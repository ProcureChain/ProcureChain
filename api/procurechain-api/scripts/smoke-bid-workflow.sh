#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8080}"
TENANT_ID="${TENANT_ID:-dev-tenant}"
COMPANY_ID="${COMPANY_ID:-dev-company}"
SUBCATEGORY_ID="${SUBCATEGORY_ID:-FAC-SRV-MNT-001}"

HDR=(-H "x-tenant-id: $TENANT_ID" -H "x-company-id: $COMPANY_ID" -H "content-type: application/json")

if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: jq is required"
  exit 1
fi

request() {
  local method="$1" path="$2" body="${3:-}"
  if [ "$#" -ge 3 ]; then
    shift 3
  else
    shift 2
  fi
  local out status resp_body

  echo -e "\n==> $method $path"
  if [ -n "$body" ]; then
    out=$(curl -sS -X "$method" "$BASE_URL$path" "${HDR[@]}" "$@" -d "$body" -w $'\n%{http_code}')
  else
    out=$(curl -sS -X "$method" "$BASE_URL$path" "${HDR[@]}" "$@" -w $'\n%{http_code}')
  fi

  status=$(printf '%s\n' "$out" | tail -n1)
  resp_body=$(printf '%s\n' "$out" | sed '$d')
  printf '%s\n' "$resp_body"
  echo "HTTP $status"

  RESP_BODY="$resp_body"
  RESP_STATUS="$status"
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

require_non_empty() {
  local name="$1" value="$2"
  if [ -z "$value" ] || [ "$value" = "null" ]; then
    echo "ERROR: $name resolved to '$value'"
    exit 1
  fi
}

request GET "/health"
expect_ok

request POST "/pr" "{\"title\":\"Bid Smoke PR\",\"subcategoryId\":\"$SUBCATEGORY_ID\",\"currency\":\"ZAR\",\"metadata\":{\"serviceBlend\":\"ops-60-tech-40\"}}"
expect_ok
PR_ID=$(printf '%s\n' "$RESP_BODY" | jq -r '.id')
require_non_empty "PR_ID" "$PR_ID"

request POST "/pr/$PR_ID/lines" '{"description":"Bid scope line","quantity":2,"uom":"service-unit"}'
expect_ok
request POST "/pr/$PR_ID/submit" '{}'
expect_ok
request POST "/pr/$PR_ID/status" '{"status":"UNDER_REVIEW"}'
expect_ok
request POST "/pr/$PR_ID/status" '{"status":"APPROVED"}'
expect_ok

request POST "/suppliers" '{"name":"Bid Smoke Supplier","country":"ZA"}'
expect_ok
SUPPLIER_ID=$(printf '%s\n' "$RESP_BODY" | jq -r '.id')
require_non_empty "SUPPLIER_ID" "$SUPPLIER_ID"

request POST "/rfqs" "{\"prId\":\"$PR_ID\",\"title\":\"Bid Smoke RFQ\",\"budgetAmount\":6000,\"currency\":\"ZAR\",\"paymentTerms\":\"NET_30\",\"taxIncluded\":true,\"priceValidityDays\":30,\"metadata\":{\"hybridAllocation\":\"ops-60-tech-40\"}}"
expect_ok
RFQ_ID=$(printf '%s\n' "$RESP_BODY" | jq -r '.id')
require_non_empty "RFQ_ID" "$RFQ_ID"

request POST "/rfqs/$RFQ_ID/suppliers" "{\"supplierIds\":[\"$SUPPLIER_ID\"]}"
expect_ok
request POST "/rfqs/$RFQ_ID/release" '{}'
expect_ok
request POST "/rfqs/$RFQ_ID/open" '{}'
expect_ok

request POST "/bids" "{\"rfqId\":\"$RFQ_ID\",\"supplierId\":\"$SUPPLIER_ID\",\"totalBidValue\":2900,\"payload\":{\"compliance\":{\"supplier_documents\":true},\"hybrid\":{\"blendJustification\":\"balanced labour+maintenance model\"}},\"documents\":{\"proposal\":\"doc-1\"}}"
expect_ok
BID_ID=$(printf '%s\n' "$RESP_BODY" | jq -r '.id')
require_non_empty "BID_ID" "$BID_ID"

request POST "/bids/$BID_ID/submit" '{}'
expect_ok
request POST "/bids/$BID_ID/open" '{}'
expect_ok
request POST "/bids/$BID_ID/evaluate" '{"criteria":[{"criterion":"PRICE","score":82,"weight":35},{"criterion":"DELIVERY","score":75,"weight":25},{"criterion":"COMPLIANCE","score":90,"weight":20},{"criterion":"RISK","score":70,"weight":20}],"summary":"balanced bid"}' -H "x-user-id: evaluator-1" -H "x-user-roles: EVALUATOR"
expect_ok
request POST "/bids/$BID_ID/recommend" '{"reason":"Best weighted score and compliance"}' -H "x-user-id: manager-1" -H "x-user-roles: PROCUREMENT_MANAGER"
expect_ok

request POST "/rfqs/$RFQ_ID/award" "{\"bidId\":\"$BID_ID\",\"supplierId\":\"$SUPPLIER_ID\",\"overrideReason\":\"Award based on evaluation pack\"}" -H "x-user-id: manager-1" -H "x-user-roles: PROCUREMENT_MANAGER"
expect_ok
AWARD_ID=$(printf '%s\n' "$RESP_BODY" | jq -r '.award.id')
require_non_empty "AWARD_ID" "$AWARD_ID"

request POST "/governance/exports/bid_opening_record" '{"format":"CSV"}'
expect_ok
request POST "/governance/exports/evaluation_pack" '{"format":"CSV"}'
expect_ok

echo -e "\nBid workflow smoke flow completed successfully."
