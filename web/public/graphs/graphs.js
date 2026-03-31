"use client";

import React, { useMemo, useState } from "react";
import ReactEChartsCore from "echarts-for-react/lib/core";
import * as echarts from "echarts/core";
import {
  LineChart,
  BarChart,
  PieChart,
  ScatterChart,
  HeatmapChart,
  TreemapChart,
  SankeyChart,
  GaugeChart,
  FunnelChart,
  BoxplotChart,
  CustomChart,
} from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  DatasetComponent,
  TransformComponent,
  VisualMapComponent,
  ToolboxComponent,
  GraphicComponent,
  DataZoomComponent,
  MarkLineComponent,
  MarkAreaComponent,
  MarkPointComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  Banknote,
  BarChart3,
  Briefcase,
  Clock3,
  FileCheck2,
  ShieldCheck,
  TrendingUp,
  Wallet,
} from "lucide-react";

echarts.use([
  LineChart,
  BarChart,
  PieChart,
  ScatterChart,
  HeatmapChart,
  TreemapChart,
  SankeyChart,
  GaugeChart,
  FunnelChart,
  BoxplotChart,
  CustomChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  DatasetComponent,
  TransformComponent,
  VisualMapComponent,
  ToolboxComponent,
  GraphicComponent,
  DataZoomComponent,
  MarkLineComponent,
  MarkAreaComponent,
  MarkPointComponent,
  CanvasRenderer,
]);

const palette = {
  bg: "#f5f7fb",
  panel: "#ffffff",
  panelSoft: "#f8fafc",
  border: "#e5e7eb",
  text: "#0f172a",
  subtext: "#475569",
  muted: "#94a3b8",
  brand: "#2563eb",
  brandSoft: "#dbeafe",
  accent: "#7c3aed",
  green: "#16a34a",
  amber: "#d97706",
  red: "#dc2626",
  cyan: "#0891b2",
  indigo: "#4f46e5",
  pink: "#db2777",
  slate: "#334155",
};

const seriesPalette = [
  "#2563eb",
  "#4f46e5",
  "#0f766e",
  "#16a34a",
  "#d97706",
  "#db2777",
  "#7c3aed",
  "#0891b2",
  "#ef4444",
  "#64748b",
];

const months = [
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
  "Jan",
  "Feb",
  "Mar",
];

const departments = [
  "Operations",
  "ICT",
  "Finance",
  "Manufacturing",
  "Logistics",
  "Facilities",
  "HR",
  "Legal",
];

const approvers = [
  "A. Ndlovu",
  "M. Jacobs",
  "S. Khan",
  "P. Dlamini",
  "R. Adams",
  "L. Botha",
];

const suppliers = [
  "Nova Industrial",
  "BluePeak Tech",
  "Kite Freight",
  "Delta Supply",
  "Vertex Works",
  "Atlas Fabrication",
  "Orion Medical",
  "Summit Office",
];

const scoreDimensions = ["Profile", "Compliance", "Delivery", "Quality", "Risk"];
const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const procurementMethods = ["3 Quotes", "RFQ", "Tender", "Emergency", "Sole Source"];
const countries = ["South Africa", "Kenya", "Namibia", "UAE", "India", "Germany"];

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(value);

