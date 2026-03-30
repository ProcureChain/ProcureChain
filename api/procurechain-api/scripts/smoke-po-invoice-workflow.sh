#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:8080}"
TENANT_ID="${TENANT_ID:-dev-tenant}"
COMPANY_ID="${COMPANY_ID:-dev-company}"
SUBCATEGORY_ID="${SUBCATEGORY_ID:-SER_MEA_CLEANING_M²}"

H=(-H "x-tenant-id: ${TENANT_ID}" -H "x-company-id: ${COMPANY_ID}" -H "content-type: application/json")
# Include elevated roles for SoD-gated actions in smoke flow.
H+=(-H "x-user-roles: PROCUREMENT_MANAGER,COMPLIANCE_OFFICER,PROCUREMENT_OFFICER")

request_json() {
  local method="$1"
  local path="$2"
  local body="${3:-}"
  if [[ -n "${body}" ]]; then
    curl -sS -X "${method}" "${BASE_URL}${path}" "${H[@]}" -d "${body}"
  else
    curl -sS -X "${method}" "${BASE_URL}${path}" "${H[@]}"
  fi
}

echo "==> GET /health"
curl -sS "${BASE_URL}/health" -H "x-tenant-id: ${TENANT_ID}" -H "x-company-id: ${COMPANY_ID}" | jq .

echo "==> POST /pr"
PR=$(request_json POST "/pr" "{\"title\":\"PO Invoice Smoke $(date +%s)\",\"subcategoryId\":\"${SUBCATEGORY_ID}\",\"currency\":\"ZAR\",\"department\":\"Operations\",\"costCentre\":\"OPS-001\"}")
PR_ID=$(echo "${PR}" | jq -r '.id')
echo "${PR}" | jq '{id,status,subcategoryId}'

echo "==> POST /pr/${PR_ID}/lines"
request_json POST "/pr/${PR_ID}/lines" '{"description":"Service scope line","quantity":2,"uom":"m2"}' | jq '{id,description,quantity,uom}'

echo "==> Submit/Approve PR"
request_json POST "/pr/${PR_ID}/submit" | jq '{id,status}'
request_json POST "/pr/${PR_ID}/status" '{"status":"UNDER_REVIEW"}' | jq '{id,status}'
request_json POST "/pr/${PR_ID}/status" '{"status":"APPROVED"}' | jq '{id,status}'

echo "==> Create supplier"
SUPPLIER=$(request_json POST "/suppliers" '{"name":"Workflow Smoke Supplier","country":"ZA","status":"ACTIVE","preferredCurrency":"ZAR"}')
SUPPLIER_ID=$(echo "${SUPPLIER}" | jq -r '.id')
echo "${SUPPLIER}" | jq '{id,name,status}'

echo "==> Create RFQ"
RFQ=$(request_json POST "/rfqs" "{\"prId\":\"${PR_ID}\",\"title\":\"Smoke RFQ\",\"budgetAmount\":6000,\"currency\":\"ZAR\",\"paymentTerms\":\"NET_30\",\"taxIncluded\":true,\"priceValidityDays\":30}")
RFQ_ID=$(echo "${RFQ}" | jq -r '.id')
echo "${RFQ}" | jq '{id,status,prId,budgetAmount,currency,paymentTerms,taxIncluded,priceValidityDays}'

echo "==> Add supplier to RFQ + release/open"
request_json POST "/rfqs/${RFQ_ID}/suppliers" "{\"supplierIds\":[\"${SUPPLIER_ID}\"]}" | jq '{id,status,suppliers:(.suppliers|length)}'
request_json POST "/rfqs/${RFQ_ID}/release" '{"releaseMode":"PRIVATE"}' | jq '{id,status,releaseMode}'
request_json POST "/rfqs/${RFQ_ID}/open" | jq '{id,status}'

