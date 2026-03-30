"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";

import { ApiErrorAlert } from "@/components/common/api-error-alert";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDateTime } from "@/lib/format";
import { useBidsByRfq, usePos, useRfqAction, useRfqs } from "@/lib/query-hooks";
import { Bid } from "@/lib/types";

const bidStatusLabel = (status: string) => {
  switch (status) {
    case "DRAFT":
      return "In Progress";
    case "SUBMITTED":
    case "OPENED":
    case "UNDER_EVALUATION":
    case "SHORTLISTED":
    case "AWARD_RECOMMENDED":
      return "Received";
    case "CLOSED":
      return "Awarded";
    case "REJECTED":
      return "Unsuccessful";
    default:
      return status;
  }
};

export function BidsPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialRfqId = searchParams.get("rfqId") ?? "";
  const [rfqId, setRfqId] = useState(initialRfqId);
  const [awardCandidate, setAwardCandidate] = useState<Bid | null>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [awardError, setAwardError] = useState<unknown>(null);

  const { data: rfqs = [], error: rfqError } = useRfqs();
  const { data: bids = [], error: bidsError } = useBidsByRfq(rfqId);
  const { refetch: refetchPos } = usePos();
  const rfqAction = useRfqAction();

  const comparableRfqs = useMemo(
    () =>
      rfqs
        .filter((rfq) => ["RELEASED", "OPEN", "AWARDED"].includes(rfq.status))
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [rfqs],
  );
  const selectedRfq = comparableRfqs.find((rfq) => rfq.id === rfqId) ?? null;

  useEffect(() => {
    if (rfqId || comparableRfqs.length === 0) return;
    setRfqId(comparableRfqs[0].id);
  }, [comparableRfqs, rfqId]);

  const submitAward = async () => {
    if (!selectedRfq || !awardCandidate) return;
    try {
      setAwardError(null);
      await rfqAction.mutateAsync({
        type: "award",
        rfqId: selectedRfq.id,
        bidId: awardCandidate.id,
        supplierId: awardCandidate.supplierId,
        overrideReason: overrideReason.trim(),
      });
      const posResult = await refetchPos();
      const matchingPo = (posResult.data ?? [])
        .filter((po) => po.rfqId === selectedRfq.id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      setAwardCandidate(null);
      setOverrideReason("");
      if (matchingPo) {
        router.push(`/purchase-orders/${matchingPo.id}`);
        return;
      }
      router.push("/purchase-orders");
    } catch (error) {
      setAwardError(error);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Bids"
        description="Compare supplier bids side by side for a single RFQ."
        actions={
          selectedRfq ? (
            <Button asChild>
              <Link href={`/rfqs/${selectedRfq.id}`}>Go to RFQ</Link>
            </Button>
          ) : null
        }
      />

      {rfqError ? <ApiErrorAlert error={rfqError} /> : null}
      {bidsError ? <ApiErrorAlert error={bidsError} /> : null}
      {awardError ? <ApiErrorAlert error={awardError} /> : null}

      <Card>
        <CardHeader>
          <CardTitle>Select RFQ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="comparison-rfq">RFQ</Label>
          <Select value={rfqId} onValueChange={setRfqId}>
            <SelectTrigger id="comparison-rfq">
              <SelectValue placeholder="Select RFQ" />
            </SelectTrigger>
            <SelectContent>
              {comparableRfqs.map((rfq) => (
                <SelectItem key={rfq.id} value={rfq.id}>
                  {rfq.title} ({rfq.status})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedRfq ? (
        <Card>
          <CardHeader>
            <CardTitle>RFQ Context</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm md:grid-cols-2">
            <p><span className="font-medium">Title:</span> {selectedRfq.title}</p>
            <p><span className="font-medium">Status:</span> {selectedRfq.status}</p>
            <p><span className="font-medium">RFQ ID:</span> {selectedRfq.id}</p>
            <p><span className="font-medium">PR ID:</span> {selectedRfq.prId}</p>
            <p><span className="font-medium">Release mode:</span> {selectedRfq.releaseMode ?? "-"}</p>
            <p><span className="font-medium">Bid count:</span> {bids.length}</p>
          </CardContent>
        </Card>
      ) : null}

      {bids.length === 0 ? (
        <EmptyState
          title={rfqId ? "No bids to compare" : "No RFQ selected"}
          description={
            rfqId
              ? "This RFQ does not have any supplier bids yet."
              : "Select an RFQ to compare supplier bids."
          }
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Bid Comparison Table</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left">
                    <th className="px-3 py-2 font-medium">Supplier</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Bid Value</th>
                    <th className="px-3 py-2 font-medium">Currency</th>
                    <th className="px-3 py-2 font-medium">Submitted</th>
                    <th className="px-3 py-2 font-medium">Documents</th>
                    <th className="px-3 py-2 font-medium">Supplier Score</th>
                    <th className="px-3 py-2 font-medium">Recommendation</th>
                    <th className="px-3 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bids.map((bid) => (
                    <tr key={bid.id} className="border-b align-top">
                      <td className="px-3 py-2 font-medium">{bid.supplierName ?? bid.supplierId}</td>
                      <td className="px-3 py-2">{bidStatusLabel(bid.status)}</td>
                      <td className="px-3 py-2">{bid.totalBidValue ?? "-"}</td>
                      <td className="px-3 py-2">{bid.currency ?? "-"}</td>
                      <td className="px-3 py-2">{bid.submittedAt ? formatDateTime(bid.submittedAt) : "-"}</td>
                      <td className="px-3 py-2">{Object.keys(bid.documents ?? {}).length}</td>
                      <td className="px-3 py-2">{bid.supplierProfileScore ?? "-"}</td>
                      <td className="px-3 py-2">{bid.recommended ? bid.recommendationReason ?? "Recommended" : "-"}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/bids/${bid.id}`}>Review</Link>
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => {
                              setAwardError(null);
                              setOverrideReason(`Award selected supplier from bids comparison for ${selectedRfq?.title ?? "RFQ"}`);
                              setAwardCandidate(bid);
                            }}
                          >
                            Award
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

      <Dialog
        open={Boolean(awardCandidate)}
        onOpenChange={(open) => {
          if (!open && !rfqAction.isPending) {
            setAwardCandidate(null);
            setOverrideReason("");
            setAwardError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Award</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {awardCandidate ? (
              <div className="space-y-2 rounded-lg border bg-slate-50 p-3 text-sm">
                <p><span className="font-medium">RFQ:</span> {selectedRfq?.title ?? selectedRfq?.id}</p>
                <p><span className="font-medium">Supplier:</span> {awardCandidate.supplierName ?? awardCandidate.supplierId}</p>
                <p><span className="font-medium">Bid value:</span> {awardCandidate.totalBidValue ?? "-"} {awardCandidate.currency ?? ""}</p>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="award-override-reason">Award reason</Label>
              <Input
                id="award-override-reason"
                value={overrideReason}
                onChange={(event) => setOverrideReason(event.target.value)}
                placeholder="Reason for awarding this supplier"
              />
            </div>
            {awardError ? <ApiErrorAlert error={awardError} /> : null}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setAwardCandidate(null);
                  setOverrideReason("");
                  setAwardError(null);
                }}
                disabled={rfqAction.isPending}
              >
                Cancel
              </Button>
              <Button onClick={submitAward} disabled={rfqAction.isPending || !overrideReason.trim()}>
                {rfqAction.isPending ? "Awarding..." : "Confirm and go to PO"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
