"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { CheckCircle2, CircleDot, Clock3, FileText, MessageSquareText, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { ApiErrorAlert } from "@/components/common/api-error-alert";
import { BidComparisonBarChart } from "@/components/bids/bid-comparison-bar-chart";
import { PageHeader } from "@/components/common/page-header";
import { PermissionNote } from "@/components/common/permission-note";
import { WorkflowChatSheet } from "@/components/workflow/workflow-chat-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatBusinessRef, formatCountryWithFlag, formatDateTime } from "@/lib/format";
import { useAuditEvents, useBidsByRfq, useOrganizationProfile, useRfq, useRfqAction, useRfqSupplierForms, useSupplierFormAction, useSupplierFormTemplates, useSuppliers } from "@/lib/query-hooks";
import { runtimeConfig } from "@/lib/runtime-config";
import { canPerformAction, permissionHint } from "@/lib/roles";
import type { AuditEvent } from "@/lib/types";

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

const auditActionLabel = (action: string) =>
  action
    .replace(/^RFQ_/, "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());

function auditTone(action: string) {
  if (action.includes("RELEASE")) return "border-blue-200 bg-blue-50 text-blue-700";
  if (action.includes("OPEN")) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (action.includes("AWARD")) return "border-amber-200 bg-amber-50 text-amber-700";
  if (action.includes("CLOSE")) return "border-slate-300 bg-slate-100 text-slate-700";
  return "border-[var(--border)] bg-white text-[var(--text-secondary)]";
}

function AuditIcon({ action }: { action: string }) {
  if (action.includes("AWARD")) return <ShieldCheck className="h-4 w-4" />;
  if (action.includes("RELEASE") || action.includes("OPEN")) return <CheckCircle2 className="h-4 w-4" />;
  if (action.includes("FORM")) return <FileText className="h-4 w-4" />;
  return <CircleDot className="h-4 w-4" />;
}

function auditDetail(event: AuditEvent) {
  const payload = event.after ?? {};
  const values = [
    typeof payload.status === "string" ? `Status: ${payload.status}` : null,
    typeof payload.releaseMode === "string" ? `Release: ${payload.releaseMode}` : null,
    typeof payload.reason === "string" ? payload.reason : null,
    typeof payload.overrideReason === "string" ? payload.overrideReason : null,
    typeof payload.templateId === "string" ? "Supplier form attached" : null,
  ].filter(Boolean);
  return values.length > 0 ? values.join(" • ") : event.details;
}

function RfqAuditTrail({ events }: { events: AuditEvent[] }) {
  const sorted = [...events].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return (
    <Card className="overflow-hidden rounded-[28px] border-[var(--border)] bg-white shadow-[var(--shadow-sm)]">
      <CardHeader className="border-b border-[var(--border)] bg-[linear-gradient(135deg,#FFFFFF_0%,#F7F8FA_100%)] pb-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
              <Clock3 className="h-4 w-4 text-[var(--secondary)]" />
              Activity Timeline
            </div>
            <CardTitle className="mt-3 text-2xl font-semibold tracking-tight text-[var(--text-primary)]">RFQ Audit Trail</CardTitle>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              Immutable RFQ lifecycle events captured from release through award and close.
            </p>
          </div>
          <div className="rounded-full border border-[var(--border)] bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">
            {sorted.length} Events
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-5">
        {sorted.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-6 text-sm text-[var(--text-muted)]">
            No RFQ audit events have been captured yet.
          </div>
        ) : (
          <div className="relative space-y-4">
            <div className="absolute left-5 top-5 bottom-5 w-px bg-[var(--border)]" />
            {sorted.map((event, index) => (
              <div key={event.id} className="relative flex gap-4">
                <div className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border ${auditTone(event.action)}`}>
                  <AuditIcon action={event.action} />
                </div>
                <div className="min-w-0 flex-1 rounded-3xl border border-[var(--border)] bg-white p-4 shadow-[var(--shadow-sm)]">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[var(--text-primary)]">{auditActionLabel(event.action)}</p>
                      <p className="mt-1 text-sm text-[var(--text-secondary)]">{auditDetail(event)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                        Step {sorted.length - index}
                      </p>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">{formatDateTime(event.at)}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[var(--surface-muted)] px-3 py-1 text-xs text-[var(--text-secondary)]">
                      Actor: {event.actor}
                    </span>
                    <span className="rounded-full bg-[var(--surface-muted)] px-3 py-1 text-xs text-[var(--text-secondary)]">
                      {formatBusinessRef(event.entityType, event.entityId)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function RfqDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: rfq, error } = useRfq(params.id);
  const { data: auditEvents = [], error: auditError } = useAuditEvents({ entityType: "RFQ", entityId: params.id, limit: 100 });
  const { data: suppliers = [] } = useSuppliers();
  const { data: bids = [] } = useBidsByRfq(params.id);
  const organizationProfile = useOrganizationProfile(!runtimeConfig.isSupplierPortal);
  const { data: formTemplates = [] } = useSupplierFormTemplates();
  const { data: attachedForms = [] } = useRfqSupplierForms(params.id);
  const action = useRfqAction();
  const formAction = useSupplierFormAction();

  const [supplierIdsInput, setSupplierIdsInput] = useState("");
  const [bidId, setBidId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [closeReason, setCloseReason] = useState("");
  const [releaseMode, setReleaseMode] = useState<"PRIVATE" | "LOCAL" | "GLOBAL">("PRIVATE");
  const [releaseDialogOpen, setReleaseDialogOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [queryOpen, setQueryOpen] = useState(false);

  const orgVerificationStatus = organizationProfile.data?.verificationStatus;
  const orgVerified = orgVerificationStatus === "VERIFIED";
  const canRelease = rfq?.status === "DRAFT" && canPerformAction("RFQ_RELEASE") && orgVerified;
  const canOpen = rfq?.status === "RELEASED" && canPerformAction("RFQ_OPEN");
  const canAward = rfq?.status === "OPEN" && canPerformAction("RFQ_AWARD");
  const canClose = rfq?.status === "OPEN" || rfq?.status === "AWARDED";

  const supplierLookup = useMemo(() => new Map(suppliers.map((s) => [s.id, s.name])), [suppliers]);
  const supplierById = useMemo(() => new Map(suppliers.map((supplier) => [supplier.id, supplier])), [suppliers]);
  const supplierMeta = useMemo(
    () =>
      Object.fromEntries(
        suppliers.map((supplier) => [supplier.id, { countryLabel: formatCountryWithFlag(supplier.country) }]),
      ),
    [suppliers],
  );
  const awardableBids = useMemo(
    () => bids.filter((bid) => ["SUBMITTED", "OPENED", "UNDER_EVALUATION", "SHORTLISTED", "AWARD_RECOMMENDED"].includes(bid.status)),
    [bids],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const search = new URLSearchParams(window.location.search);
    const formAttached = search.get("formAttached");
    const returnedReleaseMode = search.get("releaseMode");
    if (returnedReleaseMode && ["PRIVATE", "LOCAL", "GLOBAL"].includes(returnedReleaseMode)) {
      setReleaseMode(returnedReleaseMode as "PRIVATE" | "LOCAL" | "GLOBAL");
    }
    if (formAttached === "1") {
      setReleaseDialogOpen(true);
      toast.success("Additional supplier form attached", {
        description: "Review the release options, then click Release RFQ to publish it for bids.",
      });
      search.delete("formAttached");
      search.delete("releaseMode");
      const next = `${window.location.pathname}${search.toString() ? `?${search.toString()}` : ""}`;
      window.history.replaceState({}, "", next);
    }
  }, []);

  if (error) return <ApiErrorAlert error={error} />;
  if (!rfq) return <div className="rounded-xl border bg-white p-8 text-sm text-slate-500">Loading RFQ...</div>;

  const runAction = async (executor: () => Promise<unknown>, okMessage: string) => {
    try {
      await executor();
      toast.success(okMessage);
    } catch (err) {
      toast.error("RFQ action failed");
      console.error(err);
    }
  };

  const attachSelectedTemplate = async () => {
    if (!selectedTemplateId) return;
    await formAction.mutateAsync({
      type: "attach-rfq-form",
      rfqId: rfq.id,
      templateId: selectedTemplateId,
      isRequired: true,
    });
    setSelectedTemplateId("");
    toast.success("Supplier form attached to RFQ");
  };

  const releaseRfqNow = async () => {
    await action.mutateAsync({ type: "release", rfqId: rfq.id, releaseMode, localCountryCode: runtimeConfig.organizationCountry });
    setReleaseDialogOpen(false);
    toast.success(`RFQ released (${releaseMode})`);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={`${rfq.title}`}
        description={`${formatBusinessRef("RFQ", rfq.id)} • ${formatBusinessRef("PR", rfq.prId)} • Status ${rfq.status}${rfq.releaseMode ? ` • ${rfq.releaseMode} release` : ""}`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setQueryOpen(true)}>
              <MessageSquareText className="mr-2 h-4 w-4" />
              Workflow Chat
            </Button>
            <Button asChild><Link href={`/bids?rfqId=${rfq.id}`}>Manage Bids</Link></Button>
          </div>
        }
      />
      {action.error ? <ApiErrorAlert error={action.error} /> : null}
      {organizationProfile.error ? <ApiErrorAlert error={organizationProfile.error} /> : null}
      {auditError ? <ApiErrorAlert error={auditError} /> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>RFQ Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid gap-2 md:grid-cols-2">
              <p><span className="font-medium">Budget:</span> {rfq.budgetAmount ?? "-"} {rfq.currency ?? ""}</p>
              <p><span className="font-medium">Payment Terms:</span> {rfq.paymentTerms ?? "-"}</p>
              <p><span className="font-medium">Tax Included:</span> {rfq.taxIncluded == null ? "-" : rfq.taxIncluded ? "Yes" : "No"}</p>
              <p><span className="font-medium">Price Validity:</span> {rfq.priceValidityDays ? `${rfq.priceValidityDays} days` : "-"}</p>
              <p><span className="font-medium">Method:</span> {rfq.procurementMethod ?? "-"}</p>
              <p><span className="font-medium">Band:</span> {rfq.procurementBand ?? "-"}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>RFQ Lifecycle Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {!canPerformAction("RFQ_RELEASE") ? <PermissionNote message={permissionHint("RFQ_RELEASE")} /> : null}
            {!orgVerified ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                RFQ release is blocked until the organization verification status is <span className="font-semibold">VERIFIED</span>.
                Current status: <span className="font-semibold">{orgVerificationStatus ?? "MISSING_PROFILE"}</span>.
              </div>
            ) : null}
            <div className="space-y-1">
              <Label htmlFor="release-mode">Release mode</Label>
              <Select value={releaseMode} onValueChange={(value) => setReleaseMode(value as "PRIVATE" | "LOCAL" | "GLOBAL")}>
                <SelectTrigger id="release-mode">
                  <SelectValue placeholder="Select release mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRIVATE">Private (selected suppliers only)</SelectItem>
                  <SelectItem value="LOCAL">Local (tagged suppliers in {runtimeConfig.organizationCountry})</SelectItem>
                  <SelectItem value="GLOBAL">Global (all tagged suppliers in category)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">
                Private requires manually linked suppliers. Local auto-invites tagged suppliers in {runtimeConfig.organizationCountry}. Global auto-invites tagged suppliers regardless of country.
              </p>
            </div>
            <Button
              className="w-full"
              disabled={!canRelease || action.isPending}
              onClick={() => setReleaseDialogOpen(true)}
            >
              Release RFQ
            </Button>
            {!canPerformAction("RFQ_OPEN") ? <PermissionNote message={permissionHint("RFQ_OPEN")} /> : null}
            <Button className="w-full" disabled={!canOpen || action.isPending} onClick={() => runAction(() => action.mutateAsync({ type: "open", rfqId: rfq.id }), "RFQ opened")}>
              Open RFQ
            </Button>
            <Button className="w-full" variant="outline" disabled={!canClose || action.isPending} onClick={() => runAction(() => action.mutateAsync({ type: "close", rfqId: rfq.id, reason: closeReason }), "RFQ closed")}>
              Close RFQ
            </Button>
            <Textarea value={closeReason} onChange={(e) => setCloseReason(e.target.value)} placeholder="Reason (required when closing OPEN without award)" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Add Suppliers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="supplier-ids">Supplier IDs (comma-separated)</Label>
            <Input id="supplier-ids" value={supplierIdsInput} onChange={(e) => setSupplierIdsInput(e.target.value)} placeholder="uuid-1,uuid-2" />
            <Button
              variant="outline"
              disabled={!supplierIdsInput || action.isPending}
              onClick={() =>
                runAction(
                  () =>
                    action.mutateAsync({
                      type: "add-suppliers",
                      rfqId: rfq.id,
                      supplierIds: supplierIdsInput
                        .split(",")
                        .map((value) => value.trim())
                        .filter(Boolean),
                    }),
                  "Suppliers added",
                )
              }
            >
              Add Suppliers
            </Button>
            <div className="text-xs text-slate-500">
              Known suppliers: {suppliers.map((s) => s.name).join(" • ") || "none"}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={releaseDialogOpen} onOpenChange={setReleaseDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Release RFQ</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="release-mode-dialog">Release mode</Label>
              <Select value={releaseMode} onValueChange={(value) => setReleaseMode(value as "PRIVATE" | "LOCAL" | "GLOBAL")}>
                <SelectTrigger id="release-mode-dialog">
                  <SelectValue placeholder="Select release mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRIVATE">Private (selected suppliers only)</SelectItem>
                  <SelectItem value="LOCAL">Local (tagged suppliers in {runtimeConfig.organizationCountry})</SelectItem>
                  <SelectItem value="GLOBAL">Global (all tagged suppliers in category)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">
                Optionally attach an additional supplier response form before releasing this RFQ.
              </p>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <div className="space-y-3 rounded-lg border p-4">
                <div>
                  <p className="font-medium">Attach Existing Form</p>
                  <p className="text-xs text-slate-500">Use a reusable supplier form template for this RFQ.</p>
                </div>
                <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select reusable template" />
                  </SelectTrigger>
                  <SelectContent>
                    {formTemplates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} ({t.fields.length} fields)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" disabled={!selectedTemplateId || formAction.isPending} onClick={() => void attachSelectedTemplate()}>
                  Attach Template
                </Button>
              </div>

              <div className="space-y-3 rounded-lg border p-4">
                <div>
                  <p className="font-medium">Create Additional Form</p>
                  <p className="text-xs text-slate-500">Build a new RFQ-specific supplier form on a dedicated screen, then return here to release.</p>
                </div>
                <Button
                  variant="outline"
                  onClick={() =>
                    router.push(`/rfqs/${rfq.id}/forms/new?returnToRelease=1&releaseMode=${releaseMode}`)
                  }
                >
                  Add New Form
                </Button>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setReleaseDialogOpen(false)}>
                Cancel
              </Button>
              <Button disabled={action.isPending || formAction.isPending} onClick={() => void releaseRfqNow()}>
                Release RFQ
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>Award RFQ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!canPerformAction("RFQ_AWARD") ? <PermissionNote message={permissionHint("RFQ_AWARD")} /> : null}
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="space-y-1">
              <Label>Winning bid</Label>
              <Select
                value={bidId}
                onValueChange={(value) => {
                  setBidId(value);
                  const selectedBid = bids.find((bid) => bid.id === value);
                  if (selectedBid) setSupplierId(selectedBid.supplierId);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select bid" />
                </SelectTrigger>
                <SelectContent>
                  {awardableBids.map((bid) => (
                    <SelectItem key={bid.id} value={bid.id}>
                      {(bid.supplierName ?? supplierLookup.get(bid.supplierId) ?? bid.supplierId)} • {bidStatusLabel(bid.status)} • {bid.totalBidValue ?? "-"} {bid.currency ?? ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Winning supplier</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {rfq.suppliers.map((link) => (
                    <SelectItem key={link.id} value={link.supplierId}>
                      {link.supplierName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Override reason</Label>
            <Input value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} placeholder="Mandatory justification for award decision" />
          </div>
          <div>
            <Button
              className="w-full sm:w-auto"
              disabled={!canAward || !bidId || !supplierId || !overrideReason || action.isPending}
              onClick={() =>
                runAction(
                  () => action.mutateAsync({ type: "award", rfqId: rfq.id, bidId, supplierId, overrideReason }),
                  "RFQ awarded",
                )
              }
            >
              Award RFQ
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Suppliers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {rfq.suppliers.length ? (
              rfq.suppliers.map((link) => (
                <p key={link.id}>
                  {link.supplierName ?? formatBusinessRef("SUP", link.supplierId)}
                </p>
              ))
            ) : (
              <p className="text-slate-500">No suppliers linked.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bids</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {bids.length ? (
              <BidComparisonBarChart bids={bids} supplierMeta={supplierMeta} />
            ) : null}

            {bids.length ? (
              <div className="grid gap-3 xl:grid-cols-2">
                {bids.map((bid) => {
                  const supplier = supplierById.get(bid.supplierId);
                  const metrics = [
                    ["Profile", supplier?.profileScore],
                    ["Compliance", supplier?.complianceScore],
                    ["Delivery", supplier?.deliveryScore],
                    ["Quality", supplier?.qualityScore],
                    ["Risk", supplier?.riskScore],
                  ] as const;
                  return (
                    <div key={`rfq-bid-score-${bid.id}`} className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-semibold text-[var(--text-primary)]">{supplierLookup.get(bid.supplierId) ?? formatBusinessRef("SUP", bid.supplierId)}</p>
                          <p className="text-xs text-[var(--text-muted)]">{supplierMeta[bid.supplierId]?.countryLabel ?? "N/A"}</p>
                        </div>
                        <Badge variant="outline" className="rounded-full">{bidStatusLabel(bid.status)}</Badge>
                      </div>
                      <div className="mt-3 grid grid-cols-5 gap-2">
                        {metrics.map(([label, score]) => (
                          <div key={`${bid.id}-${label}`} className="rounded-lg border border-[var(--border)] bg-white p-2 text-center">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">{label}</p>
                            <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{score ?? "N/A"}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}

            {bids.length ? (
              bids.map((bid) => (
                <div key={bid.id} className="flex items-center justify-between rounded border p-2">
                  <p>
                    {formatBusinessRef("BID", bid.id)} • {supplierLookup.get(bid.supplierId) ?? formatBusinessRef("SUP", bid.supplierId)} • {supplierMeta[bid.supplierId]?.countryLabel ?? "N/A"} • {bidStatusLabel(bid.status)}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setBidId(bid.id);
                        setSupplierId(bid.supplierId);
                        if (!overrideReason) setOverrideReason("Best evaluated response");
                      }}
                    >
                      Select for Award
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/bids/${bid.id}`}>Review</Link>
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-slate-500">No bids yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <RfqAuditTrail events={auditEvents} />

      <WorkflowChatSheet
        open={queryOpen}
        onOpenChange={setQueryOpen}
        prId={rfq.prId}
        rfqId={rfq.id}
      />
    </div>
  );
}
