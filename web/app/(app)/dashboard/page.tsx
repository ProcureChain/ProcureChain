"use client";

import Link from "next/link";
import { useState } from "react";
import { useQueries } from "@tanstack/react-query";
import {
  ArrowRight,
  Bell,
  ClipboardList,
  Ellipsis,
  FileBadge2,
  FileSpreadsheet,
  Handshake,
  PackageCheck,
  ScrollText,
  TrendingUp,
} from "lucide-react";

import { KpiTile } from "@/components/common/kpi-tile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime, formatMoney } from "@/lib/format";
import {
  queryKeys,
  useAuditEvents,
  useBidAction,
  useFinanceAction,
  usePoAction,
  usePos,
  useRequisitions,
  useRfqs,
} from "@/lib/query-hooks";
import * as liveApi from "@/lib/api/live-api";
import * as mockApi from "@/lib/api/mock-api";
import { runtimeConfig } from "@/lib/runtime-config";
import { useHydrated } from "@/lib/use-hydrated";
import type { Bid, DeliveryNote, LiveInvoice, PurchaseOrder, Rfq } from "@/lib/types";
import { toast } from "sonner";

const supplierReadApi = runtimeConfig.useMockApi ? mockApi : liveApi;
type AnalyticsPeriod = "monthly" | "annual";

function DashboardHero({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-[var(--border)] bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] text-white shadow-[var(--shadow-lg)]">
      <div className="flex flex-col gap-6 px-6 py-7 lg:flex-row lg:items-end lg:justify-between lg:px-8">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">{eyebrow}</p>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-white">{title}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#dfe4ff]">{description}</p>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </section>
  );
}

function DashboardSection({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-[var(--border)] bg-[var(--surface-background)] shadow-[var(--shadow-sm)]">
      <CardHeader className="border-b border-[var(--border)] pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base font-semibold text-[var(--text-primary)]">{title}</CardTitle>
            {description ? <p className="mt-1 text-sm text-[var(--text-muted)]">{description}</p> : null}
          </div>
          {action}
        </div>
      </CardHeader>
      <CardContent className="pt-5">{children}</CardContent>
    </Card>
  );
}

function WorkMetric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "accent";
}) {
  return (
    <div className={`rounded-lg border p-4 ${tone === "accent" ? "border-[var(--primary)]/20 bg-[var(--portal-org-bg)]" : "border-[var(--border)] bg-[var(--surface-muted)]"}`}>
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--text-muted)]">{label}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight text-[var(--text-primary)]">{value}</p>
    </div>
  );
}

function ModulePanel({
  icon,
  title,
  description,
  metrics,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  metrics?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-[var(--border)] bg-[var(--surface-background)] shadow-[var(--shadow-sm)]">
      <CardHeader className="border-b border-[var(--border)] pb-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-[var(--portal-org-bg)] p-2 text-[var(--secondary)]">{icon}</div>
          <div className="min-w-0">
            <CardTitle className="text-base font-semibold text-[var(--text-primary)]">{title}</CardTitle>
            <p className="mt-1 text-sm text-[var(--text-muted)]">{description}</p>
          </div>
        </div>
        {metrics ? <div className="pt-3">{metrics}</div> : null}
      </CardHeader>
      <CardContent className="pt-5">{children}</CardContent>
    </Card>
  );
}

function resolveTopLevelCategory(subcategoryId?: string | null) {
  if (!subcategoryId) return "Unassigned";
  if (subcategoryId.startsWith("GOO_")) return "Goods & Materials";
  if (subcategoryId.startsWith("MRO_")) return "MRO";
  if (subcategoryId.startsWith("SER_")) return "Services";
  if (subcategoryId.startsWith("WOR_")) return "Works";
  if (subcategoryId.startsWith("LOG_")) return "Logistics";
  if (subcategoryId.startsWith("IT-")) return "IT & Digital";
  if (subcategoryId.startsWith("PRO_")) return "Professional Services";
  return "Other";
}

function buildSparkline(values: number[]) {
  const width = 220;
  const height = 72;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);

  const points = values.map((value, index) => {
    const x = (index / Math.max(values.length - 1, 1)) * width;
    const y = height - ((value - min) / range) * (height - 10) - 5;
    return `${x},${y}`;
  });

  return {
    width,
    height,
    points: points.join(" "),
  };
}

function isWithinAnalyticsPeriod(value: string | Date, period: AnalyticsPeriod) {
  const date = new Date(value);
  const now = new Date();
  if (period === "annual") {
    return date.getUTCFullYear() === now.getUTCFullYear();
  }
  return date.getUTCFullYear() === now.getUTCFullYear() && date.getUTCMonth() === now.getUTCMonth();
}

function buildPeriodSpendSeries(pos: PurchaseOrder[], period: AnalyticsPeriod) {
  if (period === "annual") {
    return Array.from({ length: 12 }, (_, index) => {
      const now = new Date();
      const target = new Date(Date.UTC(now.getUTCFullYear(), index, 1));
      return pos
        .filter((po) => {
          const created = new Date(po.createdAt);
          return created.getUTCFullYear() === target.getUTCFullYear() && created.getUTCMonth() === target.getUTCMonth();
        })
        .reduce((sum, po) => sum + po.committedAmount, 0);
    });
  }

  const now = new Date();
  const lastDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  const step = Math.max(1, Math.ceil(lastDay / 6));
  return Array.from({ length: 6 }, (_, index) => {
    const startDay = index * step + 1;
    const endDay = index === 5 ? lastDay : Math.min(lastDay, (index + 1) * step);
    return pos
      .filter((po) => {
        const created = new Date(po.createdAt);
        return (
          created.getUTCFullYear() === now.getUTCFullYear() &&
          created.getUTCMonth() === now.getUTCMonth() &&
          created.getUTCDate() >= startDay &&
          created.getUTCDate() <= endDay
        );
      })
      .reduce((sum, po) => sum + po.committedAmount, 0);
  });
}

