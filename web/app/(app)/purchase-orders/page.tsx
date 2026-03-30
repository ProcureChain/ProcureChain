"use client";

import Link from "next/link";

import { ApiErrorAlert } from "@/components/common/api-error-alert";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePos } from "@/lib/query-hooks";
import { formatDateTime, formatMoney } from "@/lib/format";

export default function PurchaseOrdersPage() {
  const { data: pos = [], error } = usePos();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Purchase Orders"
        description="Track PO creation from awards, supplier response, and downstream invoice alignment."
      />

      {error ? <ApiErrorAlert error={error} /> : null}

      {pos.length === 0 ? (
        <EmptyState title="No purchase orders yet" description="Purchase orders will appear here after RFQ award and supplier acceptance." ctaLabel="Go to RFQs" ctaHref="/rfqs" />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>PO Register</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left">
                    <th className="px-3 py-2 font-medium">PO #</th>
                    <th className="px-3 py-2 font-medium">Supplier</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Supplier Response</th>
                    <th className="px-3 py-2 font-medium">Committed Amount</th>
                    <th className="px-3 py-2 font-medium">RFQ</th>
                    <th className="px-3 py-2 font-medium">PR</th>
                    <th className="px-3 py-2 font-medium">Updated</th>
                    <th className="px-3 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pos.map((po) => (
                    <tr key={po.id} className="border-b align-top">
                      <td className="px-3 py-2 font-medium">{po.poNumber}</td>
                      <td className="px-3 py-2">{po.supplierName ?? "-"}</td>
                      <td className="px-3 py-2">{po.status}</td>
                      <td className="px-3 py-2">
                        {po.status === "ACCEPTED"
                          ? "Accepted"
                          : po.status === "CHANGE_REQUESTED"
                            ? "Change requested"
                            : po.status === "RELEASED"
                              ? "Awaiting supplier"
                              : "-"}
                      </td>
                      <td className="px-3 py-2">{formatMoney(po.committedAmount, po.currency)}</td>
                      <td className="px-3 py-2 font-mono text-xs text-slate-600">{po.rfqId}</td>
                      <td className="px-3 py-2 font-mono text-xs text-slate-600">{po.prId}</td>
                      <td className="px-3 py-2">{formatDateTime(po.updatedAt)}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/purchase-orders/${po.id}`}>Detail</Link>
                          </Button>
                          <Button asChild size="sm">
                            <Link href={`/finance?poId=${po.id}`}>Finance</Link>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
