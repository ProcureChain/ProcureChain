"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, MessageSquareText, PencilLine, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { ApiErrorAlert } from "@/components/common/api-error-alert";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { WorkflowChatSheet } from "@/components/workflow/workflow-chat-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatBusinessRef, formatDateTime } from "@/lib/format";
import { useCreateRfq, useRequisitions, useRfqs } from "@/lib/query-hooks";
import { Requisition, Rfq } from "@/lib/types";

const currencyOptions = ["ZAR", "USD", "EUR", "GBP"];
const paymentTermsOptions = ["IMMEDIATE", "NET_7", "NET_15", "NET_30", "NET_60", "NET_90"];
const priceValidityOptions = [7, 15, 30, 60, 90];

export default function RfqsPage() {
  const router = useRouter();
  const { data: requisitions = [], error: requisitionsError } = useRequisitions();
  const { data: rfqRows = [], error: rfqError } = useRfqs();
  const createRfq = useCreateRfq();

  const [selectedPrId, setSelectedPrId] = useState("");
  const [rfqTitle, setRfqTitle] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("NET_30");
  const [currency, setCurrency] = useState("ZAR");
  const [taxIncluded, setTaxIncluded] = useState("YES");
  const [priceValidityDays, setPriceValidityDays] = useState("30");
  const [budget, setBudget] = useState("");

  const [queryOpen, setQueryOpen] = useState(false);
  const [queryPrId, setQueryPrId] = useState("");

  const rfqs: Rfq[] = rfqRows ?? [];
  const existingRfqPrIds = useMemo(() => new Set(rfqs.map((row) => row.prId)), [rfqs]);
  const approvedPrs = useMemo(
    () =>
      (requisitions ?? [])
        .filter((pr) => pr.status === "APPROVED")
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [requisitions],
  );
  const latestApprovedPr = approvedPrs[0];
  const selectedPr = approvedPrs.find((pr) => pr.id === selectedPrId) ?? latestApprovedPr ?? null;

  const selectedPrAlreadyConverted = selectedPr ? existingRfqPrIds.has(selectedPr.id) : false;

  const isCommercialComplete = Boolean(rfqTitle.trim() && paymentTerms && currency && taxIncluded && priceValidityDays && Number(budget) > 0);

  const syncCommercialDefaults = (pr: Requisition) => {
    setSelectedPrId(pr.id);
    setRfqTitle(`${pr.title} RFx`);
    setCurrency("ZAR");
    setBudget("");
  };

  const submitCreate = async () => {
    if (!selectedPr) return;
    if (selectedPrAlreadyConverted) {
      toast.error("RFx already exists", { description: "This PR is already converted to RFQ." });
      return;
    }

    const notes = [
      `paymentTerms=${paymentTerms}`,
      `currency=${currency}`,
      `taxIncluded=${taxIncluded}`,
      `priceValidityDays=${priceValidityDays}`,
      `budget=${budget}`,
    ].join("; ");

    const created = await createRfq.mutateAsync({
      prId: selectedPr.id,
      title: rfqTitle.trim(),
      budgetAmount: Number(budget),
      currency,
      paymentTerms,
      taxIncluded: taxIncluded === "YES",
      priceValidityDays: Number(priceValidityDays),
      notes,
    });
    toast.success("RFQ created", { description: formatBusinessRef("RFQ", created.id) });
    router.push(`/rfqs/${created.id}`);
  };

  return (
    <div className="space-y-5">
      <PageHeader title="RFx" description="Convert approved PRs into RFQs with commercial controls and tracked requester queries." />
      {requisitionsError ? <ApiErrorAlert error={requisitionsError} /> : null}
      {rfqError ? <ApiErrorAlert error={rfqError} /> : null}
      {createRfq.error ? <ApiErrorAlert error={createRfq.error} /> : null}

      {latestApprovedPr ? (
        <Card className="gap-0 overflow-hidden rounded-[28px] border-[var(--border)] bg-white py-0 shadow-[var(--shadow-md)]">
          <CardContent className="p-0">
            <div className="grid lg:grid-cols-[2fr_1fr] lg:items-stretch">
              <div className="space-y-5 p-6 lg:p-7">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                      <Sparkles className="h-4 w-4 text-[var(--secondary)]" />
                      Latest Approved PR
                    </div>
                    <p className="mt-3 text-2xl font-semibold tracking-tight text-[var(--text-primary)]">{latestApprovedPr.title}</p>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">{formatBusinessRef("PR", latestApprovedPr.id)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="border-0 bg-emerald-600 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white hover:bg-emerald-600">
                      {latestApprovedPr.status}
                    </Badge>
                    {latestApprovedPr.editedAfterApprovalAt ? (
                      <Badge variant="outline" className="rounded-full border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">
                        Edited
                      </Badge>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl bg-[var(--surface-muted)] p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Requester</p>
                    <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">{latestApprovedPr.requester}</p>
                  </div>
                  <div className="rounded-2xl bg-[var(--surface-muted)] p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Department</p>
                    <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">{latestApprovedPr.department}</p>
                  </div>
                  <div className="rounded-2xl bg-[var(--surface-muted)] p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Cost Centre</p>
                    <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">{latestApprovedPr.costCenter}</p>
                  </div>
                  <div className="rounded-2xl bg-[var(--surface-muted)] p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Updated</p>
                    <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">{formatDateTime(latestApprovedPr.updatedAt)}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Justification</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-primary)]">{latestApprovedPr.justification || "-"}</p>
                </div>
              </div>

              <div className="flex h-full flex-col justify-between bg-[linear-gradient(180deg,#2D334A_0%,#202840_100%)] p-6 text-white lg:p-7">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <ShieldCheck className="h-4 w-4" />
                    RFQ Launch Block
                  </div>
                  <p className="mt-3 text-sm leading-6 text-white/75">
                    Start the RFQ conversion flow from the latest approved requisition, edit the source PR, or query the requester without leaving RFx.
                  </p>
                </div>

                <div className="mt-6 space-y-3">
                  <Button
                    className="w-full rounded-full bg-white text-[var(--primary)] hover:bg-white/90"
                    onClick={() => router.push(`/rfqs/new?prId=${latestApprovedPr.id}`)}
                  >
                    Create RFQ
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                  <Button asChild variant="outline" className="w-full rounded-full border-white/15 bg-white/10 text-white hover:bg-white/15 hover:text-white">
                    <Link href={`/requisitions/new?edit=${latestApprovedPr.id}&source=rfq`}>
                      <PencilLine className="mr-2 h-4 w-4" />
                      Edit PR
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full rounded-full border-white/15 bg-white/10 text-white hover:bg-white/15 hover:text-white"
                    onClick={() => {
                      setQueryPrId(latestApprovedPr.id);
                      setQueryOpen(true);
                    }}
                  >
                    <MessageSquareText className="mr-2 h-4 w-4" />
                    Workflow Chat
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <EmptyState title="No approved PR available" description="Approve a PR in the approvals queue before creating RFQs in RFx." ctaLabel="Go to approvals" ctaHref="/approvals" />
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Create RFQ from Approved PR</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="approved-pr-id">Approved PR</Label>
              <Select value={selectedPr?.id ?? ""} onValueChange={(id) => setSelectedPrId(id)}>
                <SelectTrigger id="approved-pr-id">
                  <SelectValue placeholder="Select approved PR" />
                </SelectTrigger>
                <SelectContent>
                  {approvedPrs.map((pr) => (
                    <SelectItem key={pr.id} value={pr.id}>
                      {pr.title} {pr.editedAfterApprovalAt ? "[Edited] " : ""}({formatBusinessRef("PR", pr.id)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedPrAlreadyConverted ? (
                <p className="text-xs text-amber-700">This PR already has an RFQ. Choose a different PR.</p>
              ) : null}
            </div>
            <div className="space-y-1">
              <Label htmlFor="rfq-title">RFQ title</Label>
              <Input id="rfq-title" value={rfqTitle} onChange={(e) => setRfqTitle(e.target.value)} placeholder="RFQ title" />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label>Payment terms</Label>
                <Select value={paymentTerms} onValueChange={setPaymentTerms}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select terms" />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentTermsOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option.replace("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    {currencyOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Tax</Label>
                <Select value={taxIncluded} onValueChange={setTaxIncluded}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tax included?" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="YES">Yes</SelectItem>
                    <SelectItem value="NO">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Price validity</Label>
                <Select value={priceValidityDays} onValueChange={setPriceValidityDays}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select validity" />
                  </SelectTrigger>
                  <SelectContent>
                    {priceValidityOptions.map((days) => (
                      <SelectItem key={days} value={String(days)}>
                        {days} days
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="rfq-budget">Budget ({currency})</Label>
              <Input
                id="rfq-budget"
                type="number"
                min={0}
                step="0.01"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <Button
              disabled={!selectedPr || !isCommercialComplete || selectedPrAlreadyConverted || createRfq.isPending}
              onClick={submitCreate}
            >
              Create RFQ
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Approved PR queue</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {approvedPrs.length === 0 ? (
              <p className="text-sm text-slate-500">No approved PRs waiting for RFx conversion.</p>
            ) : (
              approvedPrs.slice(0, 8).map((pr) => (
                <div key={pr.id} className="rounded-lg border p-3 text-sm">
                  <p className="font-medium">{pr.title}</p>
                  <p className="text-slate-500">{formatBusinessRef("PR", pr.id)}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{pr.status}</Badge>
                    {existingRfqPrIds.has(pr.id) ? <Badge variant="outline">RFQ Created</Badge> : null}
                    <Button size="sm" variant="outline" onClick={() => router.push(`/rfqs/new?prId=${pr.id}`)}>
                      Use for RFQ
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent RFQs (from audit trail)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {rfqs.length === 0 ? (
            <EmptyState title="No RFQs found" description="Create an RFQ from an approved PR to start the lifecycle." ctaLabel="Go to requisitions" ctaHref="/requisitions" />
          ) : (
            rfqs.map((rfq) => (
              <div key={rfq.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                <div>
                  <p className="font-medium">{rfq.title}</p>
                  <p className="text-slate-500">{formatBusinessRef("RFQ", rfq.id)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{rfq.status}</Badge>
                  <Badge variant="outline">Bids {rfq.bidCount}</Badge>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/rfqs/${rfq.id}`}>Detail</Link>
                  </Button>
                  <Button asChild size="sm">
                    <Link href={`/bids?rfqId=${rfq.id}`}>Bids</Link>
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {queryPrId ? (
        <WorkflowChatSheet
          open={queryOpen}
          onOpenChange={setQueryOpen}
          prId={queryPrId}
          requesterLabel={approvedPrs.find((pr) => pr.id === queryPrId)?.requester}
        />
      ) : null}
    </div>
  );
}
