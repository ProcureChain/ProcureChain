"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as liveApi from "@/lib/api/live-api";
import {
  declareCoi,
  generateGovernanceExport,
  getProcurementPolicy,
  getRetentionPolicy,
  addRfqSuppliers,
  applyApprovalAction,
  awardRfq,
  closePo,
  closeRfq,
  createPoFromAward,
  createRequisition,
  createDraftRequisition,
  updateRequisition,
  submitRequisitionDraft,
  withdrawRequisition,
  uploadRequisitionDocument,
  createRfq,
  evaluateBid,
  getPo,
  getRequisition,
  getRfq,
  getBid,
  getSupplier,
  listBidsByRfq,
  listApprovalTasks,
  listAuditEvents,
  listCoi,
  listGovernanceExports,
  listInvoices,
  listPos,
  listRequisitions,
  listRfqsFromAudit,
  listRetentionRuns,
  listSoDRules,
  listSuppliers,
  openBid,
  openRfq,
  recommendBid,
  releasePo,
  releaseRfq,
  resolveProcurementMethod,
  reviewCoi,
  respondPo,
  syncInvoices,
  submitBid,
  transitionBid,
  updateProcurementPolicy,
  updateRetentionPolicy,
  upsertSoDRule,
  upsertBid,
  validatePoInvoices,
  verifyAuditEvidence,
  runRetention,
  listTaxonomySubcategories,
  getPrDynamicFieldDefs,
  getPrFormSchema,
  getLocationSuggestions,
  listSupplierFormTemplates,
  createSupplierFormTemplate,
  listRfqSupplierForms,
  attachRfqSupplierForm,
  createDeliveryNote,
  listDeliveryNotes,
  createLiveInvoiceFromTemplate,
  createSupplierInvoice,
  listLiveInvoices,
  getLiveInvoice,
  markLiveInvoicePaid,
  reviewLiveInvoice,
  signLiveInvoice,
  submitSupplierInvoice,
  uploadSignedInvoice,
} from "@/lib/api/mock-api";
import { runtimeConfig } from "@/lib/runtime-config";
import {
  ApprovalAction,
  AuditEvidenceResult,
  Bid,
  CoiDeclaration,
  DeliveryNote,
  GovernanceExportRecord,
  GovernanceGeneratedExport,
  InvoiceSnapshot,
  LiveInvoice,
  PoInvoiceValidation,
  ProcurementPolicy,
  PurchaseOrder,
  Requisition,
  RetentionPolicy,
  RetentionRunLog,
  Rfq,
  SoDRule,
  DynamicFieldDef,
  PrFormSchema,
  RfqSupplierFormAssignment,
  LocationSuggestion,
  SupplierFormTemplate,
  TaxonomySubcategory,
} from "@/lib/types";

export const queryKeys = {
  requisitions: ["requisitions"] as const,
  requisition: (id: string) => ["requisition", id] as const,
  approvals: ["approvals"] as const,
  suppliers: ["suppliers"] as const,
  supplier: (id: string) => ["supplier", id] as const,
  audit: ["audit"] as const,
  requisitionAudit: (id: string) => ["audit", "requisition", id] as const,
  rfqs: ["rfqs"] as const,
  rfq: (id: string) => ["rfq", id] as const,
  bidsByRfq: (rfqId: string) => ["bids", "rfq", rfqId] as const,
  bid: (id: string) => ["bid", id] as const,
  pos: ["pos"] as const,
  po: (id: string) => ["po", id] as const,
  invoices: (poId?: string) => ["invoices", poId ?? "all"] as const,
  poValidation: (poId: string) => ["po-validation", poId] as const,
  procurementPolicy: ["procurement-policy"] as const,
  sodRules: ["sod-rules"] as const,
  coi: (rfqId: string) => ["coi", rfqId] as const,
  governanceExports: ["governance-exports"] as const,
  retentionPolicy: ["retention-policy"] as const,
  retentionRuns: ["retention-runs"] as const,
  auditEvidence: ["audit-evidence"] as const,
  subcategories: ["taxonomy", "subcategories"] as const,
  prDynamicFields: (subcategoryId: string) => ["rules", "pr-dynamic-fields", subcategoryId] as const,
  prFormSchema: (subcategoryId: string) => ["taxonomy", "pr-form-schema", subcategoryId] as const,
  locationSuggestions: (query: string, country?: string) => ["taxonomy", "location-suggestions", query, country ?? ""] as const,
  supplierFormTemplates: ["rfq", "supplier-form-templates"] as const,
  rfqSupplierForms: (rfqId: string) => ["rfq", rfqId, "supplier-forms"] as const,
  deliveryNotes: (poId: string) => ["finance", "delivery-notes", poId] as const,
  liveInvoices: (poId: string) => ["finance", "live-invoices", poId] as const,
  liveInvoice: (invoiceId: string) => ["finance", "live-invoice", invoiceId] as const,
  // Include the current data source in every cache key so mock and live data
  // never bleed into the same React Query cache entry during development.
  mode: runtimeConfig.useMockApi ? "mock" : "live",
};

