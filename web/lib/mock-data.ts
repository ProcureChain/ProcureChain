import { AuditEvent, DashboardKpi, Requisition, Supplier } from "@/lib/types";

const now = new Date();
const ago = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();

export const dashboardKpis: DashboardKpi[] = [
  { id: "spend", label: "Spend this month", value: "$1.9M", delta: "+8.2%" },
  { id: "cycle", label: "PR cycle time", value: "4.6 days", delta: "-0.9d" },
  { id: "aging", label: "Approvals aging", value: "17 pending", delta: "3 > 5d" },
  { id: "conversion", label: "PR to RFQ conversion", value: "74%", delta: "+3.1%" },
];

export const requisitions: Requisition[] = [
  {
    id: "pr-001",
    prNumber: "PR-2026-001",
    title: "HVAC Maintenance Services",
    requester: "L. Maseko",
    department: "Facilities",
    costCenter: "FAC-200",
    neededBy: ago(-7),
    justification: "Quarterly preventive maintenance.",
    status: "UNDER_REVIEW",
    currentApprover: "R. Govender",
    submittedAt: ago(2),
    createdAt: ago(4),
    updatedAt: ago(1),
    total: 0,
    currency: "USD",
    lineItems: [
      { id: "li-1", description: "Inspection scope", quantity: 4, uom: "visit" },
      { id: "li-2", description: "Filter replacement scope", quantity: 6, uom: "unit" },
    ],
    approvals: [
      { id: "a-1", actor: "L. Maseko", role: "Requester", action: "APPROVE", at: ago(2), comment: "Submitted" },
    ],
    attachments: [
      { id: "doc-1", name: "scope.pdf", createdAt: ago(4) },
      { id: "doc-2", name: "quotation-template.docx", createdAt: ago(4) },
    ],
  },
  {
    id: "pr-002",
    prNumber: "PR-2026-002",
    title: "Developer Laptops",
    requester: "T. Dlamini",
    department: "IT",
    costCenter: "IT-110",
    status: "DRAFT",
    currentApprover: "-",
    createdAt: ago(1),
    updatedAt: ago(0),
    total: 0,
    currency: "USD",
    lineItems: [{ id: "li-3", description: "Laptop specification scope", quantity: 6, uom: "unit" }],
    approvals: [],
    attachments: [],
  },
  {
    id: "pr-003",
    prNumber: "PR-2026-003",
    title: "Security Consulting",
    requester: "M. Naidoo",
    department: "Risk",
    costCenter: "RISK-020",
    status: "APPROVED",
    currentApprover: "-",
    submittedAt: ago(8),
    createdAt: ago(12),
    updatedAt: ago(6),
    total: 0,
    currency: "USD",
    lineItems: [{ id: "li-4", description: "Assessment scope", quantity: 1, uom: "project" }],
    approvals: [
      { id: "a-2", actor: "C. Pillay", role: "Approver", action: "APPROVE", at: ago(6), comment: "Within budget." },
    ],
    attachments: [{ id: "doc-3", name: "sow.pdf", createdAt: ago(12) }],
  },
];

export const suppliers: Supplier[] = [
  {
    id: "sup-1",
    name: "Acme Facilities",
    status: "ACTIVE",
    tags: ["preferred", "maintenance"],
    contacts: [{ id: "c-1", name: "Jane May", email: "jane@acme.co", phone: "+1 555 101" }],
    country: "US",
    profileScore: 84,
    complianceScore: 88,
    deliveryScore: 82,
    qualityScore: 86,
    riskScore: 79,
    updatedAt: ago(2),
  },
  {
    id: "sup-2",
    name: "Northwind Systems",
    status: "ACTIVE",
    tags: ["it", "hardware"],
    contacts: [{ id: "c-2", name: "Imran Ali", email: "imran@northwind.io" }],
    country: "US",
    profileScore: 76,
    complianceScore: 80,
    deliveryScore: 75,
    qualityScore: 78,
    riskScore: 71,
    updatedAt: ago(5),
  },
];

export const auditEvents: AuditEvent[] = [
  {
    id: "ev-1",
    entityType: "PR",
    entityId: "pr-001",
    action: "PR_SUBMITTED",
    actor: "L. Maseko",
    at: ago(2),
    details: "Submitted requisition with 2 line items",
  },
  {
    id: "ev-2",
    entityType: "PR",
    entityId: "pr-001",
    action: "PR_UNDER_REVIEW",
    actor: "System",
    at: ago(1),
    details: "Moved to under review",
    before: { status: "SUBMITTED" },
    after: { status: "UNDER_REVIEW" },
  },
  {
    id: "ev-3",
    entityType: "POLICY",
    entityId: "policy-1",
    action: "POLICY_UPDATED",
    actor: "Admin",
    at: ago(3),
    details: "Threshold policy updated",
  },
];
