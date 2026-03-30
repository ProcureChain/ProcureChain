"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/data/data-table";
import { ApiErrorAlert } from "@/components/common/api-error-alert";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRequisitions } from "@/lib/query-hooks";
import { formatDate, daysOld } from "@/lib/format";
import { Requisition } from "@/lib/types";

export default function RequisitionsPage() {
  const { data = [], isLoading, error } = useRequisitions();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("ALL");

  const filtered = useMemo(
    () =>
      data.filter((row) => {
        const matchStatus = status === "ALL" ? true : row.status === status;
        const q = search.toLowerCase();
        const matchQuery = row.prNumber.toLowerCase().includes(q) || row.title.toLowerCase().includes(q);
        return matchStatus && matchQuery;
      }),
    [data, search, status],
  );

  const columns = useMemo<ColumnDef<Requisition>[]>(
    () => [
      {
        accessorKey: "prNumber",
        header: "PR #",
        cell: ({ row }) => (
          <Link href={`/requisitions/${row.original.id}`} className="font-medium text-slate-900 hover:underline">
            {row.original.prNumber}
          </Link>
        ),
      },
      { accessorKey: "title", header: "Title" },
      { accessorKey: "requester", header: "Requester" },
      { accessorKey: "department", header: "Department" },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        accessorKey: "submittedAt",
        header: "Submitted",
        cell: ({ row }) => formatDate(row.original.submittedAt),
      },
      {
        id: "age",
        header: "Age",
        cell: ({ row }) => `${daysOld(row.original.createdAt)}d`,
      },
      {
        accessorKey: "currentApprover",
        header: "Current approver",
      },
    ],
    [],
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Requisition Register"
        description="Search, filter, and track every requisition lifecycle state."
        actions={
          <Button asChild>
            <Link href="/requisitions/new">Create PR</Link>
          </Button>
        }
      />

      <div className="grid gap-3 rounded-xl border bg-white p-3 md:grid-cols-[1fr_220px]">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search PR # or title" />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="SUBMITTED">Submitted</SelectItem>
            <SelectItem value="UNDER_REVIEW">Under Review</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error ? (
        <ApiErrorAlert error={error} />
      ) : isLoading ? (
        <div className="rounded-xl border bg-white p-8 text-sm text-slate-500">Loading requisitions...</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No requisitions found"
          description="Adjust your filters or create your first requisition to start the process."
          ctaLabel="Create your first requisition"
          ctaHref="/requisitions/new"
        />
      ) : (
        <DataTable columns={columns} data={filtered} />
      )}
    </div>
  );
}
