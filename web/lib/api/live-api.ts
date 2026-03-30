import { apiRequest, extractError } from "@/lib/api/client";
import { daysOld } from "@/lib/format";
import { runtimeConfig } from "@/lib/runtime-config";
import {
  ApprovalAction,
  ApprovalTask,
  AuditEvidenceResult,
  AuditEvent,
  Bid,
  CoiDeclaration,
  DeliveryNote,
  DynamicFieldDef,
  GovernanceExportRecord,
  GovernanceGeneratedExport,
  LiveInvoice,
  InvoiceSignature,
  InvoiceSnapshot,
  PaymentProof,
  PoInvoiceValidation,
  ProcurementPolicy,
  PurchaseOrder,
  Requisition,
  RequisitionDocument,
  RequisitionLine,
  RetentionPolicy,
  RetentionRunLog,
  RfqSupplierFormAssignment,
  Rfq,
  SoDRule,
  SupplierFormTemplate,
  Supplier,
  TaxonomySubcategory,
  PrFormSchema,
  LocationSuggestion,
} from "@/lib/types";

// These raw types mirror backend DTOs closely. We keep them separate from the
// frontend domain types so UI code is not forced to understand transport-level
// quirks such as nullable strings, nested payload fragments, or timestamp
// formatting details.
type RawPR = {
  id: string;
  createdAt: string;
  updatedAt: string;
  tenantId: string;
  companyId: string;
  requesterId: string | null;
  title: string;
  description: string | null;
  currency: string;
  costCentre: string | null;
  department: string | null;
  subcategoryId: string | null;
  metadata?: Record<string, unknown> | null;
  status: Requisition["status"];
  approvalChain: unknown;
  submittedAt: string | null;
  editedAfterApprovalAt?: string | null;
  documents?: RawPRDocument[];
};

type RawPRDocument = {
  id: string;
  fieldKey?: string | null;
  label?: string | null;
  originalName: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  createdAt: string;
};

type RawLine = {
  id: string;
  description: string;
  quantity: number;
  uom?: string | null;
};

type RawAudit = {
  id: string;
  ts: string;
  eventType: string;
  entityType?: string | null;
  entityId?: string | null;
  actor?: string | null;
  payload?: Record<string, unknown> | null;
};

type RawTaxonomySubcategory = {
  id: string;
  name: string;
  level1: string;
  level2: string;
  level3: string;
  archetype: string;
};

type RawRulesValidate = {
  valid: boolean;
  rulePackKey: string;
  requiredFields: string[];
  missingFields: Array<{ fieldPath: string; message?: string }>;
};

type RawPrFormSchema = PrFormSchema;

type RawSupplier = {
  id: string;
  name: string;
  status: "ACTIVE" | "INACTIVE" | "BLOCKED";
  country?: string | null;
  profileScore?: number | null;
  complianceScore?: number | null;
  deliveryScore?: number | null;
  qualityScore?: number | null;
  riskScore?: number | null;
  updatedAt: string;
  contacts?: Array<{ id: string; name: string; email: string; phone?: string | null }>;
  tags?: Array<{ subcategoryId?: string | null }>;
};

type RawRfq = {
  id: string;
  createdAt: string;
  updatedAt: string;
  prId: string;
  status: Rfq["status"];
  releaseMode?: "PRIVATE" | "LOCAL" | "GLOBAL" | "PUBLIC" | null;
  title: string;
  notes?: string | null;
  budgetAmount?: string | number | null;
  currency?: string | null;
  paymentTerms?: string | null;
  taxIncluded?: boolean | null;
  priceValidityDays?: number | null;
  procurementMethod?: string | null;
  procurementBand?: string | null;
  suppliers?: Array<{
    id: string;
    supplierId: string;
    supplier?: { id: string; name: string } | null;
  }>;
  bids?: Array<{ id: string }>;
  award?: { bidId: string; supplierId: string; overrideReason: string } | null;
};

