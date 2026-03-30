#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8080}"
TENANT_ID="${TENANT_ID:-dev-tenant}"
COMPANY_ID="${COMPANY_ID:-dev-company}"

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

# 1) Integrity baseline should include configs, families and required-field rules
request GET "/taxonomy/integrity"
expect_ok
COMPLETE=$(printf '%s\n' "$RESP_BODY" | jq -r '.taxonomy.complete')
REQ_COUNT=$(printf '%s\n' "$RESP_BODY" | jq -r '.taxonomy.requiredFieldCount')
if [ "$COMPLETE" != "true" ]; then
  echo "ERROR: taxonomy/rules integrity is not complete"
  exit 1
fi
if [ "$REQ_COUNT" = "0" ] || [ "$REQ_COUNT" = "null" ]; then
  echo "ERROR: required-field rule count is zero"
  exit 1
fi

# 2) Validate BID payload and family hooks for one subcategory per family
check_family() {
  local subcategory="$1"
  local family="$2"
  local bid_payload="$3"

  request POST "/rules/validate/bid" "{\"subcategoryId\":\"$subcategory\",\"payload\":$bid_payload}"
  expect_ok
  VALID=$(printf '%s\n' "$RESP_BODY" | jq -r '.valid')
  if [ "$VALID" != "true" ]; then
    echo "ERROR: bid payload validation failed for $subcategory"
    exit 1
  fi

  request GET "/rules/family-hooks?subcategoryId=$subcategory&type=evaluation"
  expect_ok
  GOT_FAMILY=$(printf '%s\n' "$RESP_BODY" | jq -r '.family')
  if [ "$GOT_FAMILY" != "$family" ]; then
    echo "ERROR: expected family $family for $subcategory, got $GOT_FAMILY"
    exit 1
  fi

  CHECKS=$(printf '%s\n' "$RESP_BODY" | jq -r '.checks | length')
  if [ "$CHECKS" = "0" ] || [ "$CHECKS" = "null" ]; then
    echo "ERROR: no evaluation checks returned for $subcategory"
    exit 1
  fi
}

check_family "IT-SW-LIC-001" "MEASURABLE" '{"pricing":{"totalBidValue":1000}}'
check_family "IT-SW-SUB-001" "LABOUR" '{"team":{"namedResources":["res-1"]}}'
check_family "IT-HW-END-001" "PROFESSIONAL" '{"approach":{"methodStatement":"detailed"}}'
check_family "IT-HW-PER-001" "MAINTENANCE" '{"maintenance":{"responseCommitment":"4h"}}'
check_family "FAC-SRV-CLN-001" "PROJECT" '{"project":{"workBreakdown":"WBS-v1"}}'
check_family "FAC-SRV-MNT-001" "HYBRID" '{"hybrid":{"blendJustification":"blended model"}}'

# 3) End-to-end HYBRID path through PR -> RFQ -> Award -> PO -> Invoice validation hooks
request POST "/pr" '{"title":"Sprint5 Hybrid PR","subcategoryId":"FAC-SRV-MNT-001","currency":"ZAR","metadata":{"serviceBlend":"40-60"}}'
expect_ok
PR_ID=$(printf '%s\n' "$RESP_BODY" | jq -r '.id')
require_non_empty "PR_ID" "$PR_ID"

request POST "/pr/$PR_ID/lines" '{"description":"Hybrid service line","quantity":2,"unitPrice":1500}'
expect_ok
request POST "/pr/$PR_ID/submit"
expect_ok
request POST "/pr/$PR_ID/status" '{"status":"UNDER_REVIEW"}'
expect_ok
request POST "/pr/$PR_ID/status" '{"status":"APPROVED"}'
expect_ok

request POST "/suppliers" '{"name":"Sprint5 Supplier","country":"ZA"}'
expect_ok
SUPPLIER_ID=$(printf '%s\n' "$RESP_BODY" | jq -r '.id')
require_non_empty "SUPPLIER_ID" "$SUPPLIER_ID"

request POST "/rfqs" "{\"prId\":\"$PR_ID\",\"title\":\"Sprint5 Hybrid RFQ\",\"metadata\":{\"hybridAllocation\":\"ops-60-tech-40\"}}"
expect_ok
RFQ_ID=$(printf '%s\n' "$RESP_BODY" | jq -r '.id')
require_non_empty "RFQ_ID" "$RFQ_ID"

request POST "/rfqs/$RFQ_ID/suppliers" "{\"supplierIds\":[\"$SUPPLIER_ID\"]}"
expect_ok
request POST "/rfqs/$RFQ_ID/release"
expect_ok
request POST "/rfqs/$RFQ_ID/open"
expect_ok
request POST "/rfqs/$RFQ_ID/award" "{\"supplierId\":\"$SUPPLIER_ID\",\"overrideReason\":\"Hybrid best value\"}"
expect_ok
AWARD_ID=$(printf '%s\n' "$RESP_BODY" | jq -r '.award.id')
require_non_empty "AWARD_ID" "$AWARD_ID"

request POST "/pos/from-award" "{\"awardId\":\"$AWARD_ID\",\"terms\":\"Net 30\"}"
expect_ok
PO_ID=$(printf '%s\n' "$RESP_BODY" | jq -r '.id')
PO_NUMBER=$(printf '%s\n' "$RESP_BODY" | jq -r '.poNumber')
require_non_empty "PO_ID" "$PO_ID"
require_non_empty "PO_NUMBER" "$PO_NUMBER"

request POST "/pos/$PO_ID/release"
expect_ok
request POST "/pos/$PO_ID/respond" '{"action":"ACCEPT"}'
expect_ok

request POST "/finance/invoices/sync" "{\"sourceSystem\":\"MANUAL\",\"snapshots\":[{\"externalInvoiceId\":\"INV-$PO_ID-001\",\"poId\":\"$PO_ID\",\"poNumber\":\"$PO_NUMBER\",\"currency\":\"ZAR\",\"totalAmount\":3000,\"status\":\"POSTED\"}]}"
expect_ok

request GET "/finance/po/$PO_ID/validation"
expect_ok
MATCH_STATUS=$(printf '%s\n' "$RESP_BODY" | jq -r '.matchStatus')
SERVICE_FAMILY=$(printf '%s\n' "$RESP_BODY" | jq -r '.serviceFamily')
HOOK_COUNT=$(printf '%s\n' "$RESP_BODY" | jq -r '.familyInvoiceHooks.checks | length')
if [ "$MATCH_STATUS" != "MATCH" ]; then
  echo "ERROR: expected MATCH, got $MATCH_STATUS"
  exit 1
fi
if [ "$SERVICE_FAMILY" != "HYBRID" ]; then
  echo "ERROR: expected serviceFamily HYBRID, got $SERVICE_FAMILY"
  exit 1
fi
if [ "$HOOK_COUNT" = "0" ] || [ "$HOOK_COUNT" = "null" ]; then
  echo "ERROR: no invoice hooks returned"
  exit 1
fi

echo -e "\nSprint 5 smoke flow completed successfully."