const readApi = runtimeConfig.useMockApi
  ? {
      listRequisitions,
      getRequisition,
      listApprovalTasks,
      listSuppliers,
      getSupplier,
      listAuditEvents,
      listRfqsFromAudit,
      getRfq,
      listBidsByRfq,
      getBid,
      listPos,
      getPo,
      listInvoices,
      validatePoInvoices,
      getProcurementPolicy,
      resolveProcurementMethod,
      listSoDRules,
      listCoi,
      listGovernanceExports,
      getRetentionPolicy,
      listRetentionRuns,
      verifyAuditEvidence,
      listTaxonomySubcategories,
      getPrDynamicFieldDefs,
      getPrFormSchema,
      getLocationSuggestions,
      listSupplierFormTemplates,
      listRfqSupplierForms,
      listDeliveryNotes,
      listLiveInvoices,
      getLiveInvoice,
    }
  : liveApi;

// Keep reads and writes behind the same switching layer. That lets the app run
// in mock mode for unfinished flows without scattering `if (mock)` checks
// across route components and forms.
const actionApi = runtimeConfig.useMockApi
  ? {
      createRequisition,
      createDraftRequisition,
      updateRequisition,
      submitRequisitionDraft,
      withdrawRequisition,
      uploadRequisitionDocument,
      applyApprovalAction,
      createRfq,
      addRfqSuppliers,
      releaseRfq,
      openRfq,
      awardRfq,
      closeRfq,
      upsertBid,
      submitBid,
      openBid,
      evaluateBid,
      recommendBid,
      transitionBid,
      createPoFromAward,
      releasePo,
      respondPo,
      closePo,
      syncInvoices,
      updateProcurementPolicy,
      upsertSoDRule,
      declareCoi,
      reviewCoi,
      generateGovernanceExport,
      updateRetentionPolicy,
      runRetention,
      createSupplierFormTemplate,
      attachRfqSupplierForm,
      createDeliveryNote,
      createLiveInvoiceFromTemplate,
      createSupplierInvoice,
      markLiveInvoicePaid,
      reviewLiveInvoice,
      signLiveInvoice,
      submitSupplierInvoice,
      uploadSignedInvoice,
    }
  : {
      createRequisition: liveApi.createRequisition,
      createDraftRequisition: liveApi.createDraftRequisition,
      updateRequisition: liveApi.updateRequisition,
      submitRequisitionDraft: liveApi.submitRequisitionDraft,
      withdrawRequisition: liveApi.withdrawRequisition,
      uploadRequisitionDocument: liveApi.uploadRequisitionDocument,
      applyApprovalAction: liveApi.applyApprovalAction,
      createRfq: liveApi.createRfq,
      addRfqSuppliers: liveApi.addRfqSuppliers,
      releaseRfq: liveApi.releaseRfq,
      openRfq: liveApi.openRfq,
      awardRfq: liveApi.awardRfq,
      closeRfq: liveApi.closeRfq,
      upsertBid: liveApi.upsertBid,
      submitBid: liveApi.submitBid,
      openBid: liveApi.openBid,
      evaluateBid: liveApi.evaluateBid,
      recommendBid: liveApi.recommendBid,
      transitionBid: liveApi.transitionBid,
      createPoFromAward: liveApi.createPoFromAward,
      releasePo: liveApi.releasePo,
      respondPo: liveApi.respondPo,
      closePo: liveApi.closePo,
      syncInvoices: liveApi.syncInvoices,
      updateProcurementPolicy: liveApi.updateProcurementPolicy,
      upsertSoDRule: liveApi.upsertSoDRule,
      declareCoi: liveApi.declareCoi,
      reviewCoi: liveApi.reviewCoi,
      generateGovernanceExport: liveApi.generateGovernanceExport,
      updateRetentionPolicy: liveApi.updateRetentionPolicy,
      runRetention: liveApi.runRetention,
      createSupplierFormTemplate: liveApi.createSupplierFormTemplate,
      attachRfqSupplierForm: liveApi.attachRfqSupplierForm,
      createDeliveryNote: liveApi.createDeliveryNote,
      createLiveInvoiceFromTemplate: liveApi.createLiveInvoiceFromTemplate,
      createSupplierInvoice: liveApi.createSupplierInvoice,
      markLiveInvoicePaid: liveApi.markLiveInvoicePaid,
      reviewLiveInvoice: liveApi.reviewLiveInvoice,
      signLiveInvoice: liveApi.signLiveInvoice,
      submitSupplierInvoice: liveApi.submitSupplierInvoice,
      uploadSignedInvoice: liveApi.uploadSignedInvoice,
    };

