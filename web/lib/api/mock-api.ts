import { auditEvents, requisitions, suppliers } from "@/lib/mock-data";
import {
  ApprovalAction,
  ApprovalTask,
  AuditEvidenceResult,
  Bid,
  CoiDeclaration,
  DeliveryNote,
  DynamicFieldDef,
  GovernanceExportRecord,
  GovernanceGeneratedExport,
  InvoiceSignature,
  InvoiceSnapshot,
  LiveInvoice,
  PaymentProof,
  PoInvoiceValidation,
  ProcurementPolicy,
  PurchaseOrder,
  Requisition,
  RequisitionLine,
  RetentionPolicy,
  RetentionRunLog,
  RfqSupplierFormAssignment,
  Rfq,
  SoDRule,
  SupplierFormTemplate,
  TaxonomySubcategory,
  PrFormSchema,
  LocationSuggestion,
} from "@/lib/types";
import { daysOld } from "@/lib/format";
import { runtimeConfig } from "@/lib/runtime-config";

const delay = (ms = 220) => new Promise((resolve) => setTimeout(resolve, ms));

let reqStore = [...requisitions];
let auditStore = [...auditEvents];
let rfqStore: Rfq[] = [];
let supplierFormTemplateStore: SupplierFormTemplate[] = [];
let rfqSupplierFormStore: RfqSupplierFormAssignment[] = [];
let bidStore: Bid[] = [];
let poStore: PurchaseOrder[] = [];
let invoiceStore: InvoiceSnapshot[] = [];
let deliveryNoteStore: DeliveryNote[] = [];
let liveInvoiceStore: LiveInvoice[] = [];
let procurementPolicy: ProcurementPolicy = {
  id: "mock-policy",
  tenantId: "dev-tenant",
  companyId: "dev-company",
  lowThreshold: 1000,
  midThreshold: 5000,
  lowMethod: "LOW_VALUE_QUOTATION",
  midMethod: "LIMITED_TENDER",
  highMethod: "OPEN_TENDER",
  emergencyMethod: "EMERGENCY_DIRECT",
  emergencyEnabled: true,
  requireEmergencyJustification: true,
};
let sodRules: SoDRule[] = [];
let coiStore: CoiDeclaration[] = [];
let govExports: GovernanceExportRecord[] = [];
let retentionPolicy: RetentionPolicy = {
  id: "mock-retention",
  tenantId: "dev-tenant",
  companyId: "dev-company",
  auditRetentionDays: 2555,
  enforceImmutability: true,
  allowPurge: false,
};
let retentionRuns: RetentionRunLog[] = [];

const mockSubcategories: TaxonomySubcategory[] = [
  {
    id: "IT-SW-SUB-001",
    name: "Software Subscriptions (SaaS)",
    level1: "IT",
    level2: "Software",
    level3: "Subscription",
    archetype: "B",
  },
  {
    id: "SER_MAI_MECHANICAL_M",
    name: "Mechanical maintenance (SLA)",
    level1: "Services",
    level2: "Maintenance & SLA",
    level3: "Mechanical maintenance (SLA)",
    archetype: "B",
  },
  {
    id: "SER_MEA_CLEANING_M²",
    name: "Cleaning (m² based)",
    level1: "Services",
    level2: "Measurable Services",
    level3: "Cleaning (m² based)",
    archetype: "B",
  },
];

export async function listTaxonomySubcategories(): Promise<TaxonomySubcategory[]> {
  await delay();
  return mockSubcategories;
}

export async function getPrDynamicFieldDefs(_subcategoryId: string): Promise<DynamicFieldDef[]> {
  await delay();
  return [
    { path: "metadata.item_name", key: "item_name", label: "Item Name", type: "text", required: true, hint: "Catalog field: item_name" },
    { path: "metadata.qty", key: "qty", label: "Qty", type: "number", required: true, hint: "Catalog field: qty" },
    { path: "metadata.uom", key: "uom", label: "Uom", type: "text", required: true, hint: "Catalog field: uom" },
    { path: "metadata.required_date", key: "required_date", label: "Required Date", type: "date", required: true, hint: "Catalog field: required_date" },
    { path: "metadata.delivery_location", key: "delivery_location", label: "Delivery Location", type: "text", required: true, hint: "Catalog field: delivery_location" },
  ];
}

