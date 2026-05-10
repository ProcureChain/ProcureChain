"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";

import { ApiErrorAlert } from "@/components/common/api-error-alert";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatBusinessRef, formatDate, formatDateTime, formatDomainLabel, formatMoney, formatSubcategoryLabel } from "@/lib/format";
import { useBidAction, useRfqs, useSupplier, useTaxonomySubcategories } from "@/lib/query-hooks";
import { runtimeConfig } from "@/lib/runtime-config";
import type { Rfq } from "@/lib/types";

type SortKey = "created-desc" | "created-asc" | "required-desc" | "required-asc" | "category-asc" | "category-desc" | "release-mode";

type ReleaseFilter = "ALL" | "GLOBAL" | "LOCAL";
type Level1Filter = "ALL" | string;
type ViewTab = "ALL" | "OPEN" | "RELEASED";
type QuickBidLineDraft = {
  prLineId: string;
  description: string;
  quantity: number;
  uom?: string;
  unitPrice: string;
  lineTotal: number;
};

function getSubcategoryLabel(rfq: Rfq, level3BySubcategory: Map<string, string>) {
  if (!rfq.subcategoryId) return "Uncategorized";
  return formatSubcategoryLabel(level3BySubcategory.get(rfq.subcategoryId), rfq.subcategoryId);
}

function getLevel1Label(rfq: Rfq, level1BySubcategory: Map<string, string>) {
  if (!rfq.subcategoryId) return "Uncategorized";
  return formatDomainLabel(level1BySubcategory.get(rfq.subcategoryId) ?? "Uncategorized");
}

function getRequiredDate(rfq: Rfq) {
  const metadata = rfq.prMetadata ?? {};
  const candidates = [
    metadata.delivery_date,
    metadata.required_date,
    metadata.pickup_date,
    metadata.start_date,
    metadata.end_date,
  ];

  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return undefined;
}

function compareText(a: string, b: string) {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

function extractBuyerMeta(rfq: Rfq) {
  const metadata = rfq.prMetadata ?? {};
  const companyNameCandidates = [
    metadata.companyName,
    metadata.company_name,
    metadata.organisationName,
    metadata.organizationName,
    metadata.buyerName,
    metadata.buyer_name,
  ];
  const logoCandidates = [
    metadata.companyLogoUrl,
    metadata.company_logo_url,
    metadata.logoUrl,
    metadata.logo_url,
    metadata.buyerLogoUrl,
    metadata.buyer_logo_url,
  ];
  const companyName = companyNameCandidates.find((value) => typeof value === "string" && value.trim()) as string | undefined;
  const logoUrl = logoCandidates.find((value) => typeof value === "string" && value.trim()) as string | undefined;
  const fallbackName = companyName || "Organisation";
  const initials = fallbackName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2) || "OR";
  return { companyName: fallbackName, logoUrl, initials };
}