type RawSupplierFormTemplate = {
  id: string;
  name: string;
  description?: string | null;
  fields: Array<{ id: string; key: string; label: string; type: "TEXT" | "NUMBER" | "DOCUMENT"; required: boolean }>;
  isReusable: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type RawRfqSupplierFormAssignment = {
  id: string;
  rfqId: string;
  templateId: string;
  isRequired: boolean;
  createdAt: string;
  template: RawSupplierFormTemplate;
};

type RawBid = {
  id: string;
  rfqId: string;
  supplierId: string;
  status: Bid["status"];
  currency?: string | null;
  totalBidValue?: string | number | null;
  finalScore?: string | number | null;
  recommended?: boolean | null;
  recommendationReason?: string | null;
  notes?: string | null;
  submittedAt?: string | null;
  openedAt?: string | null;
  closedAt?: string | null;
  payload?: Record<string, unknown> | null;
  documents?: Record<string, unknown> | null;
  supplier?: { id: string; name: string; profileScore?: number | null } | null;
};

type RawPo = {
  id: string;
  createdAt: string;
  updatedAt: string;
  poNumber: string;
  status: PurchaseOrder["status"];
  commercialOnly: boolean;
  currency: string;
  committedAmount: string | number;
  terms?: string | null;
  notes?: string | null;
  awardId: string;
  rfqId: string;
  prId: string;
  releasedAt?: string | null;
  acceptedAt?: string | null;
  closedAt?: string | null;
  award?: { supplier?: { id?: string; name: string } | null } | null;
  changeRequests?: Array<{
    id: string;
    reason: string;
    proposedTerms?: string | null;
    requestedBy?: string | null;
    status?: string;
    createdAt: string;
  }>;
};

type RawInvoiceSnapshot = {
  id: string;
  externalInvoiceId: string;
  invoiceNumber?: string | null;
  sourceSystem: "ERP" | "QUICKBOOKS" | "MANUAL";
  poId?: string | null;
  poNumber?: string | null;
  currency: string;
  totalAmount: string | number;
  invoiceDate?: string | null;
  status?: string | null;
  syncedAt: string;
};

type RawDeliveryNote = {
  id: string;
  poId: string;
  supplierId: string;
  noteNumber: string;
  deliveryDate: string;
  receivedBy?: string | null;
  remarks?: string | null;
  documentUrl?: string | null;
  documentName?: string | null;
  status: "RECEIVED" | "DISPUTED";
  createdAt: string;
  updatedAt: string;
};

type RawPaymentProof = {
  id: string;
  invoiceId: string;
  amountPaid: string | number;
  paymentDate: string;
  paymentReference?: string | null;
  popUrl?: string | null;
  popName?: string | null;
  notes?: string | null;
  recordedBy?: string | null;
  createdAt: string;
};

type RawInvoiceSignature = {
  id: string;
  invoiceId: string;
  signedBy: string;
  signerRole?: string | null;
  signatureHash: string;
  createdAt: string;
};

type RawLiveInvoice = {
  id: string;
  poId: string;
  supplierId: string;
  deliveryNoteId?: string | null;
  invoiceNumber: string;
  currency: string;
  subtotal: string | number;
  taxAmount: string | number;
  totalAmount: string | number;
  taxIncluded: boolean;
  issueDate: string;
  dueDate?: string | null;
  status: "DRAFT" | "SUBMITTED_TO_ORG" | "UNDER_REVIEW" | "PAID" | "SIGNED" | "CLOSED";
  notes?: string | null;
  sourceDocumentName?: string | null;
  signedDocumentName?: string | null;
  submittedAt?: string | null;
  submittedBy?: string | null;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  createdAt: string;
  updatedAt: string;
  signedAt?: string | null;
  paidAt?: string | null;
  signature?: RawInvoiceSignature | null;
  paymentProofs?: RawPaymentProof[];
};

const toNum = (value: string | number | null | undefined) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const buildApiUrl = (path: string) => {
  const normalizedBase = runtimeConfig.apiBaseUrl.endsWith("/")
    ? runtimeConfig.apiBaseUrl
    : `${runtimeConfig.apiBaseUrl}/`;
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
  return new URL(normalizedPath, normalizedBase);
};

const mapLine = (line: RawLine): RequisitionLine => ({
  id: line.id,
  description: line.description,
  quantity: Number(line.quantity ?? 0),
  uom: line.uom ?? undefined,
});

const mapPrDocument = (document: RawPRDocument): RequisitionDocument => ({
  id: document.id,
  fieldKey: document.fieldKey ?? null,
  label: document.label ?? null,
  name: document.originalName,
  mimeType: document.mimeType ?? null,
  sizeBytes: document.sizeBytes ?? null,
  createdAt: document.createdAt,
});

const mapAuditEntityType = (entityType?: string | null): AuditEvent["entityType"] => {
  const normalized = (entityType ?? "").toUpperCase();
  if (normalized === "PURCHASEREQUISITION" || normalized === "PR") return "PR";
  if (normalized === "RFQ") return "RFQ";
  if (normalized === "BID") return "BID";
  if (normalized === "POLICY") return "POLICY";
  return "SYSTEM";
};

const mapApprovalAction = (eventType: string): ApprovalAction | null => {
  if (eventType === "PR_STATUS_CHANGED" || eventType === "PR_APPROVED_EDITED") return null;
  if (eventType === "PR_INFO_REQUESTED") return "REQUEST_INFO";
  const normalized = String(eventType).toUpperCase();
  if (normalized.includes("APPROVE")) return "APPROVE";
  if (normalized.includes("REJECT")) return "REJECT";
  return null;
};

const mapAuditRow = (row: RawAudit): AuditEvent => ({
  id: row.id,
  entityType: mapAuditEntityType(row.entityType),
  entityId: row.entityId ?? "-",
  action: row.eventType,
  actor: row.actor ?? "system",
  at: row.ts,
  details: row.eventType,
  after: row.payload ?? undefined,
});

const mapApprovalSteps = (events: RawAudit[]) =>
  events
    .filter((row) =>
      ["PR_STATUS_CHANGED", "PR_INFO_REQUESTED", "PR_APPROVED_EDITED"].includes(row.eventType) ||
      row.eventType.startsWith("PR_"),
    )
    .map((row) => {
      const payload = row.payload ?? {};
      return {
        id: row.id,
        actor: row.actor ?? "system",
        role: String(payload.role ?? "Workflow"),
        action:
          mapApprovalAction(row.eventType) ??
          ((String(payload.to ?? payload.action ?? "APPROVE").toUpperCase() === "REJECTED" ? "REJECT" : "APPROVE") as ApprovalAction),
        comment:
          typeof payload.reason === "string"
            ? payload.reason
            : typeof payload.comment === "string"
              ? payload.comment
              : undefined,
        at: row.ts,
      };
    });

const mapPR = (pr: RawPR, lines: RequisitionLine[] = []): Requisition => ({
  id: pr.id,
  prNumber: pr.id.slice(0, 8).toUpperCase(),
  title: pr.title,
  requester: pr.requesterId ?? runtimeConfig.actorName,
  department: pr.department ?? "Unassigned",
  costCenter: pr.costCentre ?? "-",
  neededBy:
    typeof pr.metadata?.required_date === "string"
      ? String(pr.metadata.required_date)
      : typeof pr.metadata?.needed_by === "string"
        ? String(pr.metadata.needed_by)
        : undefined,
  justification: pr.description ?? undefined,
  status: pr.status,
  currentApprover: pr.status === "SUBMITTED" || pr.status === "UNDER_REVIEW" ? "Pending Approver" : "-",
  submittedAt: pr.submittedAt ?? undefined,
  updatedAt: pr.updatedAt,
  createdAt: pr.createdAt,
  editedAfterApprovalAt: pr.editedAfterApprovalAt ?? null,
  total: 0,
  currency: pr.currency,
  subcategoryId: pr.subcategoryId,
  metadata: pr.metadata ?? null,
  lineItems: lines,
  approvals: [],
  attachments: (pr.documents ?? []).map(mapPrDocument),
});

const inferDynamicFieldType = (key: string): DynamicFieldDef["type"] => {
  if (key.endsWith("_json")) return "textarea";
  if (key.endsWith("_date")) return "date";
  if (/^(is_|has_|requires_|require_)/.test(key)) return "checkbox";
  if (/(^|_)(qty|quantity|amount|value|price|rate|days|hours|months|years)(_|$)/.test(key)) return "number";
  return "text";
};

const humanizeKey = (key: string) =>
  key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());

