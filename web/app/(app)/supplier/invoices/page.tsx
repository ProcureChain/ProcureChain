"use client";

import { useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { toast } from "sonner";

import { ApiErrorAlert } from "@/components/common/api-error-alert";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/format";
import * as liveApi from "@/lib/api/live-api";
import * as mockApi from "@/lib/api/mock-api";
import { queryKeys, useFinanceAction, usePos } from "@/lib/query-hooks";
import { runtimeConfig } from "@/lib/runtime-config";
import type { DeliveryNote, LiveInvoice, PurchaseOrder } from "@/lib/types";

const supplierReadApi = runtimeConfig.useMockApi ? mockApi : liveApi;

export default function SupplierInvoicesPage() {
  const { data: pos = [], error } = usePos();
  const financeAction = useFinanceAction();
  const [selectedPo, setSelectedPo] = useState<PurchaseOrder | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceNotes, setInvoiceNotes] = useState("");
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);

  const invoiceReadyPos = useMemo(() => pos.filter((po) => po.status === "ACCEPTED"), [pos]);

  const deliveryQueries = useQueries({
    queries: invoiceReadyPos.map((po) => ({
      queryKey: [...queryKeys.deliveryNotes(po.id), runtimeConfig.portal],
      queryFn: () => supplierReadApi.listDeliveryNotes(po.id) as Promise<DeliveryNote[]>,
    })),
  });
  const invoiceQueries = useQueries({
    queries: invoiceReadyPos.map((po) => ({
      queryKey: [...queryKeys.liveInvoices(po.id), runtimeConfig.portal],
      queryFn: () => supplierReadApi.listLiveInvoices(po.id) as Promise<LiveInvoice[]>,
    })),
  });

  const deliveryMap = new Map<string, DeliveryNote[]>(invoiceReadyPos.map((po, index) => [po.id, deliveryQueries[index]?.data ?? []]));
  const invoiceMap = new Map<string, LiveInvoice[]>(invoiceReadyPos.map((po, index) => [po.id, invoiceQueries[index]?.data ?? []]));

  const createDraft = async () => {
    if (!selectedPo) return;
    const deliveryNoteId = deliveryMap.get(selectedPo.id)?.[0]?.id;
    try {
      await financeAction.mutateAsync({
        type: "create-supplier-invoice",
        poId: selectedPo.id,
        deliveryNoteId,
        invoiceNumber: invoiceNumber || undefined,
        notes: invoiceNotes || undefined,
        taxIncluded: true,
        taxRatePercent: 15,
        file: invoiceFile,
      });
      toast.success("Supplier invoice draft created");
      setSelectedPo(null);
      setInvoiceNumber("");
      setInvoiceNotes("");
      setInvoiceFile(null);
    } catch (err) {
      console.error(err);
      toast.error("Invoice draft creation failed");
    }
  };

  const submitInvoice = async (invoiceId: string) => {
    try {
      await financeAction.mutateAsync({ type: "submit-live-invoice", invoiceId });
      toast.success("Invoice forwarded to organisation");
    } catch (err) {
      console.error(err);
      toast.error("Invoice submission failed");
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Supplier Invoices" description="Create supplier invoices after delivery-note upload and forward them to the organisation." />
      {error ? <ApiErrorAlert error={error} /> : null}
      {financeAction.error ? <ApiErrorAlert error={financeAction.error} /> : null}

      {invoiceReadyPos.length === 0 ? (
        <EmptyState title="No invoicing work" description="Accepted purchase orders will appear here once they are ready for supplier invoicing." />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Supplier Invoice Worklist</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left">
                    <th className="px-3 py-2 font-medium">PO #</th>
                    <th className="px-3 py-2 font-medium">Delivery Notes</th>
                    <th className="px-3 py-2 font-medium">Invoice Status</th>
                    <th className="px-3 py-2 font-medium">Updated</th>
                    <th className="px-3 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceReadyPos.map((po) => {
                    const deliveryNotes = deliveryMap.get(po.id) ?? [];
                    const invoices = invoiceMap.get(po.id) ?? [];
                    const draft = invoices.find((invoice) => invoice.status === "DRAFT");
                    const latest = invoices[0];
                    return (
                      <tr key={po.id} className="border-b align-top">
                        <td className="px-3 py-2 font-medium">{po.poNumber}</td>
                        <td className="px-3 py-2">{deliveryNotes.length}</td>
                        <td className="px-3 py-2">{latest?.status ?? "Not started"}</td>
                        <td className="px-3 py-2">{formatDateTime(po.updatedAt)}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-2">
                            {!latest ? (
                              <Button size="sm" variant="outline" disabled={deliveryNotes.length < 1} onClick={() => setSelectedPo(po)}>
                                Create Draft
                              </Button>
                            ) : null}
                            {draft ? (
                              <Button size="sm" onClick={() => submitInvoice(draft.id)}>
                                Submit Invoice
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Submitted Invoices</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from(invoiceMap.values()).flat().length === 0 ? (
            <p className="text-sm text-slate-500">No supplier invoices yet.</p>
          ) : (
            Array.from(invoiceMap.values()).flat().map((invoice) => (
              <div key={invoice.id} className="rounded-lg border p-3">
                <p className="font-medium">{invoice.invoiceNumber}</p>
                <p className="mt-1 text-sm text-slate-600">{invoice.status} • {invoice.sourceDocumentName ?? "No source file"}</p>
                {invoice.submittedAt ? <p className="mt-1 text-xs text-slate-500">Submitted {formatDateTime(invoice.submittedAt)}</p> : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(selectedPo)} onOpenChange={(open) => !open && setSelectedPo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedPo ? `Create invoice for ${selectedPo.poNumber}` : "Create Invoice"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="supplier-invoice-number">Invoice number</Label>
              <Input id="supplier-invoice-number" value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} placeholder="Supplier invoice number" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="supplier-invoice-notes">Notes</Label>
              <Textarea id="supplier-invoice-notes" value={invoiceNotes} onChange={(event) => setInvoiceNotes(event.target.value)} placeholder="Invoice notes" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="supplier-invoice-file">Invoice file</Label>
              <Input id="supplier-invoice-file" type="file" onChange={(event) => setInvoiceFile(event.target.files?.[0] ?? null)} />
            </div>
            <Button className="w-full" disabled={!selectedPo} onClick={createDraft}>
              Create Supplier Invoice Draft
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