export default function SupplierRfqsPage() {
  const supplierId = runtimeConfig.supplierId ?? "";
  const { data: rfqs = [], error } = useRfqs();
  const { data: supplier } = useSupplier(supplierId);
  const taxonomy = useTaxonomySubcategories();
  const bidAction = useBidAction();
  const [releaseFilter, setReleaseFilter] = useState<ReleaseFilter>("ALL");
  const [level1Filter, setLevel1Filter] = useState<Level1Filter>("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("created-desc");
  const [viewTab, setViewTab] = useState<ViewTab>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [quickDraftRfq, setQuickDraftRfq] = useState<Rfq | null>(null);
  const [quickDraftLines, setQuickDraftLines] = useState<QuickBidLineDraft[]>([]);
  const [quickDraftComment, setQuickDraftComment] = useState("");

  const baseOpportunities = useMemo(
    () => rfqs.filter((rfq) => rfq.status === "RELEASED" || rfq.status === "OPEN"),
    [rfqs],
  );

  const level1BySubcategory = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of taxonomy.data ?? []) {
      map.set(row.id, formatDomainLabel(row.level1));
    }
    return map;
  }, [taxonomy.data]);

  const level3BySubcategory = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of taxonomy.data ?? []) {
      map.set(row.id, formatSubcategoryLabel(row.level3, row.name));
    }
    return map;
  }, [taxonomy.data]);

  const level1Options = useMemo(() => {
    const profileTags = (supplier?.tags ?? []).filter(Boolean);
    const visibleTags = baseOpportunities
      .map((rfq) => rfq.subcategoryId)
      .filter((value): value is string => Boolean(value));
    const sourceIds = profileTags.length > 0 ? profileTags : visibleTags;
    const level1Values = sourceIds
      .map((subcategoryId) => level1BySubcategory.get(subcategoryId))
      .filter((value): value is string => Boolean(value));
    return [...new Set(level1Values)].sort((a, b) => compareText(a, b));
  }, [baseOpportunities, level1BySubcategory, supplier?.tags]);

  const opportunities = useMemo(() => {
    const filtered = baseOpportunities.filter((rfq) => {
      const matchesRelease = releaseFilter === "ALL" ? true : rfq.releaseMode === releaseFilter;
      const matchesLevel1 =
        level1Filter === "ALL" ? true : getLevel1Label(rfq, level1BySubcategory) === level1Filter;
      const matchesViewTab = viewTab === "ALL" ? true : rfq.status === viewTab;
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch = !query
        ? true
        : `${rfq.title} ${rfq.id} ${rfq.releaseMode ?? ""} ${rfq.status}`.toLowerCase().includes(query);
      return matchesRelease && matchesLevel1 && matchesViewTab && matchesSearch;
    });

    return [...filtered].sort((a, b) => {
      const aRequired = getRequiredDate(a);
      const bRequired = getRequiredDate(b);
      const aCategory = getLevel1Label(a, level1BySubcategory);
      const bCategory = getLevel1Label(b, level1BySubcategory);

      switch (sortKey) {
        case "created-asc":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case "created-desc":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "required-asc":
          return new Date(aRequired ?? 0).getTime() - new Date(bRequired ?? 0).getTime();
        case "required-desc":
          return new Date(bRequired ?? 0).getTime() - new Date(aRequired ?? 0).getTime();
        case "category-asc":
          return compareText(aCategory, bCategory);
        case "category-desc":
          return compareText(bCategory, aCategory);
        case "release-mode":
          return compareText(a.releaseMode ?? "", b.releaseMode ?? "");
        default:
          return 0;
      }
    });
  }, [baseOpportunities, level1BySubcategory, level1Filter, releaseFilter, searchQuery, sortKey, viewTab]);

  const tabCounts = useMemo(() => {
    return {
      ALL: baseOpportunities.length,
      OPEN: baseOpportunities.filter((rfq) => rfq.status === "OPEN").length,
      RELEASED: baseOpportunities.filter((rfq) => rfq.status === "RELEASED").length,
    };
  }, [baseOpportunities]);

  const quickDraftTotal = useMemo(
    () => quickDraftLines.reduce((sum, line) => sum + line.lineTotal, 0),
    [quickDraftLines],
  );

  const openQuickDraft = (rfq: Rfq) => {
    setQuickDraftRfq(rfq);
    setQuickDraftComment("");
    setQuickDraftLines(
      (rfq.lines ?? []).map((line) => ({
        prLineId: line.id,
        description: line.description,
        quantity: line.quantity,
        uom: line.uom,
        unitPrice: "",
        lineTotal: 0,
      })),
    );
  };

  const updateQuickDraftLine = (prLineId: string, changes: Partial<QuickBidLineDraft>) => {
    setQuickDraftLines((current) =>
      current.map((line) => {
        if (line.prLineId !== prLineId) return line;
        const next = { ...line, ...changes };
        const unitPrice = Number(next.unitPrice);
        return { ...next, lineTotal: Number.isFinite(unitPrice) ? next.quantity * unitPrice : 0 };
      }),
    );
  };

  const saveQuickDraft = async () => {
    if (!quickDraftRfq || !supplierId) return;
    try {
      await bidAction.mutateAsync({
        type: "upsert",
        rfqId: quickDraftRfq.id,
        supplierId,
        totalBidValue: quickDraftTotal,
        lines: quickDraftLines.map((line) => ({
          prLineId: line.prLineId,
          quantity: line.quantity,
          unitPrice: Number(line.unitPrice),
          lineTotal: line.lineTotal,
        })),
        notes: quickDraftComment.trim() || undefined,
        payload: {
          supplierComment: quickDraftComment.trim() || undefined,
          compliance: { supplier_documents: false },
        },
        documents: {},
        currency: "ZAR",
      });
      toast.success("Quick draft saved");
      setQuickDraftRfq(null);
      setQuickDraftLines([]);
      setQuickDraftComment("");
    } catch (draftError) {
      console.error(draftError);
      toast.error("Failed to save quick draft");
    }
  };

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] text-white shadow-[var(--shadow-lg)]">
        <div className="flex flex-col gap-4 px-6 py-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/70">Supplier RFx Workspace</p>
            <h1 className="text-2xl font-bold tracking-tight text-white">Supplier RFx</h1>
            <p className="text-sm text-white/85">Review released opportunities, filter by category, and start bids quickly.</p>
          </div>
          <div className="rounded-xl border border-white/25 bg-white/10 px-4 py-3 text-sm">
            <p className="text-white/80">Active Opportunities</p>
            <p className="text-lg font-semibold text-white">{baseOpportunities.length}</p>
          </div>
        </div>
      </section>
      {error ? <ApiErrorAlert error={error} /> : null}

      {baseOpportunities.length === 0 ? (
        <EmptyState title="No active RFx opportunities" description="Released and open opportunities will appear here when your supplier profile is eligible." />
      ) : (
        <Card className="border-[var(--border)] bg-[var(--surface-background)] shadow-[var(--shadow-sm)]">
          <CardHeader className="gap-4 border-b border-[var(--border)] md:flex-row md:items-end md:justify-between">
            <div>
              <CardTitle className="text-lg text-[var(--text-primary)]">RFx Opportunities</CardTitle>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1.5 md:col-span-3">
                <Label>Search</Label>
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search by RFx title or reference..."
                  className="h-10 border-[var(--border)] bg-white"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Filter By Release Mode</Label>
                <Select value={releaseFilter} onValueChange={(value) => setReleaseFilter(value as ReleaseFilter)}>
                  <SelectTrigger className="w-[220px] border-[var(--border)] bg-white">
                    <SelectValue placeholder="Choose release mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Opportunities</SelectItem>
                    <SelectItem value="GLOBAL">Global Only</SelectItem>
                    <SelectItem value="LOCAL">Local Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Filter By Category</Label>
                <Select value={level1Filter} onValueChange={(value) => setLevel1Filter(value as Level1Filter)}>
                  <SelectTrigger className="w-[220px] border-[var(--border)] bg-white">
                    <SelectValue placeholder="Choose category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Linked Categories</SelectItem>
                    {level1Options.map((level1) => (
                      <SelectItem key={level1} value={level1}>
                        {formatDomainLabel(level1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Sort By</Label>
                <Select value={sortKey} onValueChange={(value) => setSortKey(value as SortKey)}>
                  <SelectTrigger className="w-[220px] border-[var(--border)] bg-white">
                    <SelectValue placeholder="Choose sort order" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="created-desc">Date Created: Newest</SelectItem>
                    <SelectItem value="created-asc">Date Created: Oldest</SelectItem>
                    <SelectItem value="required-asc">Date Required: Earliest</SelectItem>
                    <SelectItem value="required-desc">Date Required: Latest</SelectItem>
                    <SelectItem value="category-asc">Category: A to Z</SelectItem>
                    <SelectItem value="category-desc">Category: Z to A</SelectItem>
                    <SelectItem value="release-mode">Release Mode</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-5">
            <div className="mb-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setViewTab("ALL")}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  viewTab === "ALL"
                    ? "border-[var(--primary)] bg-[var(--primary)] text-white"
                    : "border-[var(--border)] bg-white text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                }`}
              >
                All RFx ({tabCounts.ALL})
              </button>
              <button
                type="button"
                onClick={() => setViewTab("OPEN")}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  viewTab === "OPEN"
                    ? "border-[var(--primary)] bg-[var(--primary)] text-white"
                    : "border-[var(--border)] bg-white text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                }`}
              >
                Open ({tabCounts.OPEN})
              </button>
              <button
                type="button"
                onClick={() => setViewTab("RELEASED")}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  viewTab === "RELEASED"
                    ? "border-[var(--primary)] bg-[var(--primary)] text-white"
                    : "border-[var(--border)] bg-white text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                }`}
              >
                Released ({tabCounts.RELEASED})
              </button>
            </div>
            <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-[var(--surface-muted)] text-left text-[var(--text-secondary)]">
                    <th className="px-3 py-2 font-medium">RFx</th>
                    <th className="px-3 py-2 font-medium">Buyer</th>
                    <th className="px-3 py-2 font-medium">Release</th>
                    <th className="px-3 py-2 font-medium">Category</th>
                    <th className="px-3 py-2 font-medium">Date Required</th>
                    <th className="px-3 py-2 font-medium">Date Created</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {opportunities.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-500">
                        No RFx opportunities match the current filters.
                      </td>
                    </tr>
                  ) : opportunities.map((rfq) => {
                    const requiredDate = getRequiredDate(rfq);
                    const category = getSubcategoryLabel(rfq, level3BySubcategory);
                    const buyer = extractBuyerMeta(rfq);
                    return (
                      <tr key={rfq.id} className="border-b align-top transition hover:bg-[var(--surface-muted)]/50">
                        <td className="px-3 py-2">
                          <div className="min-w-[220px]">
                            <p className="font-medium text-[var(--text-primary)]">{rfq.title}</p>
                            <p className="text-xs text-[var(--text-muted)]">{formatBusinessRef("RFQ", rfq.id)}</p>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            {buyer.logoUrl ? (
                              <img
                                src={buyer.logoUrl}
                                alt={buyer.companyName}
                                className="h-8 w-8 rounded-full border border-[var(--border)] object-cover"
                                onError={(event) => {
                                  (event.currentTarget as HTMLImageElement).style.display = "none";
                                }}
                              />
                            ) : (
                              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-muted)] text-xs font-semibold text-[var(--text-secondary)]">
                                {buyer.initials}
                              </span>
                            )}
                            <span className="text-sm text-[var(--text-primary)]">{buyer.companyName}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[10px]">
                            {rfq.releaseMode ?? "-"}
                          </Badge>
                        </td>
                        <td className="px-3 py-2">{category}</td>
                        <td className="px-3 py-2">{requiredDate ? formatDate(requiredDate) : "-"}</td>
                        <td className="px-3 py-2">{formatDateTime(rfq.createdAt)}</td>
                        <td className="px-3 py-2">
                          <Badge variant="secondary">{rfq.status}</Badge>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex justify-end">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button type="button" variant="outline" size="icon" className="h-8 w-8 border-[var(--border)]">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuItem asChild>
                                  <Link href={`/supplier/rfqs/${encodeURIComponent(rfq.id)}`}>View Details</Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openQuickDraft(rfq)}>
                                  Quick Draft
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
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

      <Dialog
        open={Boolean(quickDraftRfq)}
        onOpenChange={(open) => {
          if (!open) {
            setQuickDraftRfq(null);
            setQuickDraftLines([]);
            setQuickDraftComment("");
          }
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {quickDraftRfq ? `Quick Draft · ${quickDraftRfq.title}` : "Quick Draft"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="overflow-x-auto rounded-lg border">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left">
                  <th className="px-3 py-2 font-medium">Item</th>
                  <th className="px-3 py-2 font-medium">Qty</th>
                  <th className="px-3 py-2 font-medium">Unit Price</th>
                  <th className="px-3 py-2 font-medium">Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {quickDraftLines.map((line) => (
                    <tr key={line.prLineId} className="border-b align-top">
                      <td className="px-3 py-2">
                        <p className="font-medium text-slate-900">{line.description}</p>
                        <p className="text-xs text-slate-500">
                          {line.quantity} {line.uom ?? ""}
                        </p>
                      </td>
                      <td className="px-3 py-2 text-slate-700">{line.quantity}</td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          className="h-9 min-w-[130px]"
                          value={line.unitPrice}
                          placeholder="0.00"
                          onChange={(event) => updateQuickDraftLine(line.prLineId, { unitPrice: event.target.value })}
                        />
                      </td>
                      <td className="px-3 py-2 font-medium text-slate-900">
                        {formatMoney(line.lineTotal, "ZAR")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between rounded-lg border bg-slate-50 px-3 py-2 text-sm">
              <span className="font-medium text-slate-700">Draft Total</span>
              <span className="font-semibold text-slate-950">{formatMoney(quickDraftTotal, "ZAR")}</span>
            </div>
            <div className="space-y-1">
              <Label htmlFor="quick-draft-comment">Comment</Label>
              <Textarea
                id="quick-draft-comment"
                rows={4}
                value={quickDraftComment}
                onChange={(event) => setQuickDraftComment(event.target.value)}
                placeholder="Optional quick note for this draft."
              />
            </div>
            <Button
              className="w-full"
              disabled={!quickDraftRfq || !supplierId || quickDraftLines.some((line) => !line.unitPrice || Number(line.unitPrice) < 0)}
              onClick={() => void saveQuickDraft()}
            >
              Save Quick Draft
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