export async function listTaxonomySubcategories(limit = 500): Promise<TaxonomySubcategory[]> {
  const rows = await apiRequest<RawTaxonomySubcategory[]>(
    `/taxonomy/subcategories?limit=${Math.max(1, Math.min(limit, 500))}&canonicalOnly=true`,
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    level1: row.level1,
    level2: row.level2,
    level3: row.level3,
    archetype: row.archetype,
  }));
}

export async function getPrDynamicFieldDefs(subcategoryId: string): Promise<DynamicFieldDef[]> {
  const res = await apiRequest<RawRulesValidate>("/rules/validate/pr", {
    method: "POST",
    body: JSON.stringify({
      subcategoryId,
      payload: {},
    }),
  });

  const messageMap = new Map(res.missingFields.map((m) => [m.fieldPath, m.message]));
  return (res.requiredFields ?? [])
    .filter((path) => path.startsWith("metadata."))
    .map((path) => {
      const key = path.slice("metadata.".length);
      return {
        path,
        key,
        label: humanizeKey(key),
        type: inferDynamicFieldType(key),
        required: true,
        hint: messageMap.get(path),
      } satisfies DynamicFieldDef;
    });
}

export async function getPrFormSchema(subcategoryId: string, country?: string): Promise<PrFormSchema> {
  const params = new URLSearchParams({ subcategoryId });
  if (country) params.set("country", country);
  return apiRequest<RawPrFormSchema>(`/taxonomy/pr-form-schema?${params.toString()}`);
}

export async function getLocationSuggestions(query: string, country?: string, limit = 5): Promise<LocationSuggestion[]> {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  if (country) params.set("country", country);
  const res = await apiRequest<{ configured: boolean; provider: string; suggestions: LocationSuggestion[] }>(
    `/taxonomy/location-suggest?${params.toString()}`,
  );
  return res.suggestions ?? [];
}

const mapRfq = (rfq: RawRfq): Rfq => ({
  id: rfq.id,
  prId: rfq.prId,
  title: rfq.title,
  notes: rfq.notes ?? undefined,
  status: rfq.status,
  releaseMode: rfq.releaseMode ?? undefined,
  budgetAmount: rfq.budgetAmount == null ? undefined : toNum(rfq.budgetAmount),
  currency: rfq.currency ?? undefined,
  paymentTerms: rfq.paymentTerms ?? undefined,
  taxIncluded: rfq.taxIncluded ?? undefined,
  priceValidityDays: rfq.priceValidityDays ?? undefined,
  procurementMethod: rfq.procurementMethod ?? undefined,
  procurementBand: rfq.procurementBand ?? undefined,
  suppliers: (rfq.suppliers ?? []).map((s) => ({
    id: s.id,
    supplierId: s.supplierId,
    supplierName: s.supplier?.name ?? s.supplierId,
  })),
  bidCount: (rfq.bids ?? []).length,
  award: rfq.award ?? undefined,
  createdAt: rfq.createdAt,
  updatedAt: rfq.updatedAt,
});

const mapBid = (bid: RawBid): Bid => ({
  id: bid.id,
  rfqId: bid.rfqId,
  supplierId: bid.supplierId,
  supplierName: bid.supplier?.name ?? undefined,
  supplierProfileScore: bid.supplier?.profileScore == null ? null : Number(bid.supplier.profileScore),
  status: bid.status,
  currency: bid.currency ?? undefined,
  totalBidValue: bid.totalBidValue == null ? undefined : toNum(bid.totalBidValue),
  finalScore: bid.finalScore == null ? null : toNum(bid.finalScore),
  recommended: Boolean(bid.recommended),
  recommendationReason: bid.recommendationReason ?? null,
  notes: bid.notes ?? null,
  submittedAt: bid.submittedAt ?? null,
  openedAt: bid.openedAt ?? null,
  closedAt: bid.closedAt ?? null,
  payload: bid.payload ?? null,
  documents: bid.documents ?? null,
});

const mapPo = (po: RawPo): PurchaseOrder => ({
  id: po.id,
  poNumber: po.poNumber,
  status: po.status,
  currency: po.currency,
  committedAmount: toNum(po.committedAmount),
  commercialOnly: po.commercialOnly,
  awardId: po.awardId,
  rfqId: po.rfqId,
  prId: po.prId,
  terms: po.terms ?? null,
  notes: po.notes ?? null,
  supplierId: po.award?.supplier?.id ?? undefined,
  supplierName: po.award?.supplier?.name ?? undefined,
  changeRequests: (po.changeRequests ?? []).map((request) => ({
    id: request.id,
    reason: request.reason,
    proposedTerms: request.proposedTerms ?? null,
    requestedBy: request.requestedBy ?? null,
    status: request.status,
    createdAt: request.createdAt,
  })),
  releasedAt: po.releasedAt ?? null,
  acceptedAt: po.acceptedAt ?? null,
  closedAt: po.closedAt ?? null,
  createdAt: po.createdAt,
  updatedAt: po.updatedAt,
});