function PeriodToggle({
  period,
  onChange,
}: {
  period: AnalyticsPeriod;
  onChange: (period: AnalyticsPeriod) => void;
}) {
  return (
    <div className="inline-flex rounded-full bg-[var(--surface-muted)] p-1 text-xs font-medium">
      <button
        type="button"
        onClick={() => onChange("monthly")}
        className={`rounded-full px-3 py-1 transition ${period === "monthly" ? "bg-[var(--primary)] text-white" : "text-[var(--text-muted)]"}`}
        aria-pressed={period === "monthly"}
      >
        Monthly
      </button>
      <button
        type="button"
        onClick={() => onChange("annual")}
        className={`rounded-full px-3 py-1 transition ${period === "annual" ? "bg-[var(--primary)] text-white" : "text-[var(--text-muted)]"}`}
        aria-pressed={period === "annual"}
      >
        Annual
      </button>
    </div>
  );
}

function SmallTrendCard({
  label,
  value,
  hint,
  accent = "blue",
  sparkline,
}: {
  label: string;
  value: string;
  hint: string;
  accent?: "blue" | "amber" | "red";
  sparkline?: number[];
}) {
  const palette =
    accent === "amber"
      ? "bg-[#FFF7E8] text-[#9A6700]"
      : accent === "red"
        ? "bg-[#FFF1F1] text-[#B42318]"
        : "bg-[#EEF2FF] text-[#444A74]";

  const line = sparkline && sparkline.length > 1 ? buildSparkline(sparkline) : null;

  return (
    <Card className="overflow-hidden rounded-3xl border-[var(--border)] bg-white shadow-[var(--shadow-sm)]">
      <CardContent className="p-5">
        <div className="space-y-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--text-secondary)]">{label}</p>
            <p className="mt-2 max-w-full overflow-hidden text-[clamp(1.45rem,2.4vw,2.5rem)] leading-[1.05] font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
              {value}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className={`inline-flex h-5 items-center rounded-full px-2 text-[11px] font-semibold ${palette}`}>
                {hint}
              </span>
            </div>
          </div>
          {line ? (
            <div className="h-[72px] w-full rounded-2xl bg-[linear-gradient(180deg,#F7F8FA_0%,#FFFFFF_100%)] p-2">
              <svg viewBox={`0 0 ${line.width} ${line.height}`} className="h-full w-full">
                <defs>
                  <linearGradient id={`spark-${label}`} x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#6E82C4" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="#6E82C4" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <polyline
                  fill="none"
                  stroke="#6E82C4"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={line.points}
                />
              </svg>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function WorkflowStrip({
  metrics,
}: {
  metrics: Array<{ label: string; value: number; note: string; color: string }>;
}) {
  return (
    <Card className="rounded-3xl border-[var(--border)] bg-white shadow-[var(--shadow-sm)]">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">Workflow Overview</h3>
            <p className="mt-1 text-sm text-[var(--text-muted)]">Live flow health across requisitions, RFQs, orders, and invoices.</p>
          </div>
          <Button variant="ghost" size="icon" className="rounded-full text-[var(--text-muted)]">
            <Ellipsis className="h-5 w-5" />
          </Button>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <div key={metric.label} className="rounded-2xl bg-[var(--surface-muted)] p-4">
              <p className="text-sm font-medium text-[var(--text-secondary)]">{metric.label}</p>
              <div className="mt-3 flex items-end gap-2">
                <span className="text-4xl font-semibold tracking-tight text-[var(--text-primary)]">{metric.value}</span>
                <span className="mb-1 text-xs font-medium text-[var(--text-muted)]">{metric.note}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 space-y-3">
          <div className="grid h-3 grid-cols-4 gap-2 overflow-hidden rounded-full bg-[#EEF1F7]">
            {metrics.map((metric) => (
              <div key={metric.label} className="h-full rounded-full" style={{ backgroundColor: metric.color }} />
            ))}
          </div>
          <div className="grid grid-cols-4 gap-2">
            {metrics.map((metric) => (
              <div key={metric.label} className="flex justify-center">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: metric.color }} />
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function InsightsRail({
  insights,
}: {
  insights: string[];
}) {
  return (
    <Card className="rounded-3xl border-0 bg-[linear-gradient(180deg,#2D334A_0%,#202840_100%)] text-white shadow-[var(--shadow-md)] xl:sticky xl:top-20 xl:self-start">
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xl font-semibold">Procurement Intelligence</p>
            <p className="mt-1 text-sm text-white/70">This Week</p>
          </div>
          <div className="rounded-full bg-white/10 p-2">
            <Bell className="h-4 w-4" />
          </div>
        </div>
        <ul className="mt-6 space-y-4 text-sm leading-6 text-[#E5EAFB]">
          {insights.map((insight) => (
            <li key={insight} className="flex gap-3">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-white" />
              <span>{insight}</span>
            </li>
          ))}
        </ul>
        <Button className="mt-8 rounded-full bg-white px-6 text-[var(--primary)] hover:bg-white/90">
          View Insights
        </Button>
      </CardContent>
    </Card>
  );
}

function DonutBreakdown({
  average,
  segments,
  period,
  onPeriodChange,
}: {
  average: string;
  segments: Array<{ label: string; value: number; color: string }>;
  period: AnalyticsPeriod;
  onPeriodChange: (period: AnalyticsPeriod) => void;
}) {
  const total = Math.max(
    segments.reduce((sum, segment) => sum + segment.value, 0),
    1,
  );
  let cursor = 0;
  const gradient = segments
    .map((segment) => {
      const start = (cursor / total) * 100;
      cursor += segment.value;
      const end = (cursor / total) * 100;
      return `${segment.color} ${start}% ${end}%`;
    })
    .join(", ");

  return (
    <Card className="rounded-3xl border-[var(--border)] bg-white shadow-[var(--shadow-sm)]">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">Procurement Intelligence</h3>
            <p className="mt-1 text-sm text-[var(--text-muted)]">{period === "annual" ? "This Year" : "This Month"}</p>
          </div>
          <PeriodToggle period={period} onChange={onPeriodChange} />
        </div>
        <div className="mt-5 rounded-3xl bg-[var(--surface-muted)] p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-lg font-semibold text-[var(--text-primary)]">Average Bids Per RFQ</p>
            </div>
            <p className="text-4xl font-semibold tracking-tight text-[var(--text-primary)]">{average}</p>
          </div>
          <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-center">
            <div
              className="relative h-40 w-40 shrink-0 rounded-full"
              style={{
                background: `conic-gradient(${gradient})`,
              }}
            >
              <div className="absolute inset-[22px] flex items-center justify-center rounded-full bg-white">
                <div className="text-center">
                  <p className="text-3xl font-semibold tracking-tight text-[var(--text-primary)]">
                    {Math.round((segments[0]?.value ?? 0) / total * 100) || 0}%
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              {segments.map((segment) => (
                <div key={segment.label} className="flex items-center gap-3 text-sm text-[var(--text-secondary)]">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: segment.color }} />
                  <span>{segment.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TopSuppliersCard({
  rows,
  period,
  onPeriodChange,
  currency,
}: {
  rows: Array<{ supplier: string; spend: number }>;
  period: AnalyticsPeriod;
  onPeriodChange: (period: AnalyticsPeriod) => void;
  currency: string;
}) {
  const topRows = rows.slice(0, 5);
  return (
    <Card className="rounded-3xl border-[var(--border)] bg-white shadow-[var(--shadow-sm)]">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">Top 5 Suppliers by Spend</h3>
          </div>
          <PeriodToggle period={period} onChange={onPeriodChange} />
        </div>
        <div className="mt-5 rounded-3xl bg-[var(--surface-muted)] p-3">
          {topRows.length > 0 ? (
            <div className="space-y-3">
              {topRows.map((row, idx) => (
                <div key={`${row.supplier}-${idx}`} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--text-primary)]">{row.supplier}</p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold text-[var(--text-secondary)]">{formatMoney(row.spend, currency)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">No supplier spend in selected period.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SupplierDashboard({ rfqs, pos }: { rfqs: Rfq[]; pos: PurchaseOrder[] }) {
  const bidAction = useBidAction();
  const poAction = usePoAction();
  const financeAction = useFinanceAction();

  const supplierId = runtimeConfig.supplierId;
  const [bidDialogOpen, setBidDialogOpen] = useState(false);
  const [selectedRfq, setSelectedRfq] = useState<Rfq | null>(null);
  const [bidAmount, setBidAmount] = useState("");
  const [bidComment, setBidComment] = useState("");
  const [bidFiles, setBidFiles] = useState<File[]>([]);
  const [changeDialogOpen, setChangeDialogOpen] = useState(false);
  const [selectedPo, setSelectedPo] = useState<PurchaseOrder | null>(null);
  const [changeReason, setChangeReason] = useState("");
  const [proposedTerms, setProposedTerms] = useState("");
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [invoicePo, setInvoicePo] = useState<PurchaseOrder | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceNotes, setInvoiceNotes] = useState("");
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);

  const openRfqs = rfqs.filter(
    (rfq) =>
      (rfq.status === "RELEASED" || rfq.status === "OPEN") &&
      (!supplierId || rfq.suppliers.some((supplier) => supplier.supplierId === supplierId)),
  );
  const supplierPos = pos.filter((po) => !supplierId || po.supplierId === supplierId);
  const awaitingResponse = supplierPos.filter((po) => po.status === "RELEASED" || po.status === "CHANGE_REQUESTED");
  const acceptedPos = supplierPos.filter((po) => po.status === "ACCEPTED");
  const submittedPos = supplierPos.filter((po) => po.status === "CLOSED");

  const bidQueries = useQueries({
    queries: openRfqs.map((rfq) => ({
      queryKey: [...queryKeys.bidsByRfq(rfq.id), runtimeConfig.portal, supplierId ?? "unknown"],
      queryFn: () => supplierReadApi.listBidsByRfq(rfq.id) as Promise<Bid[]>,
    })),
  });
  const deliveryQueries = useQueries({
    queries: acceptedPos.map((po) => ({
      queryKey: [...queryKeys.deliveryNotes(po.id), runtimeConfig.portal],
      queryFn: () => supplierReadApi.listDeliveryNotes(po.id) as Promise<DeliveryNote[]>,
    })),
  });
  const invoiceQueries = useQueries({
    queries: acceptedPos.map((po) => ({
      queryKey: [...queryKeys.liveInvoices(po.id), runtimeConfig.portal, supplierId ?? "unknown"],
      queryFn: () => supplierReadApi.listLiveInvoices(po.id) as Promise<LiveInvoice[]>,
    })),
  });

  const bidMap = new Map<string, Bid | undefined>(
    openRfqs.map((rfq, index) => {
      const bids = (bidQueries[index]?.data ?? []).filter((bid) => !supplierId || bid.supplierId === supplierId);
      return [rfq.id, bids[0]];
    }),
  );
  const deliveryMap = new Map<string, DeliveryNote[]>(
    acceptedPos.map((po, index) => [po.id, deliveryQueries[index]?.data ?? []]),
  );
  const invoiceMap = new Map<string, LiveInvoice[]>(
    acceptedPos.map((po, index) => [
      po.id,
      (invoiceQueries[index]?.data ?? []).filter((invoice) => !supplierId || invoice.supplierId === supplierId),
    ]),
  );
  const draftBidCount = Array.from(bidMap.values()).filter((bid) => bid?.status === "DRAFT").length;
  const submittedBidCount = Array.from(bidMap.values()).filter((bid) => bid?.status === "SUBMITTED").length;
  const invoicesReadyToCreate = acceptedPos.filter((po) => (deliveryMap.get(po.id) ?? []).length > 0).length;
  const invoicesSubmitted = Array.from(invoiceMap.values())
    .flat()
    .filter((invoice) => invoice.status === "SUBMITTED_TO_ORG" || invoice.status === "UNDER_REVIEW" || invoice.status === "SIGNED" || invoice.status === "PAID")
    .length;

  const openBidEditor = (rfq: Rfq) => {
    setSelectedRfq(rfq);
    setBidAmount(String(bidMap.get(rfq.id)?.totalBidValue ?? ""));
    setBidComment(typeof bidMap.get(rfq.id)?.notes === "string" ? String(bidMap.get(rfq.id)?.notes) : "");
    const existingFiles = Array.isArray(bidMap.get(rfq.id)?.documents?.attachments)
      ? (bidMap.get(rfq.id)?.documents?.attachments as Array<{ name?: string; type?: string; sizeBytes?: number }>)
      : [];
    setBidFiles(
      existingFiles
        .filter((entry) => typeof entry?.name === "string" && entry.name.trim().length > 0)
        .map((entry) => new File([], entry.name ?? "attachment", { type: entry.type ?? "application/octet-stream" })),
    );
    setBidDialogOpen(true);
  };

  const saveBidDraft = async () => {
    if (!selectedRfq || !supplierId) return;
    try {
      const attachments = bidFiles.map((file) => ({
        name: file.name,
        type: file.type || "application/octet-stream",
        sizeBytes: file.size,
      }));
      await bidAction.mutateAsync({
        type: "upsert",
        rfqId: selectedRfq.id,
        supplierId,
        totalBidValue: Number(bidAmount),
        notes: bidComment.trim() || undefined,
        payload: {
          supplierComment: bidComment.trim() || undefined,
          compliance: { supplier_documents: attachments.length > 0 },
        },
        documents: {
          attachments,
        },
        currency: "ZAR",
      });
      toast.success("Bid draft saved");
      setBidDialogOpen(false);
      setBidComment("");
      setBidFiles([]);
    } catch (error) {
      console.error(error);
      toast.error("Bid draft save failed");
    }
  };

  const submitBid = async (rfqId: string) => {
    const bid = bidMap.get(rfqId);
    if (!bid?.id) return;
    try {
      await bidAction.mutateAsync({ type: "submit", bidId: bid.id });
      toast.success("Bid submitted");
    } catch (error) {
      console.error(error);
      toast.error("Bid submission failed");
    }
  };

  const acceptPo = async (poId: string) => {
    try {
      await poAction.mutateAsync({
        type: "respond",
        poId,
        action: "ACCEPT",
        requestedBy: runtimeConfig.actorName,
      });
      toast.success("PO accepted");
    } catch (error) {
      console.error(error);
      toast.error("PO acceptance failed");
    }
  };

  const openChangeDialog = (po: PurchaseOrder) => {
    setSelectedPo(po);
    setChangeReason("");
    setProposedTerms(po.terms ?? "");
    setChangeDialogOpen(true);
  };

  const requestChange = async () => {
    if (!selectedPo) return;
    try {
      await poAction.mutateAsync({
        type: "respond",
        poId: selectedPo.id,
        action: "REQUEST_CHANGE",
        reason: changeReason,
        proposedTerms,
        requestedBy: runtimeConfig.actorName,
      });
      toast.success("Change request sent");
      setChangeDialogOpen(false);
    } catch (error) {
      console.error(error);
      toast.error("PO change request failed");
    }
  };

  const openInvoiceDialog = (po: PurchaseOrder) => {
    setInvoicePo(po);
    setInvoiceNumber("");
    setInvoiceNotes("");
    setInvoiceFile(null);
    setInvoiceDialogOpen(true);
  };

  const createInvoiceDraft = async () => {
    if (!invoicePo) return;
    const deliveryNoteId = deliveryMap.get(invoicePo.id)?.[0]?.id;
    try {
      await financeAction.mutateAsync({
        type: "create-supplier-invoice",
        poId: invoicePo.id,
        deliveryNoteId,
        invoiceNumber: invoiceNumber || undefined,
        notes: invoiceNotes || undefined,
        taxIncluded: true,
        taxRatePercent: 15,
        file: invoiceFile,
      });
      toast.success("Supplier invoice draft created");
      setInvoiceDialogOpen(false);
    } catch (error) {
      console.error(error);
      toast.error("Invoice draft creation failed");
    }
  };

  const submitInvoice = async (invoiceId: string) => {
    try {
      await financeAction.mutateAsync({
        type: "submit-live-invoice",
        invoiceId,
      });
      toast.success("Invoice forwarded to organisation");
    } catch (error) {
      console.error(error);
      toast.error("Invoice submission failed");
    }
  };

  if (!supplierId) {
    return (
      <div className="space-y-6">
        <DashboardHero
          eyebrow="Supplier Workspace"
          title={`Welcome, ${runtimeConfig.actorName}`}
          description="Supplier dashboard requires a supplier profile selection in the test login screen."
        />
        <Card className="border-[var(--border)] bg-[var(--surface-background)] shadow-[var(--shadow-sm)]">
          <CardHeader>
            <CardTitle>No Supplier Profile Selected</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-[var(--text-muted)]">Go back to the login screen, switch to the Supplier tab, and select the supplier profile you want to operate as.</p>
            <Button asChild>
              <Link href="/login">Return to Login</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DashboardHero
        eyebrow="Supplier Workspace"
        title={`Welcome, ${runtimeConfig.actorName}`}
        description="Supplier workspace for bids, PO response, and invoice submission."
        actions={
          <Badge variant="outline" className="rounded-md border-white/20 bg-white/10 text-white">
            Supplier Portal
          </Badge>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile label="Open RFx" value={String(openRfqs.length)} delta="Available opportunities" href="/supplier/rfqs" />
        <KpiTile label="Awaiting Supplier Approval" value={String(awaitingResponse.length)} delta="POs needing acceptance" href="/supplier/purchase-orders" />
        <KpiTile label="Accepted POs" value={String(acceptedPos.length)} delta="Ready for invoice workflow" href="/supplier/invoices" />
        <KpiTile label="Completed POs" value={String(submittedPos.length)} delta="Closed commercial flows" href="/supplier/purchase-orders" />
      </section>

      <section className="grid gap-4 xl:grid-cols-4">
        <ModulePanel
          icon={<FileBadge2 className="h-5 w-5" />}
          title="RFx Opportunities"
          description="Released and open RFx invitations linked to this supplier."
          metrics={<WorkMetric label="Current Queue" value={openRfqs.length} />}
        >
          <Button asChild variant="outline" size="sm">
            <Link href="/supplier/rfqs">Open RFx Queue</Link>
          </Button>
        </ModulePanel>

        <ModulePanel
          icon={<Handshake className="h-5 w-5" />}
          title="PO Actions"
          description="Accept released POs or send back a structured change request."
          metrics={<WorkMetric label="Awaiting / Accepted" value={`${awaitingResponse.length} / ${acceptedPos.length}`} />}
        >
          <Button asChild variant="outline" size="sm">
            <Link href="/supplier/purchase-orders">Review POs</Link>
          </Button>
        </ModulePanel>

        <ModulePanel
          icon={<ScrollText className="h-5 w-5" />}
          title="Supplier Invoicing"
          description="Create supplier invoices after delivery-note upload and forward them to the organisation."
          metrics={<WorkMetric label="Ready / Forwarded" value={`${invoicesReadyToCreate} / ${invoicesSubmitted}`} />}
        >
          <Button asChild variant="outline" size="sm">
            <Link href="/supplier/invoices">Open Invoices</Link>
          </Button>
        </ModulePanel>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <WorkMetric label="Conversion Rate" value={`${openRfqs.length ? Math.round((submittedBidCount / openRfqs.length) * 100) : 0}%`} tone="accent" />
        <WorkMetric label="PO Acceptance" value={`${awaitingResponse.length ? Math.round((acceptedPos.length / Math.max(awaitingResponse.length + acceptedPos.length, 1)) * 100) : 100}%`} />
        <WorkMetric label="Invoice Forwarded" value={`${invoicesReadyToCreate ? Math.round((invoicesSubmitted / Math.max(invoicesReadyToCreate, 1)) * 100) : 0}%`} />
        <WorkMetric label="Total PO Value" value={formatMoney(supplierPos.reduce((sum, po) => sum + po.committedAmount, 0), "ZAR")} />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <DashboardSection title="PO Response" description="Review issued purchase orders and respond quickly.">
          <div className="overflow-hidden rounded-xl border border-[var(--border)]">
            <div className="hidden grid-cols-[1fr_.9fr_1fr] bg-[var(--surface-muted)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)] lg:grid">
              <span>PO</span>
              <span>Status</span>
              <span className="text-right">Action</span>
            </div>
            <div className="divide-y divide-[var(--border)]">
              {supplierPos.slice(0, 6).map((po) => (
                <div key={po.id} className="space-y-3 px-4 py-3 lg:grid lg:grid-cols-[1fr_.9fr_1fr] lg:items-center lg:gap-2 lg:space-y-0">
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{po.poNumber}</p>
                    <p className="text-xs text-[var(--text-muted)]">{formatDateTime(po.updatedAt)}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className={`w-fit rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                      po.status === "ACCEPTED" ? "status-approved" : po.status === "CHANGE_REQUESTED" ? "status-review" : "status-submitted"
                    }`}
                  >
                    {po.status}
                  </Badge>
                  <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
                    {po.status === "RELEASED" || po.status === "CHANGE_REQUESTED" ? (
                      <>
                        <Button size="sm" className="h-8 px-3" onClick={() => acceptPo(po.id)}>
                          Accept
                        </Button>
                        <Button size="sm" className="h-8 px-3" variant="outline" onClick={() => openChangeDialog(po)}>
                          Change
                        </Button>
                      </>
                    ) : (
                      <p className="text-xs font-medium text-[var(--status-approved-fg)]">No action</p>
                    )}
                  </div>
                </div>
              ))}
              {!supplierPos.length ? <p className="px-4 py-6 text-sm text-[var(--text-muted)]">No purchase orders assigned to this supplier.</p> : null}
            </div>
          </div>
        </DashboardSection>

        <DashboardSection title="Supplier Invoicing" description="Create and forward invoices after delivery-note upload.">
          <div className="overflow-hidden rounded-xl border border-[var(--border)]">
            <div className="hidden grid-cols-[1fr_1.2fr_1fr] bg-[var(--surface-muted)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)] lg:grid">
              <span>PO</span>
              <span>Invoice State</span>
              <span className="text-right">Action</span>
            </div>
            <div className="divide-y divide-[var(--border)]">
              {acceptedPos.slice(0, 6).map((po) => {
                const deliveryNotes = deliveryMap.get(po.id) ?? [];
                const invoices = invoiceMap.get(po.id) ?? [];
                const draftInvoice = invoices.find((invoice) => invoice.status === "DRAFT");
                const submittedInvoice = invoices.find((invoice) => invoice.status !== "DRAFT");
                return (
                  <div key={po.id} className="space-y-3 px-4 py-3 lg:grid lg:grid-cols-[1fr_1.2fr_1fr] lg:items-center lg:gap-2 lg:space-y-0">
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{po.poNumber}</p>
                      <p className="text-xs text-[var(--text-muted)]">DN: {deliveryNotes.length}</p>
                    </div>
                    <p className="text-sm text-[var(--text-primary)]">{submittedInvoice?.status ?? draftInvoice?.status ?? "Not started"}</p>
                    <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
                      {!draftInvoice && !submittedInvoice ? (
                        <Button size="sm" className="h-8 px-3" variant="outline" disabled={deliveryNotes.length < 1} onClick={() => openInvoiceDialog(po)}>
                          Create
                        </Button>
                      ) : null}
                      {draftInvoice ? (
                        <Button size="sm" className="h-8 px-3" onClick={() => submitInvoice(draftInvoice.id)}>
                          Forward
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
              {!acceptedPos.length ? <p className="px-4 py-6 text-sm text-[var(--text-muted)]">No accepted POs ready for invoicing.</p> : null}
            </div>
          </div>
        </DashboardSection>
      </section>

      <Dialog
        open={bidDialogOpen}
        onOpenChange={(open) => {
          setBidDialogOpen(open);
          if (!open) {
            setBidComment("");
            setBidFiles([]);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedRfq ? `Bid for ${selectedRfq.title}` : "Create Bid"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="bid-amount">Bid amount</Label>
              <Input id="bid-amount" value={bidAmount} onChange={(e) => setBidAmount(e.target.value)} placeholder="Total bid value" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="bid-comment">Comments / notes</Label>
              <Textarea id="bid-comment" value={bidComment} onChange={(e) => setBidComment(e.target.value)} placeholder="Add assumptions, exclusions, lead-time notes, or clarifications for the buyer." />
            </div>
            <div className="space-y-1">
              <Label htmlFor="bid-files">Bid documents</Label>
              <Input id="bid-files" type="file" multiple onChange={(e) => setBidFiles(Array.from(e.target.files ?? []))} />
              <p className="text-xs text-slate-500">
                Bid draft documents are currently stored as metadata on the bid record. Move this to object/blob storage before production.
              </p>
            </div>
            <Button className="w-full" disabled={!selectedRfq || !supplierId || !Number(bidAmount)} onClick={saveBidDraft}>
              Save Draft Bid
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={changeDialogOpen} onOpenChange={setChangeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedPo ? `Request change for ${selectedPo.poNumber}` : "Request PO change"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="change-reason">Reason</Label>
              <Textarea id="change-reason" value={changeReason} onChange={(e) => setChangeReason(e.target.value)} placeholder="Describe the change required" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="proposed-terms">Proposed terms</Label>
              <Input id="proposed-terms" value={proposedTerms} onChange={(e) => setProposedTerms(e.target.value)} placeholder="Optional revised terms" />
            </div>
            <Button className="w-full" disabled={!selectedPo || !changeReason.trim()} onClick={requestChange}>
              Send Change Request
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={invoiceDialogOpen} onOpenChange={setInvoiceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{invoicePo ? `Create invoice for ${invoicePo.poNumber}` : "Create Supplier Invoice"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="invoice-number">Invoice number</Label>
              <Input id="invoice-number" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="Supplier invoice number" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="invoice-notes">Notes</Label>
              <Textarea id="invoice-notes" value={invoiceNotes} onChange={(e) => setInvoiceNotes(e.target.value)} placeholder="Invoice notes" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="invoice-file">Invoice file</Label>
              <Input id="invoice-file" type="file" onChange={(e) => setInvoiceFile(e.target.files?.[0] ?? null)} />
            </div>
            <Button className="w-full" disabled={!invoicePo} onClick={createInvoiceDraft}>
              Create Supplier Invoice Draft
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OrganizationDashboard() {
  const [categoryPeriod, setCategoryPeriod] = useState<AnalyticsPeriod>("monthly");
  const [intelligencePeriod, setIntelligencePeriod] = useState<AnalyticsPeriod>("monthly");
  const [savingsPeriod, setSavingsPeriod] = useState<AnalyticsPeriod>("monthly");
  const { data: reqs = [] } = useRequisitions();
  const { data: rfqs = [] } = useRfqs();
  const { data: pos = [] } = usePos();
  const { data: events = [] } = useAuditEvents();
  const invoiceQueries = useQueries({
    queries: pos.map((po) => ({
      queryKey: [...queryKeys.liveInvoices(po.id), "dashboard", runtimeConfig.portal],
      queryFn: () => supplierReadApi.listLiveInvoices(po.id) as Promise<LiveInvoice[]>,
    })),
  });

  const pending = reqs.filter((r) => r.status === "UNDER_REVIEW" || r.status === "SUBMITTED").length;
  const drafts = reqs.filter((r) => r.status === "DRAFT").length;
  const returned = reqs.filter((r) => r.status === "RETURNED").length;
  const approved = reqs.filter((r) => r.status === "APPROVED").length;
  const activeRfqs = rfqs.filter((rfq) => rfq.status === "RELEASED" || rfq.status === "OPEN").length;
  const awardedRfqs = rfqs.filter((rfq) => rfq.status === "AWARDED").length;
  const activePos = pos.filter((po) => po.status !== "CLOSED").length;
  const closedPos = pos.filter((po) => po.status === "CLOSED").length;
  const awaitingAcceptance = pos.filter((po) => po.status === "RELEASED" || po.status === "CHANGE_REQUESTED").length;

  const allInvoices = invoiceQueries.flatMap((query) => query.data ?? []);
  const invoiceQueue = allInvoices.filter((invoice) =>
    ["SUBMITTED_TO_ORG", "UNDER_REVIEW", "SIGNED"].includes(invoice.status),
  ).length;

  const recentAuditCount = events.filter((event) => Date.now() - new Date(event.at).getTime() <= 7 * 24 * 60 * 60 * 1000).length;
  const totalSpend = pos.reduce((sum, po) => sum + po.committedAmount, 0);
  const totalSpendSeries = buildPeriodSpendSeries(pos, "annual");

  const rfqById = new Map(rfqs.map((rfq) => [rfq.id, rfq]));
  const reqById = new Map(reqs.map((req) => [req.id, req]));
  const budgetVarianceTotals = pos.reduce(
    (acc, po) => {
      const rfqBudget = rfqById.get(po.rfqId)?.budgetAmount;
      if (rfqBudget == null || rfqBudget <= 0) return acc;
      const variance = po.committedAmount - rfqBudget;
      if (variance > 0) acc.overBudgetSpend += variance;
      else if (variance < 0) acc.underBudgetSpend += Math.abs(variance);
      return acc;
    },
    { overBudgetSpend: 0, underBudgetSpend: 0 },
  );
  const overBudgetSpend = budgetVarianceTotals.overBudgetSpend;
  const underBudgetSpend = budgetVarianceTotals.underBudgetSpend;
  const cumulativeVariance = overBudgetSpend - underBudgetSpend;
  const cumulativeVarianceLabel =
    cumulativeVariance > 0
      ? "Cumulative Over Budget"
      : cumulativeVariance < 0
        ? "Cumulative Savings"
        : "On Budget";
  const categoryPos = pos.filter((po) => isWithinAnalyticsPeriod(po.createdAt, categoryPeriod));
  const categorySpendRows = Object.values(
    categoryPos.reduce<Record<string, { label: string; spend: number; poCount: number; rfqCount: Set<string> }>>((acc, po) => {
      const rfq = rfqById.get(po.rfqId);
      const req = reqById.get(po.prId);
      const label = resolveTopLevelCategory(rfq?.subcategoryId ?? req?.subcategoryId);
      if (!acc[label]) {
        acc[label] = { label, spend: 0, poCount: 0, rfqCount: new Set<string>() };
      }
      acc[label].spend += po.committedAmount;
      acc[label].poCount += 1;
      if (po.rfqId) {
        acc[label].rfqCount.add(po.rfqId);
      }
      return acc;
    }, {}),
  )
    .map((row) => ({
      label: row.label,
      spend: row.spend,
      poCount: row.poCount,
      rfqCount: row.rfqCount.size,
      share: categoryPos.length > 0 ? Math.round((row.spend / Math.max(categoryPos.reduce((sum, po) => sum + po.committedAmount, 0), 1)) * 100) : 0,
    }))
    .sort((a, b) => b.spend - a.spend);

  const categoryBreakdown = categorySpendRows.map(({ label, spend }) => ({ label, value: spend }));

  const intelligenceRfqs = rfqs.filter((rfq) => isWithinAnalyticsPeriod(rfq.createdAt, intelligencePeriod));
  const intelligencePos = pos.filter((po) => isWithinAnalyticsPeriod(po.createdAt, intelligencePeriod));
  const intelligenceCategorySpendRows = Object.values(
    intelligencePos.reduce<Record<string, { label: string; spend: number }>>((acc, po) => {
      const rfq = rfqById.get(po.rfqId);
      const req = reqById.get(po.prId);
      const label = resolveTopLevelCategory(rfq?.subcategoryId ?? req?.subcategoryId);
      if (!acc[label]) {
        acc[label] = { label, spend: 0 };
      }
      acc[label].spend += po.committedAmount;
      return acc;
    }, {}),
  );
  const rfqBidCounts = intelligenceRfqs.map((rfq) => rfq.bidCount);
  const averageBidsPerRfq =
    rfqBidCounts.length > 0
      ? (rfqBidCounts.reduce((sum, count) => sum + count, 0) / rfqBidCounts.length).toFixed(1)
      : "0.0";

  const donutSegments = [
    { label: "Goods & Materials", value: intelligenceCategorySpendRows.find((x) => x.label === "Goods & Materials")?.spend ?? 0, color: "#31477D" },
    { label: "Services", value: intelligenceCategorySpendRows.find((x) => x.label === "Services")?.spend ?? 0, color: "#6B8CC4" },
    { label: "IT & Digital", value: intelligenceCategorySpendRows.find((x) => x.label === "IT & Digital")?.spend ?? 0, color: "#8AC3C2" },
    { label: "Logistics", value: intelligenceCategorySpendRows.find((x) => x.label === "Logistics")?.spend ?? 0, color: "#F1C75B" },
  ].filter((segment) => segment.value > 0);

  const supplierSpendRows = Object.values(
    pos
      .filter((po) => isWithinAnalyticsPeriod(po.createdAt, savingsPeriod))
      .reduce<Record<string, { supplier: string; spend: number }>>((acc, po) => {
        const supplier = po.supplierName?.trim() || "Unassigned supplier";
        if (!acc[supplier]) {
          acc[supplier] = { supplier, spend: 0 };
        }
        acc[supplier].spend += po.committedAmount;
        return acc;
      }, {}),
  ).sort((a, b) => b.spend - a.spend);

  const workflowMetrics = [
    { label: "PRs Under Review", value: pending, note: `${returned} delayed`, color: "#526FB6" },
    { label: "RFQs Open", value: activeRfqs, note: awardedRfqs > 0 ? `${awardedRfqs} awarded` : "Closing soon", color: "#CBD5E1" },
    { label: "POs Awaiting", value: awaitingAcceptance, note: "Supplier response", color: "#F0C859" },
    { label: "Invoices", value: invoiceQueue, note: `${recentAuditCount} flagged`, color: "#F17D7D" },
  ];

  const insights = [
    activeRfqs > 0
      ? `${activeRfqs} RFQs are currently live in the market`
      : "No RFQs are currently open",
    awaitingAcceptance > 0
      ? `${awaitingAcceptance} purchase orders still need supplier acceptance`
      : "No purchase orders are waiting on supplier acceptance",
    averageBidsPerRfq !== "0.0"
      ? `Average bid pressure is ${averageBidsPerRfq} responses per RFQ`
      : "Bid activity has not started on current RFQs",
    returned > 0
      ? `${returned} requisitions were returned for clarification`
      : "No requisitions were returned this cycle",
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-[var(--border)] bg-white p-6 shadow-[var(--shadow-lg)]">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">Dashboard</h1>
            <p className="mt-2 text-base text-[var(--text-muted)]">Procurement Overview - April 2026</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-2 text-sm text-[var(--text-muted)]">
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--secondary)]" />
              Live dev workspace
            </div>
            <Button asChild className="rounded-full bg-white px-5 text-[var(--primary)] hover:bg-white/90">
              <Link href="/requisitions/new">
                + Create
              </Link>
            </Button>
          </div>
        </div>

        <section className="mt-6 grid gap-4 xl:grid-cols-[1.5fr_0.9fr_0.9fr_0.9fr]">
          <SmallTrendCard
            label="Total Spend"
            value={formatMoney(totalSpend || 0, pos[0]?.currency ?? "ZAR")}
            hint="Current year committed"
            sparkline={totalSpendSeries}
          />
          <SmallTrendCard
            label="Overbudget Spend"
            value={formatMoney(overBudgetSpend, pos[0]?.currency ?? "ZAR")}
            hint="Total committed above RFQ budgets"
            accent={overBudgetSpend > 0 ? "red" : "blue"}
          />
          <SmallTrendCard
            label="Underbudget Spend"
            value={formatMoney(underBudgetSpend, pos[0]?.currency ?? "ZAR")}
            hint="Total savings below RFQ budgets"
            accent={underBudgetSpend > 0 ? "blue" : "amber"}
          />
          <SmallTrendCard
            label="Cumulative Variance"
            value={formatMoney(Math.abs(cumulativeVariance), pos[0]?.currency ?? "ZAR")}
            hint={cumulativeVarianceLabel}
            accent={cumulativeVariance > 0 ? "red" : cumulativeVariance < 0 ? "blue" : "amber"}
          />
        </section>

        <section className="mt-4 grid gap-4 xl:grid-cols-[1.65fr_0.85fr]">
          <WorkflowStrip metrics={workflowMetrics} />
          <InsightsRail insights={insights} />
        </section>

        <section className="mt-4 grid gap-4 xl:grid-cols-[1.15fr_0.92fr_0.78fr]">
          <Card className="rounded-3xl border-[var(--border)] bg-white shadow-[var(--shadow-sm)]">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">Spend by Category</h3>
                </div>
                <PeriodToggle period={categoryPeriod} onChange={setCategoryPeriod} />
              </div>
              <div className="mt-4 overflow-hidden rounded-3xl border border-[var(--border)]">
                <table className="min-w-full text-sm">
                  <thead className="bg-[var(--surface-muted)] text-left text-[var(--text-muted)]">
                    <tr>
                      <th className="px-4 py-3 font-medium">Category</th>
                      <th className="px-4 py-3 font-medium">Committed Spend</th>
                      <th className="px-4 py-3 font-medium">POs</th>
                      <th className="px-4 py-3 font-medium">Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categorySpendRows.map((row) => (
                      <tr key={row.label} className="border-t border-[var(--border)]">
                        <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{row.label}</td>
                        <td className="px-4 py-3 text-[var(--text-secondary)]">{formatMoney(row.spend, pos[0]?.currency ?? "ZAR")}</td>
                        <td className="px-4 py-3 text-[var(--text-secondary)]">{row.poCount}</td>
                        <td className="px-4 py-3 text-[var(--text-secondary)]">{row.share}%</td>
                      </tr>
                    ))}
                    {categorySpendRows.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center text-[var(--text-muted)]">
                          No committed category spend data available yet.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {categoryBreakdown.slice(0, 4).map((category) => (
                  <Badge key={category.label} variant="outline" className="rounded-full border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1 text-[11px] text-[var(--text-secondary)]">
                    {category.label}: {formatMoney(category.value, rfqs[0]?.currency ?? "ZAR")}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <DonutBreakdown
            average={averageBidsPerRfq}
            segments={donutSegments.length > 0 ? donutSegments : [{ label: "No Activity", value: 1, color: "#CBD5E1" }]}
            period={intelligencePeriod}
            onPeriodChange={setIntelligencePeriod}
          />

          <TopSuppliersCard
            rows={supplierSpendRows}
            period={savingsPeriod}
            onPeriodChange={setSavingsPeriod}
            currency={pos[0]?.currency ?? "ZAR"}
          />
        </section>
      </section>
    </div>
  );
}

export default function DashboardPage() {
  const hydrated = useHydrated();
  const { data: rfqs = [] } = useRfqs();
  const { data: pos = [] } = usePos();

  if (!hydrated) {
    return <div className="space-y-6" />;
  }

  if (runtimeConfig.isSupplierPortal) {
    return <SupplierDashboard rfqs={rfqs} pos={pos} />;
  }

  return <OrganizationDashboard />;
}
