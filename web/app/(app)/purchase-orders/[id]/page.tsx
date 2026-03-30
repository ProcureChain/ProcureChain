"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { ApiErrorAlert } from "@/components/common/api-error-alert";
import { PageHeader } from "@/components/common/page-header";
import { PermissionNote } from "@/components/common/permission-note";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  downloadDeliveryNoteDocument,
  downloadLiveInvoiceDocument,
  downloadLiveInvoicePdf,
  previewLiveInvoiceDocument,
} from "@/lib/api/live-api";
import { formatDateTime, formatMoney } from "@/lib/format";
import { useDeliveryNotes, useFinanceAction, useLiveInvoices, usePo, usePoAction } from "@/lib/query-hooks";
import { canPerformAction, permissionHint } from "@/lib/roles";
import { runtimeConfig } from "@/lib/runtime-config";

export default function PurchaseOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const { data: po, error } = usePo(params.id);
  const action = usePoAction();
  const financeAction = useFinanceAction();
  const { data: deliveryNotes = [] } = useDeliveryNotes(params.id);
  const { data: liveInvoices = [] } = useLiveInvoices(params.id);

  const [closeReason, setCloseReason] = useState("");
  const [deliveryDialogOpen, setDeliveryDialogOpen] = useState(false);
  const [deliveryNoteNumber, setDeliveryNoteNumber] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [receivedBy, setReceivedBy] = useState(runtimeConfig.actorName);
  const [deliveryRemarks, setDeliveryRemarks] = useState("");
  const [deliveryFile, setDeliveryFile] = useState<File | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentProofFile, setPaymentProofFile] = useState<File | null>(null);

  if (error) return <ApiErrorAlert error={error} />;
  if (!po) return <div className="rounded-xl border bg-white p-8 text-sm text-slate-500">Loading purchase order...</div>;

  const latestChangeRequest = po.changeRequests?.[0] ?? null;
  const released = po.status !== "DRAFT";
  const accepted = po.status === "ACCEPTED" || po.status === "CLOSED";
  const deliveryUploaded = deliveryNotes.length > 0;
  const invoiceSubmitted = liveInvoices.some((invoice) => ["SUBMITTED_TO_ORG", "UNDER_REVIEW", "SIGNED", "PAID", "CLOSED"].includes(invoice.status));
  const invoiceSigned = liveInvoices.some((invoice) => ["SIGNED", "PAID", "CLOSED"].includes(invoice.status));
  const invoicePaid = liveInvoices.some((invoice) => ["PAID", "CLOSED"].includes(invoice.status));
  const canClosePo = liveInvoices.some((invoice) => invoice.status === "PAID");
  const timelineSteps = [
    { label: "Released", done: released },
    { label: "Accepted", done: accepted },
    { label: "Delivery Note Uploaded", done: deliveryUploaded },
    { label: "Invoice Submitted", done: invoiceSubmitted },
    { label: "Signed", done: invoiceSigned },
    { label: "Paid", done: invoicePaid },
    { label: "Ready to Close", done: canClosePo },
  ];

  const run = async (task: () => Promise<unknown>, label: string) => {
    try {
      await task();
      toast.success(label);
    } catch (err) {
      toast.error("PO action failed");
      console.error(err);
    }
  };

  const runFinance = async (task: () => Promise<unknown>, label: string) => {
    try {
      await task();
      toast.success(label);
    } catch (err) {
      toast.error("Invoice action failed");
      console.error(err);
    }
  };

  const createDeliveryNote = async () => {
    await runFinance(
      () =>
        financeAction.mutateAsync({
          type: "create-delivery-note",
          poId: po.id,
          noteNumber: deliveryNoteNumber || undefined,
          deliveryDate: deliveryDate || undefined,
          receivedBy: receivedBy || undefined,
          remarks: deliveryRemarks || "PO delivery captured",
          file: deliveryFile,
        }),
      "Delivery note uploaded",
    );
    setDeliveryDialogOpen(false);
    setDeliveryNoteNumber("");
    setDeliveryDate("");
    setReceivedBy(runtimeConfig.actorName);
    setDeliveryRemarks("");
    setDeliveryFile(null);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={`PO ${po.poNumber}`}
        description={`Status ${po.status} • ${formatMoney(po.committedAmount, po.currency)} • Supplier ${po.supplierName ?? "-"}`}
      />

      {action.error ? <ApiErrorAlert error={action.error} /> : null}
      {financeAction.error ? <ApiErrorAlert error={financeAction.error} /> : null}

      <Card>
        <CardHeader>
          <CardTitle>PO Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
            {timelineSteps.map((step, index) => (
              <div
                key={step.label}
                className={`rounded-lg border p-3 ${
                  step.done ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                      step.done ? "bg-emerald-600 text-white" : "bg-slate-300 text-slate-700"
                    }`}
                  >
                    {index + 1}
                  </div>
                  <p className="text-sm font-medium text-slate-900">{step.label}</p>
                </div>
                <p className={`mt-2 text-xs ${step.done ? "text-emerald-700" : "text-slate-500"}`}>
                  {step.done ? "Complete" : "Pending"}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>PO Summary</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm md:grid-cols-2">
          <p>RFQ: {po.rfqId}</p>
          <p>PR: {po.prId}</p>
          <p>Terms: {po.terms ?? "-"}</p>
          <p>Notes: {po.notes ?? "-"}</p>
          <p>Commercial-only: {po.commercialOnly ? "Yes" : "No"}</p>
          <p>Accepted At: {po.acceptedAt ? formatDateTime(po.acceptedAt) : "-"}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Step 1: Release PO</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {!canPerformAction("PO_RELEASE") ? <PermissionNote message={permissionHint("PO_RELEASE")} /> : null}
          <p className="text-slate-600">Release the PO to the supplier. The supplier must accept the PO before delivery note upload and invoicing continue.</p>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={po.status !== "DRAFT" || action.isPending || !canPerformAction("PO_RELEASE")}
              onClick={() => run(() => action.mutateAsync({ type: "release", poId: po.id }), "PO released")}
            >
              Release PO
            </Button>
            {!canPerformAction("PO_CLOSE") ? <PermissionNote message={permissionHint("PO_CLOSE")} /> : null}
            <Button
              variant="destructive"
              disabled={po.status === "CLOSED" || action.isPending || !canPerformAction("PO_CLOSE") || !canClosePo}
              onClick={() => run(() => action.mutateAsync({ type: "close", poId: po.id, reason: closeReason }), "PO closed")}
            >
              Close PO
            </Button>
            <Input value={closeReason} onChange={(e) => setCloseReason(e.target.value)} placeholder="Close reason" className="min-w-[220px]" />
          </div>
          {!canClosePo ? <p className="text-xs text-slate-500">Close PO becomes available only after an invoice for this PO is signed and payment is confirmed.</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Step 2: Supplier Response</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {po.status === "ACCEPTED" ? (
            <p className="font-medium text-emerald-700">Supplier accepted this PO on {po.acceptedAt ? formatDateTime(po.acceptedAt) : "-"}.</p>
          ) : po.status === "CHANGE_REQUESTED" ? (
            <div className="space-y-1">
              <p className="font-medium text-amber-700">Supplier requested changes.</p>
              <p>Requested at: {latestChangeRequest?.createdAt ? formatDateTime(latestChangeRequest.createdAt) : "-"}</p>
              <p>Reason: {latestChangeRequest?.reason ?? "-"}</p>
              <p>Proposed terms: {latestChangeRequest?.proposedTerms ?? "-"}</p>
              <p>Requested by: {latestChangeRequest?.requestedBy ?? "-"}</p>
            </div>
          ) : (
            <p className="text-slate-500">Awaiting supplier acceptance or change request.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Step 3: Organisation Delivery Note Upload</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-slate-600">Once the supplier accepts, upload the delivery note from the organisation side.</p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={financeAction.isPending || po.status !== "ACCEPTED"}
              onClick={() => setDeliveryDialogOpen(true)}
            >
              Upload Delivery Note
            </Button>
          </div>
          {deliveryNotes.length === 0 ? (
            <p className="text-slate-500">No delivery note uploaded yet.</p>
          ) : (
            <div className="space-y-2">
              {deliveryNotes.map((note) => (
                <div key={note.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                  <div>
                    <p className="font-medium text-slate-900">{note.noteNumber}</p>
                    <p className="text-slate-600">{formatDateTime(note.deliveryDate)} • {note.status}</p>
                  </div>
                  {note.documentName ? (
                    <Button size="sm" variant="outline" onClick={() => downloadDeliveryNoteDocument(note.id)}>
                      Download Delivery Note
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Step 4: Supplier Invoice</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-slate-600">After the delivery note is uploaded, the supplier creates and submits the invoice from the supplier side. The submitted invoice will appear below under this PO.</p>
          {liveInvoices.length === 0 ? (
            <p className="text-slate-500">No supplier invoice submitted for this PO yet.</p>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <Input value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} placeholder="Review/signing notes" />
                <Input value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} placeholder="Payment reference" />
                <Input value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} placeholder="Amount paid" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment-proof-file">Proof of payment file</Label>
                <Input id="payment-proof-file" type="file" onChange={(e) => setPaymentProofFile(e.target.files?.[0] ?? null)} />
                {paymentProofFile ? <p className="text-xs text-slate-500">Selected: {paymentProofFile.name}</p> : null}
              </div>
              {liveInvoices.map((invoice) => (
                <div key={invoice.id} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-medium text-slate-900">{invoice.invoiceNumber}</p>
                      <p className="text-slate-600">{invoice.status} • {formatMoney(invoice.totalAmount, invoice.currency)}</p>
                      {invoice.submittedAt ? <p className="text-slate-600">Submitted {formatDateTime(invoice.submittedAt)}</p> : null}
                      {invoice.reviewedAt ? <p className="text-slate-600">Reviewed {formatDateTime(invoice.reviewedAt)}</p> : null}
                      {invoice.signedAt ? <p className="text-slate-600">Signed {formatDateTime(invoice.signedAt)}</p> : null}
                      {invoice.paidAt ? <p className="text-slate-600">Paid {formatDateTime(invoice.paidAt)}</p> : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => previewLiveInvoiceDocument(invoice.id)}>
                        Preview Invoice
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => downloadLiveInvoicePdf(invoice.id)}>
                        Download PDF
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => downloadLiveInvoiceDocument(invoice.id, "source")}>
                        Download Source
                      </Button>
                      {invoice.status === "SUBMITTED_TO_ORG" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={financeAction.isPending}
                          onClick={() =>
                            runFinance(
                              () => financeAction.mutateAsync({ type: "review-live-invoice", invoiceId: invoice.id, notes: reviewNotes || undefined }),
                              "Invoice moved to review",
                            )
                          }
                        >
                          Move To Review
                        </Button>
                      ) : null}
                      {invoice.status === "UNDER_REVIEW" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={financeAction.isPending}
                          onClick={() => runFinance(() => financeAction.mutateAsync({ type: "sign-live-invoice", invoiceId: invoice.id }), "Invoice signed")}
                        >
                          Sign Invoice
                        </Button>
                      ) : null}
                      {invoice.status === "SIGNED" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={financeAction.isPending || !paymentProofFile}
                          onClick={() =>
                            runFinance(
                              () =>
                                financeAction.mutateAsync({
                                  type: "mark-live-invoice-paid",
                                  invoiceId: invoice.id,
                                  paymentReference: paymentReference || undefined,
                                  amountPaid: paymentAmount ? Number(paymentAmount) : undefined,
                                  notes: reviewNotes || undefined,
                                  file: paymentProofFile,
                                }),
                              "Payment confirmed",
                            )
                          }
                        >
                          Confirm Payment
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  {invoice.paymentProofs.length > 0 ? (
                    <div className="mt-3 border-t pt-3 text-slate-600">
                      {invoice.paymentProofs.map((proof) => (
                        <p key={proof.id}>
                          POP {proof.paymentReference ?? "-"} • {formatMoney(proof.amountPaid, invoice.currency)}
                          {proof.popName ? ` • ${proof.popName}` : ""}
                        </p>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={deliveryDialogOpen}
        onOpenChange={(open) => {
          if (!financeAction.isPending) setDeliveryDialogOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Delivery Note</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="delivery-note-number">Delivery note number</Label>
              <Input id="delivery-note-number" value={deliveryNoteNumber} onChange={(e) => setDeliveryNoteNumber(e.target.value)} placeholder="DN-20260312-001" />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="delivery-date">Delivery date</Label>
                <Input id="delivery-date" type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="received-by">Received by</Label>
                <Input id="received-by" value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} placeholder="Receiver name" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="delivery-remarks">Remarks</Label>
              <Input id="delivery-remarks" value={deliveryRemarks} onChange={(e) => setDeliveryRemarks(e.target.value)} placeholder="Delivery note remarks" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="delivery-file">Delivery note file</Label>
              <Input id="delivery-file" type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" onChange={(e) => setDeliveryFile(e.target.files?.[0] ?? null)} />
              {deliveryFile ? <p className="text-xs text-slate-500">Selected: {deliveryFile.name}</p> : null}
            </div>
            {financeAction.error ? <ApiErrorAlert error={financeAction.error} /> : null}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeliveryDialogOpen(false)} disabled={financeAction.isPending}>
                Cancel
              </Button>
              <Button onClick={createDeliveryNote} disabled={financeAction.isPending || !deliveryFile}>
                {financeAction.isPending ? "Uploading..." : "Upload Delivery Note"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