echo "==> Create and submit bid"
BID=$(request_json POST "/bids" "{\"rfqId\":\"${RFQ_ID}\",\"supplierId\":\"${SUPPLIER_ID}\",\"currency\":\"ZAR\",\"totalBidValue\":2900,\"payload\":{\"commercial\":{\"unit_rate\":1450,\"quantity_measure\":2},\"technical\":{\"method_statement\":\"provided\"}},\"documents\":{\"proposal\":\"doc-1\"}}")
BID_ID=$(echo "${BID}" | jq -r '.id')
echo "${BID}" | jq '{id,status,rfqId,supplierId}'
request_json POST "/bids/${BID_ID}/submit" | jq '{id,status}'
request_json POST "/bids/${BID_ID}/open" | jq '{id,status}'
request_json POST "/bids/${BID_ID}/evaluate" '{"criteria":[{"criterion":"PRICE","score":90,"weight":40},{"criterion":"DELIVERY","score":85,"weight":20},{"criterion":"COMPLIANCE","score":95,"weight":25},{"criterion":"RISK","score":80,"weight":15}],"summary":"Strong response"}' | jq '{id,status,finalScore}'
request_json POST "/bids/${BID_ID}/recommend" '{"reason":"Best weighted score"}' | jq '{id,status,recommended,recommendationReason}'

echo "==> Award RFQ"
AWARDED=$(request_json POST "/rfqs/${RFQ_ID}/award" "{\"bidId\":\"${BID_ID}\",\"supplierId\":\"${SUPPLIER_ID}\",\"overrideReason\":\"Best evaluated bid\"}")
echo "${AWARDED}" | jq '{id,status,award}'
AWARD_ID=$(echo "${AWARDED}" | jq -r '.award.id')
if [[ -z "${AWARD_ID}" || "${AWARD_ID}" == "null" ]]; then
  echo "ERROR: award.id missing"
  exit 1
fi

echo "==> Create PO from award"
PO=$(request_json POST "/pos/from-award" "{\"awardId\":\"${AWARD_ID}\",\"terms\":\"Net 30\",\"notes\":\"Smoke workflow\"}")
PO_ID=$(echo "${PO}" | jq -r '.id')
echo "${PO}" | jq '{id,poNumber,status,rfqId,prId,awardId}'

echo "==> Create delivery note"
DN=$(request_json POST "/finance/po/${PO_ID}/delivery-notes" '{"remarks":"Goods/services received","documentUrl":"https://example.com/dn.pdf","receivedBy":"warehouse-user"}')
DN_ID=$(echo "${DN}" | jq -r '.id')
echo "${DN}" | jq '{id,noteNumber,status,deliveryDate}'

echo "==> Create live invoice from template"
INV=$(request_json POST "/finance/po/${PO_ID}/invoices/from-template" "{\"deliveryNoteId\":\"${DN_ID}\",\"taxIncluded\":true,\"taxRatePercent\":15,\"notes\":\"Generated from template\"}")
INV_ID=$(echo "${INV}" | jq -r '.id')
echo "${INV}" | jq '{id,invoiceNumber,status,totalAmount,taxAmount}'

echo "==> Mark invoice paid with POP"
PAID=$(request_json POST "/finance/invoices/live/${INV_ID}/mark-paid" '{"paymentReference":"EFT-123456","popUrl":"https://example.com/pop.pdf","notes":"Paid in full"}')
echo "${PAID}" | jq '{id,status,paidAt,paymentProofs:(.paymentProofs|length)}'

echo "==> Sign invoice digitally"
SIGNED=$(request_json POST "/finance/invoices/live/${INV_ID}/sign" '{"signerName":"Finance Manager","signerRole":"FINANCE_APPROVER"}')
echo "${SIGNED}" | jq '{id,status,signedAt,signature:(.signature!=null),paymentProofs:(.paymentProofs|length)}'

FINAL_STATUS=$(echo "${SIGNED}" | jq -r '.status')
if [[ "${FINAL_STATUS}" != "SIGNED" ]]; then
  echo "ERROR: expected final invoice status SIGNED, got ${FINAL_STATUS}"
  exit 1
fi

echo "✅ Smoke workflow completed: PO -> Delivery Note -> Invoice -> Paid -> Signed"