export async function getPrFormSchema(subcategoryId: string): Promise<PrFormSchema> {
  const subcategory = mockSubcategories.find((s) => s.id === subcategoryId) ?? mockSubcategories[0];
  const dynamicFields = await getPrDynamicFieldDefs(subcategory.id);
  await delay();
  return {
    subcategory,
    requestedSubcategoryId: subcategoryId,
    resolvedSubcategoryId: subcategory.id,
    country: "ZA",
    resolvedFrom: "base",
    keys: {
      prFormKey: "PR_MOCK_V1",
      rfqFormKey: "RFQ_MOCK_V1",
      bidFormKey: "BID_MOCK_V1",
      prRulePackKey: "rules.pr.mock.global.v1",
      rfqRulePackKey: "rules.rfq.mock.global.v1",
      bidRulePackKey: "rules.bid.mock.global.v1",
    },
    serviceFamily: "PROJECT",
    lineBindings: {
      description: ["metadata.service_desc", "metadata.item_name"],
      quantity: ["metadata.quantity_measure", "metadata.qty"],
      uom: ["metadata.unit", "metadata.uom"],
    },
    coreFieldBindings: {
      neededBy: ["metadata.required_date"],
    },
    uomPolicy:
      subcategory.id === "SER_MEA_CLEANING_M²"
        ? { fieldPath: "metadata.unit", options: ["m2"], locked: true, defaultValue: "m2" }
        : subcategory.id === "SER_MAI_MECHANICAL_M"
          ? { fieldPath: "metadata.unit", options: ["Daily", "Weekly", "Monthly"], locked: false, defaultValue: "Monthly" }
          : null,
    schemaVersion: "pr-form-schema-v2",
    sections: [
      {
        id: "core",
        title: "Core PR Fields",
        fields: [
          { path: "title", key: "title", label: "Title", inputType: "text", required: true, section: "core" },
          { path: "department", key: "department", label: "Department", inputType: "text", required: true, section: "core" },
          { path: "costCentre", key: "costCentre", label: "Cost Centre", inputType: "text", required: true, section: "core" },
        ],
      },
      {
        id: "subcategory",
        title: "Subcategory-Specific Fields",
        fields: dynamicFields.map((f) => ({
          path: f.path,
          key: f.key,
          label: f.label,
          inputType: f.type,
          required: f.required,
          section: "subcategory",
          message: f.hint,
        })),
      },
    ],
    validation: {
      entityType: "PR",
      rulePackKey: "rules.pr.mock.global.v1",
      requiredFieldCount: dynamicFields.length,
    },
  };
}

export async function getLocationSuggestions(query: string): Promise<LocationSuggestion[]> {
  await delay();
  if (query.trim().length < 3) return [];
  return [
    {
      id: "loc-1",
      label: "1 Sandton Drive, Sandton, Gauteng, South Africa",
      lat: -26.1076,
      lng: 28.0567,
      address: {
        line1: "1 Sandton Drive",
        city: "Sandton",
        province: "Gauteng",
        postalCode: "2196",
        country: "South Africa",
        countryCode: "ZA",
      },
    },
    {
      id: "loc-2",
      label: "12 Loop Street, Cape Town, Western Cape, South Africa",
      lat: -33.9243,
      lng: 18.4241,
      address: {
        line1: "12 Loop Street",
        city: "Cape Town",
        province: "Western Cape",
        postalCode: "8001",
        country: "South Africa",
        countryCode: "ZA",
      },
    },
  ].filter((item) => item.label.toLowerCase().includes(query.toLowerCase()) || query.trim().length >= 3);
}