export function useRequisitions() {
  return useQuery({ queryKey: [...queryKeys.requisitions, queryKeys.mode], queryFn: readApi.listRequisitions });
}

export function useRequisition(id: string) {
  return useQuery({
    queryKey: [...queryKeys.requisition(id || "none"), queryKeys.mode],
    queryFn: () => readApi.getRequisition(id),
    enabled: Boolean(id),
  });
}

export function useCreateRequisition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Omit<Requisition, "id" | "prNumber" | "createdAt" | "updatedAt">) => actionApi.createRequisition(payload),
    onSuccess: (created) => {
      // Requisition creation feeds multiple screens at once: list views,
      // detail screens, and audit history. Invalidate the shared collections
      // and seed the detail cache with the returned object to avoid an extra
      // round-trip when routing to the new record.
      queryClient.invalidateQueries({ queryKey: queryKeys.requisitions });
      queryClient.invalidateQueries({ queryKey: queryKeys.audit });
      queryClient.setQueryData(queryKeys.requisition(created.id), created);
    },
  });
}

export function useCreateDraftRequisition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      title: string;
      department?: string;
      costCenter?: string;
      currency?: string;
      subcategoryId?: string | null;
      justification?: string;
      metadata?: Record<string, unknown> | null;
      lineItems?: Requisition["lineItems"];
    }) => actionApi.createDraftRequisition(payload),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.requisitions });
      queryClient.invalidateQueries({ queryKey: queryKeys.audit });
      queryClient.setQueryData(queryKeys.requisition(created.id), created);
    },
  });
}

export function useUpdateRequisition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      id: string;
      title: string;
      department: string;
      costCenter: string;
      currency?: string;
      subcategoryId?: string;
      justification?: string;
      metadata?: Record<string, unknown> | null;
      lineItems?: Requisition["lineItems"];
      editSource?: string;
      validateRequired?: boolean;
    }) => actionApi.updateRequisition(payload.id, payload),
    onSuccess: (updated) => {
      if (!updated) return;
      queryClient.setQueryData(queryKeys.requisition(updated.id), updated);
      queryClient.invalidateQueries({ queryKey: queryKeys.requisitions });
      queryClient.invalidateQueries({ queryKey: queryKeys.audit });
      queryClient.invalidateQueries({ queryKey: queryKeys.requisitionAudit(updated.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.approvals });
    },
  });
}

export function useSubmitDraftRequisition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => actionApi.submitRequisitionDraft(id),
    onSuccess: (updated) => {
      if (!updated) return;
      queryClient.setQueryData(queryKeys.requisition(updated.id), updated);
      queryClient.invalidateQueries({ queryKey: queryKeys.requisitions });
      queryClient.invalidateQueries({ queryKey: queryKeys.audit });
      queryClient.invalidateQueries({ queryKey: queryKeys.requisitionAudit(updated.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.approvals });
    },
  });
}

export function useWithdrawRequisition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => actionApi.withdrawRequisition(id, reason),
    onSuccess: (updated) => {
      if (!updated) return;
      queryClient.setQueryData(queryKeys.requisition(updated.id), updated);
      queryClient.invalidateQueries({ queryKey: queryKeys.requisitions });
      queryClient.invalidateQueries({ queryKey: queryKeys.audit });
      queryClient.invalidateQueries({ queryKey: queryKeys.requisitionAudit(updated.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.approvals });
    },
  });
}

export function useRequisitionDocumentUpload() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ requisitionId, file, fieldKey, label }: { requisitionId: string; file: File; fieldKey?: string; label?: string }) =>
      actionApi.uploadRequisitionDocument(requisitionId, { file, fieldKey, label }),
    onSuccess: (_document, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.requisition(variables.requisitionId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.requisitions });
      queryClient.invalidateQueries({ queryKey: queryKeys.audit });
      queryClient.invalidateQueries({ queryKey: queryKeys.requisitionAudit(variables.requisitionId) });
    },
  });
}

