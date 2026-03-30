"use client";

import { useState } from "react";
import { toast } from "sonner";

import { ApiErrorAlert } from "@/components/common/api-error-alert";
import { PageHeader } from "@/components/common/page-header";
import { PermissionNote } from "@/components/common/permission-note";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useComplianceAction, useCoi } from "@/lib/query-hooks";
import { canPerformAction, permissionHint } from "@/lib/roles";

export default function CompliancePage() {
  const [rfqId, setRfqId] = useState("");
  const [reason, setReason] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");

  const { data: declarations = [], error } = useCoi(rfqId);
  const complianceAction = useComplianceAction();

  const declare = async () => {
    try {
      await complianceAction.mutateAsync({ type: "declare", rfqId, reason, supplierId: supplierId || undefined });
      toast.success("COI declared");
      setReason("");
      setSupplierId("");
    } catch (err) {
      toast.error("COI declaration failed");
      console.error(err);
    }
  };

  const review = async (id: string, decision: "APPROVED" | "BLOCKED") => {
    try {
      await complianceAction.mutateAsync({ type: "review", declarationId: id, decision, reviewNotes, rfqId });
      toast.success(`COI ${decision.toLowerCase()}`);
    } catch (err) {
      toast.error("COI review failed");
      console.error(err);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Compliance" description="COI declaration, review, and award-block governance checks." />
      {error ? <ApiErrorAlert error={error} /> : null}
      {complianceAction.error ? <ApiErrorAlert error={complianceAction.error} /> : null}

      <Card>
        <CardHeader>
          <CardTitle>COI Declaration</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-2">
          <Input value={rfqId} onChange={(e) => setRfqId(e.target.value)} placeholder="RFQ ID" />
          <Input value={supplierId} onChange={(e) => setSupplierId(e.target.value)} placeholder="Supplier ID (optional)" />
          <Textarea className="md:col-span-2" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason" />
          <div className="md:col-span-2">
            <Button disabled={!rfqId || !reason || complianceAction.isPending} onClick={declare}>
              Declare COI
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>COI Review Queue</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!canPerformAction("COI_REVIEW") ? <PermissionNote message={permissionHint("COI_REVIEW")} /> : null}
          <Textarea value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} placeholder="Review notes" />
          {declarations.length === 0 ? (
            <p className="text-sm text-slate-500">No declarations found for the current RFQ.</p>
          ) : (
            declarations.map((item) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-3 text-sm">
                <div>
                  <p className="font-medium">{item.id}</p>
                  <p className="text-slate-500">
                    {item.status} • supplier {item.supplierId ?? "ALL"} • {item.reason}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={!canPerformAction("COI_REVIEW")} onClick={() => review(item.id, "APPROVED")}>
                    Approve
                  </Button>
                  <Button size="sm" variant="destructive" disabled={!canPerformAction("COI_REVIEW")} onClick={() => review(item.id, "BLOCKED")}>
                    Block
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
