"use client";

import { useState } from "react";
import { notFound, useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, ClipboardList, History, MessageSquareText, ShieldCheck } from "lucide-react";

import { ApiErrorAlert } from "@/components/common/api-error-alert";
import { PermissionNote } from "@/components/common/permission-note";
import { WorkflowChatSheet } from "@/components/workflow/workflow-chat-sheet";
import { StatusBadge } from "@/components/common/status-badge";
import { Timeline } from "@/components/common/timeline";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate, formatSubcategoryLabel } from "@/lib/format";
import { downloadRequisitionDocument } from "@/lib/api/live-api";
import { useApprovalAction, useAuditEvents, useRequisition, useTaxonomySubcategories, useWithdrawRequisition } from "@/lib/query-hooks";
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

function RequisitionHero({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[32px] border border-[var(--border)] bg-[linear-gradient(135deg,#2D334A_0%,#444A74_100%)] text-white shadow-[var(--shadow-lg)]">
      <div className="flex flex-col gap-5 px-6 py-7 lg:flex-row lg:items-end lg:justify-between lg:px-8">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/65">Purchase Requisition</p>
          <h1 className="mt-3 text-2xl font-bold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-[#E1E7FF]">{subtitle}</p>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </section>
  );
}

export default function RequisitionDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading, error } = useRequisition(params.id);
  const { data: auditEvents = [] } = useAuditEvents({ entityType: "PurchaseRequisition", entityId: params.id, limit: 300 });
  const { data: taxonomy = [] } = useTaxonomySubcategories();
  const approvalAction = useApprovalAction();
  const withdrawAction = useWithdrawRequisition();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [action, setAction] = useState<ApprovalAction>("APPROVE");
  const [comment, setComment] = useState("");
  const [workflowOpen, setWorkflowOpen] = useState(false);

  if (!isLoading && !data) notFound();
  if (error) return <ApiErrorAlert error={error} />;

  if (isLoading || !data) {
    return <div className="rounded-xl border bg-white p-8 text-sm text-slate-500">Loading requisition...</div>;
  }

  const hasApprovalPermission = canPerformAction("PR_APPROVE");
  const canApprove = (data.status === "SUBMITTED" || data.status === "UNDER_REVIEW") && hasApprovalPermission;
  const canWithdraw = data.status === "SUBMITTED" || data.status === "UNDER_REVIEW" || data.status === "RETURNED";
  const latestReturnedAudit = auditEvents.find((event) => event.action === "PR_INFO_REQUESTED");
  const subcategoryLabel =
    formatSubcategoryLabel(
      taxonomy.find((subcategory) => subcategory.id === data.subcategoryId)?.level3 ??
        taxonomy.find((subcategory) => subcategory.id === data.subcategoryId)?.name,
      data.subcategoryId,
    );
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
      router.push("/requisitions");
    } catch (mutationError) {
      toast.error("Action failed");
      console.error(mutationError);
    }
  };

  return (
    <div className="space-y-6">
      <RequisitionHero
        title={`${data.title} (${data.prNumber})`}
        subtitle={`${data.department} • Needed by ${formatDate(data.neededBy)} • ${subcategoryLabel}`}
        actions={
          <>
            <Button
              variant="outline"
              className="rounded-full border-white/20 bg-white/10 text-white hover:bg-white/15 hover:text-white"
              onClick={() => setWorkflowOpen(true)}
            >
              <MessageSquareText className="mr-2 h-4 w-4" />
              Workflow Chat
            </Button>
            {(data.status === "DRAFT" || data.status === "RETURNED" || data.status === "APPROVED") ? (
              <Button
                variant="outline"
                className="rounded-full border-white/20 bg-white/10 text-white hover:bg-white/15 hover:text-white"
                onClick={() => router.push(`/requisitions/new?edit=${data.id}`)}
              >
                {data.status === "DRAFT" ? "Edit" : "Resume Edit"}
              </Button>
            ) : null}
            {canWithdraw ? (
              <Button
                variant="outline"
                className="rounded-full border-white/20 bg-white/10 text-white hover:bg-white/15 hover:text-white"
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
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-[var(--shadow-sm)]">
          <p className="font-medium">This PR was returned for more information.</p>
          <p className="mt-1">
            {typeof latestReturnedAudit?.after?.reason === "string"
              ? latestReturnedAudit.after.reason
              : "Update the requisition and resubmit it when ready."}
          </p>
        </div>
      ) : null}
      {data.editedAfterApprovalAt ? (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 shadow-[var(--shadow-sm)]">
          <p className="font-medium">This approved PR has been edited after approval.</p>
          <p className="mt-1">The edit is recorded in audit and RFQ will show an Edited badge for this PR.</p>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="rounded-3xl border-[var(--border)] bg-white shadow-[var(--shadow-sm)]">
          <CardContent className="p-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-[var(--surface-muted)] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Status</p>
                <div className="mt-3">
                  <StatusBadge status={data.status} />
                </div>
              </div>
              <div className="rounded-2xl bg-[var(--surface-muted)] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Current Approver</p>
                <p className="mt-3 text-lg font-semibold text-[var(--text-primary)]">{data.currentApprover ?? "-"}</p>
              </div>
              <div className="rounded-2xl bg-[var(--surface-muted)] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Needed By</p>
                <p className="mt-3 text-lg font-semibold text-[var(--text-primary)]">{formatDate(data.neededBy)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-3xl border-0 bg-[linear-gradient(180deg,#2D334A_0%,#202840_100%)] text-white shadow-[var(--shadow-md)]">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-white">
              <ShieldCheck className="h-5 w-5" />
              Approver actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {!hasApprovalPermission ? <PermissionNote message={permissionHint("PR_APPROVE")} /> : null}
            <Button className="w-full rounded-full bg-white text-[var(--primary)] hover:bg-white/90" disabled={!canApprove || approvalAction.isPending} onClick={() => openAction("APPROVE")}>
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
              className="w-full rounded-full border-white/15 bg-white/10 text-white hover:bg-white/15 hover:text-white"
              variant="outline"
              disabled={!canApprove || approvalAction.isPending}
              onClick={() => openAction("REQUEST_INFO")}
            >
              Request info
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-3xl border-[var(--border)] bg-white shadow-[var(--shadow-sm)]">
        <CardHeader className="border-b border-[var(--border)] pb-4">
          <CardTitle className="flex items-center gap-2 text-[var(--text-primary)]">
            <ClipboardList className="h-5 w-5 text-[var(--secondary)]" />
            Requisition Form Preview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Standard Details</p>
              <p><span className="font-medium text-[var(--text-secondary)]">Title:</span> <span className="text-[var(--text-primary)]">{data.title}</span></p>
              <p><span className="font-medium text-[var(--text-secondary)]">Requester:</span> <span className="text-[var(--text-primary)]">{data.requester}</span></p>
              <p><span className="font-medium text-[var(--text-secondary)]">Department:</span> <span className="text-[var(--text-primary)]">{data.department}</span></p>
              <p><span className="font-medium text-[var(--text-secondary)]">Cost center:</span> <span className="text-[var(--text-primary)]">{data.costCenter}</span></p>
              <p><span className="font-medium text-[var(--text-secondary)]">Needed by:</span> <span className="text-[var(--text-primary)]">{formatDate(data.neededBy)}</span></p>
              <p><span className="font-medium text-[var(--text-secondary)]">Subcategory:</span> <span className="text-[var(--text-primary)]">{subcategoryLabel}</span></p>
              <p><span className="font-medium text-[var(--text-secondary)]">Justification:</span> <span className="text-[var(--text-primary)]">{data.justification ?? "-"}</span></p>
            </div>

            <div className="space-y-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Category-Specific Fields</p>
              {data.metadata && Object.keys(data.metadata).length > 0 ? (
                <div className="space-y-2">
                  {Object.entries(data.metadata).map(([key, value]) => (
                    <div key={key} className="rounded-xl border border-[var(--border)] bg-white px-3 py-3">
                      <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--text-muted)]">{key.replace(/_/g, " ")}</p>
                      <p className="mt-1 whitespace-pre-wrap text-[var(--text-primary)]">
                        {formatMetadataValue(value)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[var(--text-muted)]">No category-specific data captured.</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Line Items</p>
            <div className="mt-3 space-y-3">
              {data.lineItems.length > 0 ? (
                data.lineItems.map((line, index) => (
                  <div key={line.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                    <p className="font-medium text-[var(--text-primary)]">Line {index + 1}</p>
                    <p className="mt-1 text-[var(--text-primary)]">{line.description}</p>
                    <p className="mt-1 text-[var(--text-secondary)]">
                      Quantity: {line.quantity}
                      {line.uom ? ` ${line.uom}` : ""}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-[var(--text-muted)]">No line items added.</p>
              )}
            </div>
          </div>

          {data.attachments.length > 0 ? (
            <div className="rounded-2xl border border-[var(--border)] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Attachments</p>
              <div className="mt-3 space-y-2">
                {data.attachments.map((document) => (
                  <div key={document.id} className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
                    <div>
                      <p className="font-medium text-[var(--text-primary)]">{document.label ?? document.name}</p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {document.fieldKey ? `${document.fieldKey} • ` : ""}
                        {document.name}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" className="rounded-full" onClick={() => downloadRequisitionDocument(document.id)}>
                      Download
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-[var(--border)] bg-white shadow-[var(--shadow-sm)]">
        <CardHeader className="border-b border-[var(--border)] pb-4">
          <CardTitle className="flex items-center gap-2 text-[var(--text-primary)]">
            <History className="h-5 w-5 text-[var(--secondary)]" />
            Audit Trail
          </CardTitle>
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
            <Button variant="outline" className="rounded-full" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              className="rounded-full"
              onClick={submitAction}
              disabled={approvalAction.isPending || ((action === "REJECT" || action === "REQUEST_INFO") && !comment)}
            >
              Confirm
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <WorkflowChatSheet
        open={workflowOpen}
        onOpenChange={setWorkflowOpen}
        prId={data.id}
        requesterLabel={data.requester}
      />
    </div>
  );
}