export function useTaxonomySubcategories() {
  return useQuery({
    queryKey: [...queryKeys.subcategories, queryKeys.mode],
    queryFn: () => readApi.listTaxonomySubcategories(),
  });
}

export function usePrDynamicFields(subcategoryId?: string) {
  return useQuery<DynamicFieldDef[]>({
    queryKey: [...(subcategoryId ? queryKeys.prDynamicFields(subcategoryId) : ["rules", "pr-dynamic-fields", "none"]), queryKeys.mode],
    queryFn: () => readApi.getPrDynamicFieldDefs(subcategoryId as string),
    enabled: Boolean(subcategoryId),
  });
}

export function usePrFormSchema(subcategoryId?: string) {
  return useQuery<PrFormSchema>({
    queryKey: [...(subcategoryId ? queryKeys.prFormSchema(subcategoryId) : ["taxonomy", "pr-form-schema", "none"]), queryKeys.mode],
    queryFn: () => readApi.getPrFormSchema(subcategoryId as string),
    enabled: Boolean(subcategoryId),
  });
}

export function useLocationSuggestions(query?: string, country?: string, enabled = true) {
  return useQuery<LocationSuggestion[]>({
    queryKey: [...queryKeys.locationSuggestions(query ?? "", country), queryKeys.mode],
    queryFn: () => readApi.getLocationSuggestions(query as string, country) as Promise<LocationSuggestion[]>,
    enabled: enabled && Boolean(query?.trim() && query.trim().length >= 3),
  });
}

export function useSupplierFormTemplates() {
  return useQuery<SupplierFormTemplate[]>({
    queryKey: [...queryKeys.supplierFormTemplates, queryKeys.mode],
    queryFn: () => readApi.listSupplierFormTemplates() as Promise<SupplierFormTemplate[]>,
  });
}

export function useRfqSupplierForms(rfqId: string) {
  return useQuery<RfqSupplierFormAssignment[]>({
    queryKey: [...queryKeys.rfqSupplierForms(rfqId), queryKeys.mode],
    queryFn: () => readApi.listRfqSupplierForms(rfqId) as Promise<RfqSupplierFormAssignment[]>,
    enabled: Boolean(rfqId),
  });
}

export function useSupplierFormAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      type: "create-template" | "attach-rfq-form";
      rfqId?: string;
      templateId?: string;
      name?: string;
      description?: string;
      fields?: Array<{ id?: string; key?: string; label?: string; type?: "TEXT" | "NUMBER" | "DOCUMENT"; required?: boolean }>;
      isRequired?: boolean;
      saveForReuse?: boolean;
      isReusable?: boolean;
    }) => {
      if (payload.type === "create-template") {
        const templateFields = (payload.fields ?? []).map((field) => ({
          id: field.id,
          key: field.key ?? "",
          label: field.label ?? "",
          type: field.type ?? "TEXT",
          required: field.required === true,
        }));
        return actionApi.createSupplierFormTemplate({
          name: payload.name ?? "",
          description: payload.description,
          fields: templateFields,
          isReusable: payload.isReusable,
        });
      }
      return actionApi.attachRfqSupplierForm(payload.rfqId ?? "", {
        templateId: payload.templateId,
        name: payload.name,
        description: payload.description,
        fields: payload.fields,
        isRequired: payload.isRequired,
        saveForReuse: payload.saveForReuse,
      });
    },
    onSuccess: (_res, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.supplierFormTemplates });
      if (variables.rfqId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.rfqSupplierForms(variables.rfqId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.rfq(variables.rfqId) });
      }
    },
  });
}

export function useApprovalTasks() {
  return useQuery({ queryKey: [...queryKeys.approvals, queryKeys.mode], queryFn: readApi.listApprovalTasks });
}

export function useApprovalAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ requisitionId, action, comment }: { requisitionId: string; action: ApprovalAction; comment?: string }) =>
      actionApi.applyApprovalAction(requisitionId, action, comment),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.approvals });
      queryClient.invalidateQueries({ queryKey: queryKeys.requisitions });
      queryClient.invalidateQueries({ queryKey: queryKeys.audit });
      queryClient.invalidateQueries({ queryKey: queryKeys.requisition(variables.requisitionId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.requisitionAudit(variables.requisitionId) });
    },
  });
}

export function useSuppliers() {
  return useQuery({ queryKey: [...queryKeys.suppliers, queryKeys.mode], queryFn: readApi.listSuppliers });
}

export function useSupplier(id: string) {
  return useQuery({ queryKey: [...queryKeys.supplier(id), queryKeys.mode], queryFn: () => readApi.getSupplier(id) });
}

