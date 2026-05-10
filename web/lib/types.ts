export type ReqStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "RETURNED"
  | "CANCELLED"
  | "CONVERTED_TO_RFQ"
  | "CLOSED";

export type ApprovalAction = "APPROVE" | "REJECT" | "REQUEST_INFO";

export interface RequisitionLine {
  id: string;
  subcategoryId?: string;
  description: string;
  quantity: number;
  uom?: string;
  notes?: string;
  metadata?: Record<string, unknown> | null;
}

export interface RequisitionDocument {
  id: string;
  fieldKey?: string | null;
  label?: string | null;
  name: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  createdAt: string;
}

export interface ApprovalStep {
  id: string;
  actor: string;
  role: string;
  action: ApprovalAction;
  comment?: string;
  at: string;
}

export interface Requisition {
  id: string;
  prNumber: string;
  title: string;
  requester: string;
  department: string;
  costCenter: string;
  neededBy?: string;
  justification?: string;
  status: ReqStatus;
  currentApprover?: string;
  submittedAt?: string;
  updatedAt: string;
  createdAt: string;
  editedAfterApprovalAt?: string | null;
  total: number;
  currency: string;
  subcategoryId?: string | null;
  metadata?: Record<string, unknown> | null;
  lineItems: RequisitionLine[];
  approvals: ApprovalStep[];
  attachments: RequisitionDocument[];
}

export interface TaxonomySubcategory {
  id: string;
  name: string;
  level1: string;
  level2: string;
  level3: string;
  archetype: string;
  isCustom?: boolean;
  inheritsFromSubcategoryId?: string | null;
}

export interface LocationSuggestion {
  id: string;
  label: string;
  lat: number;
  lng: number;
  address: {
    line1?: string;
    city?: string;
    province?: string;
    postalCode?: string;
    country?: string;
    countryCode?: string;
  };
}

export interface DynamicFieldDef {
  path: string;
  key: string;
  label: string;
  type: "text" | "number" | "date" | "textarea" | "checkbox";
  required: boolean;
  hint?: string;
}

export interface PrFormSchemaField {
  path: string;
  key: string;
  label: string;
  inputType: "text" | "number" | "date" | "textarea" | "checkbox" | "file" | "select" | "milestones";
  required: boolean;
  section: "core" | "subcategory" | string;
  message?: string;
  options?: string[];
}

export interface PrFormSchema {
  subcategory: TaxonomySubcategory;
  requestedSubcategoryId?: string;
  resolvedSubcategoryId?: string;
  country?: string | null;
  resolvedFrom?: string;
  keys: {
    prFormKey: string;
    rfqFormKey: string;
    bidFormKey: string;
    prRulePackKey: string;
    rfqRulePackKey: string;
    bidRulePackKey: string;
  };
  serviceFamily: string;
  lineBindings?: {
    description?: string[];
    quantity?: string[];
    uom?: string[];
  };
  coreFieldBindings?: {
    neededBy?: string[];
  };
  uomPolicy?: {
    fieldPath: string;
    options: string[];
    locked: boolean;
    defaultValue?: string;
  } | null;
  schemaVersion: string;
  sections: Array<{
    id: string;
    title: string;
    fields: PrFormSchemaField[];
  }>;
  validation: {
    entityType: "PR";
    rulePackKey: string;
    fieldCount?: number;
    requiredFieldCount: number;
  };
}

export interface ApprovalTask {
  id: string;
  requisitionId: string;
  prNumber: string;
  status: ReqStatus;
  title: string;
  requester: string;
  department: string;
  amount: number;
  currency: string;
  ageDays: number;
  policyFlags: string[];
}

export interface Supplier {
  id: string;
  name: string;
  status: "ACTIVE" | "INACTIVE" | "BLOCKED";
  tags: string[];
  contacts: Array<{ id: string; name: string; email: string; phone?: string }>;
  country: string;
  profileScore?: number;
  complianceScore?: number;
  deliveryScore?: number;
  qualityScore?: number;
  riskScore?: number;
  onboardingProfile?: SupplierOnboardingProfile | null;
  documents?: SupplierVerificationDocument[];
  updatedAt: string;
}

