"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/data/data-table";
import { ApiErrorAlert } from "@/components/common/api-error-alert";
import { PageHeader } from "@/components/common/page-header";
import { Badge } from "@/components/ui/badge";
import { useSuppliers } from "@/lib/query-hooks";
import { Supplier } from "@/lib/types";
import { formatDate } from "@/lib/format";

export default function SuppliersPage() {
  const { data = [], error } = useSuppliers();

  const columns = useMemo<ColumnDef<Supplier>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Supplier",
        cell: ({ row }) => <Link href={`/suppliers/${row.original.id}`}>{row.original.name}</Link>,
      },
      {
        accessorKey: "tags",
        header: "Tags",
        cell: ({ row }) => (
          <div className="flex gap-1">
            {row.original.tags.map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>
        ),
      },
      { accessorKey: "status", header: "Status" },
      { accessorKey: "country", header: "Country" },
      { accessorKey: "updatedAt", header: "Updated", cell: ({ row }) => formatDate(row.original.updatedAt) },
    ],
    [],
  );

  return (
    <div className="space-y-4">
      <PageHeader title="Suppliers" description="Directory with profile status, tags, and contacts." />
      {error ? <ApiErrorAlert error={error} /> : <DataTable columns={columns} data={data} />}
    </div>
  );
}