export function useAuditEvents(params?: { entityType?: string; entityId?: string; limit?: number }) {
  return useQuery({
    queryKey: [
      ...(params?.entityId ? queryKeys.requisitionAudit(params.entityId) : queryKeys.audit),
      params?.entityType ?? "",
      params?.limit ?? 100,
      queryKeys.mode,
    ],
    queryFn: () => readApi.listAuditEvents(params),
  });
}

export function useRfqs() {
  return useQuery<Rfq[]>({
    queryKey: [...queryKeys.rfqs, queryKeys.mode],
    queryFn: () => readApi.listRfqsFromAudit() as Promise<Rfq[]>,
  });
}

export function useRfq(id: string) {
  return useQuery<Rfq | null>({
    queryKey: [...queryKeys.rfq(id), queryKeys.mode],
    queryFn: () => readApi.getRfq(id) as Promise<Rfq | null>,
    enabled: Boolean(id),
  });
}

export function useCreateRfq() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      prId: string;
      title: string;
      budgetAmount: number;
      currency: string;
      paymentTerms: string;
      taxIncluded: boolean;
      priceValidityDays: number;
      notes?: string;
    }) => actionApi.createRfq(payload),
    onSuccess: (rfq) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rfqs });
      queryClient.setQueryData(queryKeys.rfq(rfq.id), rfq);
    },
  });
}

export function useRfqAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { type: "add-suppliers" | "release" | "open" | "award" | "close"; rfqId: string; supplierIds?: string[]; bidId?: string; supplierId?: string; overrideReason?: string; reason?: string; releaseMode?: "PRIVATE" | "LOCAL" | "GLOBAL"; localCountryCode?: string }) => {
      if (payload.type === "add-suppliers") return actionApi.addRfqSuppliers(payload.rfqId, payload.supplierIds ?? []);
      if (payload.type === "release") return actionApi.releaseRfq(payload.rfqId, { releaseMode: payload.releaseMode, localCountryCode: payload.localCountryCode });
      if (payload.type === "open") return actionApi.openRfq(payload.rfqId);
      if (payload.type === "award") {
        return actionApi.awardRfq(payload.rfqId, {
          bidId: payload.bidId ?? "",
          supplierId: payload.supplierId ?? "",
          overrideReason: payload.overrideReason ?? "",
        });
      }
      return actionApi.closeRfq(payload.rfqId, payload.reason);
    },
    onSuccess: (rfq) => {
      if (rfq?.id) {
        queryClient.setQueryData(queryKeys.rfq(rfq.id), rfq);
        queryClient.invalidateQueries({ queryKey: queryKeys.rfqs });
        queryClient.invalidateQueries({ queryKey: queryKeys.bidsByRfq(rfq.id) });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.pos });
    },
  });
}

export function useBidsByRfq(rfqId: string) {
  return useQuery<Bid[]>({
    queryKey: [...queryKeys.bidsByRfq(rfqId), queryKeys.mode],
    queryFn: () => readApi.listBidsByRfq(rfqId) as Promise<Bid[]>,
    enabled: Boolean(rfqId),
  });
}

export function useBid(id: string) {
  return useQuery<Bid | null>({
    queryKey: [...queryKeys.bid(id), queryKeys.mode],
    queryFn: () => readApi.getBid(id) as Promise<Bid | null>,
    enabled: Boolean(id),
  });
}

export function useBidAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { type: "upsert" | "submit" | "open" | "evaluate" | "recommend" | "transition"; bidId?: string; rfqId?: string; supplierId?: string; totalBidValue?: number; reason?: string; status?: "SHORTLISTED" | "REJECTED" | "CLOSED" }) => {
      if (payload.type === "upsert") {
        return actionApi.upsertBid({
          rfqId: payload.rfqId ?? "",
          supplierId: payload.supplierId ?? "",
          totalBidValue: payload.totalBidValue,
          currency: "ZAR",
          payload: { compliance: { supplier_documents: true } },
          documents: { proposal: "doc-frontend" },
        });
      }
      if (!payload.bidId) throw new Error("bidId is required");
      if (payload.type === "submit") return actionApi.submitBid(payload.bidId);
      if (payload.type === "open") return actionApi.openBid(payload.bidId);
      if (payload.type === "evaluate") {
        return actionApi.evaluateBid(payload.bidId, {
          criteria: [{ criterion: "PRICE", score: 85, weight: 40 }, { criterion: "COMPLIANCE", score: 90, weight: 60 }],
          summary: "Frontend evaluation pass",
        });
      }
      if (payload.type === "recommend") return actionApi.recommendBid(payload.bidId, payload.reason ?? "Best evaluated response");
      return actionApi.transitionBid(payload.bidId, { status: payload.status ?? "SHORTLISTED", reason: payload.reason });
    },
    onSuccess: (bid) => {
      if (bid?.id) {
        queryClient.setQueryData(queryKeys.bid(bid.id), bid);
        queryClient.invalidateQueries({ queryKey: queryKeys.bidsByRfq(bid.rfqId) });
      }
    },
  });
}

