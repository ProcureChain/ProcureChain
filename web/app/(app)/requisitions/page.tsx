"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, ClipboardList, Clock3, FileCheck2, Search, SlidersHorizontal } from "lucide-react";

import { ApiErrorAlert } from "@/components/common/api-error-alert";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatBusinessRef, formatDate, formatSubcategoryLabel, daysOld } from "@/lib/format";
import { useRequisitions, useTaxonomySubcategories } from "@/lib/query-hooks";
import { ReqStatus, Requisition } from "@/lib/types";

type SortKey = "updated_desc" | "created_desc" | "needed_asc" | "title_asc" | "status_asc";

const STATUS_OPTIONS: Array<{ value: "ALL" | ReqStatus; label: string }> = [
  { value: "ALL", label: "All statuses" },
  { value: "DRAFT", label: "Draft" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "UNDER_REVIEW", label: "Under Review" },
  { value: "RETURNED", label: "Returned" },
  { value: "APPROVED", label: "Approved" },
  { value: "CONVERTED_TO_RFQ", label: "Converted to RFQ" },
  { value: "REJECTED", label: "Rejected" },
  { value: "CLOSED", label: "Closed" },
];

function AnalyticsCard({
  label,
  value,
  note,
  icon,
}: {
  label: string;
  value: string | number;
  note: string;
  icon: React.ReactNode;
}) {
  return (
    <Card className="rounded-3xl border-[var(--border)] bg-white shadow-[var(--shadow-sm)]">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-[var(--text-secondary)]">{label}</p>
            <p className="mt-2 text-4xl font-semibold tracking-tight text-[var(--text-primary)]">{value}</p>
            <p className="mt-2 text-sm text-[var(--text-muted)]">{note}</p>
          </div>
          <div className="rounded-2xl bg-[var(--surface-muted)] p-3 text-[var(--secondary)]">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function matchesQuery(req: Requisition, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [
    req.prNumber,
    req.title,
    req.requester,
    req.department,
    req.costCenter,
    req.subcategoryId ?? "",
    formatBusinessRef("PR", req.id),
  ]
    .join(" ")
    .toLowerCase()
    .includes(q);
}

function sortRequisitions(data: Requisition[], sortKey: SortKey) {
  return [...data].sort((a, b) => {
    switch (sortKey) {
      case "created_desc":
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case "needed_asc":
        return new Date(a.neededBy ?? "9999-12-31").getTime() - new Date(b.neededBy ?? "9999-12-31").getTime();
      case "title_asc":
        return a.title.localeCompare(b.title);
      case "status_asc":
        return a.status.localeCompare(b.status);
      case "updated_desc":
      default:
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    }
  });
}

export default function RequisitionsPage() {
  const { data = [], isLoading, error } = useRequisitions();
  const taxonomy = useTaxonomySubcategories();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"ALL" | ReqStatus>("ALL");
  const [department, setDepartment] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<SortKey>("updated_desc");

  const departmentOptions = useMemo(
    () => ["ALL", ...Array.from(new Set(data.map((req) => req.department).filter(Boolean))).sort((a, b) => a.localeCompare(b))],
    [data],
  );
  const subcategoryById = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of taxonomy.data ?? []) {
      map.set(row.id, formatSubcategoryLabel(row.level3, row.name));
    }
    return map;
  }, [taxonomy.data]);

  const filtered = useMemo(() => {
    const base = data.filter((req) => {
      const matchesStatus = status === "ALL" || req.status === status;
      const matchesDepartment = department === "ALL" || req.department === department;
      return matchesStatus && matchesDepartment && matchesQuery(req, search);
    });
    return sortRequisitions(base, sortBy);
  }, [data, department, search, sortBy, status]);

  const analytics = useMemo(() => {
    const drafts = data.filter((req) => req.status === "DRAFT").length;
    const activeApprovals = data.filter((req) => req.status === "SUBMITTED" || req.status === "UNDER_REVIEW").length;
    const approved = data.filter((req) => req.status === "APPROVED").length;
    const returned = data.filter((req) => req.status === "RETURNED").length;
    const avgAge =
      data.length > 0
        ? Math.round(data.reduce((sum, req) => sum + daysOld(req.createdAt), 0) / data.length)
        : 0;

    return { drafts, activeApprovals, approved, returned, avgAge };
  }, [data]);

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-[var(--border)] bg-white p-6 shadow-[var(--shadow-lg)]">
        <PageHeader
          title="Requisition Register"
          description="Track the full PR pipeline, narrow the register quickly, and move straight into the next action."
          actions={
            <Button asChild className="rounded-full bg-[var(--primary)] px-5 hover:bg-[var(--secondary)]">
              <Link href="/requisitions/new">Create Requisition</Link>
            </Button>
          }
        />

        <section className="mt-6 grid gap-4 xl:grid-cols-5">
          <AnalyticsCard label="Total PRs" value={data.length} note="Live requisitions in current scope" icon={<ClipboardList className="h-5 w-5" />} />
          <AnalyticsCard label="Drafts" value={analytics.drafts} note="Saved but not yet submitted" icon={<FileCheck2 className="h-5 w-5" />} />
          <AnalyticsCard label="In Approval" value={analytics.activeApprovals} note="Submitted or under review" icon={<Clock3 className="h-5 w-5" />} />
          <AnalyticsCard label="Approved" value={analytics.approved} note="Ready for RFQ conversion" icon={<ArrowRight className="h-5 w-5" />} />
          <AnalyticsCard label="Average Age" value={`${analytics.avgAge}d`} note={`${analytics.returned} currently returned`} icon={<SlidersHorizontal className="h-5 w-5" />} />
        </section>

        <section className="mt-4 rounded-3xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
          <div className="grid gap-3 xl:grid-cols-[1.35fr_0.32fr_0.32fr_0.32fr]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Quick search by PR ref, title, requester, department, cost centre"
                className="h-11 rounded-2xl border-[var(--border)] bg-white pl-10"
              />
            </div>

            <Select value={status} onValueChange={(value) => setStatus(value as "ALL" | ReqStatus)}>
              <SelectTrigger className="h-11 rounded-2xl border-[var(--border)] bg-white">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger className="h-11 rounded-2xl border-[var(--border)] bg-white">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                {departmentOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option === "ALL" ? "All departments" : option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortKey)}>
              <SelectTrigger className="h-11 rounded-2xl border-[var(--border)] bg-white">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="updated_desc">Recently updated</SelectItem>
                <SelectItem value="created_desc">Newest created</SelectItem>
                <SelectItem value="needed_asc">Needed by</SelectItem>
                <SelectItem value="title_asc">Title A-Z</SelectItem>
                <SelectItem value="status_asc">Status</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </section>

        {error ? (
          <div className="mt-4">
            <ApiErrorAlert error={error} />
          </div>
        ) : isLoading ? (
          <div className="mt-4 rounded-3xl border border-[var(--border)] bg-white p-8 text-sm text-[var(--text-muted)]">
            Loading requisitions...
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="No requisitions match the current filters"
              description="Change the search, status, department, or sort order to widen the register."
              ctaLabel="Create requisition"
              ctaHref="/requisitions/new"
            />
          </div>
        ) : (
          <section className="mt-4 overflow-hidden rounded-[28px] border border-[var(--border)] bg-white shadow-[var(--shadow-sm)]">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">PR Worklist</h2>
                <p className="mt-1 text-sm text-[var(--text-muted)]">{filtered.length} requisitions in the current view</p>
              </div>
              <Badge variant="outline" className="rounded-full border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1 text-[11px] text-[var(--text-secondary)]">
                Live register
              </Badge>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-[var(--surface-muted)] text-left text-[var(--text-muted)]">
                  <tr>
                    <th className="px-5 py-3 font-medium">PR</th>
                    <th className="px-5 py-3 font-medium">Requester</th>
                    <th className="px-5 py-3 font-medium">Department</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Needed By</th>
                    <th className="px-5 py-3 font-medium">Last Updated</th>
                    <th className="px-5 py-3 font-medium">Age</th>
                    <th className="px-5 py-3 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((req) => (
                    <tr key={req.id} className="border-t border-[var(--border)] align-top transition hover:bg-[var(--surface-muted)]/70">
                      <td className="px-5 py-4">
                        <div className="space-y-1">
                          <Link href={`/requisitions/${req.id}`} className="font-semibold text-[var(--primary)] hover:underline">
                            {req.prNumber || formatBusinessRef("PR", req.id)}
                          </Link>
                          <p className="font-medium text-[var(--text-primary)]">{req.title}</p>
                          <div className="flex flex-wrap gap-2">
                            {req.subcategoryId ? (
                              <Badge variant="outline" className="rounded-full border-[var(--border)] bg-white px-2.5 py-0.5 text-[10px] text-[var(--text-secondary)]">
                                {formatSubcategoryLabel(subcategoryById.get(req.subcategoryId), req.subcategoryId)}
                              </Badge>
                            ) : null}
                            <Badge variant="outline" className="rounded-full border-[var(--border)] bg-white px-2.5 py-0.5 text-[10px] text-[var(--text-secondary)]">
                              {req.costCenter}
                            </Badge>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-[var(--text-secondary)]">
                        <div className="space-y-1">
                          <p className="font-medium text-[var(--text-primary)]">{req.requester}</p>
                          {req.currentApprover ? <p className="text-xs text-[var(--text-muted)]">Approver: {req.currentApprover}</p> : null}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-[var(--text-secondary)]">{req.department}</td>
                      <td className="px-5 py-4">
                        <div className="space-y-2">
                          <StatusBadge status={req.status} />
                          {req.editedAfterApprovalAt ? (
                            <Badge variant="outline" className="rounded-full border-[var(--border)] bg-[#fff9ec] px-2.5 py-0.5 text-[10px] text-[#9A6700]">
                              Edited
                            </Badge>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-[var(--text-secondary)]">{formatDate(req.neededBy)}</td>
                      <td className="px-5 py-4 text-[var(--text-secondary)]">{formatDate(req.updatedAt)}</td>
                      <td className="px-5 py-4 text-[var(--text-secondary)]">{daysOld(req.createdAt)}d</td>
                      <td className="px-5 py-4 text-right">
                        <Button asChild variant="outline" size="sm" className="rounded-full">
                          <Link href={`/requisitions/${req.id}`}>Open</Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </section>
    </div>
  );
}
