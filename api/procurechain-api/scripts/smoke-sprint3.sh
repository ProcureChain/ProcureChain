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

request GET "/health"
expect_ok

if [ -z "$SUBCATEGORY_ID" ]; then
  request GET "/taxonomy/subcategories"
  expect_ok
  SUBCATEGORY_ID=$(printf '%s\n' "$RESP_BODY" | jq -r '.[0].id')
fi
require_id "SUBCATEGORY_ID" "$SUBCATEGORY_ID"
echo "SUBCATEGORY_ID=$SUBCATEGORY_ID"

# PR -> RFQ -> Award baseline
request POST "/pr" "{
  \"title\":\"Sprint3 Smoke PR\",
  \"subcategoryId\":\"$SUBCATEGORY_ID\",
  \"currency\":\"ZAR\"
}"
expect_ok
PR_ID=$(printf '%s\n' "$RESP_BODY" | jq -r '.id')
require_id "PR_ID" "$PR_ID"

echo "PR_ID=$PR_ID"

request POST "/pr/$PR_ID/lines" '{"description":"Service line","quantity":2,"unitPrice":1500}'
expect_ok
request POST "/pr/$PR_ID/submit"
expect_ok
request POST "/pr/$PR_ID/status" '{"status":"UNDER_REVIEW"}'
expect_ok
request POST "/pr/$PR_ID/status" '{"status":"APPROVED"}'
expect_ok

request POST "/suppliers" '{"name":"Sprint3 Supplier","country":"ZA"}'
expect_ok
SUPPLIER_ID=$(printf '%s\n' "$RESP_BODY" | jq -r '.id')
require_id "SUPPLIER_ID" "$SUPPLIER_ID"
echo "SUPPLIER_ID=$SUPPLIER_ID"

request POST "/rfqs" "{\"prId\":\"$PR_ID\",\"title\":\"Sprint3 RFQ\"}"
expect_ok
RFQ_ID=$(printf '%s\n' "$RESP_BODY" | jq -r '.id')
require_id "RFQ_ID" "$RFQ_ID"
echo "RFQ_ID=$RFQ_ID"

request POST "/rfqs/$RFQ_ID/suppliers" "{\"supplierIds\":[\"$SUPPLIER_ID\"]}"
expect_ok
request POST "/rfqs/$RFQ_ID/release"
expect_ok
request POST "/rfqs/$RFQ_ID/open"
expect_ok
request POST "/rfqs/$RFQ_ID/award" "{\"supplierId\":\"$SUPPLIER_ID\",\"overrideReason\":\"Best evaluated value\"}"
expect_ok

AWARD_ID=$(printf '%s\n' "$RESP_BODY" | jq -r '.award.id')
require_id "AWARD_ID" "$AWARD_ID"
echo "AWARD_ID=$AWARD_ID"

# Sprint 3: PO workflow
request POST "/pos/from-award" "{\"awardId\":\"$AWARD_ID\",\"terms\":\"Net 30\"}"
expect_ok
PO_ID=$(printf '%s\n' "$RESP_BODY" | jq -r '.id')
PO_NUMBER=$(printf '%s\n' "$RESP_BODY" | jq -r '.poNumber')
require_id "PO_ID" "$PO_ID"
require_id "PO_NUMBER" "$PO_NUMBER"
echo "PO_ID=$PO_ID"

echo "PO_NUMBER=$PO_NUMBER"

request POST "/pos/$PO_ID/release"
expect_ok
request POST "/pos/$PO_ID/respond" '{"action":"REQUEST_CHANGE","reason":"Adjust payment milestone","proposedTerms":"Net 45"}'
expect_ok
request POST "/pos/$PO_ID/release"
expect_ok
request POST "/pos/$PO_ID/respond" '{"action":"ACCEPT"}'
expect_ok

# Sprint 3: finance snapshot + validation
request POST "/finance/invoices/sync" "{
  \"sourceSystem\":\"MANUAL\",
  \"snapshots\":[
    {\"externalInvoiceId\":\"INV-$PO_ID-001\",\"poId\":\"$PO_ID\",\"poNumber\":\"$PO_NUMBER\",\"currency\":\"ZAR\",\"totalAmount\":3000,\"status\":\"POSTED\"}
  ]
}"
expect_ok

request GET "/finance/po/$PO_ID/validation"
expect_ok
MATCH_STATUS=$(printf '%s\n' "$RESP_BODY" | jq -r '.matchStatus')
if [ "$MATCH_STATUS" != "MATCH" ]; then
  echo "ERROR: expected invoice match status MATCH but got $MATCH_STATUS"
  exit 1
fi

request POST "/pos/$PO_ID/close" '{"reason":"Delivered and reconciled"}'
expect_ok
request GET "/pos/$PO_ID"
expect_ok

FINAL_PO_STATUS=$(printf '%s\n' "$RESP_BODY" | jq -r '.status')
if [ "$FINAL_PO_STATUS" != "CLOSED" ]; then
  echo "ERROR: expected PO status CLOSED but got $FINAL_PO_STATUS"
  exit 1
fi

echo -e "\nSprint 3 smoke flow completed successfully."
