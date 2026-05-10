"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Bell, Calendar, CircleHelp, Coins, Download, PiggyBank, ShieldAlert, ShieldCheck, Target, TrendingDown, TrendingUp, Wallet } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/common/page-header";
import { formatDate, formatMoney, formatSubcategoryLabel } from "@/lib/format";
import { useOrganizationAdminSettings, usePos, useRequisitions, useRfqs, useSuppliers, useTaxonomySubcategories } from "@/lib/query-hooks";
import { runtimeConfig } from "@/lib/runtime-config";

type Period = "monthly" | "annual";
type CategoryLevel = "level1" | "level2" | "level3";

function asDate(value?: string) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function samePeriod(date: Date, period: Period, now: Date) {
  if (period === "annual") return date.getUTCFullYear() === now.getUTCFullYear();
  return date.getUTCFullYear() === now.getUTCFullYear() && date.getUTCMonth() === now.getUTCMonth();
}

function lineSeries(points: number[]) {
  const width = 700;
  const height = 220;
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = Math.max(max - min, 1);
  const values = points.map((point, index) => {
    const x = (index / Math.max(points.length - 1, 1)) * width;
    const y = height - ((point - min) / range) * (height - 32) - 16;
    return `${x},${y}`;
  });
  return { width, height, values };
}

function groupedSpendByMonth(values: Array<{ createdAt: string; amount: number }>) {
  const now = new Date();
  return Array.from({ length: 6 }, (_, idx) => {
    const target = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (5 - idx), 1));
    return values
      .filter((item) => {
        const dt = asDate(item.createdAt);
        return dt && dt.getUTCFullYear() === target.getUTCFullYear() && dt.getUTCMonth() === target.getUTCMonth();
      })
      .reduce((sum, item) => sum + item.amount, 0);
  });
}

