"use client";

import { useState } from "react";
import { notFound, useParams, useRouter } from "next/navigation";
import { toast } from "sonner";

import { ApiErrorAlert } from "@/components/common/api-error-alert";
import { PageHeader } from "@/components/common/page-header";
import { PermissionNote } from "@/components/common/permission-note";
import { StatusBadge } from "@/components/common/status-badge";
import { Timeline } from "@/components/common/timeline";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/format";
import { downloadRequisitionDocument } from "@/lib/api/live-api";
import { useApprovalAction, useAuditEvents, useRequisition, useWithdrawRequisition } from "@/lib/query-hooks";
import { canPerformAction, permissionHint } from "@/lib/roles";
import { ApprovalAction } from "@/lib/types";

function formatMetadataValue(value: unknown) {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    if (value.every((item) => typeof item === "object" && item && "text" in item && "date" in item)) {
      return value
        .map((item) => {
          const milestone = item as { text?: string; date?: string };
          return [milestone.text, milestone.date].filter(Boolean).join(" - ");
        })
        .join("\n");
    }
    return value.join(", ");
  }
  return JSON.stringify(value);
}

export default function RequisitionDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading, error } = useRequisition(params.id);
  const { data: auditEvents = [] } = useAuditEvents({ entityType: "PurchaseRequisition", entityId: params.id, limit: 300 });
  const approvalAction = useApprovalAction();
  const withdrawAction = useWithdrawRequisition();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [action, setAction] = useState<ApprovalAction>("APPROVE");
  const [comment, setComment] = useState("");

  if (!isLoading && !data) notFound();
  if (error) return <ApiErrorAlert error={error} />;

  if (isLoading || !data) {
    return <div className="rounded-xl border bg-white p-8 text-sm text-slate-500">Loading requisition...</div>;
  }

  const hasApprovalPermission = canPerformAction("PR_APPROVE");
  const canApprove = (data.status === "SUBMITTED" || data.status === "UNDER_REVIEW") && hasApprovalPermission;
  const canWithdraw = data.status === "SUBMITTED" || data.status === "UNDER_REVIEW" || data.status === "RETURNED";
  const latestReturnedAudit = auditEvents.find((event) => event.action === "PR_INFO_REQUESTED");
  const auditItems = auditEvents.map((event) => ({
    id: event.id,
    title: event.action,
    actor: event.actor,
    note:
      typeof event.after?.reason === "string"
        ? event.after.reason
        : typeof event.after?.comment === "string"
          ? event.after.comment
          : typeof event.after?.originalName === "string"
            ? event.after.originalName
            : undefined,
    at: event.at,
  }));

  const openAction = (nextAction: ApprovalAction) => {
    setAction(nextAction);
    setConfirmOpen(true);
  };

  const submitAction = async () => {
    try {
      await approvalAction.mutateAsync({ requisitionId: data.id, action, comment });
      toast.success(`PR ${action.toLowerCase().replace("_", " ")} completed`);
      setConfirmOpen(false);
      setComment("");
    } catch (mutationError) {
      toast.error("Action failed");
      console.error(mutationError);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${data.title} (${data.prNumber})`}
        description={`${data.department} • Needed by ${formatDate(data.neededBy)}`}
        actions={
          <>
            {(data.status === "DRAFT" || data.status === "RETURNED" || data.status === "APPROVED") ? (
              <Button variant="outline" onClick={() => router.push(`/requisitions/new?edit=${data.id}`)}>
                {data.status === "DRAFT" ? "Edit" : "Resume Edit"}
              </Button>
            ) : null}
            {canWithdraw ? (
              <Button
                variant="outline"
                disabled={withdrawAction.isPending}
                onClick={async () => {
                  try {
                    await withdrawAction.mutateAsync({ id: data.id });
                    toast.success("PR withdrawn", { description: "Requisition moved back to draft." });
                  } catch (mutationError) {
                    toast.error("Withdraw failed");
                    console.error(mutationError);
                  }
                }}
              >
                Withdraw
              </Button>
            ) : null}
          </>
        }
      />

      {approvalAction.error ? <ApiErrorAlert error={approvalAction.error} /> : null}
      {withdrawAction.error ? <ApiErrorAlert error={withdrawAction.error} /> : null}
      {data.status === "RETURNED" ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">This PR was returned for more information.</p>
          <p className="mt-1">
            {typeof latestReturnedAudit?.after?.reason === "string"
              ? latestReturnedAudit.after.reason
              : "Update the requisition and resubmit it when ready."}
          </p>
        </div>
      ) : null}
      {data.editedAfterApprovalAt ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          <p className="font-medium">This approved PR has been edited after approval.</p>
          <p className="mt-1">The edit is recorded in audit and RFQ will show an Edited badge for this PR.</p>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <Card>
          <CardContent className="flex flex-wrap items-center gap-4 p-4">
            <StatusBadge status={data.status} />
            <p className="text-sm text-slate-600">Current approver: {data.currentApprover ?? "-"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Approver actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {!hasApprovalPermission ? <PermissionNote message={permissionHint("PR_APPROVE")} /> : null}
            <Button className="w-full" disabled={!canApprove || approvalAction.isPending} onClick={() => openAction("APPROVE")}>
              Approve
            </Button>
            <Button
              className="w-full"
              variant="destructive"
              disabled={!canApprove || approvalAction.isPending}
              onClick={() => openAction("REJECT")}
            >
              Reject
            </Button>
            <Button
              className="w-full"
              variant="outline"
              disabled={!canApprove || approvalAction.isPending}
              onClick={() => openAction("REQUEST_INFO")}
            >
              Request info
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Requisition Form Preview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 rounded-lg border p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Standard Details</p>
              <p><span className="font-medium">Title:</span> {data.title}</p>
              <p><span className="font-medium">Requester:</span> {data.requester}</p>
              <p><span className="font-medium">Department:</span> {data.department}</p>
              <p><span className="font-medium">Cost center:</span> {data.costCenter}</p>
              <p><span className="font-medium">Needed by:</span> {formatDate(data.neededBy)}</p>
              <p><span className="font-medium">Subcategory:</span> {data.subcategoryId ?? "-"}</p>
              <p><span className="font-medium">Justification:</span> {data.justification ?? "-"}</p>
            </div>

            <div className="space-y-2 rounded-lg border p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Category-Specific Fields</p>
              {data.metadata && Object.keys(data.metadata).length > 0 ? (
                <div className="space-y-2">
                  {Object.entries(data.metadata).map(([key, value]) => (
                    <div key={key} className="rounded-md bg-slate-50 px-3 py-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{key.replace(/_/g, " ")}</p>
                      <p className="mt-1 text-slate-800">
                        {formatMetadataValue(value)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500">No category-specific data captured.</p>
              )}
            </div>
          </div>

          <div className="rounded-lg border p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Line Items</p>
            <div className="mt-3 space-y-3">
              {data.lineItems.length > 0 ? (
                data.lineItems.map((line, index) => (
                  <div key={line.id} className="rounded-lg border p-3">
                    <p className="font-medium text-slate-900">Line {index + 1}</p>
                    <p className="mt-1">{line.description}</p>
                    <p className="mt-1 text-slate-600">
                      Quantity: {line.quantity}
                      {line.uom ? ` ${line.uom}` : ""}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-slate-500">No line items added.</p>
              )}
            </div>
          </div>

          {data.attachments.length > 0 ? (
            <div className="rounded-lg border p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Attachments</p>
              <div className="mt-3 space-y-2">
                {data.attachments.map((document) => (
                  <div key={document.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                    <div>
                      <p className="font-medium text-slate-900">{document.label ?? document.name}</p>
                      <p className="text-xs text-slate-500">
                        {document.fieldKey ? `${document.fieldKey} • ` : ""}
                        {document.name}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => downloadRequisitionDocument(document.id)}>
                      Download
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Audit Trail</CardTitle>
        </CardHeader>
        <CardContent>
          <Timeline items={auditItems} />
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm {action.toLowerCase().replace("_", " ")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="approval-comment">Comment</Label>
            <Input
              id="approval-comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Required for reject/request info"
            />
            {(action === "REJECT" || action === "REQUEST_INFO") && !comment && (
              <p className="text-xs text-rose-600">Comment is required for this action.</p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={submitAction}
              disabled={approvalAction.isPending || ((action === "REJECT" || action === "REQUEST_INFO") && !comment)}
            >
              Confirm
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
