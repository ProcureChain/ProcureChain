"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CheckCircle2, CircleDollarSign, Clock3, FileSignature, MessageSquareText, MoreHorizontal, PackageCheck, Truck } from "lucide-react";

import { ApiErrorAlert } from "@/components/common/api-error-alert";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { WorkflowChatSheet } from "@/components/workflow/workflow-chat-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { usePos } from "@/lib/query-hooks";
import { formatBusinessRef, formatDateTime, formatMoney } from "@/lib/format";
import type { PoStatus, PurchaseOrder } from "@/lib/types";

type LifecycleStep = "Released" | "Accepted" | "DN" | "Invoice" | "Signed" | "Paid" | "Close";

const lifecycleSteps: LifecycleStep[] = ["Released", "Accepted", "DN", "Invoice", "Signed", "Paid", "Close"];

function getLifecycleStage(po: PurchaseOrder) {
  if (po.status === "CLOSED") return "Closed";
  if (po.status === "CHANGE_REQUESTED") return "Change Requested";
  if (po.status === "ACCEPTED") return "Delivery Note Needed";
  if (po.status === "RELEASED") return "Awaiting Supplier";
  return "Draft";
}

function getNextAction(po: PurchaseOrder) {
  if (po.status === "DRAFT") return "Release PO";
  if (po.status === "RELEASED") return "Await supplier acceptance";
  if (po.status === "CHANGE_REQUESTED") return "Review supplier change";
  if (po.status === "ACCEPTED") return "Upload delivery note";
  if (po.status === "CLOSED") return "Closed";
  return "Review PO";
}

function stageClass(status: PoStatus) {
  switch (status) {
    case "ACCEPTED":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "CHANGE_REQUESTED":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "CLOSED":
      return "border-slate-300 bg-slate-100 text-slate-700";
    case "RELEASED":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "DRAFT":
    default:
      return "border-[var(--border)] bg-white text-[var(--text-secondary)]";
  }
}

function completedSteps(po: PurchaseOrder) {
  const completed = new Set<LifecycleStep>();
  if (po.releasedAt || ["RELEASED", "ACCEPTED", "CHANGE_REQUESTED", "CLOSED"].includes(po.status)) {
    completed.add("Released");
  }
  if (po.acceptedAt || ["ACCEPTED", "CLOSED"].includes(po.status)) {
    completed.add("Accepted");
  }
  if (po.status === "CLOSED") {
    lifecycleSteps.forEach((step) => completed.add(step));
  }
  return completed;
}

