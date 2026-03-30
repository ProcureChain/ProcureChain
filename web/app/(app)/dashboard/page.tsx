"use client";

import Link from "next/link";
import { useState } from "react";
import { useQueries } from "@tanstack/react-query";

import { KpiTile } from "@/components/common/kpi-tile";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { dashboardKpis } from "@/lib/mock-data";
import { formatDateTime } from "@/lib/format";
import {
  queryKeys,
  useAuditEvents,
  useBidAction,
  useFinanceAction,
  usePoAction,
  usePos,
  useRequisitions,
  useRfqs,
} from "@/lib/query-hooks";
import * as liveApi from "@/lib/api/live-api";
import * as mockApi from "@/lib/api/mock-api";
import { runtimeConfig } from "@/lib/runtime-config";
import { useHydrated } from "@/lib/use-hydrated";
import type { Bid, DeliveryNote, LiveInvoice, PurchaseOrder, Rfq } from "@/lib/types";
import { toast } from "sonner";

const supplierReadApi = runtimeConfig.useMockApi ? mockApi : liveApi;

function SupplierDashboard({ rfqs, pos }: { rfqs: Rfq[]; pos: PurchaseOrder[] }) {
  const bidAction = useBidAction();
  const poAction = usePoAction();
  const financeAction = useFinanceAction();

  const supplierId = runtimeConfig.supplierId;
  const [bidDialogOpen, setBidDialogOpen] = useState(false);
  const [selectedRfq, setSelectedRfq] = useState<Rfq | null>(null);
  const [bidAmount, setBidAmount] = useState("");
  const [changeDialogOpen, setChangeDialogOpen] = useState(false);
  const [selectedPo, setSelectedPo] = useState<PurchaseOrder | null>(null);
  const [changeReason, setChangeReason] = useState("");
  const [proposedTerms, setProposedTerms] = useState("");
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [invoicePo, setInvoicePo] = useState<PurchaseOrder | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceNotes, setInvoiceNotes] = useState("");
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);

  const openRfqs = rfqs.filter(
    (rfq) =>
      (rfq.status === "RELEASED" || rfq.status === "OPEN") &&
      (!supplierId || rfq.suppliers.some((supplier) => supplier.supplierId === supplierId)),
  );
  const supplierPos = pos.filter((po) => !supplierId || po.supplierId === supplierId);
  const awaitingResponse = supplierPos.filter((po) => po.status === "RELEASED" || po.status === "CHANGE_REQUESTED");
  const acceptedPos = supplierPos.filter((po) => po.status === "ACCEPTED");
  const submittedPos = supplierPos.filter((po) => po.status === "CLOSED");

  const bidQueries = useQueries({
    queries: openRfqs.map((rfq) => ({
      queryKey: [...queryKeys.bidsByRfq(rfq.id), runtimeConfig.portal, supplierId ?? "unknown"],
      queryFn: () => supplierReadApi.listBidsByRfq(rfq.id) as Promise<Bid[]>,
    })),
  });
  const deliveryQueries = useQueries({
    queries: acceptedPos.map((po) => ({
      queryKey: [...queryKeys.deliveryNotes(po.id), runtimeConfig.portal],
      queryFn: () => supplierReadApi.listDeliveryNotes(po.id) as Promise<DeliveryNote[]>,
    })),
  });
  const invoiceQueries = useQueries({
    queries: acceptedPos.map((po) => ({
      queryKey: [...queryKeys.liveInvoices(po.id), runtimeConfig.portal, supplierId ?? "unknown"],
      queryFn: () => supplierReadApi.listLiveInvoices(po.id) as Promise<LiveInvoice[]>,
    })),
  });

  const bidMap = new Map<string, Bid | undefined>(
    openRfqs.map((rfq, index) => {
      const bids = (bidQueries[index]?.data ?? []).filter((bid) => !supplierId || bid.supplierId === supplierId);
      return [rfq.id, bids[0]];
    }),
  );
  const deliveryMap = new Map<string, DeliveryNote[]>(
    acceptedPos.map((po, index) => [po.id, deliveryQueries[index]?.data ?? []]),
  );
  const invoiceMap = new Map<string, LiveInvoice[]>(
    acceptedPos.map((po, index) => [
      po.id,
      (invoiceQueries[index]?.data ?? []).filter((invoice) => !supplierId || invoice.supplierId === supplierId),
    ]),
  );
  const draftBidCount = Array.from(bidMap.values()).filter((bid) => bid?.status === "DRAFT").length;
  const submittedBidCount = Array.from(bidMap.values()).filter((bid) => bid?.status === "SUBMITTED").length;
  const invoicesReadyToCreate = acceptedPos.filter((po) => (deliveryMap.get(po.id) ?? []).length > 0).length;
  const invoicesSubmitted = Array.from(invoiceMap.values())
    .flat()
    .filter((invoice) => invoice.status === "SUBMITTED_TO_ORG" || invoice.status === "UNDER_REVIEW" || invoice.status === "SIGNED" || invoice.status === "PAID")
    .length;

  const openBidEditor = (rfq: Rfq) => {
    setSelectedRfq(rfq);
    setBidAmount(String(bidMap.get(rfq.id)?.totalBidValue ?? ""));
    setBidDialogOpen(true);
  };

  const saveBidDraft = async () => {
    if (!selectedRfq || !supplierId) return;
    try {
      await bidAction.mutateAsync({
        type: "upsert",
        rfqId: selectedRfq.id,
        supplierId,
        totalBidValue: Number(bidAmount),
      });
      toast.success("Bid draft saved");
      setBidDialogOpen(false);
    } catch (error) {
      console.error(error);
      toast.error("Bid draft save failed");
    }
  };

  const submitBid = async (rfqId: string) => {
    const bid = bidMap.get(rfqId);
    if (!bid?.id) return;
    try {
      await bidAction.mutateAsync({ type: "submit", bidId: bid.id });
      toast.success("Bid submitted");
    } catch (error) {
      console.error(error);
      toast.error("Bid submission failed");
    }
  };

  const acceptPo = async (poId: string) => {
    try {
      await poAction.mutateAsync({
        type: "respond",
        poId,
        action: "ACCEPT",
        requestedBy: runtimeConfig.actorName,
      });
      toast.success("PO accepted");
    } catch (error) {
      console.error(error);
      toast.error("PO acceptance failed");
    }
  };

  const openChangeDialog = (po: PurchaseOrder) => {
    setSelectedPo(po);
    setChangeReason("");
    setProposedTerms(po.terms ?? "");
    setChangeDialogOpen(true);
  };

  const requestChange = async () => {
    if (!selectedPo) return;
    try {
      await poAction.mutateAsync({
        type: "respond",
        poId: selectedPo.id,
        action: "REQUEST_CHANGE",
        reason: changeReason,
        proposedTerms,
        requestedBy: runtimeConfig.actorName,
      });
      toast.success("Change request sent");
      setChangeDialogOpen(false);
    } catch (error) {
      console.error(error);
      toast.error("PO change request failed");
    }
  };

  const openInvoiceDialog = (po: PurchaseOrder) => {
    setInvoicePo(po);
    setInvoiceNumber("");
    setInvoiceNotes("");
    setInvoiceFile(null);
    setInvoiceDialogOpen(true);
  };

  const createInvoiceDraft = async () => {
    if (!invoicePo) return;
    const deliveryNoteId = deliveryMap.get(invoicePo.id)?.[0]?.id;
    try {
      await financeAction.mutateAsync({
        type: "create-supplier-invoice",
        poId: invoicePo.id,
        deliveryNoteId,
        invoiceNumber: invoiceNumber || undefined,
        notes: invoiceNotes || undefined,
        taxIncluded: true,
        taxRatePercent: 15,
        file: invoiceFile,
      });
      toast.success("Supplier invoice draft created");
      setInvoiceDialogOpen(false);
    } catch (error) {
      console.error(error);
      toast.error("Invoice draft creation failed");
    }
  };

  const submitInvoice = async (invoiceId: string) => {
    try {
      await financeAction.mutateAsync({
        type: "submit-live-invoice",
        invoiceId,
      });
      toast.success("Invoice forwarded to organisation");
    } catch (error) {
      console.error(error);
      toast.error("Invoice submission failed");
    }
  };

  if (!supplierId) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={`Welcome, ${runtimeConfig.actorName}`}
          description="Supplier dashboard requires a supplier profile selection in the test login screen."
        />
        <Card>
          <CardHeader>
            <CardTitle>No Supplier Profile Selected</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-600">Go back to the login screen, switch to the Supplier tab, and select the supplier profile you want to operate as.</p>
            <Button asChild>
              <Link href="/login">Return to Login</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${runtimeConfig.actorName}`}
        description="Supplier workspace for bids, PO response, and invoice submission."
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile label="Open RFx" value={String(openRfqs.length)} delta="Available opportunities" />
        <KpiTile label="Awaiting Supplier Approval" value={String(awaitingResponse.length)} delta="POs needing acceptance" />
        <KpiTile label="Accepted POs" value={String(acceptedPos.length)} delta="Ready for invoice workflow" />
        <KpiTile label="Completed POs" value={String(submittedPos.length)} delta="Closed commercial flows" />
      </section>

      <section className="grid gap-4 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>RFx Opportunities</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-600">
            <p>Released and open RFx invitations linked to this supplier.</p>
            <div className="rounded-lg border bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Current Queue</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{openRfqs.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bids Module</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-600">
            <p>Create draft bids and submit them against supplier-assigned RFx only.</p>
            <div className="rounded-lg border bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Draft / Submitted</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">
                {draftBidCount} / {submittedBidCount}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>PO Actions Module</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-600">
            <p>Accept released POs or send back a structured change request.</p>
            <div className="rounded-lg border bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Awaiting / Accepted</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">
                {awaitingResponse.length} / {acceptedPos.length}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Invoicing Module</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-600">
            <p>Create supplier invoices after delivery-note upload and forward them to the organisation.</p>
            <div className="rounded-lg border bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Ready / Forwarded</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">
                {invoicesReadyToCreate} / {invoicesSubmitted}
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Module 1: RFx And Bids</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {openRfqs.slice(0, 6).map((rfq) => {
              const bid = bidMap.get(rfq.id);
              return (
                <div key={rfq.id} className="rounded-lg border p-3">
                  <p className="font-medium">{rfq.title}</p>
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                    <span>{rfq.status}</span>
                    <span>{formatDateTime(rfq.updatedAt)}</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-600">Current bid: {bid?.status ?? "Not started"}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => openBidEditor(rfq)}>
                      {bid ? "Edit Draft Bid" : "Create Draft Bid"}
                    </Button>
                    {bid?.status === "DRAFT" ? (
                      <Button size="sm" onClick={() => submitBid(rfq.id)}>
                        Submit Bid
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })}
            {!openRfqs.length ? <p className="text-sm text-slate-500">No open RFx available for this supplier.</p> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Module 2: PO Response</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {supplierPos.slice(0, 6).map((po) => (
              <div key={po.id} className="rounded-lg border p-3">
                <p className="font-medium">{po.poNumber}</p>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                  <span>{po.status}</span>
                  <span>{formatDateTime(po.updatedAt)}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {po.status === "RELEASED" || po.status === "CHANGE_REQUESTED" ? (
                    <>
                      <Button size="sm" onClick={() => acceptPo(po.id)}>
                        Accept PO
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openChangeDialog(po)}>
                        Request Change
                      </Button>
                    </>
                  ) : null}
                  {po.status === "ACCEPTED" ? (
                    <p className="text-xs font-medium text-emerald-700">Accepted. Waiting for organisation delivery note upload.</p>
                  ) : null}
                </div>
              </div>
            ))}
            {!supplierPos.length ? <p className="text-sm text-slate-500">No purchase orders assigned to this supplier.</p> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Module 3: Supplier Invoicing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {acceptedPos.slice(0, 6).map((po) => {
              const deliveryNotes = deliveryMap.get(po.id) ?? [];
              const invoices = invoiceMap.get(po.id) ?? [];
              const draftInvoice = invoices.find((invoice) => invoice.status === "DRAFT");
              const submittedInvoice = invoices.find((invoice) => invoice.status !== "DRAFT");

              return (
                <div key={po.id} className="rounded-lg border p-3">
                  <p className="font-medium">{po.poNumber}</p>
                  <div className="mt-2 text-xs text-slate-500">
                    Delivery notes: {deliveryNotes.length} • Invoice status: {submittedInvoice?.status ?? draftInvoice?.status ?? "Not started"}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {!draftInvoice && !submittedInvoice ? (
                      <Button size="sm" variant="outline" disabled={deliveryNotes.length < 1} onClick={() => openInvoiceDialog(po)}>
                        Create Invoice Draft
                      </Button>
                    ) : null}
                    {draftInvoice ? (
                      <Button size="sm" onClick={() => submitInvoice(draftInvoice.id)}>
                        Forward To Organisation
                      </Button>
                    ) : null}
                  </div>
                  {deliveryNotes.length < 1 ? (
                    <p className="mt-2 text-xs text-amber-700">Waiting for organisation delivery note upload.</p>
                  ) : null}
                </div>
              );
            })}
            {!acceptedPos.length ? <p className="text-sm text-slate-500">No accepted POs ready for invoicing.</p> : null}
          </CardContent>
        </Card>
      </section>

      <Dialog open={bidDialogOpen} onOpenChange={setBidDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedRfq ? `Bid for ${selectedRfq.title}` : "Create Bid"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="bid-amount">Bid amount</Label>
              <Input id="bid-amount" value={bidAmount} onChange={(e) => setBidAmount(e.target.value)} placeholder="Total bid value" />
            </div>
            <Button className="w-full" disabled={!selectedRfq || !supplierId || !Number(bidAmount)} onClick={saveBidDraft}>
              Save Draft Bid
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={changeDialogOpen} onOpenChange={setChangeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedPo ? `Request change for ${selectedPo.poNumber}` : "Request PO change"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="change-reason">Reason</Label>
              <Textarea id="change-reason" value={changeReason} onChange={(e) => setChangeReason(e.target.value)} placeholder="Describe the change required" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="proposed-terms">Proposed terms</Label>
              <Input id="proposed-terms" value={proposedTerms} onChange={(e) => setProposedTerms(e.target.value)} placeholder="Optional revised terms" />
            </div>
            <Button className="w-full" disabled={!selectedPo || !changeReason.trim()} onClick={requestChange}>
              Send Change Request
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={invoiceDialogOpen} onOpenChange={setInvoiceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{invoicePo ? `Create invoice for ${invoicePo.poNumber}` : "Create Supplier Invoice"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="invoice-number">Invoice number</Label>
              <Input id="invoice-number" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="Supplier invoice number" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="invoice-notes">Notes</Label>
              <Textarea id="invoice-notes" value={invoiceNotes} onChange={(e) => setInvoiceNotes(e.target.value)} placeholder="Invoice notes" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="invoice-file">Invoice file</Label>
              <Input id="invoice-file" type="file" onChange={(e) => setInvoiceFile(e.target.files?.[0] ?? null)} />
            </div>
            <Button className="w-full" disabled={!invoicePo} onClick={createInvoiceDraft}>
              Create Supplier Invoice Draft
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OrganizationDashboard() {
  const { data: reqs = [] } = useRequisitions();
  const { data: events = [] } = useAuditEvents();

  const pending = reqs.filter((r) => r.status === "UNDER_REVIEW" || r.status === "SUBMITTED").length;
  const drafts = reqs.filter((r) => r.status === "DRAFT").length;
  const returned = reqs.filter((r) => r.status === "RETURNED").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Good morning, ${runtimeConfig.actorName}`}
        description={`Visibility for approvals, spend, and execution in one place. Active roles: ${runtimeConfig.actorRoles.join(", ")}`}
        actions={
          <Button asChild>
            <Link href="/requisitions/new">Create requisition</Link>
          </Button>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {dashboardKpis.map((kpi) => (
          <KpiTile key={kpi.id} label={kpi.label} value={kpi.value} delta={kpi.delta} />
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>My Work</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border p-4">
              <p className="text-sm text-slate-500">Pending approvals</p>
              <p className="mt-1 text-2xl font-semibold">{pending}</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm text-slate-500">Draft PRs</p>
              <p className="mt-1 text-2xl font-semibold">{drafts}</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm text-slate-500">Returned PRs</p>
              <p className="mt-1 text-2xl font-semibold">{returned}</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm text-slate-500">Recently updated</p>
              <p className="mt-1 text-2xl font-semibold">{reqs.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity (Audit)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {events.slice(0, 5).map((event) => (
              <div key={event.id} className="rounded-lg border p-3">
                <p className="text-sm font-medium">{event.action}</p>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                  <span>{event.actor}</span>
                  <span>{formatDateTime(event.at)}</span>
                </div>
              </div>
            ))}
            {!events.length ? <p className="text-sm text-slate-500">No audit events available.</p> : null}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

export default function DashboardPage() {
  const hydrated = useHydrated();
  const { data: rfqs = [] } = useRfqs();
  const { data: pos = [] } = usePos();

  if (!hydrated) {
    return <div className="space-y-6" />;
  }

  if (runtimeConfig.isSupplierPortal) {
    return <SupplierDashboard rfqs={rfqs} pos={pos} />;
  }

  return <OrganizationDashboard />;
}