const mapInvoice = (invoice: RawInvoiceSnapshot): InvoiceSnapshot => ({
  id: invoice.id,
  externalInvoiceId: invoice.externalInvoiceId,
  invoiceNumber: invoice.invoiceNumber ?? null,
  sourceSystem: invoice.sourceSystem,
  poId: invoice.poId ?? null,
  poNumber: invoice.poNumber ?? null,
  currency: invoice.currency,
  totalAmount: toNum(invoice.totalAmount),
  invoiceDate: invoice.invoiceDate ?? null,
  status: invoice.status ?? null,
  syncedAt: invoice.syncedAt,
});

const mapDeliveryNote = (note: RawDeliveryNote): DeliveryNote => ({
  id: note.id,
  poId: note.poId,
  supplierId: note.supplierId,
  noteNumber: note.noteNumber,
  deliveryDate: note.deliveryDate,
  receivedBy: note.receivedBy ?? null,
  remarks: note.remarks ?? null,
  documentUrl: note.documentUrl ?? null,
  documentName: note.documentName ?? null,
  status: note.status,
  createdAt: note.createdAt,
  updatedAt: note.updatedAt,
});

const mapPaymentProof = (proof: RawPaymentProof): PaymentProof => ({
  id: proof.id,
  invoiceId: proof.invoiceId,
  amountPaid: toNum(proof.amountPaid),
  paymentDate: proof.paymentDate,
  paymentReference: proof.paymentReference ?? null,
  popUrl: proof.popUrl ?? null,
  popName: proof.popName ?? null,
  notes: proof.notes ?? null,
  recordedBy: proof.recordedBy ?? null,
  createdAt: proof.createdAt,
});

const mapInvoiceSignature = (signature: RawInvoiceSignature): InvoiceSignature => ({
  id: signature.id,
  invoiceId: signature.invoiceId,
  signedBy: signature.signedBy,
  signerRole: signature.signerRole ?? null,
  signatureHash: signature.signatureHash,
  createdAt: signature.createdAt,
});

const mapLiveInvoice = (invoice: RawLiveInvoice): LiveInvoice => ({
  id: invoice.id,
  poId: invoice.poId,
  supplierId: invoice.supplierId,
  deliveryNoteId: invoice.deliveryNoteId ?? null,
  invoiceNumber: invoice.invoiceNumber,
  currency: invoice.currency,
  subtotal: toNum(invoice.subtotal),
  taxAmount: toNum(invoice.taxAmount),
  totalAmount: toNum(invoice.totalAmount),
  taxIncluded: invoice.taxIncluded,
  issueDate: invoice.issueDate,
  dueDate: invoice.dueDate ?? null,
  status: invoice.status,
  notes: invoice.notes ?? null,
  sourceDocumentName: invoice.sourceDocumentName ?? null,
  signedDocumentName: invoice.signedDocumentName ?? null,
  submittedAt: invoice.submittedAt ?? null,
  submittedBy: invoice.submittedBy ?? null,
  reviewedAt: invoice.reviewedAt ?? null,
  reviewedBy: invoice.reviewedBy ?? null,
  createdAt: invoice.createdAt,
  updatedAt: invoice.updatedAt,
  signedAt: invoice.signedAt ?? null,
  paidAt: invoice.paidAt ?? null,
  signature: invoice.signature ? mapInvoiceSignature(invoice.signature) : null,
  paymentProofs: (invoice.paymentProofs ?? []).map(mapPaymentProof),
});

export async function listRequisitions() {
  const rows = await apiRequest<RawPR[]>("/pr");
  return rows.map((row) => mapPR(row));
}

export async function getRequisition(id: string) {
  const [pr, lines, auditRows] = await Promise.all([
    apiRequest<RawPR>(`/pr/${id}`),
    apiRequest<RawLine[]>(`/pr/${id}/lines`).catch(() => []),
    apiRequest<RawAudit[]>("/audit/events", {
      query: { limit: 300, entityType: "PurchaseRequisition", entityId: id },
    }).catch(() => []),
  ]);
  return {
    ...mapPR(pr, lines.map(mapLine)),
    approvals: mapApprovalSteps(auditRows),
  };
}

