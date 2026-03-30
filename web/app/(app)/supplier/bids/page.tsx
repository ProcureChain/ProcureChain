"use client";

import { useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { toast } from "sonner";

import { ApiErrorAlert } from "@/components/common/api-error-alert";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateTime } from "@/lib/format";
import * as liveApi from "@/lib/api/live-api";
import * as mockApi from "@/lib/api/mock-api";
import { queryKeys, useBidAction, useRfqs } from "@/lib/query-hooks";
import { runtimeConfig } from "@/lib/runtime-config";
import type { Bid, Rfq } from "@/lib/types";

const supplierReadApi = runtimeConfig.useMockApi ? mockApi : liveApi;

export default function SupplierBidsPage() {
  const supplierId = runtimeConfig.supplierId;
  const { data: rfqs = [], error } = useRfqs();
  const bidAction = useBidAction();
  const [selectedRfq, setSelectedRfq] = useState<Rfq | null>(null);
  const [bidAmount, setBidAmount] = useState("");

  const opportunities = useMemo(
    () => rfqs.filter((rfq) => rfq.status === "RELEASED" || rfq.status === "OPEN"),
    [rfqs],
  );

  const bidQueries = useQueries({
    queries: opportunities.map((rfq) => ({
      queryKey: [...queryKeys.bidsByRfq(rfq.id), runtimeConfig.portal, supplierId ?? "unknown"],
      queryFn: () => supplierReadApi.listBidsByRfq(rfq.id) as Promise<Bid[]>,
    })),
  });

  const rows = opportunities.map((rfq, index) => {
    const bid = (bidQueries[index]?.data ?? []).find((entry) => !supplierId || entry.supplierId === supplierId);
    return { rfq, bid };
  });

  const saveDraft = async () => {
    if (!selectedRfq || !supplierId) return;
    try {
      await bidAction.mutateAsync({
        type: "upsert",
        rfqId: selectedRfq.id,
        supplierId,
        totalBidValue: Number(bidAmount),
      });
      toast.success("Bid draft saved");
      setSelectedRfq(null);
      setBidAmount("");
    } catch (err) {
      console.error(err);
      toast.error("Bid draft save failed");
    }
  };

  const submitBid = async (bidId: string) => {
    try {
      await bidAction.mutateAsync({ type: "submit", bidId });
      toast.success("Bid submitted");
    } catch (err) {
      console.error(err);
      toast.error("Bid submission failed");
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Supplier Bids" description="Create, manage, and submit supplier bids for linked RFx opportunities." />
      {error ? <ApiErrorAlert error={error} /> : null}
      {bidAction.error ? <ApiErrorAlert error={bidAction.error} /> : null}

      {rows.length === 0 ? (
        <EmptyState title="No bid opportunities" description="When an RFx is released to this supplier, it will appear here for bid preparation and submission." />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Bid Worklist</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left">
                    <th className="px-3 py-2 font-medium">RFx</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Bid Status</th>
                    <th className="px-3 py-2 font-medium">Bid Value</th>
                    <th className="px-3 py-2 font-medium">Updated</th>
                    <th className="px-3 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ rfq, bid }) => (
                    <tr key={rfq.id} className="border-b align-top">
                      <td className="px-3 py-2 font-medium">{rfq.title}</td>
                      <td className="px-3 py-2">{rfq.status}</td>
                      <td className="px-3 py-2">{bid?.status ?? "Not started"}</td>
                      <td className="px-3 py-2">{bid?.totalBidValue ?? "-"}</td>
                      <td className="px-3 py-2">{formatDateTime(rfq.updatedAt)}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedRfq(rfq);
                              setBidAmount(String(bid?.totalBidValue ?? ""));
                            }}
                          >
                            {bid ? "Edit Draft" : "Create Draft"}
                          </Button>
                          {bid?.status === "DRAFT" ? (
                            <Button size="sm" onClick={() => submitBid(bid.id)}>
                              Submit Bid
                            </Button>
                          ) : null}
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

      <Dialog open={Boolean(selectedRfq)} onOpenChange={(open) => !open && setSelectedRfq(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedRfq ? `Bid for ${selectedRfq.title}` : "Create Bid"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="supplier-bid-amount">Bid amount</Label>
              <Input id="supplier-bid-amount" value={bidAmount} onChange={(event) => setBidAmount(event.target.value)} placeholder="Total bid value" />
            </div>
            <Button className="w-full" disabled={!selectedRfq || !supplierId || !Number(bidAmount)} onClick={saveDraft}>
              Save Bid Draft
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
