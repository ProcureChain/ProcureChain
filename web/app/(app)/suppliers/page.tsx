"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Building2, CheckCircle2, Globe2, Search, ShieldCheck, SlidersHorizontal, Star, UploadCloud } from "lucide-react";

import { ApiErrorAlert } from "@/components/common/api-error-alert";
import { EmptyState } from "@/components/common/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSuppliers } from "@/lib/query-hooks";
import { formatCountryWithFlag, formatDate, formatSubcategoryLabel } from "@/lib/format";
import type { Supplier } from "@/lib/types";

type DirectoryFilter = "all" | "managed" | "public";

function scoreBand(score?: number) {
  if (score == null) return "unscored";
  if (score >= 85) return "high";
  if (score >= 70) return "medium";
  return "low";
}

function scoreTone(score?: number) {
  const band = scoreBand(score);
  if (band === "high") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (band === "medium") return "border-amber-200 bg-amber-50 text-amber-700";
  if (band === "low") return "border-red-200 bg-red-50 text-red-700";
  return "border-[var(--border)] bg-white text-[var(--text-secondary)]";
}

function verificationTone(status: string) {
  if (status === "VERIFIED") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "UNDER_REVIEW") return "border-blue-200 bg-blue-50 text-blue-700";
  if (status === "REJECTED") return "border-red-200 bg-red-50 text-red-700";
  return "border-[var(--border)] bg-white text-[var(--text-secondary)]";
}

function isManagedSupplier(supplier: Supplier) {
  return Boolean(supplier.onboardingProfile || (supplier.documents?.length ?? 0) > 0);
}