function monthLabel(offset: number) {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
  return d.toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2.5 rounded-full bg-slate-200">
      <div className="h-2.5 rounded-full bg-emerald-500" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

function buildPieSlices(values: number[]) {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return [];
  let angle = -Math.PI / 2;
  return values.map((value) => {
    const slice = (value / total) * Math.PI * 2;
    const start = angle;
    const end = angle + slice;
    angle = end;
    return { start, end };
  });
}

function polar(cx: number, cy: number, r: number, angle: number) {
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

function arcPath(cx: number, cy: number, r: number, start: number, end: number) {
  const from = polar(cx, cy, r, start);
  const to = polar(cx, cy, r, end);
  const largeArc = end - start > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${from.x} ${from.y} A ${r} ${r} 0 ${largeArc} 1 ${to.x} ${to.y} Z`;
}

export default function AnalyticsPage() {
  const [spendPeriod, setSpendPeriod] = useState<Period>("monthly");
  const [categoryPeriod, setCategoryPeriod] = useState<Period>("monthly");
  const [categoryLevel, setCategoryLevel] = useState<CategoryLevel>("level3");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [dateRange, setDateRange] = useState("this-month");
  const { data: rfqs = [] } = useRfqs();
  const { data: pos = [] } = usePos();
  const { data: requisitions = [] } = useRequisitions();
  const { data: subcategories = [] } = useTaxonomySubcategories();
  const { data: adminSettings } = useOrganizationAdminSettings();
  const { data: suppliers = [] } = useSuppliers();

  const now = new Date();
  const scopedPos = pos.filter((po) => {
    const dt = asDate(po.createdAt);
    return dt ? samePeriod(dt, spendPeriod, now) : false;
  });
  const scopedRfqs = rfqs.filter((rfq) => {
    const dt = asDate(rfq.createdAt);
    return dt ? samePeriod(dt, spendPeriod, now) : false;
  });

  const totalSpend = scopedPos.reduce((sum, po) => sum + po.committedAmount, 0);
  const budgetTotal = scopedRfqs.reduce((sum, rfq) => sum + (rfq.budgetAmount ?? 0), 0);
  const savings = Math.max(0, budgetTotal - totalSpend);
  const spendVariance = budgetTotal > 0 ? ((totalSpend - budgetTotal) / budgetTotal) * 100 : 0;
  const budgetUsedPct = budgetTotal > 0 ? (totalSpend / budgetTotal) * 100 : 0;

  const supplierSpend = Object.values(
    scopedPos.reduce<Record<string, { name: string; value: number }>>((acc, po) => {
      const supplierName = po.supplierName?.trim() || "Unassigned supplier";
      if (!acc[supplierName]) acc[supplierName] = { name: supplierName, value: 0 };
      acc[supplierName].value += po.committedAmount;
      return acc;
    }, {}),
  ).sort((a, b) => b.value - a.value);
  const topSupplier = supplierSpend[0];
  const supplierConcentration = totalSpend > 0 && topSupplier ? (topSupplier.value / totalSpend) * 100 : 0;

  const spendPoints = groupedSpendByMonth(
    pos.map((po) => ({ createdAt: po.createdAt, amount: po.committedAmount })),
  );
  const spendPath = lineSeries(spendPoints);

  const categoryScopedPos = pos.filter((po) => {
    const dt = asDate(po.createdAt);
    return dt ? samePeriod(dt, categoryPeriod, now) : false;
  });
  const taxonomyById = new Map(
    subcategories.map((subcategory) => [subcategory.id, subcategory]),
  );
  const resolveCategoryLabel = (rfqSubcategoryId?: string | null, rfqTitle?: string) => {
    const taxonomy = rfqSubcategoryId ? taxonomyById.get(rfqSubcategoryId) : undefined;
    if (taxonomy) {
      if (categoryLevel === "level1") return taxonomy.level1;
      if (categoryLevel === "level2") return taxonomy.level2;
      return taxonomy.level3;
    }
    if (categoryLevel === "level3") return formatSubcategoryLabel(rfqSubcategoryId ?? undefined, rfqTitle ?? undefined);
    return "Unclassified";
  };
  const categoryBySpend = Object.values(
    categoryScopedPos.reduce<Record<string, { category: string; spend: number; count: number }>>((acc, po) => {
      const rfq = rfqs.find((item) => item.id === po.rfqId);
      const label = resolveCategoryLabel(rfq?.subcategoryId ?? undefined, rfq?.title ?? undefined);
      if (!acc[label]) acc[label] = { category: label, spend: 0, count: 0 };
      acc[label].spend += po.committedAmount;
      acc[label].count += 1;
      return acc;
    }, {}),
  ).sort((a, b) => b.spend - a.spend);
  const availableCategoryOptions = Array.from(new Set(categoryBySpend.map((row) => row.category))).sort((a, b) =>
    a.localeCompare(b),
  );
  const filteredCategoryBySpend =
    selectedCategory === "all" ? categoryBySpend : categoryBySpend.filter((row) => row.category === selectedCategory);
  const rfqById = new Map(rfqs.map((rfq) => [rfq.id, rfq]));
  const reqById = new Map(requisitions.map((req) => [req.id, req]));
  const orgCostCentres = adminSettings?.settings.costCentres ?? [];
  const costCentreNameByCode = new Map(
    orgCostCentres.map((costCentre) => [costCentre.code.trim().toLowerCase(), costCentre.name]),
  );
  const spendByCostCentre = Object.values(
    categoryScopedPos.reduce<Record<string, { code: string; name: string; spend: number }>>((acc, po) => {
      const rfq = rfqById.get(po.rfqId);
      const req = reqById.get(po.prId);
      const rawCode = (rfq?.costCentre ?? req?.costCenter ?? "").trim();
      const normalized = rawCode.toLowerCase();
      if (!normalized) return acc;

      const configuredName = costCentreNameByCode.get(normalized);
      if (!configuredName) return acc;

      if (!acc[normalized]) {
        acc[normalized] = { code: rawCode.toUpperCase(), name: configuredName, spend: 0 };
      }
      acc[normalized].spend += po.committedAmount;
      return acc;
    }, {}),
  ).sort((a, b) => b.spend - a.spend);
  const totalCostCentreSpend = spendByCostCentre.reduce((sum, row) => sum + row.spend, 0);
  const categoryTopForPie = filteredCategoryBySpend.slice(0, 5);
  const pieColors = ["#2563eb", "#16a34a", "#7c3aed", "#f59e0b", "#ef4444"];
  const pieSlices = buildPieSlices(categoryTopForPie.map((item) => item.spend));

  const currency = pos[0]?.currency ?? "ZAR";
  const bidPerRfq = rfqs.length > 0 ? rfqs.reduce((sum, rfq) => sum + rfq.bidCount, 0) / rfqs.length : 0;
  const alerts = [
    {
      title: spendVariance > 0 ? `Spend increased ${Math.abs(spendVariance).toFixed(1)}%` : "Spend is below budget",
      body: budgetTotal > 0 ? "Budget vs committed spend variance detected in current period." : "No budget values recorded for this period yet.",
      tone: spendVariance > 0 ? "red" : "green",
    },
    {
      title: "Supplier concentration risk",
      body: topSupplier ? `${topSupplier.name} accounts for ${supplierConcentration.toFixed(1)}% of committed spend.` : "No supplier concentration yet.",
      tone: supplierConcentration >= 45 ? "amber" : "green",
    },
    {
      title: "Competition signal",
      body: `Average bids per RFQ is ${bidPerRfq.toFixed(1)} across ${rfqs.length} RFQs.`,
      tone: bidPerRfq < 2 ? "amber" : "green",
    },
  ];

  const recentTransactions = [...scopedPos]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 7);

  if (runtimeConfig.isSupplierPortal) {
    return (
      <Card className="border-[var(--border)]">
        <CardContent className="py-8 text-sm text-[var(--text-muted)]">
          Analytics is available in the organization portal only.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Analytics"
        description="Single source of truth for spend, suppliers, and savings."
        actions={
          <>
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-52 bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="this-month">This month</SelectItem>
                <SelectItem value="this-year">This year</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline"><Download className="mr-2 h-4 w-4" />Export</Button>
            <Button className="bg-[var(--primary)] text-white hover:bg-[var(--primary)]/90">Save View</Button>
          </>
        }
      />

      <section className="grid gap-4 xl:grid-cols-5">
        <Card className="min-w-0"><CardContent className="min-w-0 p-6"><div className="flex items-start justify-between gap-3"><p className="text-sm text-slate-500">Total Spend</p><span className="rounded-xl bg-blue-50 p-2 text-blue-600"><Wallet className="h-4 w-4" /></span></div><p className="mt-3 break-words text-[clamp(1.5rem,2.2vw,2.3rem)] font-semibold leading-tight">{formatMoney(totalSpend, currency)}</p><p className="mt-2 text-sm text-emerald-600">Committed in selected period</p></CardContent></Card>
        <Card className="min-w-0"><CardContent className="min-w-0 p-6"><div className="flex items-start justify-between gap-3"><p className="text-sm text-slate-500">Budget vs Actual</p><span className="rounded-xl bg-emerald-50 p-2 text-emerald-600"><Target className="h-4 w-4" /></span></div><div className="mt-3 space-y-1"><p className="break-words text-[clamp(1.2rem,1.8vw,1.8rem)] font-semibold leading-tight">{formatMoney(totalSpend, currency)}</p><p className="break-words text-sm text-slate-500">of {formatMoney(budgetTotal, currency)}</p></div><p className="mt-2 text-sm text-slate-600">{budgetUsedPct.toFixed(1)}% of budget used</p><div className="mt-3"><ProgressBar value={budgetUsedPct} /></div></CardContent></Card>
        <Card className="min-w-0"><CardContent className="min-w-0 p-6"><div className="flex items-start justify-between gap-3"><p className="text-sm text-slate-500">Savings Achieved</p><span className="rounded-xl bg-amber-50 p-2 text-amber-600"><PiggyBank className="h-4 w-4" /></span></div><p className="mt-3 break-words text-[clamp(1.5rem,2.2vw,2.3rem)] font-semibold leading-tight">{formatMoney(savings, currency)}</p><p className="mt-2 text-sm text-emerald-600">Against RFQ budgets</p></CardContent></Card>
        <Card className="min-w-0"><CardContent className="min-w-0 p-6"><div className="flex items-start justify-between gap-3"><p className="text-sm text-slate-500">Spend Variance</p><span className={`rounded-xl p-2 ${spendVariance > 0 ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"}`}>{spendVariance > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}</span></div><p className={`mt-3 break-words text-[clamp(1.5rem,2.2vw,2.3rem)] font-semibold leading-tight ${spendVariance > 0 ? "text-rose-600" : "text-emerald-600"}`}>{spendVariance.toFixed(1)}%</p><p className={`mt-2 text-sm ${spendVariance > 0 ? "text-rose-600" : "text-emerald-600"}`}>{spendVariance > 0 ? "Over budget" : "Under budget"}</p></CardContent></Card>
        <Card className="min-w-0"><CardContent className="min-w-0 p-6"><div className="flex items-start justify-between gap-3"><p className="text-sm text-slate-500">Supplier Concentration</p><span className="rounded-xl bg-violet-50 p-2 text-violet-600"><Coins className="h-4 w-4" /></span></div><p className="mt-3 break-words text-[clamp(1.5rem,2.2vw,2.3rem)] font-semibold leading-tight">{supplierConcentration.toFixed(1)}%</p><p className="mt-2 truncate text-sm text-slate-600">{topSupplier ? `Top supplier: ${topSupplier.name}` : "No supplier data"}</p></CardContent></Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <CardTitle>Spend Over Time</CardTitle>
              <CircleHelp className="h-4 w-4 text-slate-400" />
            </div>
            <Select value={spendPeriod} onValueChange={(v) => setSpendPeriod(v as Period)}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="annual">Annual</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <svg viewBox={`0 0 ${spendPath.width} ${spendPath.height}`} className="h-64 w-full">
                <polyline points={spendPath.values.join(" ")} fill="none" stroke="#2f5ed7" strokeWidth="3" />
                {spendPath.values.map((point, idx) => {
                  const [x, y] = point.split(",");
                  return <circle key={idx} cx={x} cy={y} r="4" fill="#fff" stroke="#2f5ed7" strokeWidth="2" />;
                })}
              </svg>
              <div className="mt-2 grid grid-cols-6 text-center text-xs text-slate-500">
                {Array.from({ length: 6 }, (_, idx) => <span key={idx}>{monthLabel(5 - idx)}</span>)}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Intelligence & Alerts</CardTitle>
            <Button variant="link" className="h-auto p-0 text-sm">View All</Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {alerts.map((alert) => (
              <div key={alert.title} className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-start gap-2">
                  {alert.tone === "red" ? <ShieldAlert className="mt-0.5 h-4 w-4 text-rose-600" /> : alert.tone === "amber" ? <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-500" /> : <ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-600" />}
                  <div>
                    <p className={`text-sm font-semibold ${alert.tone === "red" ? "text-rose-700" : alert.tone === "amber" ? "text-amber-700" : "text-emerald-700"}`}>{alert.title}</p>
                    <p className="text-sm text-slate-600">{alert.body}</p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Spend by Cost Center</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {spendByCostCentre.slice(0, 5).map((row) => (
              <div key={row.code}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="truncate">{row.name} <span className="text-slate-500">({row.code})</span></span>
                  <span>{formatMoney(row.spend, currency)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-2 rounded-full bg-blue-600"
                    style={{ width: `${Math.min(100, Math.round((row.spend / Math.max(totalCostCentreSpend, 1)) * 100))}%` }}
                  />
                </div>
              </div>
            ))}
            {spendByCostCentre.length === 0 ? (
              <p className="text-xs text-slate-500">No committed PO spend mapped to configured cost centres yet.</p>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-col items-start justify-between gap-2 pb-2 sm:flex-row sm:items-center sm:space-y-0">
            <CardTitle className="text-base">Spend by Category</CardTitle>
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
              <Select
                value={categoryLevel}
                onValueChange={(value) => {
                  setCategoryLevel(value as CategoryLevel);
                  setSelectedCategory("all");
                }}
              >
                <SelectTrigger className="w-full sm:w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="level1">Level 1</SelectItem>
                  <SelectItem value="level2">Level 2</SelectItem>
                  <SelectItem value="level3">Level 3</SelectItem>
                </SelectContent>
              </Select>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="All categories" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {availableCategoryOptions.map((category) => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={categoryPeriod} onValueChange={(v) => setCategoryPeriod(v as Period)}>
                <SelectTrigger className="w-full sm:w-28"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="monthly">Monthly</SelectItem><SelectItem value="annual">Annual</SelectItem></SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="mb-3 flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-3">
              {pieSlices.length > 0 ? (
                <svg viewBox="0 0 160 160" className="h-36 w-36">
                  {pieSlices.map((slice, idx) => (
                    <path key={idx} d={arcPath(80, 80, 66, slice.start, slice.end)} fill={pieColors[idx % pieColors.length]} />
                  ))}
                  <circle cx="80" cy="80" r="30" fill="white" />
                </svg>
              ) : (
                <p className="text-xs text-slate-500">No category spend yet.</p>
              )}
            </div>
            {filteredCategoryBySpend.slice(0, 5).map((row) => (
              <button
                key={row.category}
                type="button"
                onClick={() => setSelectedCategory(row.category)}
                className="flex w-full items-center justify-between text-sm text-left"
                title={`View details for ${row.category}`}
              >
                <span className="max-w-[70%] truncate">
                  <span
                    className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle"
                    style={{ backgroundColor: pieColors[filteredCategoryBySpend.slice(0, 5).findIndex((item) => item.category === row.category) % pieColors.length] ?? "#2563eb" }}
                  />
                  {row.category}
                </span>
                <span className="font-medium">{Math.round((row.spend / Math.max(totalSpend, 1)) * 100)}%</span>
              </button>
            ))}
            {filteredCategoryBySpend.length === 0 ? (
              <p className="text-xs text-slate-500">No spend data for the selected category filter.</p>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Spend by Supplier</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {supplierSpend.slice(0, 5).map((row) => (
              <div key={row.name}>
                <div className="mb-1 flex items-center justify-between text-sm"><span className="truncate">{row.name}</span><span>{formatMoney(row.value, currency)}</span></div>
                <div className="h-2 rounded-full bg-slate-200"><div className="h-2 rounded-full bg-blue-600" style={{ width: `${Math.round((row.value / Math.max(totalSpend, 1)) * 100)}%` }} /></div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Top Catalogs (Sub-Categories)</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {filteredCategoryBySpend.slice(0, 5).map((row) => (
              <div key={`catalog-${row.category}`} className="flex items-center justify-between text-sm">
                <span className="max-w-[70%] truncate">{row.category}</span>
                <span>{formatMoney(row.spend, currency)}</span>
              </div>
            ))}
            {filteredCategoryBySpend.length === 0 ? (
              <p className="text-xs text-slate-500">No category spend for this selection.</p>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Budget vs Actual (This Month)</CardTitle></CardHeader>
          <CardContent>
            <div className="h-8 overflow-hidden rounded-lg bg-slate-200">
              <div className="h-8 bg-blue-600 px-3 text-xs font-medium leading-8 text-white" style={{ width: `${Math.min(100, Math.max(4, budgetUsedPct))}%` }}>
                {formatMoney(totalSpend, currency)} ({budgetUsedPct.toFixed(1)}%)
              </div>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-slate-200 p-3"><p className="text-xs text-slate-500">Budget</p><p className="mt-1 font-semibold">{formatMoney(budgetTotal, currency)}</p></div>
              <div className="rounded-lg border border-slate-200 p-3"><p className="text-xs text-slate-500">Actual Spend</p><p className="mt-1 font-semibold">{formatMoney(totalSpend, currency)}</p></div>
              <div className="rounded-lg border border-slate-200 p-3"><p className="text-xs text-slate-500">Remaining</p><p className="mt-1 font-semibold text-emerald-700">{formatMoney(Math.max(0, budgetTotal - totalSpend), currency)}</p></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-base">Recent Transactions</CardTitle>
            <Button variant="link" className="h-auto p-0 text-sm">View All</Button>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr><th className="py-2 pr-4">Date</th><th className="py-2 pr-4">Description</th><th className="py-2 pr-4">Supplier</th><th className="py-2 text-right">Amount</th></tr>
              </thead>
              <tbody>
                {recentTransactions.map((po) => (
                  <tr key={po.id} className="border-t border-slate-100">
                    <td className="py-2 pr-4 whitespace-nowrap">{formatDate(po.createdAt)}</td>
                    <td className="py-2 pr-4">{po.poNumber}</td>
                    <td className="py-2 pr-4">{po.supplierName ?? "-"}</td>
                    <td className="py-2 text-right font-medium">{formatMoney(po.committedAmount, po.currency ?? currency)}</td>
                  </tr>
                ))}
                {recentTransactions.length === 0 ? (
                  <tr><td colSpan={4} className="py-6 text-center text-slate-500">No transactions yet.</td></tr>
                ) : null}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <Badge variant="outline" className="gap-1"><Calendar className="h-3 w-3" />{dateRange === "this-year" ? "Annual window" : "Monthly window"}</Badge>
        <Badge variant="outline" className="gap-1"><Bell className="h-3 w-3" />{alerts.length} active insights</Badge>
        <Badge variant="outline" className="gap-1"><TrendingUp className="h-3 w-3" />{suppliers.length} suppliers in directory</Badge>
      </section>
    </div>
  );
}
