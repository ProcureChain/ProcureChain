"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { ApiErrorAlert } from "@/components/common/api-error-alert";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { downloadDeliveryNoteDocument, downloadLiveInvoiceDocument, downloadLiveInvoicePdf, previewLiveInvoiceDocument } from "@/lib/api/live-api";
import { formatDateTime, formatMoney } from "@/lib/format";
import { useDeliveryNotes, useFinanceAction, useInvoices, useLiveInvoices, usePoValidation } from "@/lib/query-hooks";
import { runtimeConfig } from "@/lib/runtime-config";

export function FinanceClient() {
  const searchParams = useSearchParams();
  const initialPoId = searchParams.get("poId") ?? "";

  const [poId, setPoId] = useState(initialPoId);
  const [externalInvoiceId, setExternalInvoiceId] = useState("INV-MANUAL-001");
  const [amount, setAmount] = useState("0");
  const [deliveryDocUrl, setDeliveryDocUrl] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [popUrl, setPopUrl] = useState("");
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState("");
  const [supplierInvoiceNotes, setSupplierInvoiceNotes] = useState("");
  const [supplierInvoiceFile, setSupplierInvoiceFile] = useState<File | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [signedInvoiceFile, setSignedInvoiceFile] = useState<File | null>(null);

  const { data: invoices = [], error } = useInvoices(poId || undefined);
  const { data: validation, error: validationError } = usePoValidation(poId);
  const { data: deliveryNotes = [] } = useDeliveryNotes(poId);
  const { data: liveInvoices = [] } = useLiveInvoices(poId);
  const financeAction = useFinanceAction();
  const isSupplierActor = runtimeConfig.actorRoles.includes("SUPPLIER");

  const syncSingleSnapshot = async () => {
    try {
      await financeAction.mutateAsync({
        type: "sync-snapshot",
        sourceSystem: "MANUAL",
        snapshots: [
          {
            externalInvoiceId,
            poId: poId || undefined,
            currency: "ZAR",
            totalAmount: Number(amount),
            status: "POSTED",
          },
        ],
      });
      toast.success("Invoice snapshot synced");
    } catch (err) {
      toast.error("Invoice sync failed");
      console.error(err);
    }
  };

  const createDeliveryNote = async () => {
    if (!poId) return;
    try {
      await financeAction.mutateAsync({
        type: "create-delivery-note",
        poId,
        documentUrl: deliveryDocUrl || undefined,
        remarks: "Received for invoicing",
      });
      toast.success("Delivery note created");
    } catch (err) {
      toast.error("Delivery note creation failed");
      console.error(err);
    }
  };

  const createSupplierInvoiceDraft = async () => {
    if (!poId) return;
    try {
      await financeAction.mutateAsync({
        type: "create-supplier-invoice",
        poId,
        invoiceNumber: supplierInvoiceNumber || undefined,
        notes: supplierInvoiceNotes || undefined,
        taxIncluded: true,
        taxRatePercent: 15,
        file: supplierInvoiceFile,
      });
      toast.success("Supplier invoice draft created");
      setSupplierInvoiceNumber("");
      setSupplierInvoiceNotes("");
      setSupplierInvoiceFile(null);
    } catch (err) {
      toast.error("Supplier invoice creation failed");
      console.error(err);
    }
  };

  const submitInvoiceToOrg = async (invoiceId: string) => {
    try {
      await financeAction.mutateAsync({ type: "submit-live-invoice", invoiceId, notes: supplierInvoiceNotes || undefined });
      toast.success("Invoice forwarded to organisation");
    } catch (err) {
      toast.error("Invoice submission failed");
      console.error(err);
    }
  };

  const moveInvoiceToReview = async (invoiceId: string) => {
    try {
      await financeAction.mutateAsync({ type: "review-live-invoice", invoiceId, notes: reviewNotes || undefined });
      toast.success("Invoice moved to review");
    } catch (err) {
      toast.error("Invoice review failed");
      console.error(err);
    }
  };

  const signOnline = async (invoiceId: string) => {
    try {
      await financeAction.mutateAsync({ type: "sign-live-invoice", invoiceId });
      toast.success("Invoice signed online");
    } catch (err) {
      toast.error("Online signing failed");
      console.error(err);
    }
  };

  const uploadSignedCopy = async (invoiceId: string) => {
    if (!signedInvoiceFile) return;
    try {
      await financeAction.mutateAsync({ type: "upload-signed-invoice", invoiceId, file: signedInvoiceFile });
      toast.success("Signed invoice uploaded");
      setSignedInvoiceFile(null);
    } catch (err) {
      toast.error("Signed invoice upload failed");
      console.error(err);
    }
  };

  const markPaid = async (invoiceId: string) => {
    try {
      await financeAction.mutateAsync({
        type: "mark-live-invoice-paid",
        invoiceId,
        paymentReference: paymentReference || undefined,
        popUrl: popUrl || undefined,
        amountPaid: Number(amount) || undefined,
      });
      toast.success("Invoice marked paid");
    } catch (err) {
      toast.error("Payment posting failed");
      console.error(err);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Finance" description="Supplier invoice submission, organisation review, signing, and payment controls." />
      {error ? <ApiErrorAlert error={error} /> : null}
      {validationError ? <ApiErrorAlert error={validationError} /> : null}
      {financeAction.error ? <ApiErrorAlert error={financeAction.error} /> : null}

      <Card>
        <CardHeader>
          <CardTitle>Scope by PO</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-3">
          <Input value={poId} onChange={(e) => setPoId(e.target.value)} placeholder="PO UUID" />
          <Input value={externalInvoiceId} onChange={(e) => setExternalInvoiceId(e.target.value)} placeholder="External invoice id" />
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Total amount" />
          <div className="md:col-span-3">
            <Button disabled={!externalInvoiceId || Number(amount) < 0 || financeAction.isPending} onClick={syncSingleSnapshot}>
              Sync Invoice Snapshot
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Delivery Note</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-3">
          <Input value={deliveryDocUrl} onChange={(e) => setDeliveryDocUrl(e.target.value)} placeholder="Delivery note document URL" />
          <Input value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} placeholder="Payment reference" />
          <Input value={popUrl} onChange={(e) => setPopUrl(e.target.value)} placeholder="POP URL (optional)" />
          <div className="md:col-span-3 flex flex-wrap gap-2">
            <Button disabled={!poId || financeAction.isPending} onClick={createDeliveryNote}>
              Create Delivery Note
            </Button>
            {!isSupplierActor ? (
              <p className="text-sm text-slate-500">Supplier creates and forwards invoices. Organisation reviews, signs, and pays after submission.</p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {isSupplierActor ? (
        <Card>
          <CardHeader>
            <CardTitle>Supplier Invoice Submission</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 md:grid-cols-3">
            <Input value={supplierInvoiceNumber} onChange={(e) => setSupplierInvoiceNumber(e.target.value)} placeholder="Supplier invoice number" />
            <Input value={supplierInvoiceNotes} onChange={(e) => setSupplierInvoiceNotes(e.target.value)} placeholder="Supplier invoice notes" />
            <Input type="file" onChange={(e) => setSupplierInvoiceFile(e.target.files?.[0] ?? null)} />
            <div className="md:col-span-3">
              <Button disabled={!poId || deliveryNotes.length < 1 || financeAction.isPending} onClick={createSupplierInvoiceDraft}>
                Create Supplier Invoice Draft
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {validation ? (
        <Card>
          <CardHeader>
            <CardTitle>PO Invoice Validation</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm md:grid-cols-2">
            <p>PO: {validation.poNumber}</p>
            <p>Status: {validation.poStatus}</p>
            <p>Match status: {validation.matchStatus}</p>
            <p>Invoice count: {validation.invoiceCount}</p>
            <p>Committed: {formatMoney(validation.committedAmount, validation.currency)}</p>
            <p>Total invoiced: {formatMoney(validation.totalInvoiced, validation.currency)}</p>
            <p>Variance: {formatMoney(validation.varianceAmount, validation.currency)}</p>
            <p>Service family: {validation.serviceFamily}</p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Invoice Snapshots</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {invoices.length === 0 ? (
            <p className="text-slate-500">No invoice snapshots found.</p>
          ) : (
            invoices.map((invoice) => (
              <div key={invoice.id} className="rounded border p-2">
                <p className="font-medium">{invoice.externalInvoiceId}</p>
                <p className="text-slate-600">
                  {invoice.status ?? "-"} • {formatMoney(invoice.totalAmount, invoice.currency)} • PO {invoice.poId ?? invoice.poNumber ?? "-"}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Delivery Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {deliveryNotes.length === 0 ? (
            <p className="text-slate-500">No delivery notes yet.</p>
          ) : (
            deliveryNotes.map((note) => (
              <div key={note.id} className="rounded border p-2">
                <p className="font-medium">{note.noteNumber}</p>
                <p className="text-slate-600">{formatDateTime(note.deliveryDate)} • {note.status}</p>
                {note.documentName ? (
                  <div className="mt-2">
                    <Button size="sm" variant="outline" onClick={() => downloadDeliveryNoteDocument(note.id)}>
                      Download Delivery Note
                    </Button>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Live Invoices</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Input value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} placeholder="Organisation review notes" />
          {liveInvoices.length === 0 ? (
            <p className="text-slate-500">No live invoices yet.</p>
          ) : (
            liveInvoices.map((invoice) => (
              <div key={invoice.id} className="rounded border p-3">
                <p className="font-medium">{invoice.invoiceNumber}</p>
                <p className="text-slate-600">
                  {invoice.status} • {formatMoney(invoice.totalAmount, invoice.currency)} • proofs {invoice.paymentProofs.length}
                </p>
                <p className="text-slate-600">
                  source {invoice.sourceDocumentName ?? "-"} • signed {invoice.signedDocumentName ?? "-"}
                </p>
                {invoice.submittedAt ? <p className="text-slate-600">submitted {formatDateTime(invoice.submittedAt)}</p> : null}
                {invoice.reviewedAt ? <p className="text-slate-600">reviewed {formatDateTime(invoice.reviewedAt)}</p> : null}
                <div className="mt-2 flex flex-wrap gap-2">
                  {isSupplierActor && invoice.status === "DRAFT" ? (
                    <Button size="sm" variant="outline" disabled={financeAction.isPending} onClick={() => submitInvoiceToOrg(invoice.id)}>
                      Forward To Organisation
                    </Button>
                  ) : null}
                  {!isSupplierActor ? (
                    <Button size="sm" variant="outline" onClick={() => previewLiveInvoiceDocument(invoice.id)}>
                      Preview Invoice
                    </Button>
                  ) : null}
                  {!isSupplierActor ? (
                    <Button size="sm" variant="outline" onClick={() => downloadLiveInvoicePdf(invoice.id)}>
                      Download PDF
                    </Button>
                  ) : null}
                  {!isSupplierActor ? (
                    <Button size="sm" variant="outline" onClick={() => downloadLiveInvoiceDocument(invoice.id, "source")}>
                      Download Source
                    </Button>
                  ) : null}
                  {!isSupplierActor && invoice.status === "SUBMITTED_TO_ORG" ? (
                    <Button size="sm" variant="outline" disabled={financeAction.isPending} onClick={() => moveInvoiceToReview(invoice.id)}>
                      Move To Review
                    </Button>
                  ) : null}
                  {!isSupplierActor && invoice.status === "UNDER_REVIEW" ? (
                    <Button size="sm" variant="outline" disabled={financeAction.isPending} onClick={() => signOnline(invoice.id)}>
                      Sign Online
                    </Button>
                  ) : null}
                  {!isSupplierActor && invoice.status === "UNDER_REVIEW" ? (
                    <>
                      <Input type="file" className="max-w-[240px]" onChange={(e) => setSignedInvoiceFile(e.target.files?.[0] ?? null)} />
                      <Button size="sm" variant="outline" disabled={financeAction.isPending || !signedInvoiceFile} onClick={() => uploadSignedCopy(invoice.id)}>
                        Upload Signed Copy
                      </Button>
                    </>
                  ) : null}
                  {!isSupplierActor && invoice.signedDocumentName ? (
                    <Button size="sm" variant="outline" onClick={() => downloadLiveInvoiceDocument(invoice.id, "signed")}>
                      Download Signed Invoice
                    </Button>
                  ) : null}
                  {!isSupplierActor && invoice.status === "SIGNED" ? (
                    <Button size="sm" variant="outline" disabled={financeAction.isPending} onClick={() => markPaid(invoice.id)}>
                      Mark Paid
                    </Button>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
