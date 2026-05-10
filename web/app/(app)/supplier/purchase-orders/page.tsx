"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Clock3, FileSignature, MessageSquareText, Truck } from "lucide-react";

import { ApiErrorAlert } from "@/components/common/api-error-alert";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { WorkflowChatSheet } from "@/components/workflow/workflow-chat-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBusinessRef, formatDateTime, formatMoney } from "@/lib/format";
import { usePoAction, usePos } from "@/lib/query-hooks";
import { runtimeConfig } from "@/lib/runtime-config";
import type { PurchaseOrder } from "@/lib/types";

function statusBadgeClass(status: PurchaseOrder["status"]) {
  if (status === "ACCEPTED") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "CHANGE_REQUESTED") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "RELEASED") return "border-blue-200 bg-blue-50 text-blue-700";
  if (status === "CLOSED") return "border-slate-300 bg-slate-100 text-slate-700";
  return "border-[var(--border)] bg-white text-[var(--text-secondary)]";
}

export default function SupplierPurchaseOrdersPage() {
  const { data: pos = [], error } = usePos();
  const poAction = usePoAction();
  const [selectedPo, setSelectedPo] = useState<PurchaseOrder | null>(null);
  const [workflowPo, setWorkflowPo] = useState<PurchaseOrder | null>(null);
  const [workflowOpen, setWorkflowOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [proposedTerms, setProposedTerms] = useState("");
  const releasedCount = pos.filter((po) => po.status === "RELEASED").length;
  const acceptedCount = pos.filter((po) => po.status === "ACCEPTED").length;
  const changeCount = pos.filter((po) => po.status === "CHANGE_REQUESTED").length;
  const committed = pos.reduce((sum, po) => sum + po.committedAmount, 0);
  const currency = pos[0]?.currency ?? "ZAR";

  const acceptPo = async (poId: string) => {
    try {
      await poAction.mutateAsync({
        type: "respond",
        poId,
        action: "ACCEPT",
        requestedBy: runtimeConfig.actorName,
      });
      toast.success("PO accepted");
    } catch (err) {
      console.error(err);
      toast.error("PO acceptance failed");
    }
  };

  const requestChange = async () => {
    if (!selectedPo || !reason.trim()) return;
    try {
      await poAction.mutateAsync({
        type: "respond",
        poId: selectedPo.id,
        action: "REQUEST_CHANGE",
        reason,
        proposedTerms,
        requestedBy: runtimeConfig.actorName,
      });
      toast.success("PO change request sent");
      setSelectedPo(null);
      setReason("");
      setProposedTerms("");
    } catch (err) {
      console.error(err);
      toast.error("PO change request failed");
    }
  };

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] text-white shadow-[var(--shadow-lg)]">
        <div className="flex flex-col gap-4 px-6 py-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/70">Supplier PO Workspace</p>
            <h1 className="text-2xl font-bold tracking-tight text-white">Supplier Purchase Orders</h1>
            <p className="text-sm text-white/85">Review released POs, accept them, or send back a structured change request.</p>
          </div>
          <div className="rounded-xl border border-white/25 bg-white/10 px-4 py-3 text-sm">
            <p className="text-white/80">POs In Scope</p>
            <p className="text-lg font-semibold text-white">{pos.length}</p>
          </div>
        </div>
      </section>
      {error ? <ApiErrorAlert error={error} /> : null}
      {poAction.error ? <ApiErrorAlert error={poAction.error} /> : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border-[var(--border)] bg-white shadow-[var(--shadow-sm)]">
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-[var(--text-secondary)]">Awaiting Response</p>
                <p className="mt-2 text-3xl font-semibold text-[var(--text-primary)]">{releasedCount}</p>
              </div>
              <div className="rounded-xl bg-[var(--surface-muted)] p-2 text-[var(--secondary)]"><Clock3 className="h-5 w-5" /></div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[var(--border)] bg-white shadow-[var(--shadow-sm)]">
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-[var(--text-secondary)]">Accepted</p>
                <p className="mt-2 text-3xl font-semibold text-[var(--text-primary)]">{acceptedCount}</p>
              </div>
              <div className="rounded-xl bg-[var(--surface-muted)] p-2 text-[var(--secondary)]"><CheckCircle2 className="h-5 w-5" /></div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[var(--border)] bg-white shadow-[var(--shadow-sm)]">
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-[var(--text-secondary)]">Change Requests</p>
                <p className="mt-2 text-3xl font-semibold text-[var(--text-primary)]">{changeCount}</p>
              </div>
              <div className="rounded-xl bg-[var(--surface-muted)] p-2 text-[var(--secondary)]"><FileSignature className="h-5 w-5" /></div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[var(--border)] bg-white shadow-[var(--shadow-sm)]">
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-[var(--text-secondary)]">Committed Value</p>
                <p className="mt-2 text-xl font-semibold text-[var(--text-primary)]">{formatMoney(committed, currency)}</p>
              </div>
              <div className="rounded-xl bg-[var(--surface-muted)] p-2 text-[var(--secondary)]"><Truck className="h-5 w-5" /></div>
            </div>
          </CardContent>
        </Card>
      </section>

      {pos.length === 0 ? (
        <EmptyState title="No supplier POs" description="Awarded and released purchase orders assigned to this supplier will appear here." />
      ) : (
        <Card className="border-[var(--border)] bg-[var(--surface-background)] shadow-[var(--shadow-sm)]">
          <CardHeader className="border-b border-[var(--border)]">
            <CardTitle className="text-lg text-[var(--text-primary)]">Supplier PO Register</CardTitle>
          </CardHeader>
          <CardContent className="pt-5">
            <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-[var(--surface-muted)] text-left text-[var(--text-secondary)]">
                    <th className="px-3 py-2 font-medium">PO #</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Amount</th>
                    <th className="px-3 py-2 font-medium">RFQ</th>
                    <th className="px-3 py-2 font-medium">Updated</th>
                    <th className="px-3 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pos.map((po) => (
                    <tr key={po.id} className="border-b align-top transition hover:bg-[var(--surface-muted)]/60">
                      <td className="px-3 py-2">
                        <p className="font-semibold text-[var(--text-primary)]">{po.poNumber}</p>
                        <p className="text-xs text-[var(--text-muted)]">{formatBusinessRef("PO", po.id)}</p>
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${statusBadgeClass(po.status)}`}>
                          {po.status.replaceAll("_", " ")}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">{formatMoney(po.committedAmount, po.currency)}</td>
                      <td className="px-3 py-2 text-slate-600">{formatBusinessRef("RFQ", po.rfqId)}</td>
                      <td className="px-3 py-2">{formatDateTime(po.updatedAt)}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          {po.status === "RELEASED" || po.status === "CHANGE_REQUESTED" ? (
                            <>
                              <Button size="sm" onClick={() => acceptPo(po.id)}>Accept PO</Button>
                              <Button size="sm" variant="outline" onClick={() => { setSelectedPo(po); setReason(""); setProposedTerms(po.terms ?? ""); }}>
                                Request Change
                              </Button>
                            </>
                          ) : null}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 border-[var(--border)]"
                            onClick={() => {
                              setWorkflowPo(po);
                              setWorkflowOpen(true);
                            }}
                          >
                            <MessageSquareText className="mr-1 h-4 w-4" />
                            Workflow Chat
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

      <Dialog open={Boolean(selectedPo)} onOpenChange={(open) => !open && setSelectedPo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedPo ? `Request change for ${selectedPo.poNumber}` : "Request PO change"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="supplier-po-reason">Reason</Label>
              <Input id="supplier-po-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Describe the requested change" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="supplier-po-terms">Proposed terms</Label>
              <Input id="supplier-po-terms" value={proposedTerms} onChange={(event) => setProposedTerms(event.target.value)} placeholder="Optional revised terms" />
            </div>
            <Button className="w-full" disabled={!selectedPo || !reason.trim()} onClick={requestChange}>
              Send Change Request
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {workflowPo ? (
        <WorkflowChatSheet
          open={workflowOpen}
          onOpenChange={setWorkflowOpen}
          prId={workflowPo.prId}
          rfqId={workflowPo.rfqId}
          poId={workflowPo.id}
          requesterLabel={workflowPo.supplierName ?? "Organisation"}
        />
      ) : null}
    </div>
  );
}