export function usePos() {
  return useQuery<PurchaseOrder[]>({
    queryKey: [...queryKeys.pos, queryKeys.mode],
    queryFn: () => readApi.listPos() as Promise<PurchaseOrder[]>,
  });
}

export function usePo(id: string) {
  return useQuery<PurchaseOrder | null>({
    queryKey: [...queryKeys.po(id), queryKeys.mode],
    queryFn: () => readApi.getPo(id) as Promise<PurchaseOrder | null>,
    enabled: Boolean(id),
  });
}

export function usePoAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      type: "create-from-award" | "release" | "respond" | "close";
      poId?: string;
      awardId?: string;
      terms?: string;
      notes?: string;
      action?: "ACCEPT" | "REQUEST_CHANGE";
      reason?: string;
      proposedTerms?: string;
      requestedBy?: string;
    }) => {
      if (payload.type === "create-from-award") {
        return actionApi.createPoFromAward({
          awardId: payload.awardId ?? "",
          terms: payload.terms,
          notes: payload.notes,
        });
      }
      if (!payload.poId) throw new Error("poId is required");
      if (payload.type === "release") return actionApi.releasePo(payload.poId);
      if (payload.type === "respond") {
        return actionApi.respondPo(payload.poId, {
          action: payload.action ?? "ACCEPT",
          reason: payload.reason,
          proposedTerms: payload.proposedTerms,
          requestedBy: payload.requestedBy,
        });
      }
      return actionApi.closePo(payload.poId, payload.reason);
    },
    onSuccess: (po) => {
      if (po?.id) {
        queryClient.setQueryData(queryKeys.po(po.id), po);
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.pos });
      queryClient.invalidateQueries({ queryKey: queryKeys.audit });
    },
  });
}

export function useInvoices(poId?: string) {
  return useQuery<InvoiceSnapshot[]>({
    queryKey: [...queryKeys.invoices(poId), queryKeys.mode],
    queryFn: () => readApi.listInvoices(poId) as Promise<InvoiceSnapshot[]>,
  });
}

export function usePoValidation(poId: string) {
  return useQuery<PoInvoiceValidation>({
    queryKey: [...queryKeys.poValidation(poId), queryKeys.mode],
    queryFn: () => readApi.validatePoInvoices(poId) as Promise<PoInvoiceValidation>,
    enabled: Boolean(poId),
  });
}

export function useDeliveryNotes(poId: string) {
  return useQuery<DeliveryNote[]>({
    queryKey: [...queryKeys.deliveryNotes(poId), queryKeys.mode],
    queryFn: () => readApi.listDeliveryNotes(poId) as Promise<DeliveryNote[]>,
    enabled: Boolean(poId),
  });
}

export function useLiveInvoices(poId: string) {
  return useQuery<LiveInvoice[]>({
    queryKey: [...queryKeys.liveInvoices(poId), queryKeys.mode],
    queryFn: () => readApi.listLiveInvoices(poId) as Promise<LiveInvoice[]>,
    enabled: Boolean(poId),
  });
}

export function useLiveInvoice(invoiceId: string) {
  return useQuery<LiveInvoice>({
    queryKey: [...queryKeys.liveInvoice(invoiceId), queryKeys.mode],
    queryFn: () => readApi.getLiveInvoice(invoiceId) as Promise<LiveInvoice>,
    enabled: Boolean(invoiceId),
  });
}