export async function createRequisition(payload: Omit<Requisition, "id" | "prNumber" | "createdAt" | "updatedAt">) {
  const created = await apiRequest<RawPR>("/pr", {
    method: "POST",
    body: JSON.stringify({
      title: payload.title,
      description: payload.justification ?? payload.title,
      currency: payload.currency,
      costCentre: payload.costCenter,
      department: payload.department,
      subcategoryId: payload.subcategoryId ?? runtimeConfig.defaultSubcategoryId,
      metadata: payload.metadata ?? undefined,
    }),
  });

  for (const line of payload.lineItems) {
    await apiRequest(`/pr/${created.id}/lines`, {
      method: "POST",
      body: JSON.stringify({
        description: line.description,
        quantity: line.quantity,
        uom: line.uom,
      }),
    });
  }

  await apiRequest(`/pr/${created.id}/submit`, { method: "POST" });
  return getRequisition(created.id);
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
  const created = await apiRequest<RawPR>("/pr", {
    method: "POST",
    body: JSON.stringify({
      title: payload.title,
      description: payload.justification ?? payload.title,
      currency: payload.currency ?? "ZAR",
      costCentre: payload.costCenter,
      department: payload.department,
      subcategoryId: payload.subcategoryId ?? runtimeConfig.defaultSubcategoryId,
      metadata: payload.metadata ?? undefined,
      validateRequired: false,
    }),
  });

  for (const line of payload.lineItems ?? []) {
    await apiRequest(`/pr/${created.id}/lines`, {
      method: "POST",
      body: JSON.stringify({
        description: line.description,
        quantity: line.quantity,
        uom: line.uom,
      }),
    });
  }

  return getRequisition(created.id);
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
    validateRequired?: boolean;
  },
) {
  const existingLines = await apiRequest<RawLine[]>(`/pr/${id}/lines`).catch(() => []);

  await apiRequest(`/pr/${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      title: payload.title,
      department: payload.department,
      costCentre: payload.costCenter,
      currency: payload.currency,
      subcategoryId: payload.subcategoryId,
      description: payload.justification,
      metadata: payload.metadata ?? undefined,
      editSource: payload.editSource,
      validateRequired: payload.validateRequired === true,
    }),
  });

  if (payload.lineItems) {
    await Promise.all(
      existingLines.map((line) =>
        apiRequest(`/pr/${id}/lines/${line.id}`, {
          method: "DELETE",
        }),
      ),
    );

    for (const line of payload.lineItems) {
      await apiRequest(`/pr/${id}/lines`, {
        method: "POST",
        body: JSON.stringify({
          description: line.description,
          quantity: line.quantity,
          uom: line.uom,
        }),
      });
    }
  }

  return getRequisition(id);
}

export async function submitRequisitionDraft(id: string) {
  await apiRequest(`/pr/${id}/submit`, { method: "POST" });
  return getRequisition(id);
}

export async function withdrawRequisition(id: string, reason?: string) {
  const trimmedReason = reason?.trim();
  await apiRequest(`/pr/${id}/withdraw`, {
    method: "POST",
    body: JSON.stringify(trimmedReason ? { reason: trimmedReason } : {}),
  });
  return getRequisition(id);
}

export async function uploadRequisitionDocument(
  requisitionId: string,
  payload: { file: File; fieldKey?: string; label?: string },
) {
  const body = new FormData();
  body.append("file", payload.file);
  if (payload.fieldKey) body.append("fieldKey", payload.fieldKey);
  if (payload.label) body.append("label", payload.label);
  return apiRequest<RawPRDocument>(`/pr/${requisitionId}/documents`, {
    method: "POST",
    body,
  });
}

export async function downloadRequisitionDocument(documentId: string) {
  const requestId = crypto.randomUUID();
  const response = await fetch(buildApiUrl(`/pr/documents/${documentId}/download`), {
    headers: {
      "x-request-id": requestId,
      "x-tenant-id": runtimeConfig.tenantId,
      "x-company-id": runtimeConfig.companyId,
      "x-user-id": runtimeConfig.actorId,
      "x-user-roles": runtimeConfig.actorRoles.join(","),
    },
    cache: "no-store",
  });
  if (!response.ok) {
    throw await extractError(response);
  }
  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition");
  const match = disposition?.match(/filename=\"?([^\"]+)\"?/);
  const filename = match?.[1] ?? `${documentId}.bin`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function listApprovalTasks(): Promise<ApprovalTask[]> {
  const reqs = await listRequisitions();
  return reqs
    .filter((r) => r.status === "SUBMITTED" || r.status === "UNDER_REVIEW")
    .map((r) => ({
      id: `${r.id}-task`,
      requisitionId: r.id,
      prNumber: r.prNumber,
      status: r.status,
      title: r.title,
      requester: r.requester,
      department: r.department,
      amount: 0,
      currency: r.currency,
      ageDays: daysOld(r.submittedAt ?? r.updatedAt),
      policyFlags: ["Necessity review pending"],
    }));
}

export async function applyApprovalAction(requisitionId: string, action: ApprovalAction, comment?: string) {
  const trimmedComment = comment?.trim();
  const postRoutedStatus = (status: "APPROVED" | "REJECTED" | "RETURNED") =>
    apiRequest(`/pr/${requisitionId}/status`, {
      method: "POST",
      body: JSON.stringify(trimmedComment ? { status, reason: trimmedComment } : { status }),
    });

  if (action === "APPROVE") {
    await postRoutedStatus("APPROVED");
    return;
  }

  if (action === "REJECT") {
    await postRoutedStatus("REJECTED");
    return;
  }

  await postRoutedStatus("RETURNED");
}

export async function listSuppliers() {
  const rows = await apiRequest<RawSupplier[]>("/suppliers");
  return rows.map(
    (row): Supplier => ({
      id: row.id,
      name: row.name,
      status: row.status,
      tags: (row.tags ?? []).map((tag) => tag.subcategoryId).filter((v): v is string => Boolean(v)),
      contacts: (row.contacts ?? []).map((c) => ({ id: c.id, name: c.name, email: c.email, phone: c.phone ?? undefined })),
      country: row.country ?? "-",
      profileScore: row.profileScore == null ? undefined : Number(row.profileScore),
      complianceScore: row.complianceScore == null ? undefined : Number(row.complianceScore),
      deliveryScore: row.deliveryScore == null ? undefined : Number(row.deliveryScore),
      qualityScore: row.qualityScore == null ? undefined : Number(row.qualityScore),
      riskScore: row.riskScore == null ? undefined : Number(row.riskScore),
      updatedAt: row.updatedAt,
    }),
  );
}

export async function getSupplier(id: string) {
  const row = await apiRequest<RawSupplier>(`/suppliers/${id}`);
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    tags: (row.tags ?? []).map((tag) => tag.subcategoryId).filter((v): v is string => Boolean(v)),
    contacts: (row.contacts ?? []).map((c) => ({ id: c.id, name: c.name, email: c.email, phone: c.phone ?? undefined })),
    country: row.country ?? "-",
    profileScore: row.profileScore == null ? undefined : Number(row.profileScore),
    complianceScore: row.complianceScore == null ? undefined : Number(row.complianceScore),
    deliveryScore: row.deliveryScore == null ? undefined : Number(row.deliveryScore),
    qualityScore: row.qualityScore == null ? undefined : Number(row.qualityScore),
    riskScore: row.riskScore == null ? undefined : Number(row.riskScore),
    updatedAt: row.updatedAt,
  } satisfies Supplier;
}

export async function listAuditEvents(params?: { entityType?: string; entityId?: string; limit?: number }) {
  const rows = await apiRequest<RawAudit[]>("/audit/events", {
    query: {
      limit: params?.limit ?? 100,
      entityType: params?.entityType,
      entityId: params?.entityId,
    },
  });
  return rows.map(mapAuditRow);
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
  procurementMethod?: string;
  isEmergency?: boolean;
  emergencyJustification?: string;
}) {
  const created = await apiRequest<RawRfq>("/rfqs", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return mapRfq(created);
}

export async function getRfq(id: string) {
  const rfq = await apiRequest<RawRfq>(`/rfqs/${id}`);
  return mapRfq(rfq);
}

export async function listRfqsFromAudit(limit = 30) {
  const events = await apiRequest<RawAudit[]>("/audit/events", { query: { limit: 300 } });
  const ids = Array.from(
    new Set(
      events
        .filter((event) => event.entityType?.toUpperCase() === "RFQ")
        .map((event) => event.entityId)
        .filter((id): id is string => Boolean(id)),
    ),
  ).slice(0, limit);

  const rows = await Promise.all(ids.map((id) => getRfq(id).catch(() => null)));
  return rows.filter((row): row is Rfq => Boolean(row));
}

export async function addRfqSuppliers(rfqId: string, supplierIds: string[]) {
  await apiRequest(`/rfqs/${rfqId}/suppliers`, {
    method: "POST",
    body: JSON.stringify({ supplierIds }),
  });
  return getRfq(rfqId);
}

export async function releaseRfq(
  rfqId: string,
  payload?: { releaseMode?: "PRIVATE" | "LOCAL" | "GLOBAL"; localCountryCode?: string },
) {
  await apiRequest(`/rfqs/${rfqId}/release`, {
    method: "POST",
    body: JSON.stringify(payload ?? {}),
  });
  return getRfq(rfqId);
}

export async function openRfq(rfqId: string) {
  await apiRequest(`/rfqs/${rfqId}/open`, { method: "POST" });
  return getRfq(rfqId);
}

export async function awardRfq(rfqId: string, payload: { bidId: string; supplierId: string; overrideReason: string; notes?: string }) {
  await apiRequest(`/rfqs/${rfqId}/award`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return getRfq(rfqId);
}

export async function closeRfq(rfqId: string, reason?: string) {
  await apiRequest(`/rfqs/${rfqId}/close`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
  return getRfq(rfqId);
}

export async function listSupplierFormTemplates(limit = 100) {
  const rows = await apiRequest<RawSupplierFormTemplate[]>("/rfqs/forms/templates", {
    query: { limit },
  });
  return rows as SupplierFormTemplate[];
}

export async function createSupplierFormTemplate(payload: {
  name: string;
  description?: string;
  fields: Array<{ id?: string; key: string; label: string; type: "TEXT" | "NUMBER" | "DOCUMENT"; required?: boolean }>;
  isReusable?: boolean;
}) {
  const row = await apiRequest<RawSupplierFormTemplate>("/rfqs/forms/templates", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return row as SupplierFormTemplate;
}

export async function listRfqSupplierForms(rfqId: string) {
  const rows = await apiRequest<RawRfqSupplierFormAssignment[]>(`/rfqs/${rfqId}/forms`);
  return rows as RfqSupplierFormAssignment[];
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
  const row = await apiRequest<RawRfqSupplierFormAssignment>(`/rfqs/${rfqId}/forms`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return row as RfqSupplierFormAssignment;
}

export async function listBidsByRfq(rfqId: string) {
  const rows = await apiRequest<RawBid[]>(`/bids/rfq/${rfqId}`);
  return rows.map(mapBid);
}

export async function getBid(id: string) {
  const row = await apiRequest<RawBid>(`/bids/${id}`);
  return mapBid(row);
}

export async function upsertBid(payload: {
  rfqId: string;
  supplierId: string;
  totalBidValue?: number;
  currency?: string;
  notes?: string;
  payload?: Record<string, unknown>;
  documents?: Record<string, unknown>;
}) {
  const row = await apiRequest<RawBid>("/bids", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return mapBid(row);
}

export async function submitBid(id: string) {
  const row = await apiRequest<RawBid>(`/bids/${id}/submit`, { method: "POST" });
  return mapBid(row);
}

export async function openBid(id: string) {
  const row = await apiRequest<RawBid>(`/bids/${id}/open`, { method: "POST" });
  return mapBid(row);
}

export async function evaluateBid(
  id: string,
  payload: { criteria: Array<{ criterion: "PRICE" | "DELIVERY" | "COMPLIANCE" | "RISK"; score: number; weight?: number; notes?: string }>; summary?: string },
) {
  const row = await apiRequest<RawBid>(`/bids/${id}/evaluate`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return mapBid(row);
}

export async function recommendBid(id: string, reason: string) {
  const row = await apiRequest<RawBid>(`/bids/${id}/recommend`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
  return mapBid(row);
}

export async function transitionBid(id: string, payload: { status: "SHORTLISTED" | "REJECTED" | "CLOSED"; reason?: string }) {
  const row = await apiRequest<RawBid>(`/bids/${id}/status`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return mapBid(row);
}

export async function listPos() {
  const rows = await apiRequest<RawPo[]>("/pos");
  return rows.map(mapPo);
}

export async function getPo(id: string) {
  const row = await apiRequest<RawPo>(`/pos/${id}`);
  return mapPo(row);
}

export async function createPoFromAward(payload: { awardId: string; terms?: string; notes?: string }) {
  const row = await apiRequest<RawPo>("/pos/from-award", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return mapPo(row);
}

export async function releasePo(id: string) {
  const row = await apiRequest<RawPo>(`/pos/${id}/release`, { method: "POST" });
  return mapPo(row);
}

export async function respondPo(id: string, payload: { action: "ACCEPT" | "REQUEST_CHANGE"; reason?: string; proposedTerms?: string; requestedBy?: string }) {
  const row = await apiRequest<RawPo>(`/pos/${id}/respond`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return mapPo(row);
}

export async function closePo(id: string, reason?: string) {
  const row = await apiRequest<RawPo>(`/pos/${id}/close`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
  return mapPo(row);
}

export async function listInvoices(poId?: string) {
  const rows = await apiRequest<RawInvoiceSnapshot[]>("/finance/invoices", {
    query: { poId, limit: 100 },
  });
  return rows.map(mapInvoice);
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
  return apiRequest<{ sourceSystem: string; processed: number; created: number; updated: number }>("/finance/invoices/sync", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function validatePoInvoices(poId: string): Promise<PoInvoiceValidation> {
  const result = await apiRequest<{
    poId: string;
    poNumber: string;
    poStatus: string;
    currency: string;
    committedAmount: string | number;
    invoiceCount: number;
    totalInvoiced: string | number;
    varianceAmount: string | number;
    matchStatus: "MATCH" | "UNDER_INVOICED" | "OVER_INVOICED" | "MISSING_INVOICE";
    serviceFamily: string;
    familyInvoiceHooks: string[];
    invoices: RawInvoiceSnapshot[];
  }>(`/finance/po/${poId}/validation`);

  return {
    poId: result.poId,
    poNumber: result.poNumber,
    poStatus: result.poStatus,
    currency: result.currency,
    committedAmount: toNum(result.committedAmount),
    invoiceCount: result.invoiceCount,
    totalInvoiced: toNum(result.totalInvoiced),
    varianceAmount: toNum(result.varianceAmount),
    matchStatus: result.matchStatus,
    serviceFamily: result.serviceFamily,
    familyInvoiceHooks: result.familyInvoiceHooks,
    invoices: result.invoices.map(mapInvoice),
  };
}

export async function createDeliveryNote(
  poId: string,
  payload: { noteNumber?: string; supplierId?: string; deliveryDate?: string; receivedBy?: string; remarks?: string; documentUrl?: string; file?: File | null },
) {
  const body = new FormData();
  if (payload.noteNumber) body.append("noteNumber", payload.noteNumber);
  if (payload.supplierId) body.append("supplierId", payload.supplierId);
  if (payload.deliveryDate) body.append("deliveryDate", payload.deliveryDate);
  if (payload.receivedBy) body.append("receivedBy", payload.receivedBy);
  if (payload.remarks) body.append("remarks", payload.remarks);
  if (payload.documentUrl) body.append("documentUrl", payload.documentUrl);
  if (payload.file) body.append("file", payload.file);
  const row = await apiRequest<RawDeliveryNote>(`/finance/po/${poId}/delivery-notes`, { method: "POST", body });
  return mapDeliveryNote(row);
}

export async function listDeliveryNotes(poId: string) {
  const rows = await apiRequest<RawDeliveryNote[]>(`/finance/po/${poId}/delivery-notes`);
  return rows.map(mapDeliveryNote);
}

export async function downloadDeliveryNoteDocument(id: string) {
  const requestId = crypto.randomUUID();
  const response = await fetch(buildApiUrl(`/finance/delivery-notes/${id}/document`), {
    headers: {
      "x-request-id": requestId,
      "x-tenant-id": runtimeConfig.tenantId,
      "x-company-id": runtimeConfig.companyId,
      "x-user-id": runtimeConfig.actorId,
      "x-user-roles": runtimeConfig.actorRoles.join(","),
    },
    cache: "no-store",
  });
  if (!response.ok) {
    throw await extractError(response);
  }
  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition");
  const match = disposition?.match(/filename=\"?([^\"]+)\"?/);
  const filename = match?.[1] ?? `${id}-delivery-note.bin`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function createLiveInvoiceFromTemplate(
  poId: string,
  payload: { deliveryNoteId?: string; invoiceNumber?: string; taxIncluded?: boolean; taxRatePercent?: number; dueDate?: string; notes?: string },
) {
  const row = await apiRequest<RawLiveInvoice>(`/finance/po/${poId}/invoices/from-template`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return mapLiveInvoice(row);
}

export async function createSupplierInvoice(
  poId: string,
  payload: {
    deliveryNoteId?: string;
    invoiceNumber?: string;
    taxIncluded?: boolean;
    taxRatePercent?: number;
    dueDate?: string;
    notes?: string;
    file?: File | null;
  },
) {
  const body = new FormData();
  if (payload.deliveryNoteId) body.append("deliveryNoteId", payload.deliveryNoteId);
  if (payload.invoiceNumber) body.append("invoiceNumber", payload.invoiceNumber);
  if (payload.taxIncluded != null) body.append("taxIncluded", String(payload.taxIncluded));
  if (payload.taxRatePercent != null) body.append("taxRatePercent", String(payload.taxRatePercent));
  if (payload.dueDate) body.append("dueDate", payload.dueDate);
  if (payload.notes) body.append("notes", payload.notes);
  if (payload.file) body.append("file", payload.file);
  const row = await apiRequest<RawLiveInvoice>(`/finance/po/${poId}/invoices/supplier`, {
    method: "POST",
    body,
  });
  return mapLiveInvoice(row);
}

export async function listLiveInvoices(poId: string) {
  const rows = await apiRequest<RawLiveInvoice[]>(`/finance/po/${poId}/invoices/live`);
  return rows.map(mapLiveInvoice);
}

export async function getLiveInvoice(id: string) {
  const row = await apiRequest<RawLiveInvoice>(`/finance/invoices/live/${id}`);
  return mapLiveInvoice(row);
}

export async function submitSupplierInvoice(id: string, payload: { notes?: string } = {}) {
  const row = await apiRequest<RawLiveInvoice>(`/finance/invoices/live/${id}/submit`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return mapLiveInvoice(row);
}

export async function reviewLiveInvoice(id: string, payload: { notes?: string } = {}) {
  const row = await apiRequest<RawLiveInvoice>(`/finance/invoices/live/${id}/review`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return mapLiveInvoice(row);
}

export async function markLiveInvoicePaid(
  id: string,
  payload: { paymentDate?: string; amountPaid?: number; paymentReference?: string; popUrl?: string; notes?: string; file?: File | null },
) {
  const body = new FormData();
  if (payload.paymentDate) body.append("paymentDate", payload.paymentDate);
  if (payload.amountPaid != null) body.append("amountPaid", String(payload.amountPaid));
  if (payload.paymentReference) body.append("paymentReference", payload.paymentReference);
  if (payload.popUrl) body.append("popUrl", payload.popUrl);
  if (payload.notes) body.append("notes", payload.notes);
  if (payload.file) body.append("file", payload.file);
  const row = await apiRequest<RawLiveInvoice>(`/finance/invoices/live/${id}/mark-paid`, {
    method: "POST",
    body,
  });
  return mapLiveInvoice(row);
}

export async function signLiveInvoice(
  id: string,
  payload: { signerName?: string; signerRole?: string; signatureHash?: string } = {},
) {
  const row = await apiRequest<RawLiveInvoice>(`/finance/invoices/live/${id}/sign`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return mapLiveInvoice(row);
}

export async function uploadSignedInvoice(id: string, file: File) {
  const body = new FormData();
  body.append("file", file);
  const row = await apiRequest<RawLiveInvoice>(`/finance/invoices/live/${id}/upload-signed`, {
    method: "POST",
    body,
  });
  return mapLiveInvoice(row);
}

export async function downloadLiveInvoiceDocument(id: string, kind: "source" | "signed") {
  const requestId = crypto.randomUUID();
  const response = await fetch(buildApiUrl(`/finance/invoices/live/${id}/document?kind=${kind}`), {
    headers: {
      "x-request-id": requestId,
      "x-tenant-id": runtimeConfig.tenantId,
      "x-company-id": runtimeConfig.companyId,
      "x-user-id": runtimeConfig.actorId,
      "x-user-roles": runtimeConfig.actorRoles.join(","),
    },
    cache: "no-store",
  });
  if (!response.ok) {
    throw await extractError(response);
  }
  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition");
  const match = disposition?.match(/filename=\"?([^"]+)\"?/);
  const filename = match?.[1] ?? `${id}-${kind}.bin`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function previewLiveInvoiceDocument(id: string) {
  const requestId = crypto.randomUUID();
  const response = await fetch(buildApiUrl(`/finance/invoices/live/${id}/preview`), {
    headers: {
      "x-request-id": requestId,
      "x-tenant-id": runtimeConfig.tenantId,
      "x-company-id": runtimeConfig.companyId,
      "x-user-id": runtimeConfig.actorId,
      "x-user-roles": runtimeConfig.actorRoles.join(","),
    },
    cache: "no-store",
  });
  if (!response.ok) {
    throw await extractError(response);
  }
  const html = await response.text();
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function downloadLiveInvoicePdf(id: string) {
  const requestId = crypto.randomUUID();
  const response = await fetch(buildApiUrl(`/finance/invoices/live/${id}/pdf`), {
    headers: {
      "x-request-id": requestId,
      "x-tenant-id": runtimeConfig.tenantId,
      "x-company-id": runtimeConfig.companyId,
      "x-user-id": runtimeConfig.actorId,
      "x-user-roles": runtimeConfig.actorRoles.join(","),
    },
    cache: "no-store",
  });
  if (!response.ok) {
    throw await extractError(response);
  }
  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition");
  const match = disposition?.match(/filename=\"?([^\"]+)\"?/);
  const filename = match?.[1] ?? `${id}.pdf`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function getProcurementPolicy() {
  return apiRequest<ProcurementPolicy>("/policies/procurement");
}

export async function updateProcurementPolicy(payload: Partial<ProcurementPolicy>) {
  return apiRequest<ProcurementPolicy>("/policies/procurement", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function resolveProcurementMethod(payload: {
  budgetAmount: number;
  isEmergency?: boolean;
  requestedMethod?: string;
  emergencyJustification?: string;
}) {
  return apiRequest<{ band: string; method: string; policy: ProcurementPolicy }>("/policies/procurement/resolve", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listSoDRules() {
  return apiRequest<SoDRule[]>("/policies/sod");
}

export async function upsertSoDRule(action: string, payload: { allowedRoles?: string[]; blockedRoles?: string[]; isActive?: boolean }) {
  return apiRequest<SoDRule>(`/policies/sod/${action}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function declareCoi(rfqId: string, payload: { reason: string; supplierId?: string }) {
  return apiRequest<CoiDeclaration>(`/compliance/rfqs/${rfqId}/coi`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listCoi(rfqId: string) {
  return apiRequest<CoiDeclaration[]>(`/compliance/rfqs/${rfqId}/coi`);
}

export async function reviewCoi(id: string, payload: { decision: "APPROVED" | "BLOCKED"; reviewNotes?: string }) {
  return apiRequest<CoiDeclaration>(`/compliance/coi/${id}/review`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function generateGovernanceExport(exportType: string, format: "CSV" | "PDF" = "CSV") {
  return apiRequest<GovernanceGeneratedExport>(`/governance/exports/${exportType}`, {
    method: "POST",
    body: JSON.stringify({ format }),
  });
}

export async function listGovernanceExports(limit = 50) {
  return apiRequest<GovernanceExportRecord[]>("/governance/exports", { query: { limit } });
}

export async function getRetentionPolicy() {
  return apiRequest<RetentionPolicy>("/governance/retention/policy");
}

export async function updateRetentionPolicy(payload: Partial<RetentionPolicy>) {
  return apiRequest<RetentionPolicy>("/governance/retention/policy", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function runRetention(dryRun = true) {
  return apiRequest<RetentionRunLog>("/governance/retention/run", {
    method: "POST",
    body: JSON.stringify({ dryRun }),
  });
}

export async function listRetentionRuns(limit = 50) {
  return apiRequest<RetentionRunLog[]>("/governance/retention/logs", { query: { limit } });
}

export async function verifyAuditEvidence(limit = 500) {
  return apiRequest<AuditEvidenceResult>("/governance/audit/evidence", { query: { limit } });
}
