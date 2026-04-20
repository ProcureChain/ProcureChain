"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { ApiErrorAlert } from "@/components/common/api-error-alert";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatBusinessRef, formatDate, formatDateTime } from "@/lib/format";
import { useRfqs, useSupplier, useTaxonomySubcategories } from "@/lib/query-hooks";
import { runtimeConfig } from "@/lib/runtime-config";
import type { Rfq } from "@/lib/types";

type SortKey = "created-desc" | "created-asc" | "required-desc" | "required-asc" | "category-asc" | "category-desc" | "release-mode";

type ReleaseFilter = "ALL" | "GLOBAL" | "LOCAL";
type Level1Filter = "ALL" | string;

function getSubcategoryLabel(rfq: Rfq, level3BySubcategory: Map<string, string>) {
  if (!rfq.subcategoryId) return "Uncategorized";
  return level3BySubcategory.get(rfq.subcategoryId) ?? rfq.subcategoryId;
}

function getLevel1Label(rfq: Rfq, level1BySubcategory: Map<string, string>) {
  if (!rfq.subcategoryId) return "Uncategorized";
  return level1BySubcategory.get(rfq.subcategoryId) ?? "Uncategorized";
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

export default function SupplierRfqsPage() {
  const supplierId = runtimeConfig.supplierId ?? "";
  const { data: rfqs = [], error } = useRfqs();
  const { data: supplier } = useSupplier(supplierId);
  const taxonomy = useTaxonomySubcategories();
  const [releaseFilter, setReleaseFilter] = useState<ReleaseFilter>("ALL");
  const [level1Filter, setLevel1Filter] = useState<Level1Filter>("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("created-desc");

  const baseOpportunities = useMemo(
    () => rfqs.filter((rfq) => rfq.status === "RELEASED" || rfq.status === "OPEN"),
    [rfqs],
  );

  const level1BySubcategory = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of taxonomy.data ?? []) {
      map.set(row.id, row.level1);
    }
    return map;
  }, [taxonomy.data]);

  const level3BySubcategory = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of taxonomy.data ?? []) {
      map.set(row.id, row.level3 || row.name);
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
      return matchesRelease && matchesLevel1;
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
  }, [baseOpportunities, level1BySubcategory, level1Filter, releaseFilter, sortKey]);

  return (
    <div className="space-y-5">
      <PageHeader title="Supplier RFx" description="Released and open RFx opportunities in a sortable list for supplier review." />
      {error ? <ApiErrorAlert error={error} /> : null}

      {baseOpportunities.length === 0 ? (
        <EmptyState title="No active RFx opportunities" description="Released and open opportunities will appear here when your supplier profile is eligible." />
      ) : (
        <Card>
          <CardHeader className="gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <CardTitle>RFx Opportunities</CardTitle>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Filter By Release Mode</Label>
                <Select value={releaseFilter} onValueChange={(value) => setReleaseFilter(value as ReleaseFilter)}>
                  <SelectTrigger className="w-[220px]">
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
                  <SelectTrigger className="w-[220px]">
                    <SelectValue placeholder="Choose category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Linked Categories</SelectItem>
                    {level1Options.map((level1) => (
                      <SelectItem key={level1} value={level1}>
                        {level1}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Sort By</Label>
                <Select value={sortKey} onValueChange={(value) => setSortKey(value as SortKey)}>
                  <SelectTrigger className="w-[220px]">
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
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left">
                    <th className="px-3 py-2 font-medium">RFx</th>
                    <th className="px-3 py-2 font-medium">Release</th>
                    <th className="px-3 py-2 font-medium">Category</th>
                    <th className="px-3 py-2 font-medium">Date Required</th>
                    <th className="px-3 py-2 font-medium">Date Created</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Actions</th>
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
                    return (
                      <tr key={rfq.id} className="border-b align-top">
                        <td className="px-3 py-2">
                          <div className="min-w-[220px]">
                            <p className="font-medium text-slate-900">{rfq.title}</p>
                            <p className="text-xs text-slate-500">{formatBusinessRef("RFQ", rfq.id)}</p>
                          </div>
                        </td>
                        <td className="px-3 py-2">{rfq.releaseMode ?? "-"}</td>
                        <td className="px-3 py-2">{category}</td>
                        <td className="px-3 py-2">{requiredDate ? formatDate(requiredDate) : "-"}</td>
                        <td className="px-3 py-2">{formatDateTime(rfq.createdAt)}</td>
                        <td className="px-3 py-2">
                          <Badge variant="secondary">{rfq.status}</Badge>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-2">
                            <Button asChild size="sm" variant="outline">
                              <Link href={`/supplier/rfqs/${encodeURIComponent(rfq.id)}`}>View Details</Link>
                            </Button>
                            <Button asChild size="sm">
                              <Link href={`/supplier/bids?rfqId=${encodeURIComponent(rfq.id)}`}>Respond In Bids</Link>
                            </Button>
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
    </div>
  );
}