export async function listRequisitions() {
  await delay();
  return [...reqStore].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getRequisition(id: string) {
  await delay();
  return reqStore.find((r) => r.id === id) ?? null;
}

export async function createRequisition(payload: Omit<Requisition, "id" | "prNumber" | "createdAt" | "updatedAt">) {
  await delay();
  const next: Requisition = {
    ...payload,
    id: crypto.randomUUID(),
    prNumber: `PR-2026-${String(reqStore.length + 1).padStart(3, "0")}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  reqStore = [next, ...reqStore];
  auditStore = [
    {
      id: crypto.randomUUID(),
      entityType: "PR",
      entityId: next.id,
      action: "PR_CREATED",
      actor: runtimeConfig.actorName,
      at: new Date().toISOString(),
      details: `Created ${next.prNumber}`,
    },
    ...auditStore,
  ];
  return next;
}

export async function createDraftRequisition(payload: {
  title: string;
  department?: string;
  costCenter?: string;
  currency?: string;
  subcategoryId?: string | null;
  justification?: string;
  metadata?: Record<string, unknown> | null;
  lineItems?: RequisitionLine[];
}) {
  await delay();
  const now = new Date().toISOString();
  const next: Requisition = {
    id: crypto.randomUUID(),
    prNumber: `PR-2026-${String(reqStore.length + 1).padStart(3, "0")}`,
    title: payload.title,
    requester: runtimeConfig.actorName,
    department: payload.department ?? "",
    costCenter: payload.costCenter ?? "",
    justification: payload.justification,
    status: "DRAFT",
    currentApprover: "-",
    createdAt: now,
    updatedAt: now,
    total: 0,
    currency: payload.currency ?? "ZAR",
    subcategoryId: payload.subcategoryId ?? null,
    metadata: payload.metadata ?? null,
    lineItems: payload.lineItems ?? [],
    approvals: [],
    attachments: [],
  };
  reqStore = [next, ...reqStore];
  return next;
}

export async function updateRequisition(
  id: string,
  payload: {
    title: string;
    department: string;
    costCenter: string;
    currency?: string;
    subcategoryId?: string;
    justification?: string;
    metadata?: Record<string, unknown> | null;
    lineItems?: RequisitionLine[];
    editSource?: string;
  },
) {
  await delay();
  reqStore = reqStore.map((req) =>
    req.id !== id
      ? req
      : {
          ...req,
          title: payload.title,
          department: payload.department,
          costCenter: payload.costCenter,
          currency: payload.currency ?? req.currency,
          subcategoryId: payload.subcategoryId ?? req.subcategoryId,
          justification: payload.justification,
          metadata: payload.metadata ?? req.metadata,
          lineItems: payload.lineItems ?? req.lineItems,
          updatedAt: new Date().toISOString(),
        },
  );
  return reqStore.find((req) => req.id === id) ?? null;
}

export async function submitRequisitionDraft(id: string) {
  await delay();
  reqStore = reqStore.map((req) =>
    req.id !== id
      ? req
      : {
          ...req,
          status: "SUBMITTED",
          submittedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
  );
  return reqStore.find((req) => req.id === id) ?? null;
}

export async function withdrawRequisition(id: string, reason?: string) {
  await delay();
  reqStore = reqStore.map((req) =>
    req.id !== id
      ? req
      : {
          ...req,
          status: "DRAFT",
          updatedAt: new Date().toISOString(),
          approvals: [
            ...req.approvals,
            {
              id: crypto.randomUUID(),
              actor: runtimeConfig.actorName,
              role: "Requester",
              action: "REQUEST_INFO",
              comment: reason,
              at: new Date().toISOString(),
            },
          ],
        },
  );
  return reqStore.find((req) => req.id === id) ?? null;
}

export async function uploadRequisitionDocument(
  requisitionId: string,
  payload: { file: File; fieldKey?: string; label?: string },
) {
  await delay();
  const document = {
    id: crypto.randomUUID(),
    fieldKey: payload.fieldKey ?? null,
    label: payload.label ?? null,
    originalName: payload.file.name,
    name: payload.file.name,
    mimeType: payload.file.type || null,
    sizeBytes: payload.file.size,
    createdAt: new Date().toISOString(),
  };
  reqStore = reqStore.map((req) =>
    req.id !== requisitionId
      ? req
      : {
          ...req,
          attachments: [...req.attachments, document],
          updatedAt: new Date().toISOString(),
        },
  );
  return document;
}

export async function listApprovalTasks(): Promise<ApprovalTask[]> {
  await delay();
  return reqStore
    .filter((r) => r.status === "SUBMITTED" || r.status === "UNDER_REVIEW")
    .map((r) => ({
      id: `${r.id}-task`,
      requisitionId: r.id,
      prNumber: r.prNumber,
      status: r.status,
      title: r.title,
      requester: r.requester,
      department: r.department,
      amount: r.total,
      currency: r.currency,
      ageDays: daysOld(r.submittedAt ?? r.updatedAt),
      policyFlags: r.total > 10000 ? ["Above manager threshold"] : ["Within policy"],
    }));
}

export async function applyApprovalAction(requisitionId: string, action: ApprovalAction, comment?: string) {
  await delay();
  const trimmedComment = comment?.trim();
  reqStore = reqStore.map((r) =>
    r.id !== requisitionId
      ? r
      : {
          ...r,
          status: action === "APPROVE" ? "APPROVED" : action === "REJECT" ? "REJECTED" : "RETURNED",
          updatedAt: new Date().toISOString(),
          approvals: [
            ...r.approvals,
            {
              id: crypto.randomUUID(),
              actor: runtimeConfig.actorName,
              role: "Approver",
              action,
              comment: trimmedComment,
              at: new Date().toISOString(),
            },
          ],
        },
  );
}

export async function listSuppliers() {
  await delay();
  return suppliers;
}

export async function getSupplier(id: string) {
  await delay();
  return suppliers.find((s) => s.id === id) ?? null;
}

export async function listAuditEvents(params?: { entityType?: string; entityId?: string; limit?: number }) {
  await delay();
  return auditStore
    .filter((event) => (params?.entityType ? event.entityType === "PR" : true))
    .filter((event) => (params?.entityId ? event.entityId === params.entityId : true))
    .slice(0, params?.limit ?? auditStore.length);
}

export async function listRfqsFromAudit() {
  await delay();
  return rfqStore;
}

export async function createRfq(payload: {
  prId: string;
  title: string;
  budgetAmount: number;
  currency: string;
  paymentTerms: string;
  taxIncluded: boolean;
  priceValidityDays: number;
  notes?: string;
}) {
  await delay();
  const rfq: Rfq = {
    id: crypto.randomUUID(),
    prId: payload.prId,
    title: payload.title,
    notes: payload.notes,
    status: "DRAFT",
    budgetAmount: payload.budgetAmount,
    currency: payload.currency,
    paymentTerms: payload.paymentTerms,
    taxIncluded: payload.taxIncluded,
    priceValidityDays: payload.priceValidityDays,
    suppliers: [],
    bidCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  rfqStore = [rfq, ...rfqStore];
  return rfq;
}

export async function getRfq(id: string) {
  await delay();
  return rfqStore.find((rfq) => rfq.id === id) ?? null;
}

export async function addRfqSuppliers(rfqId: string, supplierIds: string[]) {
  await delay();
  rfqStore = rfqStore.map((rfq) =>
    rfq.id !== rfqId
      ? rfq
      : {
          ...rfq,
          suppliers: supplierIds.map((supplierId) => ({
            id: `${rfqId}-${supplierId}`,
            supplierId,
            supplierName: suppliers.find((s) => s.id === supplierId)?.name ?? supplierId,
          })),
          updatedAt: new Date().toISOString(),
        },
  );
  return rfqStore.find((rfq) => rfq.id === rfqId) ?? null;
}

export async function releaseRfq(rfqId: string, payload?: { releaseMode?: "PRIVATE" | "LOCAL" | "GLOBAL"; localCountryCode?: string }) {
  await delay();
  const releaseMode = payload?.releaseMode ?? "PRIVATE";
  rfqStore = rfqStore.map((rfq) =>
    rfq.id === rfqId
      ? { ...rfq, status: "RELEASED", releaseMode, updatedAt: new Date().toISOString() }
      : rfq,
  );
  return rfqStore.find((rfq) => rfq.id === rfqId) ?? null;
}

export async function openRfq(rfqId: string) {
  await delay();
  rfqStore = rfqStore.map((rfq) => (rfq.id === rfqId ? { ...rfq, status: "OPEN", updatedAt: new Date().toISOString() } : rfq));
  return rfqStore.find((rfq) => rfq.id === rfqId) ?? null;
}

export async function closeRfq(rfqId: string) {
  await delay();
  rfqStore = rfqStore.map((rfq) => (rfq.id === rfqId ? { ...rfq, status: "CLOSED", updatedAt: new Date().toISOString() } : rfq));
  return rfqStore.find((rfq) => rfq.id === rfqId) ?? null;
}

export async function listSupplierFormTemplates() {
  await delay();
  return supplierFormTemplateStore.filter((t) => t.isActive && t.isReusable);
}

export async function createSupplierFormTemplate(payload: {
  name: string;
  description?: string;
  fields: Array<{ id?: string; key: string; label: string; type: "TEXT" | "NUMBER" | "DOCUMENT"; required?: boolean }>;
  isReusable?: boolean;
}) {
  await delay();
  const now = new Date().toISOString();
  const template: SupplierFormTemplate = {
    id: crypto.randomUUID(),
    name: payload.name,
    description: payload.description ?? null,
    fields: payload.fields.map((field, index) => ({
      id: field.id ?? `${field.key}-${index + 1}`,
      key: field.key,
      label: field.label,
      type: field.type,
      required: field.required === true,
    })),
    isReusable: payload.isReusable !== false,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
  supplierFormTemplateStore = [template, ...supplierFormTemplateStore];
  return template;
}

export async function listRfqSupplierForms(rfqId: string) {
  await delay();
  return rfqSupplierFormStore.filter((row) => row.rfqId === rfqId);
}

export async function attachRfqSupplierForm(
  rfqId: string,
  payload: {
    templateId?: string;
    name?: string;
    description?: string;
    fields?: Array<{ id?: string; key?: string; label?: string; type?: "TEXT" | "NUMBER" | "DOCUMENT"; required?: boolean }>;
    isRequired?: boolean;
    saveForReuse?: boolean;
  },
) {
  await delay();
  let template: SupplierFormTemplate | undefined;

  if (payload.templateId) {
    template = supplierFormTemplateStore.find((t) => t.id === payload.templateId);
  } else if (payload.name && payload.fields?.length) {
    template = await createSupplierFormTemplate({
      name: payload.name,
      description: payload.description,
      fields: payload.fields as Array<{ id?: string; key: string; label: string; type: "TEXT" | "NUMBER" | "DOCUMENT"; required?: boolean }>,
      isReusable: payload.saveForReuse !== false,
    });
  }

  if (!template) {
    throw new Error("Template not found");
  }

  const existing = rfqSupplierFormStore.find((row) => row.rfqId === rfqId && row.templateId === template.id);
  if (existing) return existing;

  const row: RfqSupplierFormAssignment = {
    id: crypto.randomUUID(),
    rfqId,
    templateId: template.id,
    isRequired: payload.isRequired !== false,
    createdAt: new Date().toISOString(),
    template,
  };
  rfqSupplierFormStore = [row, ...rfqSupplierFormStore];
  return row;
}

export async function awardRfq(rfqId: string, payload: { bidId: string; supplierId: string; overrideReason: string }) {
  await delay();
  rfqStore = rfqStore.map((rfq) =>
    rfq.id === rfqId
      ? {
          ...rfq,
          status: "AWARDED",
          award: { bidId: payload.bidId, supplierId: payload.supplierId, overrideReason: payload.overrideReason },
          updatedAt: new Date().toISOString(),
        }
      : rfq,
  );
  return rfqStore.find((rfq) => rfq.id === rfqId) ?? null;
}

export async function listBidsByRfq(rfqId: string) {
  await delay();
  return bidStore.filter((bid) => bid.rfqId === rfqId);
}

export async function getBid(id: string) {
  await delay();
  return bidStore.find((bid) => bid.id === id) ?? null;
}

export async function upsertBid(payload: { rfqId: string; supplierId: string; totalBidValue?: number; currency?: string }) {
  await delay();
  const existing = bidStore.find((bid) => bid.rfqId === payload.rfqId && bid.supplierId === payload.supplierId);
  if (existing) return existing;
  const bid: Bid = {
    id: crypto.randomUUID(),
    rfqId: payload.rfqId,
    supplierId: payload.supplierId,
    supplierName: suppliers.find((s) => s.id === payload.supplierId)?.name ?? payload.supplierId,
    supplierProfileScore: suppliers.find((s) => s.id === payload.supplierId)?.profileScore ?? null,
    status: "DRAFT",
    currency: payload.currency ?? "USD",
    totalBidValue: payload.totalBidValue ?? 0,
    recommended: false,
  };
  bidStore = [bid, ...bidStore];
  return bid;
}

export async function submitBid(id: string) {
  await delay();
  bidStore = bidStore.map((bid) => (bid.id === id ? { ...bid, status: "SUBMITTED", submittedAt: new Date().toISOString() } : bid));
  return bidStore.find((bid) => bid.id === id) ?? null;
}

export async function openBid(id: string) {
  await delay();
  bidStore = bidStore.map((bid) => (bid.id === id ? { ...bid, status: "OPENED", openedAt: new Date().toISOString() } : bid));
  return bidStore.find((bid) => bid.id === id) ?? null;
}

export async function evaluateBid(id: string) {
  await delay();
  bidStore = bidStore.map((bid) => (bid.id === id ? { ...bid, status: "UNDER_EVALUATION", finalScore: 78.5 } : bid));
  return bidStore.find((bid) => bid.id === id) ?? null;
}

export async function recommendBid(id: string, reason: string) {
  await delay();
  bidStore = bidStore.map((bid) =>
    bid.id === id ? { ...bid, status: "AWARD_RECOMMENDED", recommended: true, recommendationReason: reason } : bid,
  );
  return bidStore.find((bid) => bid.id === id) ?? null;
}

export async function transitionBid(id: string, payload: { status: "SHORTLISTED" | "REJECTED" | "CLOSED"; reason?: string }) {
  await delay();
  bidStore = bidStore.map((bid) => (bid.id === id ? { ...bid, status: payload.status, notes: payload.reason ?? bid.notes } : bid));
  return bidStore.find((bid) => bid.id === id) ?? null;
}

export async function listPos() {
  await delay();
  return poStore;
}

export async function getPo(id: string) {
  await delay();
  return poStore.find((po) => po.id === id) ?? null;
}

export async function createPoFromAward(payload: { awardId: string; terms?: string; notes?: string }) {
  await delay();
  const po: PurchaseOrder = {
    id: crypto.randomUUID(),
    poNumber: `PO-${Date.now()}`,
    status: "DRAFT",
    currency: "ZAR",
    committedAmount: 3000,
    commercialOnly: true,
    awardId: payload.awardId,
    rfqId: "rfq-mock",
    prId: "pr-mock",
    terms: payload.terms ?? null,
    notes: payload.notes ?? null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  poStore = [po, ...poStore];
  return po;
}

export async function releasePo(id: string) {
  await delay();
  poStore = poStore.map((po) => (po.id === id ? { ...po, status: "RELEASED", releasedAt: new Date().toISOString() } : po));
  return poStore.find((po) => po.id === id) ?? null;
}

export async function respondPo(id: string, payload: { action: "ACCEPT" | "REQUEST_CHANGE"; reason?: string; proposedTerms?: string; requestedBy?: string }) {
  await delay();
  poStore = poStore.map((po) =>
    po.id === id
      ? {
          ...po,
          status: payload.action === "ACCEPT" ? "ACCEPTED" : "CHANGE_REQUESTED",
          acceptedAt: payload.action === "ACCEPT" ? new Date().toISOString() : po.acceptedAt,
          notes: payload.reason ?? po.notes,
        }
      : po,
  );
  return poStore.find((po) => po.id === id) ?? null;
}

export async function closePo(id: string, reason?: string) {
  await delay();
  poStore = poStore.map((po) => (po.id === id ? { ...po, status: "CLOSED", closedAt: new Date().toISOString(), notes: reason ?? po.notes } : po));
  return poStore.find((po) => po.id === id) ?? null;
}

export async function listInvoices(poId?: string) {
  await delay();
  if (!poId) return invoiceStore;
  return invoiceStore.filter((invoice) => invoice.poId === poId);
}

export async function syncInvoices(payload: {
  sourceSystem?: "ERP" | "QUICKBOOKS" | "MANUAL";
  since?: string;
  snapshots?: Array<{
    externalInvoiceId: string;
    invoiceNumber?: string;
    poId?: string;
    poNumber?: string;
    currency?: string;
    totalAmount: number;
    invoiceDate?: string;
    status?: string;
  }>;
}) {
  await delay();
  const snapshots = payload.snapshots ?? [];
  const mapped: InvoiceSnapshot[] = snapshots.map((snapshot) => ({
    id: crypto.randomUUID(),
    externalInvoiceId: snapshot.externalInvoiceId,
    invoiceNumber: snapshot.invoiceNumber ?? null,
    sourceSystem: payload.sourceSystem ?? "MANUAL",
    poId: snapshot.poId ?? null,
    poNumber: snapshot.poNumber ?? null,
    currency: snapshot.currency ?? "ZAR",
    totalAmount: snapshot.totalAmount,
    invoiceDate: snapshot.invoiceDate ?? null,
    status: snapshot.status ?? null,
    syncedAt: new Date().toISOString(),
  }));
  invoiceStore = [...mapped, ...invoiceStore];
  return {
    sourceSystem: payload.sourceSystem ?? "MANUAL",
    processed: mapped.length,
    created: mapped.length,
    updated: 0,
  };
}

export async function validatePoInvoices(poId: string): Promise<PoInvoiceValidation> {
  await delay();
  const po = poStore.find((candidate) => candidate.id === poId);
  const invoices = invoiceStore.filter((invoice) => invoice.poId === poId);
  const totalInvoiced = invoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0);
  const committed = po?.committedAmount ?? 0;
  return {
    poId,
    poNumber: po?.poNumber ?? "UNKNOWN",
    poStatus: po?.status ?? "DRAFT",
    currency: po?.currency ?? "ZAR",
    committedAmount: committed,
    invoiceCount: invoices.length,
    totalInvoiced,
    varianceAmount: totalInvoiced - committed,
    matchStatus: invoices.length === 0 ? "MISSING_INVOICE" : totalInvoiced === committed ? "MATCH" : totalInvoiced < committed ? "UNDER_INVOICED" : "OVER_INVOICED",
    serviceFamily: "PROJECT",
    familyInvoiceHooks: [],
    invoices,
  };
}

export async function createDeliveryNote(
  poId: string,
  payload: { noteNumber?: string; supplierId?: string; deliveryDate?: string; receivedBy?: string; remarks?: string; documentUrl?: string },
) {
  await delay();
  const po = poStore.find((candidate) => candidate.id === poId);
  if (!po) throw new Error("PO not found");
  const note: DeliveryNote = {
    id: crypto.randomUUID(),
    poId,
    supplierId: payload.supplierId ?? "mock-supplier",
    noteNumber: payload.noteNumber ?? `DN-${Date.now()}`,
    deliveryDate: payload.deliveryDate ?? new Date().toISOString(),
    receivedBy: payload.receivedBy ?? null,
    remarks: payload.remarks ?? null,
    documentUrl: payload.documentUrl ?? null,
    status: "RECEIVED",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  deliveryNoteStore = [note, ...deliveryNoteStore];
  return note;
}

export async function listDeliveryNotes(poId: string) {
  await delay();
  return deliveryNoteStore.filter((note) => note.poId === poId);
}

export async function createLiveInvoiceFromTemplate(
  poId: string,
  payload: { deliveryNoteId?: string; invoiceNumber?: string; taxIncluded?: boolean; taxRatePercent?: number; dueDate?: string; notes?: string },
) {
  await delay();
  const po = poStore.find((candidate) => candidate.id === poId);
  if (!po) throw new Error("PO not found");
  const note = deliveryNoteStore.find((n) => n.id === payload.deliveryNoteId && n.poId === poId) ?? deliveryNoteStore.find((n) => n.poId === poId);
  if (!note) throw new Error("Delivery note required");
  const taxRate = (payload.taxRatePercent ?? 15) / 100;
  const subtotal = po.committedAmount;
  const taxAmount = payload.taxIncluded === false ? 0 : subtotal * taxRate;
  const invoice: LiveInvoice = {
    id: crypto.randomUUID(),
    poId,
    supplierId: note.supplierId,
    deliveryNoteId: note.id,
    invoiceNumber: payload.invoiceNumber ?? `INV-${Date.now()}`,
    currency: po.currency,
    subtotal,
    taxAmount,
    totalAmount: subtotal + taxAmount,
    taxIncluded: payload.taxIncluded !== false,
    issueDate: new Date().toISOString(),
    dueDate: payload.dueDate ?? null,
    status: "DRAFT",
    notes: payload.notes ?? null,
    sourceDocumentName: null,
    signedDocumentName: null,
    submittedAt: null,
    submittedBy: null,
    reviewedAt: null,
    reviewedBy: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    paidAt: null,
    signedAt: null,
    signature: null,
    paymentProofs: [],
  };
  liveInvoiceStore = [invoice, ...liveInvoiceStore];
  return invoice;
}

export async function createSupplierInvoice(
  poId: string,
  payload: { deliveryNoteId?: string; invoiceNumber?: string; taxIncluded?: boolean; taxRatePercent?: number; dueDate?: string; notes?: string; file?: File | null },
) {
  await delay();
  const invoice = await createLiveInvoiceFromTemplate(poId, payload);
  liveInvoiceStore = liveInvoiceStore.map((item) =>
    item.id === invoice.id
      ? {
          ...item,
          sourceDocumentName: payload.file?.name ?? null,
          updatedAt: new Date().toISOString(),
        }
      : item,
  );
  return liveInvoiceStore.find((item) => item.id === invoice.id)!;
}

export async function listLiveInvoices(poId: string) {
  await delay();
  return liveInvoiceStore.filter((item) => item.poId === poId);
}

export async function getLiveInvoice(id: string) {
  await delay();
  const invoice = liveInvoiceStore.find((item) => item.id === id);
  if (!invoice) throw new Error("Invoice not found");
  return invoice;
}

export async function submitSupplierInvoice(id: string, payload: { notes?: string } = {}) {
  await delay();
  liveInvoiceStore = liveInvoiceStore.map((item) =>
    item.id === id
      ? {
          ...item,
          status: "SUBMITTED_TO_ORG",
          submittedAt: new Date().toISOString(),
          submittedBy: runtimeConfig.actorName,
          notes: payload.notes ?? item.notes,
          updatedAt: new Date().toISOString(),
        }
      : item,
  );
  return liveInvoiceStore.find((item) => item.id === id)!;
}

export async function reviewLiveInvoice(id: string, payload: { notes?: string } = {}) {
  await delay();
  liveInvoiceStore = liveInvoiceStore.map((item) =>
    item.id === id
      ? {
          ...item,
          status: "UNDER_REVIEW",
          reviewedAt: new Date().toISOString(),
          reviewedBy: runtimeConfig.actorName,
          notes: payload.notes ?? item.notes,
          updatedAt: new Date().toISOString(),
        }
      : item,
  );
  return liveInvoiceStore.find((item) => item.id === id)!;
}

export async function markLiveInvoicePaid(
  id: string,
  payload: { paymentDate?: string; amountPaid?: number; paymentReference?: string; popUrl?: string; notes?: string },
) {
  await delay();
  const invoice = liveInvoiceStore.find((item) => item.id === id);
  if (!invoice) throw new Error("Invoice not found");
  const proof: PaymentProof = {
    id: crypto.randomUUID(),
    invoiceId: id,
    amountPaid: payload.amountPaid ?? invoice.totalAmount,
    paymentDate: payload.paymentDate ?? new Date().toISOString(),
    paymentReference: payload.paymentReference ?? null,
    popUrl: payload.popUrl ?? null,
    notes: payload.notes ?? null,
    recordedBy: runtimeConfig.actorName,
    createdAt: new Date().toISOString(),
  };
  liveInvoiceStore = liveInvoiceStore.map((item) =>
    item.id === id
      ? {
          ...item,
          status: "PAID",
          paidAt: proof.paymentDate,
          paymentProofs: [proof, ...item.paymentProofs],
          updatedAt: new Date().toISOString(),
        }
      : item,
  );
  return liveInvoiceStore.find((item) => item.id === id)!;
}

export async function signLiveInvoice(
  id: string,
  payload: { signerName?: string; signerRole?: string; signatureHash?: string } = {},
) {
  await delay();
  const invoice = liveInvoiceStore.find((item) => item.id === id);
  if (!invoice) throw new Error("Invoice not found");
  const signature: InvoiceSignature = {
    id: crypto.randomUUID(),
    invoiceId: id,
    signedBy: payload.signerName ?? runtimeConfig.actorName,
    signerRole: payload.signerRole ?? "FINANCE_APPROVER",
    signatureHash: payload.signatureHash ?? `${id}-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  liveInvoiceStore = liveInvoiceStore.map((item) =>
    item.id === id
      ? {
          ...item,
          status: "SIGNED",
          signedAt: new Date().toISOString(),
          signature,
          updatedAt: new Date().toISOString(),
        }
      : item,
  );
  return liveInvoiceStore.find((item) => item.id === id)!;
}

export async function uploadSignedInvoice(id: string, file: File) {
  await delay();
  liveInvoiceStore = liveInvoiceStore.map((item) =>
    item.id === id
      ? {
          ...item,
          status: item.status === "PAID" ? "PAID" : "SIGNED",
          signedDocumentName: file.name,
          signedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      : item,
  );
  return liveInvoiceStore.find((item) => item.id === id)!;
}

export async function getProcurementPolicy() {
  await delay();
  return procurementPolicy;
}

export async function updateProcurementPolicy(payload: Partial<ProcurementPolicy>) {
  await delay();
  procurementPolicy = { ...procurementPolicy, ...payload };
  return procurementPolicy;
}

export async function resolveProcurementMethod(payload: { budgetAmount: number; isEmergency?: boolean; requestedMethod?: string; emergencyJustification?: string }) {
  await delay();
  const method = payload.budgetAmount <= procurementPolicy.lowThreshold ? procurementPolicy.lowMethod : payload.budgetAmount <= procurementPolicy.midThreshold ? procurementPolicy.midMethod : procurementPolicy.highMethod;
  return { band: payload.budgetAmount <= procurementPolicy.lowThreshold ? "LOW" : payload.budgetAmount <= procurementPolicy.midThreshold ? "MID" : "HIGH", method, policy: procurementPolicy };
}

export async function listSoDRules() {
  await delay();
  return sodRules;
}

export async function upsertSoDRule(action: string, payload: { allowedRoles?: string[]; blockedRoles?: string[]; isActive?: boolean }) {
  await delay();
  const existing = sodRules.find((rule) => rule.action === action);
  if (existing) {
    const updated = { ...existing, ...payload };
    sodRules = sodRules.map((rule) => (rule.action === action ? updated : rule));
    return updated;
  }
  const created: SoDRule = { id: crypto.randomUUID(), action, allowedRoles: payload.allowedRoles ?? ["PROCUREMENT_MANAGER"], blockedRoles: payload.blockedRoles ?? [], isActive: payload.isActive ?? true };
  sodRules = [created, ...sodRules];
  return created;
}

export async function declareCoi(rfqId: string, payload: { reason: string; supplierId?: string }) {
  await delay();
  const declaration: CoiDeclaration = {
    id: crypto.randomUUID(),
    rfqId,
    supplierId: payload.supplierId ?? null,
    declaredBy: runtimeConfig.actorName,
    reason: payload.reason,
    status: "PENDING",
    createdAt: new Date().toISOString(),
  };
  coiStore = [declaration, ...coiStore];
  return declaration;
}

export async function listCoi(rfqId: string) {
  await delay();
  return coiStore.filter((item) => item.rfqId === rfqId);
}

export async function reviewCoi(id: string, payload: { decision: "APPROVED" | "BLOCKED"; reviewNotes?: string }) {
  await delay();
  coiStore = coiStore.map((item) =>
    item.id === id
      ? { ...item, status: payload.decision, reviewNotes: payload.reviewNotes ?? null, reviewedBy: runtimeConfig.actorName, reviewedAt: new Date().toISOString() }
      : item,
  );
  return coiStore.find((item) => item.id === id) ?? null;
}

export async function generateGovernanceExport(exportType: string, format: "CSV" | "PDF" = "CSV"): Promise<GovernanceGeneratedExport> {
  await delay();
  const generated: GovernanceGeneratedExport = {
    id: crypto.randomUUID(),
    exportType,
    format,
    rowCount: 1,
    hashReference: `sha256:${crypto.randomUUID().replaceAll("-", "")}`,
    content: "mock_export_content",
  };
  govExports = [
    {
      id: generated.id,
      exportType,
      format,
      rowCount: generated.rowCount,
      contentHash: generated.hashReference.replace("sha256:", ""),
      createdAt: new Date().toISOString(),
    },
    ...govExports,
  ];
  return generated;
}

export async function listGovernanceExports() {
  await delay();
  return govExports;
}

export async function getRetentionPolicy() {
  await delay();
  return retentionPolicy;
}

export async function updateRetentionPolicy(payload: Partial<RetentionPolicy>) {
  await delay();
  retentionPolicy = { ...retentionPolicy, ...payload };
  return retentionPolicy;
}

export async function runRetention(dryRun = true) {
  await delay();
  const run: RetentionRunLog = {
    id: crypto.randomUUID(),
    cutoffTs: new Date(Date.now() - retentionPolicy.auditRetentionDays * 86400000).toISOString(),
    eligibleCount: 0,
    purgedCount: 0,
    mode: dryRun ? "CHECK_ONLY" : "PURGE_MUTABLE_ONLY",
    createdAt: new Date().toISOString(),
  };
  retentionRuns = [run, ...retentionRuns];
  return run;
}

export async function listRetentionRuns() {
  await delay();
  return retentionRuns;
}

export async function verifyAuditEvidence(): Promise<AuditEvidenceResult> {
  await delay();
  return { valid: true, checked: 10, lastHash: crypto.randomUUID().replaceAll("-", "") };
}
