"use client";

import { useEffect, useMemo, useState } from "react";
import { MessageSquareText } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/format";
import { runtimeConfig } from "@/lib/runtime-config";

type RequesterQueryMessage = {
  id: string;
  prId: string;
  rfqId?: string;
  author: "organization" | "requester";
  authorLabel: string;
  message: string;
  at: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prId: string;
  rfqId?: string;
  requesterLabel?: string;
};

function storageKey(prId: string, rfqId?: string) {
  return `procurechain.requester-query.${prId}.${rfqId ?? "pr-only"}`;
}

export function RequesterQuerySheet({ open, onOpenChange, prId, rfqId, requesterLabel }: Props) {
  const [message, setMessage] = useState("");
  const [thread, setThread] = useState<RequesterQueryMessage[]>([]);

  const key = useMemo(() => storageKey(prId, rfqId), [prId, rfqId]);
  const requesterName = requesterLabel?.trim() || "Requester";

  useEffect(() => {
    if (typeof window === "undefined" || !prId) return;
    try {
      const raw = window.localStorage.getItem(key);
      setThread(raw ? (JSON.parse(raw) as RequesterQueryMessage[]) : []);
    } catch {
      setThread([]);
    }
  }, [key, prId]);

  const persist = (next: RequesterQueryMessage[]) => {
    setThread(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(key, JSON.stringify(next));
    }
  };

  const submit = () => {
    if (!message.trim()) return;
    const nextMessage: RequesterQueryMessage = {
      id: crypto.randomUUID(),
      prId,
      rfqId,
      author: "organization",
      authorLabel: runtimeConfig.actorName,
      message: message.trim(),
      at: new Date().toISOString(),
    };
    persist([nextMessage, ...thread]);
    setMessage("");
    toast.success("Query saved to requester thread");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[420px] sm:max-w-[420px] p-0">
        <SheetHeader className="border-b">
          <SheetTitle className="flex items-center gap-2">
            <MessageSquareText className="h-4 w-4" />
            Requester Query
          </SheetTitle>
          <SheetDescription>
            Scoped to PR {prId}
            {rfqId ? ` • RFQ ${rfqId}` : ""}. This thread is only for this requisition context.
          </SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {thread.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-slate-500">
                No messages yet for this PR/RFQ thread.
              </div>
            ) : (
              thread.map((entry) => (
                <div key={entry.id} className="rounded-lg border bg-slate-50 p-3 text-sm">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="font-medium">{entry.authorLabel}</span>
                    <span className="text-xs text-slate-500">{formatDateTime(entry.at)}</span>
                  </div>
                  <p className="whitespace-pre-wrap text-slate-700">{entry.message}</p>
                </div>
              ))
            )}
          </div>
          <div className="border-t p-4">
            <div className="space-y-2">
              <Label htmlFor="requester-query-message">Message to {requesterName}</Label>
              <Textarea
                id="requester-query-message"
                rows={5}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Ask for clarification or additional detail"
              />
              <div className="flex justify-end">
                <Button disabled={!message.trim()} onClick={submit}>
                  Send query
                </Button>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
