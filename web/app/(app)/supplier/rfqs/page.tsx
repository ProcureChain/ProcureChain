"use client";

import Link from "next/link";
import { useMemo } from "react";

import { ApiErrorAlert } from "@/components/common/api-error-alert";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";
import { useRfqs } from "@/lib/query-hooks";

export default function SupplierRfqsPage() {
  const { data: rfqs = [], error } = useRfqs();
  const opportunities = useMemo(
    () => rfqs.filter((rfq) => rfq.status === "RELEASED" || rfq.status === "OPEN").sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [rfqs],
  );

  return (
    <div className="space-y-5">
      <PageHeader title="Supplier RFx" description="Released and open RFx opportunities assigned to this supplier." />
      {error ? <ApiErrorAlert error={error} /> : null}

      {opportunities.length === 0 ? (
        <EmptyState title="No active RFx opportunities" description="Released and open opportunities will appear here when your supplier profile is invited." />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>RFx Opportunities</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {opportunities.map((rfq) => (
              <div key={rfq.id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{rfq.title}</p>
                    <p className="text-xs text-slate-500">{rfq.id}</p>
                  </div>
                  <Badge variant="secondary">{rfq.status}</Badge>
                </div>
                <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-2">
                  <p><span className="font-medium text-slate-900">Release mode:</span> {rfq.releaseMode ?? "-"}</p>
                  <p><span className="font-medium text-slate-900">Updated:</span> {formatDateTime(rfq.updatedAt)}</p>
                  <p><span className="font-medium text-slate-900">Currency:</span> {rfq.currency ?? "-"}</p>
                  <p><span className="font-medium text-slate-900">Invited suppliers:</span> {rfq.suppliers.length}</p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button asChild size="sm">
                    <Link href="/supplier/bids">Respond In Bids</Link>
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
