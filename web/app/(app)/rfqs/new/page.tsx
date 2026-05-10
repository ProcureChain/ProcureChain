"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ApiErrorAlert } from "@/components/common/api-error-alert";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatBusinessRef } from "@/lib/format";
import { useCreateRfq, useRequisitions, useRfqs } from "@/lib/query-hooks";

const currencyOptions = ["ZAR", "USD", "EUR", "GBP"];
const paymentTermsOptions = ["IMMEDIATE", "NET_7", "NET_15", "NET_30", "NET_60", "NET_90"];
const priceValidityOptions = [7, 15, 30, 60, 90];

export default function NewRfqPage() {
  const router = useRouter();
  const { data: requisitions = [], error: requisitionsError, isLoading: reqLoading } = useRequisitions();
  const { data: rfqs = [], error: rfqError } = useRfqs();
  const createRfq = useCreateRfq();

  const [prId, setPrId] = useState<string | null>(null);
  const [rfqTitle, setRfqTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("NET_30");
  const [currency, setCurrency] = useState("ZAR");
  const [taxIncluded, setTaxIncluded] = useState("YES");
  const [priceValidityDays, setPriceValidityDays] = useState("30");
  const [budget, setBudget] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setPrId(params.get("prId"));
  }, []);

  const approvedPrs = useMemo(
    () =>
      requisitions
        .filter((pr) => pr.status === "APPROVED")
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [requisitions],
  );
  const existingRfqPrIds = useMemo(() => new Set(rfqs.map((row) => row.prId)), [rfqs]);
  const selectedPr = approvedPrs.find((pr) => pr.id === prId) ?? null;
  const alreadyConverted = selectedPr ? existingRfqPrIds.has(selectedPr.id) : false;
  const isReady = Boolean(selectedPr && rfqTitle.trim() && paymentTerms && currency && taxIncluded && priceValidityDays && Number(budget) > 0);

  useEffect(() => {
    if (!selectedPr) return;
    setRfqTitle((current) => current || `${selectedPr.title} RFx`);
  }, [selectedPr]);

  if (!reqLoading && prId && !selectedPr) {
    return (
      <EmptyState
        title="Approved PR not found"
        description="The selected PR is not available for RFQ conversion. It may not be approved yet or may already be converted."
        ctaLabel="Back to RFx"
        ctaHref="/rfqs"
      />
    );
  }

  const submitCreate = async () => {
    if (!selectedPr) return;
    if (alreadyConverted) {
      toast.error("RFQ already exists", { description: "This PR has already been converted." });
      return;
    }

    const commercialNotes = [
      notes.trim(),
      `paymentTerms=${paymentTerms}`,
      `currency=${currency}`,
      `taxIncluded=${taxIncluded}`,
      `priceValidityDays=${priceValidityDays}`,
      `budget=${budget}`,
    ]
      .filter(Boolean)
      .join("; ");

    const created = await createRfq.mutateAsync({
      prId: selectedPr.id,
      title: rfqTitle.trim(),
      budgetAmount: Number(budget),
      currency,
      paymentTerms,
      taxIncluded: taxIncluded === "YES",
      priceValidityDays: Number(priceValidityDays),
      notes: commercialNotes,
    });
    toast.success("RFQ created", { description: formatBusinessRef("RFQ", created.id) });
    router.push(`/rfqs/${created.id}`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create RFQ"
        description="Convert an approved PR into an RFQ with the required RFQ details."
        actions={
          <Button variant="outline" onClick={() => router.push("/rfqs")}>
            Back to RFx
          </Button>
        }
      />

      {requisitionsError ? <ApiErrorAlert error={requisitionsError} /> : null}
      {rfqError ? <ApiErrorAlert error={rfqError} /> : null}
      {createRfq.error ? <ApiErrorAlert error={createRfq.error} /> : null}
      <div className="mx-auto max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>RFQ Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="rfq-title">RFQ title</Label>
              <Input id="rfq-title" value={rfqTitle} onChange={(event) => setRfqTitle(event.target.value)} placeholder="RFQ title" />
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
                        {option.replaceAll("_", " ")}
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
                onChange={(event) => setBudget(event.target.value)}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="rfq-notes">RFQ notes</Label>
              <Textarea
                id="rfq-notes"
                rows={4}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Optional instructions or scope notes for the RFQ."
              />
            </div>

            <Button disabled={!isReady || alreadyConverted || createRfq.isPending} onClick={submitCreate}>
              Create RFQ
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
