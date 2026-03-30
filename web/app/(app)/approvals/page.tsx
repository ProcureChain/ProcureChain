"use client";

import { useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";

import { DataTable } from "@/components/data/data-table";
import { ApiErrorAlert } from "@/components/common/api-error-alert";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { PermissionNote } from "@/components/common/permission-note";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useApprovalAction, useApprovalTasks } from "@/lib/query-hooks";
import { canPerformAction, permissionHint } from "@/lib/roles";
import { ApprovalAction, ApprovalTask } from "@/lib/types";

export default function ApprovalsPage() {
  const { data = [], error } = useApprovalTasks();
  const approveAction = useApprovalAction();

  const [selected, setSelected] = useState<ApprovalTask | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [action, setAction] = useState<ApprovalAction>("APPROVE");
  const [comment, setComment] = useState("");

  const columns = useMemo<ColumnDef<ApprovalTask>[]>(
    () => [
      { accessorKey: "prNumber", header: "PR #" },
      { accessorKey: "status", header: "Status" },
      { accessorKey: "title", header: "Title" },
      { accessorKey: "requester", header: "Requester" },
      { accessorKey: "department", header: "Department" },
      {
        accessorKey: "ageDays",
        header: "Age",
        cell: ({ row }) => `${row.original.ageDays}d`,
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <Button size="sm" variant="outline" onClick={() => setSelected(row.original)}>
            Review
          </Button>
        ),
      },
    ],
    [],
  );

  const submitAction = async () => {
    if (!selected) return;
    await approveAction.mutateAsync({ requisitionId: selected.requisitionId, action, comment });
    toast.success(`Request ${action.toLowerCase().replace("_", " ")}d`);
    setConfirmOpen(false);
    setSelected(null);
    setComment("");
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Approvals Inbox" description="Review assigned requisitions with policy context and act quickly." />
      {error ? (
        <ApiErrorAlert error={error} />
      ) : data.length ? (
        <DataTable columns={columns} data={data} />
      ) : (
        <EmptyState title="No approvals pending" description="Your approvals inbox is clear." />
      )}

      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>{selected?.prNumber}</SheetTitle>
          </SheetHeader>
          {selected && (
            <div className="mt-6 space-y-4">
              {!canPerformAction("PR_APPROVE") ? <PermissionNote message={permissionHint("PR_APPROVE")} /> : null}
              <div className="rounded-lg border p-3 text-sm">
                <p className="font-medium">{selected.title}</p>
                <p className="mt-1 text-slate-600">Requester: {selected.requester}</p>
              </div>
              <div className="rounded-lg border p-3 text-sm">
                <p className="font-medium">Policy flags</p>
                <ul className="mt-2 list-disc pl-5 text-slate-600">
                  {selected.policyFlags.map((flag) => (
                    <li key={flag}>{flag}</li>
                  ))}
                </ul>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  disabled={!canPerformAction("PR_APPROVE")}
                  onClick={() => {
                    setAction("APPROVE");
                    setConfirmOpen(true);
                  }}
                >
                  Approve
                </Button>
                <Button
                  variant="destructive"
                  disabled={!canPerformAction("PR_APPROVE")}
                  onClick={() => {
                    setAction("REJECT");
                    setConfirmOpen(true);
                  }}
                >
                  Reject
                </Button>
                <Button
                  variant="outline"
                  disabled={!canPerformAction("PR_APPROVE")}
                  onClick={() => {
                    setAction("REQUEST_INFO");
                    setConfirmOpen(true);
                  }}
                >
                  Request Info
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm action</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="comment">Comment</Label>
            <Input id="comment" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Required for reject/request info" />
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
              disabled={(action === "REJECT" || action === "REQUEST_INFO") && !comment}
            >
              Confirm
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
