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

expect_status() {
  local expected="$1"
  if [ "$RESP_STATUS" != "$expected" ]; then
    echo "ERROR: expected HTTP $expected but got $RESP_STATUS"
    exit 1
  fi
}

require_non_empty() {
  local name="$1" value="$2"
  if [ -z "$value" ] || [ "$value" = "null" ]; then
    echo "ERROR: $name resolved to '$value'"
    exit 1
  fi
}

# Health
request GET "/health"
expect_ok

# 1) Set strict procurement policy
request PUT "/policies/procurement" '{"lowThreshold":1000,"midThreshold":5000,"lowMethod":"LOW_VALUE_QUOTATION","midMethod":"LIMITED_TENDER","highMethod":"OPEN_TENDER","emergencyEnabled":true,"requireEmergencyJustification":true}'
expect_ok

# 2) Create PR in MID threshold band (line total 3000)
request POST "/pr" "{\"title\":\"Sprint6 Policy PR\",\"subcategoryId\":\"$SUBCATEGORY_ID\",\"currency\":\"ZAR\",\"metadata\":{\"serviceBlend\":\"ops-60-tech-40\"}}"
expect_ok
PR_ID=$(printf '%s\n' "$RESP_BODY" | jq -r '.id')
require_non_empty "PR_ID" "$PR_ID"

request POST "/pr/$PR_ID/lines" '{"description":"Sprint6 line","quantity":2,"unitPrice":1500}'
expect_ok
request POST "/pr/$PR_ID/submit" '{}'
expect_ok
request POST "/pr/$PR_ID/status" '{"status":"UNDER_REVIEW"}'
expect_ok
request POST "/pr/$PR_ID/status" '{"status":"APPROVED"}'
expect_ok

# 3) Supplier + policy mismatch check on RFQ create
request POST "/suppliers" '{"name":"Sprint6 Supplier","country":"ZA"}'
expect_ok
SUPPLIER_ID=$(printf '%s\n' "$RESP_BODY" | jq -r '.id')
require_non_empty "SUPPLIER_ID" "$SUPPLIER_ID"

request POST "/rfqs" "{\"prId\":\"$PR_ID\",\"title\":\"Sprint6 RFQ Wrong Method\",\"procurementMethod\":\"LOW_VALUE_QUOTATION\",\"metadata\":{\"hybridAllocation\":\"ops-60-tech-40\"}}"
expect_status 400

request POST "/rfqs" "{\"prId\":\"$PR_ID\",\"title\":\"Sprint6 RFQ\",\"procurementMethod\":\"LIMITED_TENDER\",\"metadata\":{\"hybridAllocation\":\"ops-60-tech-40\"}}"
expect_ok
RFQ_ID=$(printf '%s\n' "$RESP_BODY" | jq -r '.id')
require_non_empty "RFQ_ID" "$RFQ_ID"

# 4) SoD + COI flow
request POST "/rfqs/$RFQ_ID/suppliers" "{\"supplierIds\":[\"$SUPPLIER_ID\"]}"
expect_ok
request POST "/rfqs/$RFQ_ID/release" '{}'
expect_ok
request POST "/rfqs/$RFQ_ID/open" '{}'
expect_ok

request POST "/compliance/rfqs/$RFQ_ID/coi" "{\"supplierId\":\"$SUPPLIER_ID\",\"reason\":\"Potential related-party conflict\"}"
expect_ok
COI_ID=$(printf '%s\n' "$RESP_BODY" | jq -r '.id')
require_non_empty "COI_ID" "$COI_ID"

# Award with role not allowed by default SoD matrix
request POST "/rfqs/$RFQ_ID/award" "{\"supplierId\":\"$SUPPLIER_ID\",\"overrideReason\":\"Best value\"}" -H "x-user-id: sprint6-officer" -H "x-user-roles: PROCUREMENT_OFFICER"
expect_status 403

# COI compliance approval
request PUT "/compliance/coi/$COI_ID/review" '{"decision":"APPROVED","reviewNotes":"Mitigation in place"}' -H "x-user-id: sprint6-compliance" -H "x-user-roles: COMPLIANCE_OFFICER"
expect_ok

# Award with allowed role + resolved COI
request POST "/rfqs/$RFQ_ID/award" "{\"supplierId\":\"$SUPPLIER_ID\",\"overrideReason\":\"Best value\"}" -H "x-user-id: sprint6-manager" -H "x-user-roles: PROCUREMENT_MANAGER"
expect_ok

AWARD_ID=$(printf '%s\n' "$RESP_BODY" | jq -r '.award.id')
require_non_empty "AWARD_ID" "$AWARD_ID"

echo -e "\nSprint 6 smoke flow completed successfully."
