"use client";

import { Suspense, useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { ApiErrorAlert } from "@/components/common/api-error-alert";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatBusinessRef, formatDateTime, formatMoney } from "@/lib/format";
import * as liveApi from "@/lib/api/live-api";
import * as mockApi from "@/lib/api/mock-api";
import { queryKeys, useBidAction, useRfqs, useSupplierProfile } from "@/lib/query-hooks";
import { runtimeConfig } from "@/lib/runtime-config";
import type { Bid, Rfq } from "@/lib/types";

const supplierReadApi = runtimeConfig.useMockApi ? mockApi : liveApi;

function SupplierBidsPageContent() {
  const supplierId = runtimeConfig.supplierId;
  const searchParams = useSearchParams();
  const requestedRfqId = searchParams.get("rfqId");
  const { data: rfqs = [], error } = useRfqs();
  const supplierProfile = useSupplierProfile(Boolean(supplierId));
  const bidAction = useBidAction();
  const [selectedRfq, setSelectedRfq] = useState<Rfq | null>(null);
  const [bidAmount, setBidAmount] = useState("");
  const [supplierComment, setSupplierComment] = useState("");
  const [bidFiles, setBidFiles] = useState<File[]>([]);

  const opportunities = useMemo(
    () => rfqs.filter((rfq) => rfq.status === "RELEASED" || rfq.status === "OPEN"),
    [rfqs],
  );

  const bidQueries = useQueries({
    queries: opportunities.map((rfq) => ({
      queryKey: [...queryKeys.bidsByRfq(rfq.id), runtimeConfig.portal, supplierId ?? "unknown"],
      queryFn: () => supplierReadApi.listBidsByRfq(rfq.id) as Promise<Bid[]>,
      enabled: Boolean(supplierId),
    })),
  });

  const bids = useMemo(() => {
    return opportunities
      .flatMap((rfq, index) => {
        const rows = bidQueries[index]?.data ?? [];
        return rows
          .filter((entry) => !supplierId || entry.supplierId === supplierId)
          .map((entry) => ({ bid: entry, rfq }));
      })
      .sort((a, b) => {
        const aTs = a.bid.updatedAt ?? a.bid.submittedAt ?? a.bid.createdAt ?? a.rfq.updatedAt;
        const bTs = b.bid.updatedAt ?? b.bid.submittedAt ?? b.bid.createdAt ?? b.rfq.updatedAt;
        return new Date(bTs).getTime() - new Date(aTs).getTime();
      });
  }, [bidQueries, opportunities, supplierId]);

  const requestedRfq = useMemo(
    () => opportunities.find((rfq) => rfq.id === requestedRfqId) ?? null,
    [opportunities, requestedRfqId],
  );

  const requestedRfqBid = useMemo(
    () => bids.find((row) => row.rfq.id === requestedRfqId)?.bid ?? null,
    [bids, requestedRfqId],
  );
  const verificationStatus = supplierProfile.data?.onboardingProfile?.verificationStatus ?? "PENDING";
  const canSubmitBid = verificationStatus === "VERIFIED";

  const openDraftDialog = (rfq: Rfq, bid?: Bid | null) => {
    setSelectedRfq(rfq);
    setBidAmount(String(bid?.totalBidValue ?? ""));
    setSupplierComment(typeof bid?.notes === "string" ? bid.notes : "");
    const existingFiles = Array.isArray(bid?.documents?.attachments)
      ? (bid.documents.attachments as Array<{ name?: string; type?: string; sizeBytes?: number }>)
      : [];
    setBidFiles(
      existingFiles
        .filter((entry) => typeof entry?.name === "string" && entry.name.trim().length > 0)
        .map((entry) => new File([], entry.name ?? "attachment", { type: entry.type ?? "application/octet-stream" })),
    );
  };

  const saveDraft = async () => {
    if (!selectedRfq || !supplierId) return;
    try {
      const attachments = bidFiles.map((file) => ({
        name: file.name,
        type: file.type || "application/octet-stream",
        sizeBytes: file.size,
      }));
      await bidAction.mutateAsync({
        type: "upsert",
        rfqId: selectedRfq.id,
        supplierId,
        totalBidValue: Number(bidAmount),
        notes: supplierComment.trim() || undefined,
        payload: {
          supplierComment: supplierComment.trim() || undefined,
          compliance: { supplier_documents: attachments.length > 0 },
        },
        documents: {
          attachments,
        },
        currency: "ZAR",
      });
      toast.success("Bid draft saved");
      setSelectedRfq(null);
      setBidAmount("");
      setSupplierComment("");
      setBidFiles([]);
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
      <PageHeader title="Supplier Bids" description="Only bids already started by this supplier appear here. New opportunities stay in Supplier RFx until you create a bid." />
      {error ? <ApiErrorAlert error={error} /> : null}
      {supplierProfile.error ? <ApiErrorAlert error={supplierProfile.error} /> : null}
      {bidAction.error ? <ApiErrorAlert error={bidAction.error} /> : null}
      {!canSubmitBid ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Supplier verification status is <span className="font-semibold">{verificationStatus}</span>. You can save bid drafts, but bid submission is blocked until the supplier profile is VERIFIED.
        </div>
      ) : null}

      {requestedRfq && !requestedRfqBid ? (
        <Card>
          <CardHeader>
            <CardTitle>Ready To Start Bid</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600">
            <div className="rounded-lg border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-900">{requestedRfq.title}</p>
                  <p className="text-xs text-slate-500">{formatBusinessRef("RFQ", requestedRfq.id)}</p>
                </div>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">{requestedRfq.status}</span>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <p><span className="font-medium text-slate-900">Release mode:</span> {requestedRfq.releaseMode ?? "-"}</p>
                <p><span className="font-medium text-slate-900">Updated:</span> {formatDateTime(requestedRfq.updatedAt)}</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => openDraftDialog(requestedRfq, null)}>
                  Create Bid Draft
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {bids.length === 0 ? (
        <EmptyState title="No bids started" description="Go to Supplier RFx to start a bid. This page only shows bids after you create a draft or submit a response." />
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
                    <th className="px-3 py-2 font-medium">RFx Status</th>
                    <th className="px-3 py-2 font-medium">Bid Status</th>
                    <th className="px-3 py-2 font-medium">Bid Value</th>
                    <th className="px-3 py-2 font-medium">Updated</th>
                    <th className="px-3 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bids.map(({ rfq, bid }) => (
                    <tr key={bid.id} className="border-b align-top">
                      <td className="px-3 py-2 font-medium">{rfq.title}</td>
                      <td className="px-3 py-2">{rfq.status}</td>
                      <td className="px-3 py-2">{bid.status}</td>
                      <td className="px-3 py-2">{bid.totalBidValue != null ? formatMoney(bid.totalBidValue, bid.currency) : "-"}</td>
                      <td className="px-3 py-2">{bid.updatedAt ? formatDateTime(bid.updatedAt) : bid.submittedAt ? formatDateTime(bid.submittedAt) : bid.createdAt ? formatDateTime(bid.createdAt) : formatDateTime(rfq.updatedAt)}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          {bid.status === "DRAFT" ? (
                            <>
                              <Button size="sm" variant="outline" onClick={() => openDraftDialog(rfq, bid)}>
                                Edit Draft
                              </Button>
                              <Button size="sm" disabled={!canSubmitBid} onClick={() => submitBid(bid.id)}>
                                Submit Bid
                              </Button>
                            </>
                          ) : (
                            <span className="text-xs text-slate-500">Submitted bids are locked</span>
                          )}
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

      <Dialog
        open={Boolean(selectedRfq)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedRfq(null);
            setBidAmount("");
            setSupplierComment("");
            setBidFiles([]);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedRfq ? `Bid for ${selectedRfq.title}` : "Create Bid"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="supplier-bid-amount">Bid amount</Label>
              <Input id="supplier-bid-amount" value={bidAmount} onChange={(event) => setBidAmount(event.target.value)} placeholder="Total bid value" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="supplier-bid-comment">Comments / notes</Label>
              <Textarea
                id="supplier-bid-comment"
                value={supplierComment}
                onChange={(event) => setSupplierComment(event.target.value)}
                placeholder="Add assumptions, exclusions, lead-time notes, or clarifications for the buyer."
                rows={5}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="supplier-bid-documents">Bid documents</Label>
              <Input
                id="supplier-bid-documents"
                type="file"
                multiple
                onChange={(event) => setBidFiles(Array.from(event.target.files ?? []))}
              />
              <p className="text-xs text-slate-500">
                This currently stores document metadata on the bid draft. Replace with real object storage when bid file upload is formalized.
              </p>
              {bidFiles.length > 0 ? (
                <div className="rounded-md border bg-slate-50 p-3 text-xs text-slate-700">
                  <p className="mb-2 font-medium text-slate-900">Attached documents</p>
                  <ul className="space-y-1">
                    {bidFiles.map((file) => (
                      <li key={`${file.name}-${file.size}`}>
                        {file.name} ({file.size} bytes)
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
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

export default function SupplierBidsPage() {
  return (
    <Suspense fallback={<div className="rounded-xl border bg-white p-8 text-sm text-slate-500">Loading supplier bids...</div>}>
      <SupplierBidsPageContent />
    </Suspense>
  );
}
