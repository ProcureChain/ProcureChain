#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8080}"
TENANT_ID="${TENANT_ID:-dev-tenant}"
COMPANY_ID="${COMPANY_ID:-dev-company}"
SUBCATEGORY_ID="${SUBCATEGORY_ID:-}"

HDR=(-H "x-tenant-id: $TENANT_ID" -H "x-company-id: $COMPANY_ID" -H "content-type: application/json")

if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: jq is required"
  exit 1
fi

request() {
  local method="$1" path="$2" body="${3:-}"
  local out status resp_body

  echo -e "\n==> $method $path"
  if [ -n "$body" ]; then
    out=$(curl -sS -X "$method" "$BASE_URL$path" "${HDR[@]}" -d "$body" -w $'\n%{http_code}')
  else
    out=$(curl -sS -X "$method" "$BASE_URL$path" "${HDR[@]}" -w $'\n%{http_code}')
  fi

  status=$(printf '%s\n' "$out" | tail -n1)
  resp_body=$(printf '%s\n' "$out" | sed '$d')
  printf '%s\n' "$resp_body"
  echo "HTTP $status"

  RESP_BODY="$resp_body"
  RESP_STATUS="$status"
}

expect_code() {
  local expected="$1"
  if [ "$RESP_STATUS" != "$expected" ]; then
    echo "ERROR: expected HTTP $expected but got $RESP_STATUS"
    exit 1
  fi
}

expect_ok() {
  case "$RESP_STATUS" in
    200|201) ;;
    *)
      echo "ERROR: expected HTTP 200/201 but got $RESP_STATUS"
      exit 1
      ;;
  esac
}

require_id() {
  local name="$1" value="$2"
  if [ -z "$value" ] || [ "$value" = "null" ]; then
    echo "ERROR: $name resolved to '$value'"
    exit 1
  fi
}

# 0) Health (tenant headers required in current build)
request GET "/health"
expect_ok

# 1) Subcategory lookup (or override via env SUBCATEGORY_ID)
if [ -z "$SUBCATEGORY_ID" ]; then
  request GET "/taxonomy/subcategories"
  expect_ok
  SUBCATEGORY_ID=$(printf '%s\n' "$RESP_BODY" | jq -r '.[0].id')
fi
require_id "SUBCATEGORY_ID" "$SUBCATEGORY_ID"
echo "SUBCATEGORY_ID=$SUBCATEGORY_ID"

# 2) Create PR (DRAFT)
request POST "/pr" "{
  \"title\":\"Sprint2 Smoke PR\",
  \"description\":\"PR for RFQ lifecycle smoke\",
  \"subcategoryId\":\"$SUBCATEGORY_ID\",
  \"currency\":\"ZAR\"
}"
expect_ok
PR_ID=$(printf '%s\n' "$RESP_BODY" | jq -r '.id')
require_id "PR_ID" "$PR_ID"
echo "PR_ID=$PR_ID"

# 3) Add PR line (required for submit)
request POST "/pr/$PR_ID/lines" '{
  "description":"Service line 1",
  "quantity":2,
  "unitPrice":1500
}'
expect_ok

# 4) Submit PR: DRAFT -> SUBMITTED
request POST "/pr/$PR_ID/submit"
expect_ok

# 5) PR transitions: SUBMITTED -> UNDER_REVIEW -> APPROVED
request POST "/pr/$PR_ID/status" '{"status":"UNDER_REVIEW"}'
expect_ok
request POST "/pr/$PR_ID/status" '{"status":"APPROVED"}'
expect_ok

# 6) Create supplier
request POST "/suppliers" '{
  "name":"Smoke Supplier",
  "email":"smoke@supplier.test",
  "country":"ZA"
}'
expect_ok
SUPPLIER_ID=$(printf '%s\n' "$RESP_BODY" | jq -r '.id')
require_id "SUPPLIER_ID" "$SUPPLIER_ID"
echo "SUPPLIER_ID=$SUPPLIER_ID"

# 7) Create RFQ from approved PR
request POST "/rfqs" "{
  \"prId\":\"$PR_ID\",
  \"title\":\"Smoke RFQ\",
  \"notes\":\"Lifecycle test\"
}"
expect_ok
RFQ_ID=$(printf '%s\n' "$RESP_BODY" | jq -r '.id')
require_id "RFQ_ID" "$RFQ_ID"
echo "RFQ_ID=$RFQ_ID"

# 8) Negative check: release without supplier should fail (400)
request POST "/rfqs/$RFQ_ID/release"
expect_code 400

# 9) Add supplier to RFQ
request POST "/rfqs/$RFQ_ID/suppliers" "{
  \"supplierIds\":[\"$SUPPLIER_ID\"]
}"
expect_ok

# 10) RFQ lifecycle: DRAFT -> RELEASED -> OPEN
request POST "/rfqs/$RFQ_ID/release"
expect_ok
request POST "/rfqs/$RFQ_ID/open"
expect_ok

# 11) Negative check: award without overrideReason should fail (400)
request POST "/rfqs/$RFQ_ID/award" "{
  \"supplierId\":\"$SUPPLIER_ID\",
  \"overrideReason\":\"\"
}"
expect_code 400

# 12) Award RFQ: OPEN -> AWARDED
request POST "/rfqs/$RFQ_ID/award" "{
  \"supplierId\":\"$SUPPLIER_ID\",
  \"overrideReason\":\"Best evaluated value\",
  \"notes\":\"Smoke award\"
}"
expect_ok

# 13) Close RFQ: AWARDED -> CLOSED
request POST "/rfqs/$RFQ_ID/close" '{}'
expect_ok

# 14) Final readback
request GET "/rfqs/$RFQ_ID"
expect_ok
request GET "/pr/$PR_ID"
expect_ok

echo -e "\nSmoke flow completed successfully."
