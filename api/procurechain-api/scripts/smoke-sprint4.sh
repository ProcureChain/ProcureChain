#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8080}"
TENANT_ID="${TENANT_ID:-dev-tenant}"
COMPANY_ID="${COMPANY_ID:-dev-company}"
SUBCATEGORY_ID="${SUBCATEGORY_ID:-PRO-SRV-CON-001}"
COUNTRY_CODE="${COUNTRY_CODE:-ZA}"

HDR=(-H "x-tenant-id: $TENANT_ID" -H "x-company-id: $COMPANY_ID" -H "content-type: application/json")

if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: jq is required"
  exit 1
fi

request() {
  local method="$1" path="$2"
  local out status resp_body

  echo -e "\n==> $method $path"
  out=$(curl -sS -X "$method" "$BASE_URL$path" "${HDR[@]}" -w $'\n%{http_code}')
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

request GET "/taxonomy/integrity"
expect_ok
COMPLETE=$(printf '%s\n' "$RESP_BODY" | jq -r '.taxonomy.complete')
if [ "$COMPLETE" != "true" ]; then
  echo "ERROR: taxonomy integrity not complete"
  exit 1
fi

request GET "/taxonomy/effective-config?subcategoryId=$SUBCATEGORY_ID"
expect_ok
BASE_SOURCE=$(printf '%s\n' "$RESP_BODY" | jq -r '.resolvedFrom')
if [ "$BASE_SOURCE" != "base" ]; then
  echo "ERROR: expected base resolution without country, got $BASE_SOURCE"
  exit 1
fi

request GET "/taxonomy/effective-config?subcategoryId=$SUBCATEGORY_ID&country=$COUNTRY_CODE"
expect_ok
OVERLAY_SOURCE=$(printf '%s\n' "$RESP_BODY" | jq -r '.resolvedFrom')
if [ "$OVERLAY_SOURCE" != "country_overlay" ] && [ "$OVERLAY_SOURCE" != "base" ]; then
  echo "ERROR: unexpected resolution source: $OVERLAY_SOURCE"
  exit 1
fi

for key in prFormKey rfqFormKey bidFormKey prRulePackKey rfqRulePackKey bidRulePackKey; do
  VALUE=$(printf '%s\n' "$RESP_BODY" | jq -r ".keys.${key}")
  if [ -z "$VALUE" ] || [ "$VALUE" = "null" ]; then
    echo "ERROR: resolved key $key is empty"
    exit 1
  fi
done

echo -e "\nSprint 4 smoke flow completed successfully."
