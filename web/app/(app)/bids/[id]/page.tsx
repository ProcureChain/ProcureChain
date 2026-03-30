"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { ApiErrorAlert } from "@/components/common/api-error-alert";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useBid } from "@/lib/query-hooks";

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

  if (error) return <ApiErrorAlert error={error} />;
  if (!bid) return <div className="rounded-xl border bg-white p-8 text-sm text-slate-500">Loading bid...</div>;

  return (
    <div className="space-y-5">
      <PageHeader
        title={`Bid ${bid.id}`}
        description={`RFQ ${bid.rfqId} • Supplier ${bid.supplierName ?? bid.supplierId} • ${bidStatusLabel(bid.status)}`}
        actions={
          <div className="flex gap-2">
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
          <p>Supplier: {bid.supplierName ?? bid.supplierId}</p>
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
    </div>
  );
}
