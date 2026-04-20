"use client";

import { useMemo, useState } from "react";
import { MessageSquareText, Milestone } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { formatBusinessRef, formatDateTime } from "@/lib/format";
import { useWorkflowMessageAction, useWorkflowThread } from "@/lib/query-hooks";
import { runtimeConfig } from "@/lib/runtime-config";
import type { WorkflowThreadEntry } from "@/lib/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prId: string;
  rfqId?: string;
  poId?: string;
  requesterLabel?: string;
};

function eventLabel(entry: Extract<WorkflowThreadEntry, { type: "event" }>) {
  const fallback = entry.eventType.replace(/_/g, " ").toLowerCase();
  return fallback.charAt(0).toUpperCase() + fallback.slice(1);
}

function eventContext(entry: Extract<WorkflowThreadEntry, { type: "event" }>) {
  switch (entry.entityType) {
    case "PurchaseRequisition":
      return formatBusinessRef("PR", entry.entityId ?? undefined);
    case "RFQ":
      return formatBusinessRef("RFQ", entry.entityId ?? undefined);
    case "PurchaseOrder":
      return formatBusinessRef("PO", entry.entityId ?? undefined);
    case "Bid":
      return formatBusinessRef("BID", entry.entityId ?? undefined);
    case "Invoice":
      return "Invoice";
    case "DeliveryNote":
      return "Delivery Note";
    default:
      return entry.entityType;
  }
}

function renderPayloadSummary(entry: Extract<WorkflowThreadEntry, { type: "event" }>) {
  if (!entry.payload || typeof entry.payload !== "object") return null;
  const payload = entry.payload as Record<string, unknown>;
  if (typeof payload.overrideReason === "string") return payload.overrideReason;
  if (typeof payload.reason === "string") return payload.reason;
  if (typeof payload.notes === "string") return payload.notes;
  if (typeof payload.comment === "string") return payload.comment;
  if (typeof payload.title === "string") return payload.title;
  if (typeof payload.noteNumber === "string") return payload.noteNumber;
  if (typeof payload.invoiceNumber === "string") return payload.invoiceNumber;
  return null;
}

export function WorkflowChatSheet({ open, onOpenChange, prId, rfqId, poId, requesterLabel }: Props) {
  const [message, setMessage] = useState("");
  const { data, isLoading, error } = useWorkflowThread(prId);
  const messageAction = useWorkflowMessageAction();

  const requesterName = requesterLabel?.trim() || "Workflow participants";
  const entries = useMemo(() => data?.entries ?? [], [data?.entries]);

  const submit = async () => {
    if (!message.trim()) return;
    try {
      await messageAction.mutateAsync({
        prId,
        message: message.trim(),
        authorLabel: runtimeConfig.actorName,
      });
      setMessage("");
      toast.success("Workflow message posted");
    } catch (submitError) {
      console.error(submitError);
      toast.error("Workflow message failed");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[460px] sm:max-w-[460px] p-0">
        <SheetHeader className="border-b">
          <SheetTitle className="flex items-center gap-2">
            <MessageSquareText className="h-4 w-4" />
            Workflow Chat
          </SheetTitle>
          <SheetDescription>
            Scoped to {formatBusinessRef("PR", prId)}
            {rfqId ? ` • ${formatBusinessRef("RFQ", rfqId)}` : ""}
            {poId ? ` • ${formatBusinessRef("PO", poId)}` : ""}. Messages and audit events stay on this workflow thread.
          </SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                Unable to load the workflow conversation.
              </div>
            ) : isLoading ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-slate-500">
                Loading workflow conversation...
              </div>
            ) : entries.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-slate-500">
                No workflow events or messages yet for this PR.
              </div>
            ) : (
              entries.map((entry) =>
                entry.type === "message" ? (
                  <div key={entry.id} className="rounded-lg border bg-slate-50 p-3 text-sm">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="font-medium">{entry.authorLabel}</span>
                      <span className="text-xs text-slate-500">{formatDateTime(entry.at)}</span>
                    </div>
                    <p className="whitespace-pre-wrap text-slate-700">{entry.message}</p>
                  </div>
                ) : (
                  <div key={entry.id} className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-700">
                          {eventContext(entry)}
                        </span>
                        <span className="font-medium text-slate-900">{eventLabel(entry)}</span>
                      </div>
                      <span className="text-xs text-slate-500">{formatDateTime(entry.at)}</span>
                    </div>
                    <div className="flex items-start gap-2 text-slate-700">
                      <Milestone className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
                      <div>
                        <p>Recorded by {entry.authorLabel || "System"}</p>
                        {renderPayloadSummary(entry) ? <p className="mt-1 text-slate-600">{renderPayloadSummary(entry)}</p> : null}
                      </div>
                    </div>
                  </div>
                ),
              )
            )}
          </div>
          <div className="border-t p-4">
            <div className="space-y-2">
              <Label htmlFor="workflow-chat-message">Message to {requesterName}</Label>
              <Textarea
                id="workflow-chat-message"
                rows={5}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Post a workflow note, clarification, or decision against this PR thread"
              />
              <div className="flex justify-between gap-2">
                <p className="text-xs text-slate-500">Audit events are automatic and immutable. User messages are appended to the same thread.</p>
                <Button disabled={!message.trim() || messageAction.isPending} onClick={submit}>
                  Send message
                </Button>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