function SupplierMetric({
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
            <p className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text-primary)]">{value}</p>
            <p className="mt-2 text-sm text-[var(--text-muted)]">{note}</p>
          </div>
          <div className="rounded-2xl bg-[var(--surface-muted)] p-3 text-[var(--secondary)]">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function SupplierCard({ supplier }: { supplier: Supplier }) {
  const verification = supplier.onboardingProfile?.verificationStatus ?? "PENDING";
  const managed = isManagedSupplier(supplier);
  const primaryContact = supplier.contacts[0];
  const visibleTags = supplier.tags.slice(0, 4);

  return (
    <div className="rounded-[28px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-sm)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/suppliers/${supplier.id}`} className="text-lg font-semibold text-[var(--text-primary)] hover:text-[var(--primary)] hover:underline">
              {supplier.name}
            </Link>
            <Badge variant="outline" className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${managed ? "border-blue-200 bg-blue-50 text-blue-700" : "border-[var(--border)] bg-white text-[var(--text-secondary)]"}`}>
              {managed ? "Organisation Supplier" : "Public Directory"}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-[var(--text-muted)]">{primaryContact?.email ?? "No primary contact email"}</p>
        </div>
        <Badge variant="outline" className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${verificationTone(verification)}`}>
          {verification.replaceAll("_", " ")}
        </Badge>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl bg-[var(--surface-muted)] p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Country</p>
          <p className="mt-1 font-medium text-[var(--text-primary)]">{formatCountryWithFlag(supplier.country)}</p>
        </div>
        <div className="rounded-2xl bg-[var(--surface-muted)] p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Status</p>
          <p className="mt-1 font-medium text-[var(--text-primary)]">{supplier.status}</p>
        </div>
        <div className="rounded-2xl bg-[var(--surface-muted)] p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Updated</p>
          <p className="mt-1 font-medium text-[var(--text-primary)]">{formatDate(supplier.updatedAt)}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {visibleTags.length ? (
          visibleTags.map((tag) => (
            <Badge key={tag} variant="secondary" className="rounded-full">
              {formatSubcategoryLabel(tag)}
            </Badge>
          ))
        ) : (
          <span className="text-sm text-[var(--text-muted)]">No categories assigned</span>
        )}
        {supplier.tags.length > visibleTags.length ? (
          <Badge variant="outline" className="rounded-full">
            +{supplier.tags.length - visibleTags.length}
          </Badge>
        ) : null}
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-5">
        {[
          ["Profile", supplier.profileScore],
          ["Compliance", supplier.complianceScore],
          ["Delivery", supplier.deliveryScore],
          ["Quality", supplier.qualityScore],
          ["Risk", supplier.riskScore],
        ].map(([label, score]) => (
          <div key={String(label)} className={`rounded-2xl border p-3 text-center ${scoreTone(score as number | undefined)}`}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em]">{label}</p>
            <p className="mt-1 text-xl font-semibold">{score ?? "-"}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
        <p className="text-sm text-[var(--text-muted)]">
          {managed ? "Uploaded or verified within the organisation directory." : "Available from the public supplier directory."}
        </p>
        <Button asChild className="rounded-full bg-[var(--primary)] hover:bg-[var(--secondary)]">
          <Link href={`/suppliers/${supplier.id}`}>Open Profile</Link>
        </Button>
      </div>
    </div>
  );
}

export default function SuppliersPage() {
  const { data = [], error } = useSuppliers();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [verificationFilter, setVerificationFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [scoreBandFilter, setScoreBandFilter] = useState("all");
  const [directoryFilter, setDirectoryFilter] = useState<DirectoryFilter>("all");

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
      const managed = isManagedSupplier(supplier);
      const matchesSearch =
        query.length === 0 ||
        supplier.name.toLowerCase().includes(query) ||
        supplier.country.toLowerCase().includes(query) ||
        supplier.tags.some((tag) => tag.toLowerCase().includes(query) || formatSubcategoryLabel(tag).toLowerCase().includes(query)) ||
        supplier.contacts.some((contact) => contact.name.toLowerCase().includes(query) || contact.email.toLowerCase().includes(query));

      const matchesDirectory = directoryFilter === "all" || (directoryFilter === "managed" ? managed : !managed);
      const matchesStatus = statusFilter === "all" || supplier.status === statusFilter;
      const matchesVerification = verificationFilter === "all" || verificationStatus === verificationFilter;
      const matchesCountry = countryFilter === "all" || supplier.country === countryFilter;
      const matchesCategory = categoryFilter === "all" || supplier.tags.includes(categoryFilter);
      const matchesScoreBand = scoreBandFilter === "all" || scoreBand(supplier.profileScore) === scoreBandFilter;

      return matchesSearch && matchesDirectory && matchesStatus && matchesVerification && matchesCountry && matchesCategory && matchesScoreBand;
    });
  }, [categoryFilter, countryFilter, data, directoryFilter, scoreBandFilter, search, statusFilter, verificationFilter]);

  const analytics = useMemo(() => {
    const managed = data.filter(isManagedSupplier).length;
    const verified = data.filter((supplier) => supplier.onboardingProfile?.verificationStatus === "VERIFIED").length;
    const active = data.filter((supplier) => supplier.status === "ACTIVE").length;
    const highScore = data.filter((supplier) => scoreBand(supplier.profileScore) === "high").length;
    return { managed, publicCount: data.length - managed, verified, active, highScore };
  }, [data]);

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setVerificationFilter("all");
    setCountryFilter("all");
    setCategoryFilter("all");
    setScoreBandFilter("all");
    setDirectoryFilter("all");
  };

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[32px] border border-[var(--border)] bg-[linear-gradient(135deg,#2D334A_0%,#444A74_100%)] p-6 text-white shadow-[var(--shadow-lg)]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/65">Suppliers</p>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-white">Supplier Directory</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75">
            Search public suppliers and manage organisation-private supplier records from one directory.
          </p>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl border border-white/15 bg-white/10 p-4">
            <p className="text-sm text-white/70">Public Suppliers</p>
            <p className="mt-2 text-3xl font-semibold">{analytics.publicCount}</p>
          </div>
          <div className="rounded-3xl border border-white/15 bg-white/10 p-4">
            <p className="text-sm text-white/70">Organisation Suppliers</p>
            <p className="mt-2 text-3xl font-semibold">{analytics.managed}</p>
          </div>
          <div className="rounded-3xl border border-white/15 bg-white/10 p-4">
            <p className="text-sm text-white/70">Verified</p>
            <p className="mt-2 text-3xl font-semibold">{analytics.verified}</p>
          </div>
          <div className="rounded-3xl border border-white/15 bg-white/10 p-4">
            <p className="text-sm text-white/70">High Score</p>
            <p className="mt-2 text-3xl font-semibold">{analytics.highScore}</p>
          </div>
        </div>
      </section>

      {error ? <ApiErrorAlert error={error} /> : null}

      <section className="grid gap-4 xl:grid-cols-4">
        <SupplierMetric label="Total Suppliers" value={data.length} note="Directory records" icon={<Globe2 className="h-5 w-5" />} />
        <SupplierMetric label="Active" value={analytics.active} note="Available supplier records" icon={<CheckCircle2 className="h-5 w-5" />} />
        <SupplierMetric label="Verified" value={analytics.verified} note="Verified onboarding profiles" icon={<ShieldCheck className="h-5 w-5" />} />
        <SupplierMetric label="Managed" value={analytics.managed} note="Organisation-private directory" icon={<Building2 className="h-5 w-5" />} />
      </section>

      <section className="rounded-[28px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-sm)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
              <SlidersHorizontal className="h-4 w-4 text-[var(--secondary)]" />
              Directory Controls
            </div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text-primary)]">Find Suppliers</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Showing <span className="font-semibold">{filteredData.length}</span> of <span className="font-semibold">{data.length}</span> suppliers.
            </p>
          </div>
          <Button type="button" variant="outline" className="rounded-full" onClick={resetFilters}>
            Reset Filters
          </Button>
        </div>

        <div className="mt-5 grid gap-3 xl:grid-cols-[1.4fr_repeat(6,minmax(0,1fr))]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search supplier, contact, country, or category"
              className="h-11 rounded-2xl border-[var(--border)] bg-white pl-10"
            />
          </div>
          <Select value={directoryFilter} onValueChange={(value) => setDirectoryFilter(value as DirectoryFilter)}>
            <SelectTrigger className="h-11 rounded-2xl bg-white">
              <SelectValue placeholder="Directory" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All directories</SelectItem>
              <SelectItem value="public">Public</SelectItem>
              <SelectItem value="managed">Organisation</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-11 rounded-2xl bg-white">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categoryOptions.map((category) => (
                <SelectItem key={category} value={category}>
                  {formatSubcategoryLabel(category)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-11 rounded-2xl bg-white">
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
            <SelectTrigger className="h-11 rounded-2xl bg-white">
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
            <SelectTrigger className="h-11 rounded-2xl bg-white">
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
            <SelectTrigger className="h-11 rounded-2xl bg-white">
              <SelectValue placeholder="Score" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All scores</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="unscored">Unscored</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        {filteredData.length === 0 ? (
          <div className="xl:col-span-2">
            <EmptyState title="No suppliers match the current filters" description="Adjust the search or reset filters to widen the directory." />
          </div>
        ) : (
          filteredData.map((supplier) => <SupplierCard key={supplier.id} supplier={supplier} />)
        )}
      </section>

      <section className="rounded-[28px] border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-white p-3 text-[var(--secondary)]">
              <UploadCloud className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-[var(--text-primary)]">Private supplier uploads</p>
              <p className="text-sm text-[var(--text-secondary)]">This directory is ready for organisation-uploaded private supplier records.</p>
            </div>
          </div>
          <Badge variant="outline" className="rounded-full border-[var(--border)] bg-white text-[var(--text-secondary)]">
            Upload workflow pending
          </Badge>
        </div>
      </section>
    </div>
  );
}
