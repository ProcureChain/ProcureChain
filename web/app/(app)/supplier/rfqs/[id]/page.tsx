"use client";

import * as React from "react";
import Link from "next/link";

import { ApiErrorAlert } from "@/components/common/api-error-alert";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBusinessRef, formatDateTime, formatMoney } from "@/lib/format";
import { useRfq } from "@/lib/query-hooks";

type SupplierRfqDetailPageProps = {
  params: Promise<{ id: string }>;
};

function renderMetadataValue(value: unknown) {
  if (value == null || value === "") return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export default function SupplierRfqDetailPage({ params }: SupplierRfqDetailPageProps) {
  const { id } = React.use(params);
  return <SupplierRfqDetailClient id={id} />;
}

function SupplierRfqDetailClient({ id }: { id: string }) {
  const { data: rfq, error } = useRfq(id);

  if (error) {
    return (
      <div className="space-y-5">
        <PageHeader title="RFx Details" description="Supplier-side view of the RFx opportunity." />
        <ApiErrorAlert error={error} />
      </div>
    );
  }

  if (!rfq) {
    return (
      <div className="space-y-5">
        <PageHeader title="RFx Details" description="Supplier-side view of the RFx opportunity." />
        <EmptyState title="RFx not found" description="This RFx is not available to the current supplier session." />
      </div>
    );
  }

  const metadataEntries = Object.entries(rfq.prMetadata ?? {}).filter(([, value]) => value !== null && value !== "");

  return (
    <div className="space-y-5">
      <PageHeader title={rfq.title} description="Supplier-side RFx detail view for review before creating or submitting a bid." />

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href="/supplier/rfqs">Back to RFx</Link>
        </Button>
        <Button asChild size="sm">
          <Link href={`/supplier/bids?rfqId=${encodeURIComponent(rfq.id)}`}>Respond In Bids</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>RFx Summary</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-slate-600 md:grid-cols-2">
          <p><span className="font-medium text-slate-900">RFx Reference:</span> {formatBusinessRef("RFQ", rfq.id)}</p>
          <p><span className="font-medium text-slate-900">Status:</span> {rfq.status}</p>
          <p><span className="font-medium text-slate-900">Release mode:</span> {rfq.releaseMode ?? "-"}</p>
          <p><span className="font-medium text-slate-900">Updated:</span> {formatDateTime(rfq.updatedAt)}</p>
          <p><span className="font-medium text-slate-900">Budget:</span> {typeof rfq.budgetAmount === "number" ? formatMoney(rfq.budgetAmount, rfq.currency ?? "ZAR") : "-"}</p>
          <p><span className="font-medium text-slate-900">Payment terms:</span> {rfq.paymentTerms ?? "-"}</p>
          <p><span className="font-medium text-slate-900">Price validity:</span> {rfq.priceValidityDays ? `${rfq.priceValidityDays} days` : "-"}</p>
          <p><span className="font-medium text-slate-900">Tax included:</span> {typeof rfq.taxIncluded === "boolean" ? (rfq.taxIncluded ? "Yes" : "No") : "-"}</p>
          <p><span className="font-medium text-slate-900">Procurement method:</span> {rfq.procurementMethod ?? "-"}</p>
          <p><span className="font-medium text-slate-900">Procurement band:</span> {rfq.procurementBand ?? "-"}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>PR Context</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-slate-600 md:grid-cols-2">
          <p><span className="font-medium text-slate-900">PR Reference:</span> {formatBusinessRef("PR", rfq.prId)}</p>
          <p><span className="font-medium text-slate-900">Title:</span> {rfq.prTitle ?? "-"}</p>
          <p><span className="font-medium text-slate-900">Department:</span> {rfq.department ?? "-"}</p>
          <p><span className="font-medium text-slate-900">Cost centre:</span> {rfq.costCentre ?? "-"}</p>
          <p className="md:col-span-2"><span className="font-medium text-slate-900">Justification:</span> {rfq.justification ?? "-"}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Line Items</CardTitle>
        </CardHeader>
        <CardContent>
          {rfq.lines.length === 0 ? (
            <p className="text-sm text-slate-500">No line items attached.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left">
                    <th className="px-3 py-2 font-medium">Description</th>
                    <th className="px-3 py-2 font-medium">Quantity</th>
                    <th className="px-3 py-2 font-medium">UOM</th>
                    <th className="px-3 py-2 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {rfq.lines.map((line) => (
                    <tr key={line.id} className="border-b align-top">
                      <td className="px-3 py-2">{line.description}</td>
                      <td className="px-3 py-2">{line.quantity}</td>
                      <td className="px-3 py-2">{line.uom ?? "-"}</td>
                      <td className="px-3 py-2">{line.notes ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Additional Requirements</CardTitle>
        </CardHeader>
        <CardContent>
          {metadataEntries.length === 0 ? (
            <p className="text-sm text-slate-500">No additional dynamic fields captured for this RFx.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {metadataEntries.map(([key, value]) => (
                <div key={key} className="rounded-lg border p-3 text-sm">
                  <p className="font-medium text-slate-900">{key.replace(/_/g, " ")}</p>
                  <p className="mt-1 text-slate-600">{renderMetadataValue(value)}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
