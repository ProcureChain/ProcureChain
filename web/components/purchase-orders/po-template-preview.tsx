"use client";

import { BrandLogo } from "@/components/common/brand-logo";
import { formatBusinessRef, formatDate, formatMoney } from "@/lib/format";
import type { OrganizationProfile, PurchaseOrder, Requisition, Rfq, Supplier } from "@/lib/types";

type POTemplatePreviewProps = {
  po: PurchaseOrder;
  rfq?: Rfq | null;
  requisition?: Requisition | null;
  organizationProfile?: OrganizationProfile | null;
  supplier?: Supplier | null;
};

type InfoRow = { label: string; value: string };

function readMetadataString(requisition: Requisition | null | undefined, keys: string[]) {
  const metadata = requisition?.metadata as Record<string, unknown> | undefined;
  if (!metadata) return "";
  for (const key of keys) {
    const raw = metadata[key];
    if (typeof raw === "string" && raw.trim()) return raw.trim();
  }
  return "";
}

function calcTaxAmount(po: PurchaseOrder, rfq?: Rfq | null) {
  if (rfq?.taxIncluded === true) return 0;
  return 0;
}

function asDisplayValue(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : "N/A";
}

export function POTemplatePreview({ po, rfq, requisition, organizationProfile, supplier }: POTemplatePreviewProps) {
  const paymentTerms = rfq?.paymentTerms ?? "Net 30";
  const requestedDeliveryDate = requisition?.neededBy ?? "";
  const procurementCategory = po.commercialOnly ? "Service" : "Product";
  const incoterms =
    readMetadataString(requisition, ["incoterms", "incoterm", "trade_terms"]) || "DAP";
  const exchangeRate = readMetadataString(requisition, ["exchangeRate", "exchange_rate"]) || "-";

  const subtotal = (po.lineItems ?? []).reduce((sum, line) => sum + Number(line.lineTotal || 0), 0);
  const discountTotal = 0;
  const taxTotal = calcTaxAmount(po, rfq);
  const shippingCost = 0;
  const total = subtotal - discountTotal + taxTotal + shippingCost;

  const customerName = asDisplayValue(organizationProfile?.companyName);
  const customerEmail = asDisplayValue(organizationProfile?.workEmail);
  const customerPhone = asDisplayValue(organizationProfile?.phoneNumber);
  const customerContact = asDisplayValue(organizationProfile?.contactFullName);

  const supplierPrimaryContact = supplier?.contacts?.[0];
  const supplierContactName = asDisplayValue(supplierPrimaryContact?.name);
  const supplierContactEmail = asDisplayValue(supplierPrimaryContact?.email);
  const supplierContactPhone = asDisplayValue(supplierPrimaryContact?.phone);

  const rows: InfoRow[] = [
    { label: "PO Number", value: po.poNumber || "-" },
    { label: "PO Status", value: po.status || "-" },
    { label: "PO Version", value: "V1.0.0" },
    { label: "Issue Date", value: formatDate(po.releasedAt ?? po.createdAt) },
    { label: "Requested Delivery Date", value: requestedDeliveryDate ? formatDate(requestedDeliveryDate) : "-" },
    { label: "Payment Terms", value: paymentTerms },
    { label: "Currency", value: po.currency || "-" },
    { label: "Exchange Rate", value: exchangeRate },
    { label: "Procurement Category", value: procurementCategory },
    { label: "Linked Requisition ID", value: formatBusinessRef("PR", po.prId) },
    { label: "Incoterms", value: incoterms },
  ];

  return (
    <section id="po-template-printable" className="rounded-xl border border-slate-300 bg-[#f2f2f2] p-6 text-[#111]">
      <div className="mx-auto max-w-[980px] space-y-6" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
        <div className="flex justify-end">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8">
              <BrandLogo variant="mark" imageClassName="h-full w-full object-contain" />
            </div>
            <span className="text-2xl text-[#303653]">ProcureChain</span>
          </div>
        </div>

        <h2 className="text-center text-6xl font-bold tracking-tight">PURCHASE ORDER</h2>

        <div className="border-2 border-slate-300 bg-[#f2f2f2] p-4">
          <div className="grid gap-1 text-[18px] leading-[1.85]">
            {rows.map((row) => (
              <div key={row.label} className="flex flex-wrap gap-2">
                <span className="min-w-[300px] font-bold">{row.label}</span>
                <span>{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 border-2 border-slate-300">
          <div className="border-r-2 border-slate-300 p-4">
            <h3 className="mb-3 text-[24px] font-bold">CUSTOMER DETAILS</h3>
            <div className="space-y-2 text-[18px]">
              <p>{customerName}</p>
              <p>VAT Number: {asDisplayValue(organizationProfile?.registrationNumber)}</p>
              <p>Billing Address: {asDisplayValue(organizationProfile?.country)}</p>
              <p>Contact Person: {customerContact}</p>
              <p>Name: {customerContact}</p>
              <p>Email: {customerEmail}</p>
              <p>Phone: {customerPhone}</p>
            </div>
          </div>
          <div className="p-4">
            <h3 className="mb-3 text-[24px] font-bold">SUPPLIER DETAILS</h3>
            <div className="space-y-2 text-[18px]">
              <p>{asDisplayValue(supplier?.name || po.supplierName)}</p>
              <p>VAT / Tax Number: N/A</p>
              <p>Supplier Address: {asDisplayValue(supplier?.country)}</p>
              <p>Supplier Contact Person: {supplierContactName}</p>
              <p>Name: {supplierContactName}</p>
              <p>Email: {supplierContactEmail}</p>
              <p>Phone: {supplierContactPhone}</p>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-[48px] font-bold">ITEM DETAILS</h3>
          <p className="mt-1 text-[20px]">Repeatable line-item structure</p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse border-2 border-slate-300 text-[18px]">
            <thead>
              <tr>
                <th className="border border-slate-300 p-2 text-left">Item ID</th>
                <th className="border border-slate-300 p-2 text-left">Item Type</th>
                <th className="border border-slate-300 p-2 text-left">Description</th>
                <th className="border border-slate-300 p-2 text-left">Qty</th>
                <th className="border border-slate-300 p-2 text-left">UOM</th>
                <th className="border border-slate-300 p-2 text-left">Unit Price (excl. VAT)</th>
                <th className="border border-slate-300 p-2 text-left">Discount (%)</th>
                <th className="border border-slate-300 p-2 text-left">Line Total (system calculated)</th>
              </tr>
            </thead>
            <tbody>
              {(po.lineItems ?? []).map((line, index) => (
                <tr key={`${line.prLineId}-${index}`}>
                  <td className="border border-slate-300 p-2">{formatBusinessRef("ITM", line.prLineId)}</td>
                  <td className="border border-slate-300 p-2">{procurementCategory}</td>
                  <td className="border border-slate-300 p-2">{line.description || "-"}</td>
                  <td className="border border-slate-300 p-2">{line.quantity}</td>
                  <td className="border border-slate-300 p-2">{line.uom || "-"}</td>
                  <td className="border border-slate-300 p-2">{formatMoney(line.unitPrice, po.currency)}</td>
                  <td className="border border-slate-300 p-2">0%</td>
                  <td className="border border-slate-300 p-2">{formatMoney(line.lineTotal, po.currency)}</td>
                </tr>
              ))}
              {(po.lineItems ?? []).length === 0 ? (
                <tr>
                  <td className="border border-slate-300 p-2 text-center" colSpan={8}>
                    No line items
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="ml-auto w-full max-w-[520px] space-y-3 text-right text-[20px]">
          <p>Subtotal (Excl. Tax): {formatMoney(subtotal, po.currency)}</p>
          <p>Discount Total: {formatMoney(discountTotal, po.currency)}</p>
          <p>Tax Total (VAT / GST): {formatMoney(taxTotal, po.currency)}</p>
          <p>Shipping / Logistics Cost (If applicable): {formatMoney(shippingCost, po.currency)}</p>
          <p className="font-bold">Total PO Value (Incl. Tax): {formatMoney(total, po.currency)}</p>
        </div>
      </div>
    </section>
  );
}