export function useFinanceAction() {
  const queryClient = useQueryClient();
  return useMutation<
    unknown,
    Error,
    | {
        type: "sync-snapshot";
        sourceSystem?: "ERP" | "QUICKBOOKS" | "MANUAL";
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
      }
    | {
        type: "create-delivery-note";
        poId: string;
        noteNumber?: string;
        supplierId?: string;
        deliveryDate?: string;
        receivedBy?: string;
        remarks?: string;
        documentUrl?: string;
        file?: File | null;
      }
    | {
        type: "create-supplier-invoice";
        poId: string;
        deliveryNoteId?: string;
        invoiceNumber?: string;
        taxIncluded?: boolean;
        taxRatePercent?: number;
        dueDate?: string;
        notes?: string;
        file?: File | null;
      }
    | {
        type: "create-live-invoice";
        poId: string;
        deliveryNoteId?: string;
        invoiceNumber?: string;
        taxIncluded?: boolean;
        taxRatePercent?: number;
        dueDate?: string;
        notes?: string;
      }
    | {
        type: "submit-live-invoice";
        invoiceId: string;
        notes?: string;
      }
    | {
        type: "review-live-invoice";
        invoiceId: string;
        notes?: string;
      }
    | {
        type: "mark-live-invoice-paid";
        invoiceId: string;
        paymentDate?: string;
        amountPaid?: number;
        paymentReference?: string;
        popUrl?: string;
        notes?: string;
        file?: File | null;
      }
    | {
        type: "upload-signed-invoice";
        invoiceId: string;
        file: File;
      }
    | {
        type: "sign-live-invoice";
        invoiceId: string;
        signerName?: string;
        signerRole?: string;
        signatureHash?: string;
      }
  >({
    mutationFn: (
      payload:
        | {
            type: "sync-snapshot";
            sourceSystem?: "ERP" | "QUICKBOOKS" | "MANUAL";
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
          }
        | {
            type: "create-delivery-note";
            poId: string;
            noteNumber?: string;
            supplierId?: string;
            deliveryDate?: string;
            receivedBy?: string;
            remarks?: string;
            documentUrl?: string;
            file?: File | null;
          }
        | {
            type: "create-supplier-invoice";
            poId: string;
            deliveryNoteId?: string;
            invoiceNumber?: string;
            taxIncluded?: boolean;
            taxRatePercent?: number;
            dueDate?: string;
            notes?: string;
            file?: File | null;
          }
        | {
            type: "create-live-invoice";
            poId: string;
            deliveryNoteId?: string;
            invoiceNumber?: string;
            taxIncluded?: boolean;
            taxRatePercent?: number;
            dueDate?: string;
            notes?: string;
          }
        | {
            type: "submit-live-invoice";
            invoiceId: string;
            notes?: string;
          }
        | {
            type: "review-live-invoice";
            invoiceId: string;
            notes?: string;
          }
        | {
            type: "mark-live-invoice-paid";
            invoiceId: string;
            paymentDate?: string;
            amountPaid?: number;
            paymentReference?: string;
            popUrl?: string;
            notes?: string;
            file?: File | null;
          }
        | {
            type: "upload-signed-invoice";
            invoiceId: string;
            file: File;
          }
        | {
            type: "sign-live-invoice";
            invoiceId: string;
            signerName?: string;
            signerRole?: string;
            signatureHash?: string;
          },
    ) => {
      if (payload.type === "sync-snapshot") {
        return actionApi.syncInvoices({
          sourceSystem: payload.sourceSystem,
          snapshots: payload.snapshots,
        });
      }
      if (payload.type === "create-delivery-note") {
        const { type: _type, poId, ...request } = payload;
        return actionApi.createDeliveryNote(poId, request);
      }
      if (payload.type === "create-supplier-invoice") {
        const { type: _type, poId, ...request } = payload;
        return actionApi.createSupplierInvoice(poId, request);
      }
      if (payload.type === "create-live-invoice") {
        const { type: _type, poId, ...request } = payload;
        return actionApi.createLiveInvoiceFromTemplate(poId, request);
      }
      if (payload.type === "submit-live-invoice") {
        const { type: _type, invoiceId, ...request } = payload;
        return actionApi.submitSupplierInvoice(invoiceId, request);
      }
      if (payload.type === "review-live-invoice") {
        const { type: _type, invoiceId, ...request } = payload;
        return actionApi.reviewLiveInvoice(invoiceId, request);
      }
      if (payload.type === "mark-live-invoice-paid") {
        const { type: _type, invoiceId, ...request } = payload;
        return actionApi.markLiveInvoicePaid(invoiceId, request);
      }
      if (payload.type === "upload-signed-invoice") {
        return actionApi.uploadSignedInvoice(payload.invoiceId, payload.file);
      }
      const { type: _type, invoiceId, ...request } = payload;
      return actionApi.signLiveInvoice(invoiceId, request);
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      if ("poId" in variables && variables.poId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.deliveryNotes(variables.poId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.liveInvoices(variables.poId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.poValidation(variables.poId) });
      }
      if ("invoiceId" in variables && variables.invoiceId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.liveInvoice(variables.invoiceId) });
        queryClient.invalidateQueries({ queryKey: ["finance", "live-invoices"] });
      }
    },
  });
}

