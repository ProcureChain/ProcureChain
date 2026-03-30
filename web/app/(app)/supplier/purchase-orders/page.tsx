"use client";

import { useState } from "react";
import { toast } from "sonner";

import { ApiErrorAlert } from "@/components/common/api-error-alert";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateTime, formatMoney } from "@/lib/format";
import { usePoAction, usePos } from "@/lib/query-hooks";
import { runtimeConfig } from "@/lib/runtime-config";
import type { PurchaseOrder } from "@/lib/types";

export default function SupplierPurchaseOrdersPage() {
  const { data: pos = [], error } = usePos();
  const poAction = usePoAction();
  const [selectedPo, setSelectedPo] = useState<PurchaseOrder | null>(null);
  const [reason, setReason] = useState("");
  const [proposedTerms, setProposedTerms] = useState("");

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
      <PageHeader title="Supplier Purchase Orders" description="Review released purchase orders, accept them, or send back a change request." />
      {error ? <ApiErrorAlert error={error} /> : null}
      {poAction.error ? <ApiErrorAlert error={poAction.error} /> : null}

      {pos.length === 0 ? (
        <EmptyState title="No supplier POs" description="Awarded and released purchase orders assigned to this supplier will appear here." />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Supplier PO Register</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left">
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
                    <tr key={po.id} className="border-b align-top">
                      <td className="px-3 py-2 font-medium">{po.poNumber}</td>
                      <td className="px-3 py-2">{po.status}</td>
                      <td className="px-3 py-2">{formatMoney(po.committedAmount, po.currency)}</td>
                      <td className="px-3 py-2 font-mono text-xs text-slate-600">{po.rfqId}</td>
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
                          {po.status === "ACCEPTED" ? <span className="text-xs font-medium text-emerald-700">Accepted</span> : null}
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
    </div>
  );
}
