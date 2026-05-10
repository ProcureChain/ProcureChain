"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Download, MessageSquareText } from "lucide-react";

import { ApiErrorAlert } from "@/components/common/api-error-alert";
import { PageHeader } from "@/components/common/page-header";
import { PermissionNote } from "@/components/common/permission-note";
import { POTemplatePreview } from "@/components/purchase-orders/po-template-preview";
import { WorkflowChatSheet } from "@/components/workflow/workflow-chat-sheet";
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
import { formatBusinessRef, formatDateTime, formatMoney } from "@/lib/format";
import {
  useDeliveryNotes,
  useFinanceAction,
  useLiveInvoices,
  useOrganizationProfile,
  usePo,
  usePoAction,
  useRequisition,
  useRfq,
  useSupplier,
} from "@/lib/query-hooks";
import { canPerformAction, permissionHint } from "@/lib/roles";
import { runtimeConfig } from "@/lib/runtime-config";

export default function PurchaseOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const { data: po, error } = usePo(params.id);
  const action = usePoAction();
  const financeAction = useFinanceAction();
  const { data: deliveryNotes = [] } = useDeliveryNotes(params.id);
  const { data: liveInvoices = [] } = useLiveInvoices(params.id);
  const { data: orgProfile } = useOrganizationProfile();
  const { data: rfq } = useRfq(po?.rfqId ?? "");
  const { data: requisition } = useRequisition(po?.prId ?? "");
  const { data: supplier } = useSupplier(po?.supplierId ?? "");

  const [closeReason, setCloseReason] = useState("");
  const [deliveryDialogOpen, setDeliveryDialogOpen] = useState(false);
  const [deliveryOverrideDialogOpen, setDeliveryOverrideDialogOpen] = useState(false);
  const [deliveryNoteNumber, setDeliveryNoteNumber] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [receivedBy, setReceivedBy] = useState(runtimeConfig.actorName);
  const [deliveryRemarks, setDeliveryRemarks] = useState("");
  const [deliveryOverrideReason, setDeliveryOverrideReason] = useState("");
  const [deliveryFile, setDeliveryFile] = useState<File | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentProofFile, setPaymentProofFile] = useState<File | null>(null);
  const [workflowOpen, setWorkflowOpen] = useState(false);

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

  const proceedWithoutDeliveryNoteUpload = async () => {
    await runFinance(
      () =>
        financeAction.mutateAsync({
          type: "create-delivery-note",
          poId: po.id,
          noteNumber: deliveryNoteNumber || undefined,
          deliveryDate: deliveryDate || undefined,
          receivedBy: receivedBy || undefined,
          remarks: deliveryRemarks || "Delivery note upload manually overridden by organisation",
          manualOverride: true,
          manualOverrideReason: deliveryOverrideReason,
        }),
      "Manual override recorded. Proceeded without file upload.",
    );
    setDeliveryOverrideDialogOpen(false);
    setDeliveryDialogOpen(false);
    setDeliveryNoteNumber("");
    setDeliveryDate("");
    setReceivedBy(runtimeConfig.actorName);
    setDeliveryRemarks("");
    setDeliveryOverrideReason("");
    setDeliveryFile(null);
  };

  const downloadPoPdf = () => {
    void (async () => {
      const node = document.getElementById("po-template-printable");
      if (!node) {
        toast.error("PO template preview is not ready yet");
        return;
      }
      try {
        const [{ toPng }, { jsPDF }] = await Promise.all([
          import("html-to-image"),
          import("jspdf"),
        ]);

        const imgData = await toPng(node, {
          cacheBust: true,
          pixelRatio: 2,
          backgroundColor: "#f2f2f2",
        });
        const pdf = new jsPDF("p", "mm", "a4");
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const img = new Image();
        img.src = imgData;
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error("Failed to load generated PO image"));
        });

        const imgWidth = pageWidth;
        const imgHeight = (img.height * imgWidth) / img.width;

        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight, undefined, "FAST");
        heightLeft -= pageHeight;

        while (heightLeft > 0) {
          position = heightLeft - imgHeight;
          pdf.addPage();
          pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight, undefined, "FAST");
          heightLeft -= pageHeight;
        }

        pdf.save(`${po.poNumber || "purchase-order"}.pdf`);
      } catch (err) {
        console.error(err);
        toast.error("Failed to download PO PDF");
      }
    })();
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={`PO ${po.poNumber}`}
        description={`Status ${po.status} • ${formatMoney(po.committedAmount, po.currency)} • Supplier ${po.supplierName ?? "-"}`}
        actions={
          <>
            <Button variant="outline" onClick={downloadPoPdf}>
              <Download className="mr-2 h-4 w-4" />
              Download PO PDF
            </Button>
            <Button variant="outline" onClick={() => setWorkflowOpen(true)}>
              <MessageSquareText className="mr-2 h-4 w-4" />
              Workflow Chat
            </Button>
          </>
        }
      />

      {action.error ? <ApiErrorAlert error={action.error} /> : null}
      {financeAction.error ? <ApiErrorAlert error={financeAction.error} /> : null}

      <Card>
        <CardHeader>
          <CardTitle>PO Template Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <POTemplatePreview
            po={po}
            rfq={rfq ?? undefined}
            requisition={requisition ?? undefined}
            organizationProfile={orgProfile ?? undefined}
            supplier={supplier ?? undefined}
          />
        </CardContent>
      </Card>

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
          <p>RFQ: {formatBusinessRef("RFQ", po.rfqId)}</p>
          <p>PR: {formatBusinessRef("PR", po.prId)}</p>
          <p>Terms: {po.terms ?? "-"}</p>
          <p>Notes: {po.notes ?? "-"}</p>
          <p>Commercial-only: {po.commercialOnly ? "Yes" : "No"}</p>
          <p>Accepted At: {po.acceptedAt ? formatDateTime(po.acceptedAt) : "-"}</p>
        </CardContent>
      </Card>

      {po.lineItems?.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Commercial Line Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left">
                    <th className="px-3 py-2 font-medium">Description</th>
                    <th className="px-3 py-2 font-medium">Qty</th>
                    <th className="px-3 py-2 font-medium">UOM</th>
                    <th className="px-3 py-2 font-medium">Unit Price</th>
                    <th className="px-3 py-2 font-medium">Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {po.lineItems.map((line) => (
                    <tr key={`${po.id}-${line.prLineId}`} className="border-b align-top">
                      <td className="px-3 py-2 font-medium">{line.description}</td>
                      <td className="px-3 py-2">{line.quantity}</td>
                      <td className="px-3 py-2">{line.uom ?? "-"}</td>
                      <td className="px-3 py-2">{formatMoney(line.unitPrice, po.currency)}</td>
                      <td className="px-3 py-2">{formatMoney(line.lineTotal, po.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}

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
                              "Supplier invoice accepted",
                            )
                          }
                        >
                          Accept Received Invoice
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
              <Button
                variant="outline"
                onClick={() => setDeliveryOverrideDialogOpen(true)}
                disabled={financeAction.isPending}
              >
                Proceed Without Upload
              </Button>
              <Button onClick={createDeliveryNote} disabled={financeAction.isPending || !deliveryFile}>
                {financeAction.isPending ? "Uploading..." : "Upload Delivery Note"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deliveryOverrideDialogOpen}
        onOpenChange={(open) => {
          if (!financeAction.isPending) setDeliveryOverrideDialogOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manual Override Warning</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              You are proceeding without uploading a delivery note document. This action is restricted to organisation users and will be written to the audit trail.
            </div>
            <div className="space-y-2">
              <Label htmlFor="delivery-override-reason">Override reason (required)</Label>
              <Input
                id="delivery-override-reason"
                value={deliveryOverrideReason}
                onChange={(e) => setDeliveryOverrideReason(e.target.value)}
                placeholder="Provide the reason for overriding delivery note upload"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setDeliveryOverrideDialogOpen(false)}
                disabled={financeAction.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={financeAction.isPending || !deliveryOverrideReason.trim()}
                onClick={proceedWithoutDeliveryNoteUpload}
              >
                Confirm Override
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <WorkflowChatSheet
        open={workflowOpen}
        onOpenChange={setWorkflowOpen}
        prId={po.prId}
        rfqId={po.rfqId}
        poId={po.id}
      />
    </div>
  );
}
