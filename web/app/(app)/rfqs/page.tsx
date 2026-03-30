"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquareText, PencilLine } from "lucide-react";
import { toast } from "sonner";

import { ApiErrorAlert } from "@/components/common/api-error-alert";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { RequesterQuerySheet } from "@/components/rfq/requester-query-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/format";
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
    toast.success("RFQ created", { description: created.id });
    router.push(`/rfqs/${created.id}`);
  };

  return (
    <div className="space-y-5">
      <PageHeader title="RFx" description="Convert approved PRs into RFQs with commercial controls and tracked requester queries." />
      {requisitionsError ? <ApiErrorAlert error={requisitionsError} /> : null}
      {rfqError ? <ApiErrorAlert error={rfqError} /> : null}
      {createRfq.error ? <ApiErrorAlert error={createRfq.error} /> : null}

      {latestApprovedPr ? (
        <Card>
          <CardHeader>
            <CardTitle>Latest Approved PR</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold">{latestApprovedPr.title}</p>
                <p className="text-sm text-slate-500">{latestApprovedPr.id}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{latestApprovedPr.status}</Badge>
                {latestApprovedPr.editedAfterApprovalAt ? <Badge variant="outline">Edited</Badge> : null}
              </div>
            </div>
            <div className="grid gap-2 text-sm text-slate-700 md:grid-cols-2">
              <p><span className="font-medium">Requester:</span> {latestApprovedPr.requester}</p>
              <p><span className="font-medium">Department:</span> {latestApprovedPr.department}</p>
              <p><span className="font-medium">Cost Centre:</span> {latestApprovedPr.costCenter}</p>
              <p><span className="font-medium">Updated:</span> {formatDateTime(latestApprovedPr.updatedAt)}</p>
              <p className="md:col-span-2"><span className="font-medium">Justification:</span> {latestApprovedPr.justification || "-"}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => router.push(`/rfqs/new?prId=${latestApprovedPr.id}`)}>Approve PR / Create RFQ</Button>
              <Button asChild variant="outline">
                <Link href={`/requisitions/new?edit=${latestApprovedPr.id}&source=rfq`}>
                  <PencilLine className="mr-2 h-4 w-4" />
                  Edit PR
                </Link>
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setQueryPrId(latestApprovedPr.id);
                  setQueryOpen(true);
                }}
              >
                <MessageSquareText className="mr-2 h-4 w-4" />
                Query Requester
              </Button>
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
                      {pr.title} {pr.editedAfterApprovalAt ? "[Edited] " : ""}({pr.id.slice(0, 8)})
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
                  <p className="text-slate-500">{pr.id}</p>
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
                  <p className="text-slate-500">{rfq.id}</p>
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
        <RequesterQuerySheet
          open={queryOpen}
          onOpenChange={setQueryOpen}
          prId={queryPrId}
          requesterLabel={approvedPrs.find((pr) => pr.id === queryPrId)?.requester}
        />
      ) : null}
    </div>
  );
}
