"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBusinessRef, formatMoney } from "@/lib/format";
import { Bid } from "@/lib/types";

interface BidComparisonBarChartProps {
  bids: Bid[];
  supplierMeta?: Record<string, { countryLabel?: string; countryCode?: string }>;
}

export function BidComparisonBarChart({ bids, supplierMeta = {} }: BidComparisonBarChartProps) {
  const chartData = bids
    .map((bid) => ({
      id: bid.id,
      supplierId: bid.supplierId,
      supplierLabel: bid.supplierName ?? formatBusinessRef("SUP", bid.supplierId),
      value: Number(bid.totalBidValue ?? 0),
      currency: bid.currency ?? "ZAR",
    }))
    .filter((bid) => Number.isFinite(bid.value) && bid.value > 0)
    .sort((a, b) => b.value - a.value);

  if (chartData.length === 0) {
    return null;
  }

  const maxValue = Math.max(...chartData.map((bid) => bid.value), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bid Comparison Chart</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {chartData.map((bid) => {
          const width = Math.max((bid.value / maxValue) * 100, 8);
          const country = supplierMeta[bid.supplierId]?.countryLabel;
          const countryCode = supplierMeta[bid.supplierId]?.countryCode;
          return (
            <div key={bid.id} className="space-y-1.5 rounded-xl border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <span className="block truncate font-medium text-slate-800">{bid.supplierLabel}</span>
                  <span className="flex items-center gap-1 text-xs text-slate-500">
                    {countryCode ? (
                      <img
                        src={`https://flagcdn.com/24x18/${countryCode.toLowerCase()}.png`}
                        alt={countryCode}
                        className="h-3 w-4 rounded-[2px] object-cover"
                      />
                    ) : null}
                    <span>{countryCode || country || "Country N/A"}</span>
                  </span>
                </div>
                <div className="text-right">
                  <span className="block text-slate-700">{formatMoney(bid.value, bid.currency)}</span>
                  <span className="text-xs text-slate-500">Rank #{chartData.findIndex((entry) => entry.id === bid.id) + 1}</span>
                </div>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 transition-all"
                  style={{ width: `${width}%` }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
