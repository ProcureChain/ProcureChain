"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBusinessRef, formatMoney } from "@/lib/format";
import { Bid, Rfq } from "@/lib/types";

interface BidLineComparisonTableProps {
  rfq: Rfq;
  bids: Bid[];
}

export function BidLineComparisonTable({ rfq, bids }: BidLineComparisonTableProps) {
  if (rfq.lines.length === 0 || bids.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Line-by-Line Comparison</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {rfq.lines.map((rfqLine) => (
          <div key={rfqLine.id} className="rounded-lg border">
            <div className="border-b bg-slate-50 px-4 py-3">
              <p className="text-sm font-semibold text-slate-900">{rfqLine.description}</p>
              <p className="text-xs text-slate-500">
                Requested: {rfqLine.quantity} {rfqLine.uom ?? ""} • {formatBusinessRef("LINE", rfqLine.id)}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-white text-left">
                    <th className="px-3 py-2 font-medium">Supplier</th>
                    <th className="px-3 py-2 font-medium">Qty</th>
                    <th className="px-3 py-2 font-medium">UOM</th>
                    <th className="px-3 py-2 font-medium">Unit Price</th>
                    <th className="px-3 py-2 font-medium">Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {bids.map((bid) => {
                    const line = bid.lines?.find((entry) => entry.prLineId === rfqLine.id);
                    return (
                      <tr key={`${rfqLine.id}-${bid.id}`} className="border-b align-top">
                        <td className="px-3 py-2 font-medium">{bid.supplierName ?? formatBusinessRef("SUP", bid.supplierId)}</td>
                        <td className="px-3 py-2">{line?.quantity ?? "-"}</td>
                        <td className="px-3 py-2">{line?.uom ?? rfqLine.uom ?? "-"}</td>
                        <td className="px-3 py-2">
                          {line ? formatMoney(line.unitPrice, bid.currency ?? "ZAR") : "-"}
                        </td>
                        <td className="px-3 py-2">
                          {line ? formatMoney(line.lineTotal, bid.currency ?? "ZAR") : "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