export interface OrganizationProfile {
  id: string;
  tenantId: string;
  companyId: string;
  companyName?: string | null;
  registrationNumber?: string | null;
  industry?: string | null;
  country?: string | null;
  preferredLanguage?: string | null;
  preferredCurrency?: string | null;
  companySize?: string | null;
  contactFullName?: string | null;
  workEmail?: string | null;
  phoneNumber?: string | null;
  role?: string | null;
  monthlyProcurementSpendRange?: string | null;
  mainCategoriesPurchased: string[];
  supplierCountRange?: string | null;
  usesProcurementSystem?: boolean | null;
  verificationStatus: "PENDING" | "UNDER_REVIEW" | "VERIFIED" | "REJECTED";
  verifiedAt?: string | null;
  verifiedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationUser {
  id: string;
  fullName: string;
  email: string;
  jobTitle?: string | null;
  roles: string[];
  departmentIds: string[];
  isActive: boolean;
  createdAt: string;
}

export interface OrganizationDepartment {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

export interface OrganizationCostCentre {
  id: string;
  code: string;
  name: string;
  departmentId?: string | null;
  isActive: boolean;
}

export interface OrganizationBudgetAllocation {
  id: string;
  scopeId: string;
  amount: number;
}

export interface OrganizationApprovalRoute {
  id: string;
  scopeType: "DEPARTMENT" | "COST_CENTRE";
  scopeValue: string;
  roles: string[];
}

export interface OrganizationAdminSettings {
  users: OrganizationUser[];
  settings: {
    departments: OrganizationDepartment[];
    costCentres: OrganizationCostCentre[];
    totalBudget?: number | null;
    budgetCurrency: string;
    departmentBudgets: OrganizationBudgetAllocation[];
    costCentreBudgets: OrganizationBudgetAllocation[];
    approvalRoutes: OrganizationApprovalRoute[];
    customRoles?: Array<{ id: string; name: string; permissions: string[] }>;
    userPermissionOverrides?: Array<{ userId: string; permissions: string[] }>;
    updatedAt: string;
  };
}

export interface SupplierVerificationDocument {
  id: string;
  fieldKey: string;
  label?: string | null;
  originalName: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierOnboardingProfile {
  id: string;
  yearsInOperation?: number | null;
  employeeCountRange?: string | null;
  regionsServed: string[];
  selectedCategoryIds: string[];
  questionnaire?: Record<string, unknown> | null;
  scoreBreakdown?: Record<string, unknown> | null;
  tier: "BRONZE" | "SILVER" | "GOLD";
  verificationStatus: "PENDING" | "UNDER_REVIEW" | "VERIFIED" | "REJECTED";
  verifiedAt?: string | null;
  verifiedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierPortalProfile {
  id: string;
  name: string;
  legalName?: string | null;
  registrationNumber?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  country?: string | null;
  profileScore?: number | null;
  complianceScore?: number | null;
  deliveryScore?: number | null;
  qualityScore?: number | null;
  riskScore?: number | null;
  contacts: Array<{
    id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    role?: string | null;
    isPrimary?: boolean;
  }>;
  tags: Array<{
    id: string;
    subcategoryId: string;
    subcategory?: {
      id: string;
      name: string;
      level1: string;
      level2: string;
      level3: string;
    } | null;
  }>;
  onboardingProfile?: SupplierOnboardingProfile | null;
  documents: SupplierVerificationDocument[];
  createdAt: string;
  updatedAt: string;
}

export interface AuditEvent {
  id: string;
  entityType: "PR" | "RFQ" | "BID" | "POLICY" | "SYSTEM";
  entityId: string;
  action: string;
  actor: string;
  at: string;
  details: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

export interface WorkflowThreadEntryMessage {
  id: string;
  type: "message";
  at: string;
  authorLabel: string;
  authorId?: string | null;
  message: string;
}

export interface WorkflowThreadEntryEvent {
  id: string;
  type: "event";
  at: string;
  authorLabel: string;
  entityType: string;
  entityId?: string | null;
  eventType: string;
  payload?: Record<string, unknown> | null;
}

export type WorkflowThreadEntry = WorkflowThreadEntryMessage | WorkflowThreadEntryEvent;

export interface WorkflowThread {
  id: string;
  prId: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowThreadResponse {
  thread: WorkflowThread;
  entries: WorkflowThreadEntry[];
}

export interface DashboardKpi {
  id: string;
  label: string;
  value: string;
  delta: string;
}

export type RfqStatus = "DRAFT" | "RELEASED" | "OPEN" | "AWARDED" | "CLOSED";
export type BidStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "OPENED"
  | "UNDER_EVALUATION"
  | "SHORTLISTED"
  | "REJECTED"
  | "AWARD_RECOMMENDED"
  | "CLOSED";

export interface RfqSupplierLink {
  id: string;
  supplierId: string;
  supplierName: string;
}

export interface Rfq {
  id: string;
  prId: string;
  title: string;
  notes?: string;
  status: RfqStatus;
  releaseMode?: "PRIVATE" | "LOCAL" | "GLOBAL" | "PUBLIC";
  budgetAmount?: number;
  currency?: string;
  paymentTerms?: string;
  taxIncluded?: boolean;
  priceValidityDays?: number;
  procurementMethod?: string;
  procurementBand?: string;
  suppliers: RfqSupplierLink[];
  bidCount: number;
  award?: { bidId: string; supplierId: string; overrideReason: string };
  prTitle?: string;
  subcategoryId?: string;
  department?: string;
  costCentre?: string;
  justification?: string;
  prMetadata?: Record<string, unknown>;
  lines: RequisitionLine[];
  createdAt: string;
  updatedAt: string;
}

export type SupplierFormFieldType = "TEXT" | "NUMBER" | "DOCUMENT";

export interface SupplierFormField {
  id: string;
  key: string;
  label: string;
  type: SupplierFormFieldType;
  required: boolean;
}

export interface SupplierFormTemplate {
  id: string;
  name: string;
  description?: string | null;
  fields: SupplierFormField[];
  isReusable: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RfqSupplierFormAssignment {
  id: string;
  rfqId: string;
  templateId: string;
  isRequired: boolean;
  createdAt: string;
  template: SupplierFormTemplate;
  responses?: SupplierFormResponse[];
}

export interface SupplierFormResponse {
  id: string;
  rfqId: string;
  assignmentId: string;
  templateId: string;
  supplierId: string;
  response?: Record<string, unknown> | null;
  documents?: Record<string, unknown> | null;
  isComplete: boolean;
  completedAt?: string | null;
  submittedBy?: string | null;
  createdAt: string;
  updatedAt: string;
  missingFields?: Array<{ key: string; label: string }>;
}

export interface Bid {
  id: string;
  rfqId: string;
  supplierId: string;
  supplierName?: string;
  supplierProfileScore?: number | null;
  status: BidStatus;
  currency?: string;
  totalBidValue?: number;
  lines?: BidLine[];
  finalScore?: number | null;
  recommended?: boolean;
  recommendationReason?: string | null;
  notes?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  submittedAt?: string | null;
  openedAt?: string | null;
  closedAt?: string | null;
  payload?: Record<string, unknown> | null;
  documents?: Record<string, unknown> | null;
}

export interface BidLine {
  id: string;
  prLineId: string;
  description: string;
  quantity: number;
  uom?: string | null;
  unitPrice: number;
  lineTotal: number;
  notes?: string | null;
}

export interface PurchaseOrderLineItem {
  prLineId: string;
  description: string;
  quantity: number;
  uom?: string | null;
  unitPrice: number;
  lineTotal: number;
  notes?: string | null;
}

export type PoStatus = "DRAFT" | "RELEASED" | "ACCEPTED" | "CHANGE_REQUESTED" | "CLOSED";

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  status: PoStatus;
  currency: string;
  committedAmount: number;
  lineItems?: PurchaseOrderLineItem[];
  commercialOnly: boolean;
  awardId: string;
  rfqId: string;
  prId: string;
  terms?: string | null;
  notes?: string | null;
  supplierId?: string;
  supplierName?: string;
  changeRequests?: Array<{
    id: string;
    reason: string;
    proposedTerms?: string | null;
    requestedBy?: string | null;
    status?: string;
    createdAt: string;
  }>;
  releasedAt?: string | null;
  acceptedAt?: string | null;
  closedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceSnapshot {
  id: string;
  externalInvoiceId: string;
  invoiceNumber?: string | null;
  sourceSystem: "ERP" | "QUICKBOOKS" | "MANUAL";
  poId?: string | null;
  poNumber?: string | null;
  currency: string;
  totalAmount: number;
  invoiceDate?: string | null;
  status?: string | null;
  syncedAt: string;
}

export type DeliveryNoteStatus = "RECEIVED" | "DISPUTED";
export type LiveInvoiceStatus = "DRAFT" | "SUBMITTED_TO_ORG" | "UNDER_REVIEW" | "SIGNED" | "PAID" | "CLOSED";

export interface DeliveryNote {
  id: string;
  poId: string;
  supplierId: string;
  noteNumber: string;
  deliveryDate: string;
  receivedBy?: string | null;
  remarks?: string | null;
  documentUrl?: string | null;
  documentName?: string | null;
  status: DeliveryNoteStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentProof {
  id: string;
  invoiceId: string;
  amountPaid: number;
  paymentDate: string;
  paymentReference?: string | null;
  popUrl?: string | null;
  popName?: string | null;
  notes?: string | null;
  recordedBy?: string | null;
  createdAt: string;
}

export interface InvoiceSignature {
  id: string;
  invoiceId: string;
  signedBy: string;
  signerRole?: string | null;
  signatureHash: string;
  createdAt: string;
}

export interface LiveInvoice {
  id: string;
  poId: string;
  supplierId: string;
  deliveryNoteId?: string | null;
  invoiceNumber: string;
  currency: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  taxIncluded: boolean;
  issueDate: string;
  dueDate?: string | null;
  status: LiveInvoiceStatus;
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
  signature?: InvoiceSignature | null;
  paymentProofs: PaymentProof[];
}

export interface PoInvoiceValidation {
  poId: string;
  poNumber: string;
  poStatus: string;
  currency: string;
  committedAmount: number;
  invoiceCount: number;
  totalInvoiced: number;
  varianceAmount: number;
  matchStatus: "MATCH" | "UNDER_INVOICED" | "OVER_INVOICED" | "MISSING_INVOICE";
  serviceFamily: string;
  familyInvoiceHooks: string[];
  invoices: InvoiceSnapshot[];
}

export interface ProcurementPolicy {
  id: string;
  tenantId: string;
  companyId: string;
  lowThreshold: number;
  midThreshold: number;
  lowMethod: string;
  midMethod: string;
  highMethod: string;
  emergencyMethod: string;
  emergencyEnabled: boolean;
  requireEmergencyJustification: boolean;
}

export interface SoDRule {
  id: string;
  action: string;
  allowedRoles: string[];
  blockedRoles: string[];
  isActive: boolean;
}

export interface CoiDeclaration {
  id: string;
  rfqId: string;
  supplierId?: string | null;
  declaredBy: string;
  reason: string;
  status: "PENDING" | "APPROVED" | "BLOCKED";
  reviewNotes?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
}

export interface GovernanceExportRecord {
  id: string;
  exportType: string;
  format: "CSV" | "PDF";
  rowCount: number;
  contentHash: string;
  createdAt: string;
}

export interface GovernanceGeneratedExport {
  id: string;
  exportType: string;
  format: "CSV" | "PDF";
  rowCount: number;
  hashReference: string;
  content: string;
}

export interface RetentionPolicy {
  id: string;
  tenantId: string;
  companyId: string;
  auditRetentionDays: number;
  enforceImmutability: boolean;
  allowPurge: boolean;
}

export interface RetentionRunLog {
  id: string;
  cutoffTs: string;
  eligibleCount: number;
  purgedCount: number;
  mode: string;
  createdAt: string;
}

export interface AuditEvidenceResult {
  valid: boolean;
  checked: number;
  lastHash?: string | null;
  brokenEventId?: string;
  expectedPrevHash?: string | null;
  actualPrevHash?: string | null;
  expectedHash?: string | null;
  actualHash?: string | null;
}
