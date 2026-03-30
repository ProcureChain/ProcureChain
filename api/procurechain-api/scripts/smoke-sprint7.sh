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

# 1) health + new audit events
request GET "/health"
expect_ok

request POST "/audit/test" '{}'
expect_ok
request POST "/audit/test" '{}'
expect_ok

# 2) retention policy and run
request GET "/governance/retention/policy"
expect_ok

request PUT "/governance/retention/policy" '{"auditRetentionDays":3650,"enforceImmutability":true,"allowPurge":false}'
expect_ok

request POST "/governance/retention/run" '{"dryRun":true}'
expect_ok
MODE=$(printf '%s\n' "$RESP_BODY" | jq -r '.mode')
if [ "$MODE" != "CHECK_ONLY" ] && [ "$MODE" != "PURGE_MUTABLE_ONLY" ]; then
  echo "ERROR: unexpected retention run mode $MODE"
  exit 1
fi

# 3) audit evidence check
request GET "/governance/audit/evidence?limit=500"
expect_ok
VALID=$(printf '%s\n' "$RESP_BODY" | jq -r '.valid')
if [ "$VALID" != "true" ]; then
  echo "ERROR: audit evidence chain invalid"
  exit 1
fi

# 4) required government exports (CSV)
for t in tender_register bid_opening_record evaluation_pack award_report_notice coi_register retention_log; do
  request POST "/governance/exports/$t" '{"format":"CSV"}'
  expect_ok
  HASH=$(printf '%s\n' "$RESP_BODY" | jq -r '.hashReference')
  if [[ "$HASH" != sha256:* ]]; then
    echo "ERROR: invalid hashReference for $t => $HASH"
    exit 1
  fi
done

# 5) one PDF snapshot
request POST "/governance/exports/tender_register" '{"format":"PDF"}'
expect_ok
PDF_HASH=$(printf '%s\n' "$RESP_BODY" | jq -r '.hashReference')
if [[ "$PDF_HASH" != sha256:* ]]; then
  echo "ERROR: invalid PDF hashReference"
  exit 1
fi

# 6) export registry listing
request GET "/governance/exports?limit=20"
expect_ok
COUNT=$(printf '%s\n' "$RESP_BODY" | jq -r 'length')
if [ "$COUNT" -lt 7 ]; then
  echo "ERROR: expected at least 7 governance exports, got $COUNT"
  exit 1
fi

echo -e "\nSprint 7 smoke flow completed successfully."