const formatCompactCurrency = (value) => {
  if (value >= 1_000_000_000) return `R${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `R${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `R${(value / 1_000).toFixed(0)}k`;
  return `R${value}`;
};

const rgba = (hex, alpha) => {
  const clean = hex.replace("#", "");
  const bigint = parseInt(clean, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const arrTrend = (base, slope, wave, len = 12, offset = 0) =>
  Array.from({ length: len }, (_, i) =>
    Math.round(base + slope * i + Math.sin((i + offset) / 1.6) * wave + (i % 3) * wave * 0.22)
  );

const sparkPath = (values, width = 160, height = 42) => {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);
  return values
    .map((v, i) => {
      const x = (i / Math.max(values.length - 1, 1)) * width;
      const y = height - ((v - min) / range) * (height - 6) - 3;
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
};

function Sparkline({ values, tone = palette.brand }) {
  return (
    <svg viewBox="0 0 160 42" className="h-10 w-40 overflow-visible">
      <path d={sparkPath(values)} fill="none" stroke={tone} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function ChartPanel({ title, subtitle, height = 320, option, extra, className = "" }) {
  return (
    <div
      className={`rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)] ${className}`}
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
        </div>
        {extra ? <div>{extra}</div> : null}
      </div>
      <ReactEChartsCore echarts={echarts} option={option} notMerge lazyUpdate style={{ height }} />
    </div>
  );
}

function MetricTile({ icon: Icon, label, value, delta, tone = palette.brand, sublabel }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-slate-500">{label}</div>
          <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{value}</div>
        </div>
        <div
          className="rounded-2xl p-3"
          style={{ backgroundColor: rgba(tone, 0.12), color: tone }}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium" style={{ color: tone }}>
          {delta}
        </span>
        <span className="text-slate-400">{sublabel}</span>
      </div>
    </div>
  );
}

function ProgressBullet({ label, value, tone = palette.brand }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="text-slate-600">{label}</span>
        <span className="font-semibold text-slate-900">{value}%</span>
      </div>
      <div className="h-2.5 rounded-full bg-slate-100">
        <div className="h-2.5 rounded-full" style={{ width: `${value}%`, backgroundColor: tone }} />
      </div>
    </div>
  );
}

function FilterChip({ children, active = false }) {
  return (
    <button
      className={`rounded-full border px-3 py-1.5 text-sm transition ${
        active
          ? "border-blue-200 bg-blue-50 text-blue-700"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
      }`}
    >
      {children}
    </button>
  );
}

export default function ProcureChainAnalyticsPreview() {
  const [tab, setTab] = useState("overview");

  const data = useMemo(() => {
    const spendRequested = arrTrend(18_500_000, 1_250_000, 1_050_000);
    const spendApproved = spendRequested.map((v, i) => Math.round(v * (0.83 + (i % 3) * 0.02)));
    const spendAwarded = spendApproved.map((v, i) => Math.round(v * (0.89 - (i % 4) * 0.01)));
    const spendPaid = spendAwarded.map((v, i) => Math.round(v * (0.74 + (i % 5) * 0.02)));

    const prCreated = arrTrend(124, 8, 14);
    const prSubmitted = prCreated.map((v, i) => Math.round(v * (0.88 + (i % 4) * 0.01)));
    const rfqCreated = prSubmitted.map((v, i) => Math.round(v * (0.58 + (i % 3) * 0.02)));
    const poIssued = rfqCreated.map((v, i) => Math.round(v * (0.82 + (i % 2) * 0.02)));

    const prStatusMix = months.map((month, i) => ({
      month,
      Draft: 18 + (i % 4) * 2,
      Submitted: 54 + i * 2,
      "Under Review": 25 + (i % 3) * 4,
      Approved: 48 + i * 2,
      Returned: 11 + (i % 5),
      Rejected: 8 + (i % 4),
      "To RFQ": 31 + i,
      Closed: 24 + i,
    }));

    const departmentSpend = departments.map((name, i) => ({
      name,
      value: [42, 55, 31, 77, 49, 28, 19, 14][i] * 1_000_000,
    }));

    const approvalWorkload = approvers.map((name, i) => ({
      name,
      pending: [36, 22, 29, 18, 25, 14][i],
      breaches: [7, 3, 6, 2, 4, 1][i],
      avgAge: [6.4, 3.1, 5.8, 2.6, 4.2, 2.1][i],
    }));

    const approvalHeatmap = [];
    approvers.forEach((name, y) => {
      weekdays.forEach((day, x) => {
        approvalHeatmap.push([x, y, [18, 24, 21, 28, 34, 12, 9][x] + y * 2 + (x % 2 ? 3 : 0)]);
      });
    });

    const spendHeatmap = [];
    departments.slice(0, 6).forEach((name, y) => {
      months.forEach((month, x) => {
        spendHeatmap.push([x, y, 3.2 + x * 0.35 + y * 0.48 + ((x + y) % 3) * 0.3]);
      });
    });

    const supplierScoreHeatmap = suppliers.map((supplier, supplierIndex) =>
      scoreDimensions.map((dimension, dimensionIndex) => [
        dimensionIndex,
        supplierIndex,
        [83, 91, 86, 88, 42][dimensionIndex] - supplierIndex * 2 + ((supplierIndex + dimensionIndex) % 3) * 3,
      ])
    ).flat();

    const supplierScatter = suppliers.map((name, i) => ({
      name,
      value: [72 + i * 3, 4_500_000 + i * 1_700_000],
      risk: [48, 36, 54, 29, 41, 58, 33, 22][i],
      quality: [78, 84, 73, 89, 81, 70, 92, 88][i],
    }));

    const bubble = suppliers.map((name, i) => ({
      name,
      value: [
        [48, 36, 54, 29, 41, 58, 33, 22][i],
        [78, 84, 73, 89, 81, 70, 92, 88][i],
        [12, 18, 9, 21, 14, 11, 16, 13][i],
      ],
    }));

    const boxplotSource = [
      [310000, 325000, 342000, 355000, 368000, 394000, 415000, 432000, 510000],
      [120000, 150000, 164000, 171000, 182000, 190000, 210000, 258000, 284000],
      [540000, 590000, 615000, 632000, 678000, 701000, 748000, 790000, 860000],
      [210000, 245000, 266000, 278000, 294000, 316000, 352000, 389000, 440000],
      [93000, 105000, 118000, 126000, 141000, 158000, 166000, 181000, 212000],
    ];

    const treemap = [
      {
        name: "ICT",
        children: [
          {
            name: "Hardware",
            value: 18_200_000,
            children: [
              { name: "BluePeak Tech", value: 9_300_000 },
              { name: "Vertex Works", value: 5_100_000 },
              { name: "Nova Industrial", value: 3_800_000 },
            ],
          },
          {
            name: "Software",
            value: 11_600_000,
            children: [
              { name: "BluePeak Tech", value: 6_400_000 },
              { name: "Summit Office", value: 5_200_000 },
            ],
          },
        ],
      },
      {
        name: "Manufacturing",
        children: [
          {
            name: "Raw Materials",
            value: 22_900_000,
            children: [
              { name: "Atlas Fabrication", value: 10_200_000 },
              { name: "Delta Supply", value: 7_900_000 },
              { name: "Nova Industrial", value: 4_800_000 },
            ],
          },
          {
            name: "MRO",
            value: 14_700_000,
            children: [
              { name: "Delta Supply", value: 6_200_000 },
              { name: "Nova Industrial", value: 5_100_000 },
              { name: "Atlas Fabrication", value: 3_400_000 },
            ],
          },
        ],
      },
      {
        name: "Logistics",
        children: [
          {
            name: "Freight",
            value: 16_200_000,
            children: [
              { name: "Kite Freight", value: 10_800_000 },
              { name: "Orion Medical", value: 2_400_000 },
              { name: "Vertex Works", value: 3_000_000 },
            ],
          },
        ],
      },
    ];

    const funnel = [
      { name: "PR Created", value: 1482 },
      { name: "Approved", value: 1174 },
      { name: "RFQ Released", value: 693 },
      { name: "Bids Received", value: 621 },
      { name: "Awarded", value: 504 },
      { name: "PO Issued", value: 463 },
      { name: "Paid", value: 392 },
    ];

    const rfqStageTime = [
      { stage: "Created", value: 0.5 },
      { stage: "Released", value: 1.2 },
      { stage: "Open", value: 5.8 },
      { stage: "Evaluated", value: 3.6 },
      { stage: "Awarded", value: 1.9 },
      { stage: "Closed", value: 0.7 },
    ];

    const invoiceMatch = [
      { name: "Matched", value: 682 },
      { name: "Under Invoiced", value: 81 },
      { name: "Over Invoiced", value: 46 },
      { name: "Missing Invoice", value: 24 },
    ];

    const supplierCountry = [
      { name: countries[0], value: 58 },
      { name: countries[1], value: 14 },
      { name: countries[2], value: 7 },
      { name: countries[3], value: 9 },
      { name: countries[4], value: 8 },
      { name: countries[5], value: 4 },
    ];

    const policyMix = [
      { name: "Low Band", value: 448 },
      { name: "Mid Band", value: 312 },
      { name: "High Band", value: 119 },
      { name: "Emergency", value: 37 },
      { name: "Override", value: 22 },
    ];

    const paymentTrend = arrTrend(10_200_000, 840_000, 700_000);
    const auditEvents = arrTrend(4200, 180, 280);
    const httpRequests = arrTrend(58000, 1700, 2400);
    const p95 = arrTrend(740, -9, 45);
    const errorRate = [1.8, 1.7, 1.9, 1.6, 1.4, 1.5, 1.2, 1.1, 0.9, 0.8, 0.9, 0.7];

    const sankey = {
      nodes: [
        { name: "PR Submitted" },
        { name: "Approved" },
        { name: "Returned" },
        { name: "Rejected" },
        { name: "RFQ Released" },
        { name: "No Bid" },
        { name: "Awarded" },
        { name: "PO Issued" },
        { name: "Invoiced" },
        { name: "Paid" },
      ],
      links: [
        { source: "PR Submitted", target: "Approved", value: 1174 },
        { source: "PR Submitted", target: "Returned", value: 188 },
        { source: "PR Submitted", target: "Rejected", value: 120 },
        { source: "Approved", target: "RFQ Released", value: 693 },
        { source: "Approved", target: "PO Issued", value: 481 },
        { source: "RFQ Released", target: "No Bid", value: 72 },
        { source: "RFQ Released", target: "Awarded", value: 504 },
        { source: "Awarded", target: "PO Issued", value: 463 },
        { source: "PO Issued", target: "Invoiced", value: 421 },
        { source: "Invoiced", target: "Paid", value: 392 },
      ],
    };

    const ganttRows = [
      { label: "PR-240118", start: 0, end: 4, color: palette.brand, status: "Approved" },
      { label: "RFQ-8841", start: 3, end: 10, color: palette.accent, status: "Awarded" },
      { label: "PO-5529", start: 10, end: 14, color: palette.green, status: "Accepted" },
      { label: "INV-1021", start: 14, end: 19, color: palette.amber, status: "Paid" },
      { label: "PR-240121", start: 2, end: 7, color: palette.cyan, status: "Under Review" },
      { label: "RFQ-8856", start: 8, end: 15, color: palette.pink, status: "Open" },
    ];

    const supplierScorecards = suppliers.slice(0, 6).map((name, i) => ({
      name,
      profile: [83, 88, 79, 91, 86, 77][i],
      compliance: [90, 85, 72, 93, 81, 69][i],
      delivery: [84, 79, 75, 87, 82, 73][i],
      quality: [86, 88, 78, 92, 84, 71][i],
      risk: [42, 36, 54, 29, 41, 58][i],
      spark: arrTrend(64 + i * 3, 1.2, 4, 10, i),
    }));

    const departmentLeaderboard = departments.slice(0, 6).map((name, i) => ({
      name,
      spend: [77, 55, 49, 42, 31, 28][i] * 1_000_000,
      queue: [26, 19, 15, 14, 12, 9][i],
      spark: arrTrend(20 + i * 4, 1.6, 2.5, 9, i),
    }));

    const waterfall = {
      labels: ["Requested", "Approved", "Awarded", "Committed", "Invoiced", "Paid"],
      values: [212_000_000, -31_000_000, -14_000_000, -22_000_000, -9_000_000, -12_000_000],
    };

    return {
      spendRequested,
      spendApproved,
      spendAwarded,
      spendPaid,
      prCreated,
      prSubmitted,
      rfqCreated,
      poIssued,
      prStatusMix,
      departmentSpend,
      approvalWorkload,
      approvalHeatmap,
      spendHeatmap,
      supplierScoreHeatmap,
      supplierScatter,
      bubble,
      boxplotSource,
      treemap,
      funnel,
      rfqStageTime,
      invoiceMatch,
      supplierCountry,
      policyMix,
      paymentTrend,
      auditEvents,
      httpRequests,
      p95,
      errorRate,
      sankey,
      ganttRows,
      supplierScorecards,
      departmentLeaderboard,
      waterfall,
    };
  }, []);

  const baseGrid = {
    left: 16,
    right: 16,
    top: 40,
    bottom: 20,
    containLabel: true,
  };

  const sharedAxis = {
    axisLine: { lineStyle: { color: rgba(palette.slate, 0.15) } },
    axisTick: { show: false },
    axisLabel: { color: palette.subtext, fontSize: 11 },
    splitLine: { lineStyle: { color: rgba(palette.slate, 0.08) } },
  };

  const tooltip = {
    trigger: "axis",
    backgroundColor: "rgba(15,23,42,0.94)",
    borderWidth: 0,
    textStyle: { color: "#fff" },
    extraCssText: "border-radius: 14px; box-shadow: 0 12px 30px rgba(2,6,23,0.28);",
  };

  const spendOverTimeOption = {
    color: [palette.brand, palette.green, palette.amber, palette.accent],
    tooltip,
    legend: { top: 0, textStyle: { color: palette.subtext } },
    grid: baseGrid,
    xAxis: { type: "category", data: months, ...sharedAxis },
    yAxis: {
      type: "value",
      ...sharedAxis,
      axisLabel: {
        color: palette.subtext,
        formatter: (v) => `R${Math.round(v / 1_000_000)}m`,
      },
    },
    series: [
      {
        name: "Requested",
        type: "line",
        smooth: true,
        symbolSize: 7,
        areaStyle: { color: rgba(palette.brand, 0.12) },
        lineStyle: { width: 3 },
        data: data.spendRequested,
      },
      {
        name: "Approved",
        type: "line",
        smooth: true,
        symbolSize: 6,
        lineStyle: { width: 2.5 },
        data: data.spendApproved,
      },
      {
        name: "Awarded",
        type: "line",
        smooth: true,
        symbolSize: 6,
        lineStyle: { width: 2.5 },
        data: data.spendAwarded,
      },
      {
        name: "Paid",
        type: "line",
        smooth: true,
        symbolSize: 6,
        lineStyle: { width: 2.5 },
        data: data.spendPaid,
      },
    ],
  };

  const prDemandOption = {
    color: [palette.brand, palette.accent, palette.green, palette.cyan],
    tooltip,
    legend: { top: 0, textStyle: { color: palette.subtext } },
    grid: baseGrid,
    xAxis: { type: "category", data: months, ...sharedAxis },
    yAxis: { type: "value", ...sharedAxis },
    series: [
      { name: "PRs Created", type: "bar", barWidth: 14, borderRadius: [8, 8, 0, 0], data: data.prCreated },
      { name: "Submitted", type: "line", smooth: true, data: data.prSubmitted },
      { name: "RFQs", type: "line", smooth: true, data: data.rfqCreated },
      { name: "POs", type: "line", smooth: true, data: data.poIssued },
    ],
  };

  const statusMixOption = {
    color: seriesPalette,
    tooltip,
    legend: { top: 0, type: "scroll", textStyle: { color: palette.subtext } },
    grid: { ...baseGrid, top: 72 },
    xAxis: { type: "category", data: months, ...sharedAxis },
    yAxis: { type: "value", ...sharedAxis },
    series: ["Draft", "Submitted", "Under Review", "Approved", "Returned", "Rejected", "To RFQ", "Closed"].map(
      (key) => ({
        name: key,
        type: "bar",
        stack: "status",
        emphasis: { focus: "series" },
        borderRadius: [4, 4, 0, 0],
        data: data.prStatusMix.map((row) => row[key]),
      })
    ),
  };

  const departmentSpendOption = {
    color: [palette.brand],
    tooltip: { ...tooltip, trigger: "item" },
    grid: { ...baseGrid, left: 110 },
    xAxis: {
      type: "value",
      ...sharedAxis,
      axisLabel: { color: palette.subtext, formatter: (v) => `R${v / 1_000_000}m` },
    },
    yAxis: {
      type: "category",
      data: data.departmentSpend.map((d) => d.name).reverse(),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: palette.subtext },
    },
    series: [
      {
        type: "bar",
        data: [...data.departmentSpend].reverse().map((d) => ({ value: d.value, itemStyle: { borderRadius: [0, 10, 10, 0] } })),
        label: { show: true, position: "right", formatter: ({ value }) => formatCompactCurrency(value), color: palette.subtext },
      },
    ],
  };

  const funnelOption = {
    color: [palette.brand, palette.accent, palette.cyan, palette.green, palette.amber, palette.indigo, palette.pink],
    tooltip: { ...tooltip, trigger: "item", formatter: "{b}: {c}" },
    series: [
      {
        type: "funnel",
        top: 20,
        bottom: 10,
        left: "10%",
        width: "80%",
        min: 0,
        max: 1500,
        minSize: "20%",
        maxSize: "100%",
        sort: "descending",
        gap: 4,
        label: { show: true, position: "inside", color: "#fff", fontWeight: 600 },
        itemStyle: { borderColor: "#fff", borderWidth: 2, borderRadius: 10 },
        data: data.funnel,
      },
    ],
  };

  const approvalAgingHeatmapOption = {
    tooltip: { ...tooltip, trigger: "item" },
    grid: { ...baseGrid, left: 90, top: 28, bottom: 72 },
    xAxis: {
      type: "category",
      data: weekdays,
      splitArea: { show: true },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: palette.subtext },
    },
    yAxis: {
      type: "category",
      data: approvers,
      splitArea: { show: true },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: palette.subtext },
    },
    visualMap: {
      min: 0,
      max: 50,
      calculable: false,
      orient: "horizontal",
      left: "center",
      bottom: 8,
      inRange: { color: ["#e0f2fe", "#7dd3fc", "#2563eb", "#1e3a8a"] },
      textStyle: { color: palette.subtext },
    },
    series: [
      {
        type: "heatmap",
        data: data.approvalHeatmap,
        label: { show: true, color: "#0f172a", fontWeight: 600 },
        emphasis: { itemStyle: { shadowBlur: 12, shadowColor: rgba("#000000", 0.18) } },
      },
    ],
  };

  const approvalWorkloadOption = {
    color: [palette.amber, palette.red],
    tooltip,
    legend: { top: 0, textStyle: { color: palette.subtext } },
    grid: { ...baseGrid, left: 92 },
    xAxis: { type: "value", ...sharedAxis },
    yAxis: {
      type: "category",
      data: approvers,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: palette.subtext },
    },
    series: [
      { name: "Pending", type: "bar", stack: "x", data: data.approvalWorkload.map((d) => d.pending), barWidth: 16 },
      { name: "SLA Breach", type: "bar", stack: "x", data: data.approvalWorkload.map((d) => d.breaches), barWidth: 16 },
    ],
  };

  const approvalScatterOption = {
    color: [palette.accent],
    tooltip: {
      ...tooltip,
      trigger: "item",
      formatter: (params) => {
        const [age, amount] = params.value;
        return `${params.name}<br/>Approval age: ${age} days<br/>PR amount: ${formatCurrency(amount)}`;
      },
    },
    grid: baseGrid,
    xAxis: { type: "value", name: "Approval age (days)", nameTextStyle: { color: palette.subtext }, ...sharedAxis },
    yAxis: {
      type: "value",
      name: "PR amount",
      nameTextStyle: { color: palette.subtext },
      ...sharedAxis,
      axisLabel: { color: palette.subtext, formatter: (v) => `R${Math.round(v / 1_000_000)}m` },
    },
    series: [
      {
        type: "scatter",
        symbolSize: (val) => Math.max(12, val[1] / 800000),
        data: [
          [2.1, 420000],
          [3.4, 860000],
          [5.2, 2100000],
          [7.6, 4800000],
          [4.4, 1320000],
          [6.8, 5600000],
          [9.2, 7900000],
          [8.1, 6400000],
          [1.7, 280000],
          [3.1, 950000],
          [11.8, 9100000],
          [5.9, 3400000],
        ].map((value, i) => ({ name: `PR-${240101 + i}`, value })),
        itemStyle: { shadowBlur: 10, shadowColor: rgba(palette.accent, 0.2) },
      },
    ],
  };

  const supplierCountryOption = {
    color: [palette.brand, palette.accent, palette.green, palette.cyan, palette.amber, palette.pink],
    tooltip: { ...tooltip, trigger: "item" },
    legend: { bottom: 0, textStyle: { color: palette.subtext } },
    series: [
      {
        type: "pie",
        radius: ["52%", "76%"],
        center: ["50%", "45%"],
        itemStyle: { borderColor: "#fff", borderWidth: 3 },
        label: { formatter: "{b}\n{d}%", color: palette.text },
        data: data.supplierCountry,
      },
    ],
  };

  const policyMixOption = {
    color: [palette.green, palette.brand, palette.accent, palette.amber, palette.red],
    tooltip: { ...tooltip, trigger: "item" },
    series: [
      {
        type: "pie",
        roseType: "area",
        radius: ["24%", "78%"],
        center: ["50%", "48%"],
        itemStyle: { borderColor: "#fff", borderWidth: 2, borderRadius: 10 },
        label: { color: palette.text },
        data: data.policyMix,
      },
    ],
  };

  const rfqStageOption = {
    color: [palette.cyan],
    tooltip: { ...tooltip, trigger: "item" },
    grid: { ...baseGrid, left: 74 },
    xAxis: { type: "category", data: data.rfqStageTime.map((d) => d.stage), ...sharedAxis },
    yAxis: { type: "value", ...sharedAxis, axisLabel: { color: palette.subtext, formatter: (v) => `${v}d` } },
    series: [
      {
        type: "bar",
        data: data.rfqStageTime.map((d) => d.value),
        barWidth: 24,
        itemStyle: { borderRadius: [10, 10, 0, 0], color: palette.cyan },
      },
    ],
  };

  const supplierScatterOption = {
    color: [palette.green],
    tooltip: {
      ...tooltip,
      trigger: "item",
      formatter: (params) => `${params.name}<br/>Score: ${params.value[0]}<br/>Award value: ${formatCurrency(params.value[1])}`,
    },
    grid: baseGrid,
    xAxis: { type: "value", min: 65, max: 100, name: "Supplier score", nameTextStyle: { color: palette.subtext }, ...sharedAxis },
    yAxis: {
      type: "value",
      name: "Award value",
      nameTextStyle: { color: palette.subtext },
      ...sharedAxis,
      axisLabel: { color: palette.subtext, formatter: (v) => `R${Math.round(v / 1_000_000)}m` },
    },
    series: [
      {
        type: "scatter",
        symbolSize: 18,
        data: data.supplierScatter,
        label: { show: true, formatter: ({ name }) => name.split(" ")[0], position: "top", color: palette.subtext },
      },
    ],
  };

  const bubbleOption = {
    color: seriesPalette,
    tooltip: {
      ...tooltip,
      trigger: "item",
      formatter: (params) => `${params.name}<br/>Risk: ${params.value[0]}<br/>Quality: ${params.value[1]}<br/>Awarded value: ${params.value[2]}m`,
    },
    grid: baseGrid,
    xAxis: { type: "value", name: "Risk score", nameTextStyle: { color: palette.subtext }, ...sharedAxis },
    yAxis: { type: "value", name: "Quality score", nameTextStyle: { color: palette.subtext }, ...sharedAxis },
    series: [
      {
        type: "scatter",
        data: data.bubble,
        symbolSize: (val) => val[2] * 2.3,
        itemStyle: { opacity: 0.82 },
        label: { show: true, formatter: ({ name }) => name.split(" ")[0], color: palette.slate },
      },
    ],
  };

  const supplierHeatmapOption = {
    tooltip: { ...tooltip, trigger: "item" },
    grid: { ...baseGrid, left: 110, top: 28, bottom: 72 },
    xAxis: {
      type: "category",
      data: scoreDimensions,
      splitArea: { show: true },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: palette.subtext },
    },
    yAxis: {
      type: "category",
      data: suppliers,
      splitArea: { show: true },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: palette.subtext },
    },
    visualMap: {
      min: 20,
      max: 100,
      calculable: false,
      orient: "horizontal",
      left: "center",
      bottom: 8,
      inRange: { color: ["#fee2e2", "#fdba74", "#fde68a", "#86efac", "#2563eb"] },
      textStyle: { color: palette.subtext },
    },
    series: [
      {
        type: "heatmap",
        data: data.supplierScoreHeatmap,
        label: { show: true, color: palette.text, fontSize: 11, fontWeight: 600 },
      },
    ],
  };

  const boxplotOption = {
    tooltip: { ...tooltip, trigger: "item" },
    dataset: [
      { source: data.boxplotSource },
      { transform: { type: "boxplot" } },
      { fromDatasetIndex: 1, fromTransformResult: 1 },
    ],
    grid: { ...baseGrid, left: 64 },
    xAxis: {
      type: "category",
      data: ["ICT", "Office", "Logistics", "MRO", "Travel"],
      boundaryGap: true,
      splitArea: { show: false },
      axisLine: { lineStyle: { color: rgba(palette.slate, 0.15) } },
      axisLabel: { color: palette.subtext },
    },
    yAxis: {
      type: "value",
      ...sharedAxis,
      axisLabel: { color: palette.subtext, formatter: (v) => `R${Math.round(v / 1000)}k` },
    },
    series: [
      { name: "Bid spread", type: "boxplot", datasetIndex: 1, itemStyle: { color: rgba(palette.brand, 0.65), borderColor: palette.brand } },
      { name: "Outlier", type: "scatter", datasetIndex: 2, itemStyle: { color: palette.red } },
    ],
  };

  const treemapOption = {
    tooltip: { ...tooltip, trigger: "item" },
    series: [
      {
        type: "treemap",
        roam: false,
        breadcrumb: { show: false },
        nodeClick: false,
        itemStyle: { borderColor: "#fff", borderWidth: 3, gapWidth: 3 },
        upperLabel: { show: true, height: 28, color: "#fff" },
        label: { show: true, formatter: "{b}", color: "#fff" },
        levels: [
          { color: [palette.brand, palette.accent, palette.green] },
          { colorSaturation: [0.35, 0.65], itemStyle: { borderColorSaturation: 0.7 } },
          { colorSaturation: [0.2, 0.45], itemStyle: { borderColorSaturation: 0.6 } },
        ],
        data: data.treemap,
      },
    ],
  };

  const waterfallBase = [];
  let sum = 0;
  for (let i = 0; i < data.waterfall.values.length; i += 1) {
    waterfallBase.push(sum);
    sum += data.waterfall.values[i];
  }

  const waterfallOption = {
    color: [palette.brand, palette.red, palette.green],
    tooltip: {
      ...tooltip,
      trigger: "axis",
      axisPointer: { type: "shadow" },
    },
    grid: baseGrid,
    xAxis: { type: "category", data: data.waterfall.labels, ...sharedAxis },
    yAxis: {
      type: "value",
      ...sharedAxis,
      axisLabel: { color: palette.subtext, formatter: (v) => `R${Math.round(v / 1_000_000)}m` },
    },
    series: [
      {
        type: "bar",
        stack: "total",
        itemStyle: { color: "transparent", borderColor: "transparent" },
        emphasis: { itemStyle: { color: "transparent", borderColor: "transparent" } },
        data: waterfallBase,
      },
      {
        type: "bar",
        stack: "total",
        label: { show: true, position: "top", formatter: ({ value }) => formatCompactCurrency(Math.abs(value)), color: palette.subtext },
        data: data.waterfall.values.map((v, i) => ({
          value: Math.abs(v),
          itemStyle: { color: i === 0 ? palette.brand : i === data.waterfall.values.length - 1 ? palette.green : palette.amber, borderRadius: [8, 8, 0, 0] },
        })),
      },
    ],
  };

  const invoiceMatchOption = {
    color: [palette.green, palette.amber, palette.red, palette.slate],
    tooltip: { ...tooltip, trigger: "item" },
    legend: { bottom: 0, textStyle: { color: palette.subtext } },
    series: [
      {
        type: "pie",
        radius: ["50%", "74%"],
        center: ["50%", "44%"],
        itemStyle: { borderColor: "#fff", borderWidth: 3 },
        label: { color: palette.text },
        data: data.invoiceMatch,
      },
    ],
    graphic: [
      {
        type: "text",
        left: "center",
        top: "38%",
        style: {
          text: "Invoice\nMatch",
          textAlign: "center",
          fill: palette.text,
          fontSize: 18,
          fontWeight: 700,
        },
      },
    ],
  };

  const paymentTrendOption = {
    color: [palette.green, palette.amber],
    tooltip,
    grid: baseGrid,
    xAxis: { type: "category", data: months, ...sharedAxis },
    yAxis: [
      {
        type: "value",
        ...sharedAxis,
        axisLabel: { color: palette.subtext, formatter: (v) => `R${Math.round(v / 1_000_000)}m` },
      },
      {
        type: "value",
        ...sharedAxis,
        splitLine: { show: false },
        axisLabel: { color: palette.subtext, formatter: (v) => `${v}d` },
      },
    ],
    series: [
      {
        name: "Paid amount",
        type: "line",
        smooth: true,
        areaStyle: { color: rgba(palette.green, 0.14) },
        lineStyle: { width: 3 },
        data: data.paymentTrend,
      },
      {
        name: "Days to pay",
        type: "bar",
        yAxisIndex: 1,
        barWidth: 12,
        data: [36, 34, 33, 31, 29, 28, 27, 25, 24, 23, 22, 21],
      },
    ],
  };

  const sankeyOption = {
    tooltip: { ...tooltip, trigger: "item", triggerOn: "mousemove" },
    series: [
      {
        type: "sankey",
        emphasis: { focus: "adjacency" },
        lineStyle: { color: "gradient", curveness: 0.55, opacity: 0.45 },
        nodeGap: 18,
        nodeWidth: 18,
        data: data.sankey.nodes,
        links: data.sankey.links,
        itemStyle: { borderWidth: 0, color: palette.brand },
        levels: [
          { depth: 0, itemStyle: { color: palette.brand } },
          { depth: 1, itemStyle: { color: palette.accent } },
          { depth: 2, itemStyle: { color: palette.green } },
          { depth: 3, itemStyle: { color: palette.amber } },
        ],
        label: { color: palette.text, fontWeight: 600 },
      },
    ],
  };

  const auditTrendOption = {
    color: [palette.indigo],
    tooltip,
    grid: baseGrid,
    xAxis: { type: "category", data: months, ...sharedAxis },
    yAxis: { type: "value", ...sharedAxis },
    series: [
      {
        type: "line",
        smooth: true,
        symbolSize: 6,
        areaStyle: { color: rgba(palette.indigo, 0.14) },
        lineStyle: { width: 3 },
        data: data.auditEvents,
        markPoint: {
          symbolSize: 52,
          itemStyle: { color: palette.indigo },
          data: [{ type: "max", name: "Peak" }],
        },
      },
    ],
  };

  const operationalOption = {
    color: [palette.brand, palette.cyan, palette.red],
    tooltip,
    legend: { top: 0, textStyle: { color: palette.subtext } },
    grid: baseGrid,
    xAxis: { type: "category", data: months, ...sharedAxis },
    yAxis: [
      { type: "value", ...sharedAxis, axisLabel: { color: palette.subtext, formatter: (v) => `${Math.round(v / 1000)}k` } },
      { type: "value", ...sharedAxis, splitLine: { show: false }, axisLabel: { color: palette.subtext, formatter: (v) => `${v}${v > 10 ? "ms" : "%"}` } },
    ],
    series: [
      { name: "HTTP Requests", type: "bar", data: data.httpRequests, barWidth: 16 },
      { name: "P95 Latency", type: "line", yAxisIndex: 1, smooth: true, data: data.p95 },
      { name: "Error Rate", type: "line", yAxisIndex: 1, smooth: true, data: data.errorRate },
    ],
  };

  const gaugeOption = {
    series: [
      {
        type: "gauge",
        center: ["50%", "56%"],
        radius: "88%",
        startAngle: 200,
        endAngle: -20,
        min: 0,
        max: 100,
        splitNumber: 5,
        progress: { show: true, width: 14, itemStyle: { color: palette.brand, shadowBlur: 10, shadowColor: rgba(palette.brand, 0.25) } },
        axisLine: { lineStyle: { width: 14, color: [[1, rgba(palette.brand, 0.12)]] } },
        axisTick: { show: false },
        splitLine: { length: 10, lineStyle: { color: rgba(palette.slate, 0.15), width: 2 } },
        axisLabel: { distance: 14, color: palette.subtext, fontSize: 11 },
        pointer: { show: false },
        anchor: { show: false },
        title: { show: true, offsetCenter: [0, "56%"], color: palette.subtext, fontSize: 12 },
        detail: {
          valueAnimation: true,
          fontSize: 26,
          fontWeight: 800,
          color: palette.text,
          offsetCenter: [0, "10%"],
          formatter: "{value}%",
        },
        data: [{ value: 92, name: "SLA attainment" }],
      },
    ],
  };

  const tabButton = (key, label) => (
    <button
      key={key}
      onClick={() => setTab(key)}
      className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${
        tab === key ? "bg-slate-900 text-white shadow-lg" : "bg-white text-slate-600 hover:bg-slate-100"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto max-w-[1680px] p-6 md:p-8">
        <div className="rounded-[32px] border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-7 text-white shadow-[0_24px_60px_rgba(15,23,42,0.25)]">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium text-blue-100 backdrop-blur">
                <BadgeCheck className="h-3.5 w-3.5" />
                Procurement analytics UI preview · mock data only
              </div>
              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                ProcureChain analytical dashboard preview
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 md:text-base">
                High-fidelity dashboard concepts for PR, RFQ, supplier, PO, invoice, compliance, governance, audit, and operational analytics. Designed for a Next.js client-side analytics surface using Apache ECharts.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-300">Theme</div>
                <div className="mt-2 text-sm font-medium">Executive procurement BI</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-300">Library</div>
                <div className="mt-2 text-sm font-medium">Apache ECharts</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-300">Mode</div>
                <div className="mt-2 text-sm font-medium">UI / UX prototype</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-300">Install</div>
                <div className="mt-2 text-sm font-medium">echarts + echarts-for-react</div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap gap-2">{[
              ["overview", "Overview"],
              ["pr", "PR & Approvals"],
              ["sourcing", "Sourcing & Suppliers"],
              ["finance", "Finance & Governance"],
            ].map(([key, label]) => tabButton(key, label))}</div>
            <div className="flex flex-wrap gap-2">
              <FilterChip active>Last 12 months</FilterChip>
              <FilterChip>All departments</FilterChip>
              <FilterChip>All cost centres</FilterChip>
              <FilterChip>All procurement bands</FilterChip>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-5">
          <MetricTile icon={Wallet} label="Requested spend" value="R212.0M" delta="+12.8% vs prior period" sublabel="YTD procurement demand" tone={palette.brand} />
          <MetricTile icon={Clock3} label="Avg PR lead time" value="18.4 days" delta="-2.3 days" sublabel="Create to close" tone={palette.green} />
          <MetricTile icon={Briefcase} label="Pending approvals" value="144" delta="23 in SLA breach" sublabel="Across 6 approvers" tone={palette.amber} />
          <MetricTile icon={FileCheck2} label="Invoice match rate" value="81.9%" delta="+3.7 pts" sublabel="PO / invoice validation" tone={palette.cyan} />
          <MetricTile icon={ShieldCheck} label="Blocked awards" value="17" delta="2 high-risk COI" sublabel="Compliance interventions" tone={palette.red} />
        </div>

        {tab === "overview" && (
          <div className="mt-6 grid gap-5 xl:grid-cols-12">
            <ChartPanel
              className="xl:col-span-8"
              title="Spend visibility over time"
              subtitle="Requested, approved, awarded, and paid spend by month"
              height={360}
              option={spendOverTimeOption}
            />
            <div className="xl:col-span-4 grid gap-5">
              <ChartPanel
                title="Workflow conversion funnel"
                subtitle="PR to payment flow"
                height={360}
                option={funnelOption}
              />
            </div>

            <ChartPanel
              className="xl:col-span-7"
              title="PR demand volume"
              subtitle="Created, submitted, converted to RFQ, and issued to PO"
              height={340}
              option={prDemandOption}
            />
            <ChartPanel
              className="xl:col-span-5"
              title="Top departments by spend"
              subtitle="Awarded and committed volume"
              height={340}
              option={departmentSpendOption}
            />

            <ChartPanel
              className="xl:col-span-8"
              title="PR / RFQ / PO status mix by month"
              subtitle="Stacked workflow distribution"
              height={380}
              option={statusMixOption}
            />
            <div className="xl:col-span-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
              <div className="mb-4">
                <h3 className="text-base font-semibold text-slate-900">Policy and supplier mix</h3>
                <p className="mt-1 text-sm text-slate-500">Compact distributions for fast executive reads</p>
              </div>
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-1">
                <div>
                  <div className="mb-2 text-sm font-medium text-slate-700">Procurement band / method mix</div>
                  <ReactEChartsCore echarts={echarts} option={policyMixOption} notMerge lazyUpdate style={{ height: 240 }} />
                </div>
                <div>
                  <div className="mb-2 text-sm font-medium text-slate-700">Supplier country mix</div>
                  <ReactEChartsCore echarts={echarts} option={supplierCountryOption} notMerge lazyUpdate style={{ height: 240 }} />
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "pr" && (
          <div className="mt-6 grid gap-5 xl:grid-cols-12">
            <ChartPanel
              className="xl:col-span-7"
              title="Approval aging heatmap"
              subtitle="Backlog concentration by approver and weekday"
              height={360}
              option={approvalAgingHeatmapOption}
            />
            <div className="xl:col-span-5 grid gap-5">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">SLA attainment</h3>
                    <p className="mt-1 text-sm text-slate-500">Approval and workflow control performance</p>
                  </div>
                  <AlertTriangle className="mt-1 h-5 w-5 text-amber-500" />
                </div>
                <ReactEChartsCore echarts={echarts} option={gaugeOption} notMerge lazyUpdate style={{ height: 240 }} />
                <div className="mt-3 space-y-4">
                  <ProgressBullet label="Policy compliance rate" value={94} tone={palette.green} />
                  <ProgressBullet label="Invoice match rate" value={82} tone={palette.cyan} />
                  <ProgressBullet label="Audit integrity rate" value={99} tone={palette.accent} />
                </div>
              </div>
            </div>

            <ChartPanel
              className="xl:col-span-5"
              title="Approval workload by approver"
              subtitle="Pending queue and current breach volume"
              height={320}
              option={approvalWorkloadOption}
            />
            <ChartPanel
              className="xl:col-span-7"
              title="Approval age vs PR amount"
              subtitle="Large requests naturally clustering toward longer reviews"
              height={320}
              option={approvalScatterOption}
            />

            <div className="xl:col-span-12 rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Operational milestone timeline</h3>
                  <p className="mt-1 text-sm text-slate-500">Preview of PR → RFQ → PO → invoice milestone tracking</p>
                </div>
                <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">Gantt / timeline style</div>
              </div>
              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <div className="grid grid-cols-[180px_repeat(20,minmax(0,1fr))] border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <div className="border-r border-slate-200 px-4 py-3">Work item</div>
                  {Array.from({ length: 20 }, (_, i) => (
                    <div key={i} className="px-2 py-3 text-center">D{i + 1}</div>
                  ))}
                </div>
                {data.ganttRows.map((row, idx) => (
                  <div key={row.label} className={`grid grid-cols-[180px_repeat(20,minmax(0,1fr))] ${idx !== data.ganttRows.length - 1 ? "border-b border-slate-100" : ""}`}>
                    <div className="border-r border-slate-100 px-4 py-4">
                      <div className="text-sm font-semibold text-slate-900">{row.label}</div>
                      <div className="mt-1 text-xs text-slate-500">{row.status}</div>
                    </div>
                    {Array.from({ length: 20 }, (_, i) => {
                      const active = i >= row.start && i < row.end;
                      const first = i === row.start;
                      const last = i === row.end - 1;
                      return (
                        <div key={i} className="px-1 py-3">
                          <div
                            className={`h-10 ${first ? "rounded-l-xl" : ""} ${last ? "rounded-r-xl" : ""}`}
                            style={{ backgroundColor: active ? rgba(row.color, 0.9) : "transparent" }}
                          />
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "sourcing" && (
          <div className="mt-6 grid gap-5 xl:grid-cols-12">
            <ChartPanel
              className="xl:col-span-4"
              title="RFQ stage duration"
              subtitle="Average days in each sourcing stage"
              height={320}
              option={rfqStageOption}
            />
            <ChartPanel
              className="xl:col-span-4"
              title="Supplier score vs award value"
              subtitle="Score quality against commercial outcome"
              height={320}
              option={supplierScatterOption}
            />
            <ChartPanel
              className="xl:col-span-4"
              title="Supplier bubble matrix"
              subtitle="Risk, quality, and total awarded value"
              height={320}
              option={bubbleOption}
            />

            <ChartPanel
              className="xl:col-span-6"
              title="Supplier performance heatmap"
              subtitle="Profile, compliance, delivery, quality, and risk scores"
              height={360}
              option={supplierHeatmapOption}
            />
            <ChartPanel
              className="xl:col-span-6"
              title="Bid value spread by subcategory"
              subtitle="Box plot of bid dispersion and outliers"
              height={360}
              option={boxplotOption}
            />

            <ChartPanel
              className="xl:col-span-7"
              title="Spend hierarchy treemap"
              subtitle="Category → subcategory → supplier view"
              height={420}
              option={treemapOption}
            />
            <div className="xl:col-span-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Supplier scorecards</h3>
                  <p className="mt-1 text-sm text-slate-500">Table + sparkline hybrid for supplier portfolio review</p>
                </div>
                <Banknote className="mt-1 h-5 w-5 text-blue-500" />
              </div>
              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Supplier</th>
                      <th className="px-3 py-3 text-left font-medium">Scores</th>
                      <th className="px-3 py-3 text-left font-medium">Risk</th>
                      <th className="px-3 py-3 text-left font-medium">Trend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.supplierScorecards.map((row, idx) => (
                      <tr key={row.name} className={idx !== data.supplierScorecards.length - 1 ? "border-b border-slate-100" : ""}>
                        <td className="px-4 py-3 font-medium text-slate-900">{row.name}</td>
                        <td className="px-3 py-3 text-slate-600">
                          P {row.profile} · C {row.compliance} · D {row.delivery} · Q {row.quality}
                        </td>
                        <td className="px-3 py-3">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${row.risk >= 50 ? "bg-red-50 text-red-700" : row.risk >= 40 ? "bg-amber-50 text-amber-700" : "bg-green-50 text-green-700"}`}>
                            {row.risk}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <Sparkline values={row.spark} tone={row.risk >= 50 ? palette.red : palette.brand} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {tab === "finance" && (
          <div className="mt-6 grid gap-5 xl:grid-cols-12">
            <ChartPanel
              className="xl:col-span-5"
              title="Spend bridge waterfall"
              subtitle="Requested to paid value movement"
              height={340}
              option={waterfallOption}
            />
            <ChartPanel
              className="xl:col-span-3"
              title="Invoice match analytics"
              subtitle="Validation outcomes"
              height={340}
              option={invoiceMatchOption}
            />
            <ChartPanel
              className="xl:col-span-4"
              title="Invoice payment trend"
              subtitle="Paid value and days-to-pay trend"
              height={340}
              option={paymentTrendOption}
            />

            <ChartPanel
              className="xl:col-span-7"
              title="Workflow movement sankey"
              subtitle="Status transitions from PR through invoice outcome"
              height={420}
              option={sankeyOption}
            />
            <div className="xl:col-span-5 grid gap-5">
              <ChartPanel
                title="Audit event trend"
                subtitle="Volume of immutable-chain audit activity"
                height={200}
                option={auditTrendOption}
              />
              <ChartPanel
                title="API operational analytics"
                subtitle="Request volume, p95 latency, and error rate"
                height={200}
                option={operationalOption}
              />
            </div>

            <div className="xl:col-span-12 rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Department leaderboard</h3>
                  <p className="mt-1 text-sm text-slate-500">Table + sparkline hybrid for spend and aging queue monitoring</p>
                </div>
                <Activity className="mt-1 h-5 w-5 text-indigo-500" />
              </div>
              <div className="grid gap-4 xl:grid-cols-3">
                {data.departmentLeaderboard.map((row) => (
                  <div key={row.name} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{row.name}</div>
                        <div className="mt-1 text-xs text-slate-500">Spend leaderboard</div>
                      </div>
                      <div className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 shadow-sm">
                        Queue {row.queue}
                      </div>
                    </div>
                    <div className="mt-4 flex items-end justify-between gap-3">
                      <div>
                        <div className="text-2xl font-semibold tracking-tight text-slate-950">{formatCompactCurrency(row.spend)}</div>
                        <div className="mt-1 text-xs text-slate-500">Committed + awarded</div>
                      </div>
                      <Sparkline values={row.spark} tone={palette.indigo} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 rounded-[28px] border border-dashed border-slate-300 bg-white/70 p-5 text-sm text-slate-600 backdrop-blur">
          <div className="font-semibold text-slate-900">Integration note</div>
          <p className="mt-2 leading-6">
            This component is intentionally front-end only and uses deterministic mock data. For a real Next.js app, place it in a client component and install <code className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-800">echarts</code> and <code className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-800">echarts-for-react</code>. The chart architecture is already structured so you can swap the mock arrays for API-backed analytics later.
          </p>
        </div>
      </div>
    </div>
  );
}