export function useProcurementPolicy() {
  return useQuery<ProcurementPolicy>({
    queryKey: [...queryKeys.procurementPolicy, queryKeys.mode],
    queryFn: () => readApi.getProcurementPolicy() as Promise<ProcurementPolicy>,
  });
}

export function useSoDRules() {
  return useQuery<SoDRule[]>({
    queryKey: [...queryKeys.sodRules, queryKeys.mode],
    queryFn: () => readApi.listSoDRules() as Promise<SoDRule[]>,
  });
}

export function usePolicyAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      payload:
        | { type: "update-procurement"; data: Partial<ProcurementPolicy> }
        | { type: "resolve-method"; data: { budgetAmount: number; isEmergency?: boolean; requestedMethod?: string; emergencyJustification?: string } }
        | { type: "upsert-sod"; action: string; data: { allowedRoles?: string[]; blockedRoles?: string[]; isActive?: boolean } },
    ) => {
      if (payload.type === "update-procurement") return actionApi.updateProcurementPolicy(payload.data);
      if (payload.type === "resolve-method") return readApi.resolveProcurementMethod(payload.data);
      if (payload.type === "upsert-sod") return actionApi.upsertSoDRule(payload.action, payload.data);
      throw new Error("Unsupported policy action");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.procurementPolicy });
      queryClient.invalidateQueries({ queryKey: queryKeys.sodRules });
    },
  });
}

export function useCoi(rfqId: string) {
  return useQuery<CoiDeclaration[]>({
    queryKey: [...queryKeys.coi(rfqId), queryKeys.mode],
    queryFn: () => readApi.listCoi(rfqId) as Promise<CoiDeclaration[]>,
    enabled: Boolean(rfqId),
  });
}

export function useComplianceAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { type: "declare" | "review"; rfqId?: string; declarationId?: string; reason?: string; supplierId?: string; decision?: "APPROVED" | "BLOCKED"; reviewNotes?: string }) => {
      if (payload.type === "declare") {
        if (!payload.rfqId || !payload.reason) throw new Error("rfqId and reason required");
        return actionApi.declareCoi(payload.rfqId, { reason: payload.reason, supplierId: payload.supplierId });
      }
      if (!payload.declarationId || !payload.decision) throw new Error("declarationId and decision required");
      return actionApi.reviewCoi(payload.declarationId, { decision: payload.decision, reviewNotes: payload.reviewNotes });
    },
    onSuccess: (_result, variables) => {
      if (variables.rfqId) queryClient.invalidateQueries({ queryKey: queryKeys.coi(variables.rfqId) });
    },
  });
}

export function useGovernanceExports() {
  return useQuery<GovernanceExportRecord[]>({
    queryKey: [...queryKeys.governanceExports, queryKeys.mode],
    queryFn: () => readApi.listGovernanceExports() as Promise<GovernanceExportRecord[]>,
  });
}

export function useRetentionPolicy() {
  return useQuery<RetentionPolicy>({
    queryKey: [...queryKeys.retentionPolicy, queryKeys.mode],
    queryFn: () => readApi.getRetentionPolicy() as Promise<RetentionPolicy>,
  });
}

export function useRetentionRuns() {
  return useQuery<RetentionRunLog[]>({
    queryKey: [...queryKeys.retentionRuns, queryKeys.mode],
    queryFn: () => readApi.listRetentionRuns() as Promise<RetentionRunLog[]>,
  });
}

export function useAuditEvidence() {
  return useQuery<AuditEvidenceResult>({
    queryKey: [...queryKeys.auditEvidence, queryKeys.mode],
    queryFn: () => readApi.verifyAuditEvidence() as Promise<AuditEvidenceResult>,
  });
}

export function useGovernanceAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { type: "generate-export" | "update-retention" | "run-retention"; exportType?: string; format?: "CSV" | "PDF"; retention?: Partial<RetentionPolicy>; dryRun?: boolean }) => {
      if (payload.type === "generate-export") {
        return actionApi.generateGovernanceExport(payload.exportType ?? "TENDER_REGISTER", payload.format ?? "CSV") as Promise<GovernanceGeneratedExport>;
      }
      if (payload.type === "update-retention") {
        return actionApi.updateRetentionPolicy(payload.retention ?? {});
      }
      return actionApi.runRetention(payload.dryRun ?? true);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.governanceExports });
      queryClient.invalidateQueries({ queryKey: queryKeys.retentionPolicy });
      queryClient.invalidateQueries({ queryKey: queryKeys.retentionRuns });
      queryClient.invalidateQueries({ queryKey: queryKeys.auditEvidence });
    },
  });
}