function ProgressDots({ po }: { po: PurchaseOrder }) {
  const completed = completedSteps(po);
  return (
    <div className="flex items-center gap-1">
      {lifecycleSteps.map((step, index) => {
        const done = completed.has(step);
        return (
          <div key={step} className="flex items-center gap-1">
            <div
              title={step}
              className={`flex h-6 w-6 items-center justify-center rounded-full border text-[9px] font-semibold ${
                done
                  ? "border-[var(--primary)] bg-[var(--primary)] text-white"
                  : "border-[var(--border)] bg-white text-[var(--text-muted)]"
              }`}
            >
              {done ? <CheckCircle2 className="h-3 w-3" /> : step.slice(0, 1)}
            </div>
            {index < lifecycleSteps.length - 1 ? (
              <div className={`hidden h-px w-2 sm:block ${done ? "bg-[var(--primary)]" : "bg-[var(--border)]"}`} />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function MetricCard({
  label,
  value,
  note,
  icon,
}: {
  label: string;
  value: string | number;
  note: string;
  icon: React.ReactNode;
}) {
  return (
    <Card className="rounded-3xl border-[var(--border)] bg-white shadow-[var(--shadow-sm)]">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-[var(--text-secondary)]">{label}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text-primary)]">{value}</p>
            <p className="mt-2 text-sm text-[var(--text-muted)]">{note}</p>
          </div>
          <div className="rounded-2xl bg-[var(--surface-muted)] p-3 text-[var(--secondary)]">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PurchaseOrdersPage() {
  const { data: pos = [], error } = usePos();
  const [selectedPo, setSelectedPo] = useState<PurchaseOrder | null>(null);
  const [workflowOpen, setWorkflowOpen] = useState(false);

  const analytics = useMemo(() => {
    const released = pos.filter((po) => po.status === "RELEASED").length;
    const accepted = pos.filter((po) => po.status === "ACCEPTED").length;
    const changes = pos.filter((po) => po.status === "CHANGE_REQUESTED").length;
    const closed = pos.filter((po) => po.status === "CLOSED").length;
    const committed = pos.reduce((sum, po) => sum + po.committedAmount, 0);
    const currency = pos[0]?.currency ?? "ZAR";
    return { released, accepted, changes, closed, committed, currency };
  }, [pos]);

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-[var(--border)] bg-white p-6 shadow-[var(--shadow-lg)]">
        <PageHeader
          title="Purchase Orders"
          description="Track awarded RFQs through release, supplier acceptance, delivery, invoice, payment, and closure."
        />

        {error ? (
          <div className="mt-4">
            <ApiErrorAlert error={error} />
          </div>
        ) : null}

        <section className="mt-6 grid gap-4 xl:grid-cols-5">
          <MetricCard label="Total POs" value={pos.length} note="Live purchase orders" icon={<PackageCheck className="h-5 w-5" />} />
          <MetricCard label="Awaiting Supplier" value={analytics.released} note="Released but not accepted" icon={<Clock3 className="h-5 w-5" />} />
          <MetricCard label="Accepted" value={analytics.accepted} note="Ready for delivery note" icon={<Truck className="h-5 w-5" />} />
          <MetricCard label="Change Requests" value={analytics.changes} note="Supplier requested updates" icon={<FileSignature className="h-5 w-5" />} />
          <MetricCard label="Committed" value={formatMoney(analytics.committed, analytics.currency)} note={`${analytics.closed} closed`} icon={<CircleDollarSign className="h-5 w-5" />} />
        </section>

        {pos.length === 0 ? (
          <div className="mt-6">
            <EmptyState title="No purchase orders yet" description="Purchase orders will appear here after RFQ award and supplier acceptance." ctaLabel="Go to RFQs" ctaHref="/rfqs" />
          </div>
        ) : (
          <section className="mt-6 overflow-hidden rounded-[28px] border border-[var(--border)] bg-white shadow-[var(--shadow-sm)]">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] bg-[linear-gradient(135deg,#FFFFFF_0%,#F7F8FA_100%)] px-5 py-5">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                  <PackageCheck className="h-4 w-4 text-[var(--secondary)]" />
                  Execution Register
                </div>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--text-primary)]">PO Register</h2>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">{pos.length} purchase orders in the current view</p>
              </div>
              <Badge variant="outline" className="rounded-full border-[var(--border)] bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">
                Lifecycle View
              </Badge>
            </div>

            <div>
              <table className="w-full table-fixed text-sm">
                <thead className="bg-[var(--surface-muted)] text-left text-[var(--text-muted)]">
                  <tr>
                    <th className="w-[30%] px-4 py-3 font-medium">PO & Supplier</th>
                    <th className="w-[16%] px-4 py-3 font-medium">Amount</th>
                    <th className="w-[18%] px-4 py-3 font-medium">Stage</th>
                    <th className="w-[24%] px-4 py-3 font-medium">Progress & Next Action</th>
                    <th className="w-[12%] px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pos.map((po) => (
                    <tr key={po.id} className="border-t border-[var(--border)] align-top transition hover:bg-[var(--surface-muted)]/70">
                      <td className="px-4 py-4">
                        <div className="space-y-1">
                          <Link href={`/purchase-orders/${po.id}`} className="font-semibold text-[var(--primary)] hover:underline">
                            {po.poNumber}
                          </Link>
                          <p className="truncate font-medium text-[var(--text-primary)]">{po.supplierName ?? "-"}</p>
                          <p className="text-xs text-[var(--text-muted)]">{po.lineItems?.length ?? 0} line items</p>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="outline" className="rounded-full border-[var(--border)] bg-white px-2.5 py-0.5 text-[10px] text-[var(--text-secondary)]">
                              {formatBusinessRef("RFQ", po.rfqId)}
                            </Badge>
                            <Badge variant="outline" className="rounded-full border-[var(--border)] bg-white px-2.5 py-0.5 text-[10px] text-[var(--text-secondary)]">
                              {formatBusinessRef("PR", po.prId)}
                            </Badge>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-semibold text-[var(--text-primary)]">{formatMoney(po.committedAmount, po.currency)}</p>
                        <p className="mt-1 text-xs text-[var(--text-muted)]">Updated {formatDateTime(po.updatedAt)}</p>
                      </td>
                      <td className="px-4 py-4">
                        <Badge variant="outline" className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${stageClass(po.status)}`}>
                          {getLifecycleStage(po)}
                        </Badge>
                        <p className="mt-2 text-xs text-[var(--text-muted)]">{po.status.replaceAll("_", " ")}</p>
                      </td>
                      <td className="px-4 py-4">
                        <div className="max-w-full overflow-hidden">
                          <ProgressDots po={po} />
                        </div>
                        <p className="font-medium text-[var(--text-primary)]">{getNextAction(po)}</p>
                        <p className="mt-1 text-xs text-[var(--text-muted)]">Workflow checkpoint</p>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="outline" className="h-9 w-9 rounded-full">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Open PO actions</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem asChild>
                              <Link href={`/purchase-orders/${po.id}`}>View Detail</Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedPo(po);
                                setWorkflowOpen(true);
                              }}
                            >
                              Workflow Chat
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href={`/finance?poId=${po.id}`}>Finance</Link>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </section>

      {selectedPo ? (
        <WorkflowChatSheet
          open={workflowOpen}
          onOpenChange={setWorkflowOpen}
          prId={selectedPo.prId}
          rfqId={selectedPo.rfqId}
          poId={selectedPo.id}
        />
      ) : null}
    </div>
  );
}
