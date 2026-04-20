"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";

import { DataTable } from "@/components/data/data-table";
import { ApiErrorAlert } from "@/components/common/api-error-alert";
import { PageHeader } from "@/components/common/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSuppliers } from "@/lib/query-hooks";
import { Supplier } from "@/lib/types";
import { formatDate } from "@/lib/format";

function SortableHeader({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <Button type="button" variant="ghost" size="sm" className="-ml-3 h-8 px-3 text-slate-700" onClick={onClick}>
      {label}
      <ArrowUpDown className="size-4 text-slate-500" />
    </Button>
  );
}

function scoreBand(score?: number) {
  if (score == null) return "unscored";
  if (score >= 85) return "high";
  if (score >= 70) return "medium";
  return "low";
}

function formatScore(score?: number) {
  return score == null ? "-" : `${score}`;
}

export default function SuppliersPage() {
  const { data = [], error } = useSuppliers();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [verificationFilter, setVerificationFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [scoreBandFilter, setScoreBandFilter] = useState("all");

  const categoryOptions = useMemo(
    () => [...new Set(data.flatMap((supplier) => supplier.tags).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [data],
  );
  const countryOptions = useMemo(
    () => [...new Set(data.map((supplier) => supplier.country).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [data],
  );

  const filteredData = useMemo(() => {
    const query = search.trim().toLowerCase();
    return data.filter((supplier) => {
      const verificationStatus = supplier.onboardingProfile?.verificationStatus ?? "PENDING";
      const matchesSearch =
        query.length === 0 ||
        supplier.name.toLowerCase().includes(query) ||
        supplier.country.toLowerCase().includes(query) ||
        supplier.tags.some((tag) => tag.toLowerCase().includes(query)) ||
        supplier.contacts.some((contact) => contact.name.toLowerCase().includes(query) || contact.email.toLowerCase().includes(query));

      const matchesStatus = statusFilter === "all" || supplier.status === statusFilter;
      const matchesVerification = verificationFilter === "all" || verificationStatus === verificationFilter;
      const matchesCountry = countryFilter === "all" || supplier.country === countryFilter;
      const matchesCategory = categoryFilter === "all" || supplier.tags.includes(categoryFilter);
      const matchesScoreBand = scoreBandFilter === "all" || scoreBand(supplier.profileScore) === scoreBandFilter;

      return matchesSearch && matchesStatus && matchesVerification && matchesCountry && matchesCategory && matchesScoreBand;
    });
  }, [categoryFilter, countryFilter, data, scoreBandFilter, search, statusFilter, verificationFilter]);

  const columns = useMemo<ColumnDef<Supplier>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => <SortableHeader label="Supplier" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />,
        sortingFn: "text",
        cell: ({ row }) => (
          <div className="space-y-1">
            <Link href={`/suppliers/${row.original.id}`} className="font-medium text-slate-900 hover:underline">
              {row.original.name}
            </Link>
            <p className="text-xs text-slate-500">{row.original.contacts[0]?.email ?? "No primary contact email"}</p>
          </div>
        ),
      },
      {
        accessorKey: "tags",
        header: ({ column }) => <SortableHeader label="Categories" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />,
        sortingFn: (left, right) => left.original.tags.join(",").localeCompare(right.original.tags.join(",")),
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.tags.length ? (
              <>
                {row.original.tags.slice(0, 3).map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
                {row.original.tags.length > 3 ? <Badge variant="secondary">...</Badge> : null}
              </>
            ) : (
              <span className="text-sm text-slate-400">Unmapped</span>
            )}
          </div>
        ),
      },
      {
        id: "verification",
        accessorFn: (row) => row.onboardingProfile?.verificationStatus ?? "PENDING",
        header: ({ column }) => <SortableHeader label="Verification" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />,
        cell: ({ row }) => {
          const verification = row.original.onboardingProfile?.verificationStatus ?? "PENDING";
          const variant =
            verification === "VERIFIED"
              ? "default"
              : verification === "UNDER_REVIEW"
                ? "secondary"
                : verification === "REJECTED"
                  ? "destructive"
                  : "outline";
          return <Badge variant={variant}>{verification}</Badge>;
        },
      },
      {
        accessorKey: "status",
        header: ({ column }) => <SortableHeader label="Status" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />,
        cell: ({ row }) => <Badge variant="outline">{row.original.status}</Badge>,
      },
      {
        accessorKey: "country",
        header: ({ column }) => <SortableHeader label="Country" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />,
      },
      {
        id: "profileScore",
        accessorFn: (row) => row.profileScore ?? -1,
        header: ({ column }) => <SortableHeader label="Profile" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />,
        cell: ({ row }) => formatScore(row.original.profileScore),
      },
      {
        id: "complianceScore",
        accessorFn: (row) => row.complianceScore ?? -1,
        header: ({ column }) => <SortableHeader label="Compliance" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />,
        cell: ({ row }) => formatScore(row.original.complianceScore),
      },
      {
        id: "deliveryScore",
        accessorFn: (row) => row.deliveryScore ?? -1,
        header: ({ column }) => <SortableHeader label="Delivery" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />,
        cell: ({ row }) => formatScore(row.original.deliveryScore),
      },
      {
        id: "qualityScore",
        accessorFn: (row) => row.qualityScore ?? -1,
        header: ({ column }) => <SortableHeader label="Quality" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />,
        cell: ({ row }) => formatScore(row.original.qualityScore),
      },
      {
        id: "riskScore",
        accessorFn: (row) => row.riskScore ?? -1,
        header: ({ column }) => <SortableHeader label="Risk" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />,
        cell: ({ row }) => formatScore(row.original.riskScore),
      },
      {
        accessorKey: "updatedAt",
        header: ({ column }) => <SortableHeader label="Updated" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />,
        cell: ({ row }) => formatDate(row.original.updatedAt),
      },
    ],
    [],
  );

  const toolbar = (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-[2fr_repeat(5,minmax(0,1fr))]">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search supplier, contact, country, or category"
          className="bg-white"
        />
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="bg-white">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categoryOptions.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="bg-white">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="INACTIVE">Inactive</SelectItem>
            <SelectItem value="BLOCKED">Blocked</SelectItem>
          </SelectContent>
        </Select>
        <Select value={verificationFilter} onValueChange={setVerificationFilter}>
          <SelectTrigger className="bg-white">
            <SelectValue placeholder="Verification" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All verification</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="UNDER_REVIEW">Under review</SelectItem>
            <SelectItem value="VERIFIED">Verified</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Select value={countryFilter} onValueChange={setCountryFilter}>
          <SelectTrigger className="bg-white">
            <SelectValue placeholder="Country" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All countries</SelectItem>
            {countryOptions.map((country) => (
              <SelectItem key={country} value={country}>
                {country}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={scoreBandFilter} onValueChange={setScoreBandFilter}>
          <SelectTrigger className="bg-white">
            <SelectValue placeholder="Score band" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All score bands</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="unscored">Unscored</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center justify-between text-sm text-slate-600">
        <span>
          Showing <span className="font-medium text-slate-900">{filteredData.length}</span> of{" "}
          <span className="font-medium text-slate-900">{data.length}</span> suppliers
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setSearch("");
            setStatusFilter("all");
            setVerificationFilter("all");
            setCountryFilter("all");
            setCategoryFilter("all");
            setScoreBandFilter("all");
          }}
        >
          Reset filters
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Suppliers"
        description="Supplier register for the organisation portal with category filters, verification state, and performance metrics."
      />
      {error ? <ApiErrorAlert error={error} /> : <DataTable columns={columns} data={filteredData} toolbar={toolbar} />}
    </div>
  );
}
