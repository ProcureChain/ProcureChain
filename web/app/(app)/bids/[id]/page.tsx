"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { MessageSquareText } from "lucide-react";

import { ApiErrorAlert } from "@/components/common/api-error-alert";
import { PageHeader } from "@/components/common/page-header";
import { WorkflowChatSheet } from "@/components/workflow/workflow-chat-sheet";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBusinessRef } from "@/lib/format";
import { useBid, useRfq } from "@/lib/query-hooks";

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

export default function BidDetailPage() {
  const params = useParams<{ id: string }>();
  const { data: bid, error } = useBid(params.id);
  const { data: rfq } = useRfq(bid?.rfqId ?? "");
  const [workflowOpen, setWorkflowOpen] = useState(false);

  if (error) return <ApiErrorAlert error={error} />;
  if (!bid) return <div className="rounded-xl border bg-white p-8 text-sm text-slate-500">Loading bid...</div>;

  return (
    <div className="space-y-5">
      <PageHeader
        title={formatBusinessRef("BID", bid.id)}
        description={`${formatBusinessRef("RFQ", bid.rfqId)} • Supplier ${bid.supplierName ?? formatBusinessRef("SUP", bid.supplierId)} • ${bidStatusLabel(bid.status)}`}
        actions={
          <div className="flex gap-2">
            {rfq?.prId ? (
              <Button variant="outline" onClick={() => setWorkflowOpen(true)}>
                <MessageSquareText className="mr-2 h-4 w-4" />
                Workflow Chat
              </Button>
            ) : null}
            <Button asChild variant="outline">
              <Link href={`/bids?rfqId=${bid.rfqId}`}>Back to Bid List</Link>
            </Button>
            <Button asChild>
              <Link href={`/rfqs/${bid.rfqId}`}>Award from RFQ</Link>
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Bid Review</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>Supplier: {bid.supplierName ?? formatBusinessRef("SUP", bid.supplierId)}</p>
          <p>Supplier score: {bid.supplierProfileScore ?? "-"}</p>
          <p>Status: {bidStatusLabel(bid.status)}</p>
          <p>Total value: {bid.totalBidValue ?? 0} {bid.currency ?? ""}</p>
          <p>Submitted at: {bid.submittedAt ?? "-"}</p>
          <p>Documents attached: {Object.keys(bid.documents ?? {}).length}</p>
          <p>Notes: {bid.notes ?? "-"}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Organisation Action</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-600">
          Review the supplier response here, then return to the RFQ page to select the winning supplier and award the RFQ.
        </CardContent>
      </Card>

      {rfq?.prId ? (
        <WorkflowChatSheet
          open={workflowOpen}
          onOpenChange={setWorkflowOpen}
          prId={rfq.prId}
          rfqId={bid.rfqId}
        />
      ) : null}
    </div>
  );
}
