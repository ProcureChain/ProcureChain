"use client";

import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useQueries } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRight, ClipboardList, Layers3, ListChecks } from "lucide-react";

import { ApiErrorAlert } from "@/components/common/api-error-alert";
import { LocationAutocompleteField } from "@/components/forms/location-autocomplete-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatDomainLabel } from "@/lib/format";
import { runtimeConfig } from "@/lib/runtime-config";
import { useAuditEvents, useCreateCustomTaxonomySubcategory, useCreateDraftRequisition, useOrganizationAdminSettings, usePrFormSchema, useRequisition, useRequisitionDocumentUpload, useSubmitDraftRequisition, useTaxonomySubcategories, useUpdateRequisition } from "@/lib/query-hooks";
import { LocationSuggestion, PrFormSchemaField } from "@/lib/types";
import * as liveApi from "@/lib/api/live-api";
import * as mockApi from "@/lib/api/mock-api";

const lineSchema = z.object({
  subcategoryId: z.string().min(1, "Level 3 subcategory is required"),
  description: z.string().min(2, "Description required"),
  quantity: z.number().min(1),
  uom: z.string().optional(),
});

const schema = z.object({
  title: z.string().min(3, "Title is required"),
  department: z.string().min(2),
  costCenter: z.string().min(2),
  neededBy: z.string().optional(),
  justification: z.string().min(10),
  metadata: z.record(z.string(), z.unknown()),
  lines: z.array(lineSchema).min(1, "At least one line item is required"),
});

type FormValues = z.infer<typeof schema>;

function isMissing(value: unknown) {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function fieldInput(def: PrFormSchemaField) {
  if (def.inputType === "file") return "file";
  if (def.inputType === "textarea") return "textarea";
  if (def.inputType === "checkbox") return "checkbox";
  if (def.inputType === "select") return "select";
  if (def.inputType === "milestones") return "milestones";
  return "input";
}

function isLocationAutocompleteField(def: PrFormSchemaField) {
  return /(location|address|city|town|municipality|province|state|region|postal_code|postcode|zip_code|country(?:_code)?)/i.test(
    `${def.key} ${def.path} ${def.label}`,
  );
}

function formatDynamicValue(value: unknown) {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) {
    if (value.every((item) => typeof item === "object" && item && "text" in item && "date" in item)) {
      return value
        .map((item) => {
          const milestone = item as { text?: string; date?: string };
          return [milestone.text, milestone.date].filter(Boolean).join(" - ");
        })
        .join("\n");
    }
    return value.join(", ");
  }
  if (value && typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function WizardHero({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section className="overflow-hidden rounded-[32px] border border-[var(--border)] bg-[linear-gradient(135deg,#2D334A_0%,#444A74_100%)] text-white shadow-[var(--shadow-lg)]">
      <div className="px-6 py-7 lg:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/65">Purchase Requisition</p>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-white">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#E1E7FF]">{description}</p>
      </div>
    </section>
  );
}

function StepChip({
  number,
  title,
  active,
  complete,
}: {
  number: number;
  title: string;
  active: boolean;
  complete: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border px-4 py-3 ${
        active
          ? "border-[var(--primary)] bg-[var(--portal-org-bg)]"
          : complete
            ? "border-[var(--border)] bg-[var(--surface-muted)]"
            : "border-[var(--border)] bg-white"
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold ${
            active
              ? "bg-[var(--primary)] text-white"
              : complete
                ? "bg-[var(--secondary)] text-white"
                : "bg-[var(--surface-muted)] text-[var(--text-secondary)]"
          }`}
        >
          {number}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Step {number}</p>
          <p className="text-sm font-semibold text-[var(--text-primary)]">{title}</p>
        </div>
      </div>
    </div>
  );
}

export default function NewRequisitionPage() {
  const [editId, setEditId] = useState<string | null>(null);
  const [editSource, setEditSource] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [isPrefilled, setIsPrefilled] = useState(false);
  const [syncCategoryFieldsToFirstLine, setSyncCategoryFieldsToFirstLine] = useState(true);
  const [selectedLevel1, setSelectedLevel1] = useState("");
  const [selectedLevel2, setSelectedLevel2] = useState("");
  const [customLevel3Name, setCustomLevel3Name] = useState("");
  const [showCreateLevel3Inline, setShowCreateLevel3Inline] = useState(false);
  const [dynamicDocumentFiles, setDynamicDocumentFiles] = useState<Record<string, File | null>>({});
  const [lineDynamicValues, setLineDynamicValues] = useState<Record<number, Record<string, unknown>>>({});
  const [lineDynamicDocumentFiles, setLineDynamicDocumentFiles] = useState<Record<number, Record<string, File | null>>>(
    {},
  );
  const [activeLineDynamicIndex, setActiveLineDynamicIndex] = useState<number | null>(null);
  const router = useRouter();
  const createDraftReq = useCreateDraftRequisition();
  const updateReq = useUpdateRequisition();
  const submitDraftReq = useSubmitDraftRequisition();
  const uploadDocument = useRequisitionDocumentUpload();
  const subcategories = useTaxonomySubcategories();
  const createCustomSubcategory = useCreateCustomTaxonomySubcategory();
  const existingReq = useRequisition(editId ?? "");
  const organizationAdminSettings = useOrganizationAdminSettings();
  const { data: existingAudit = [] } = useAuditEvents(
    editId ? { entityType: "PurchaseRequisition", entityId: editId, limit: 50 } : undefined,
  );
  const isApprovedEdit = existingReq.data?.status === "APPROVED";

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setEditId(params.get("edit"));
    setEditSource(params.get("source"));
  }, []);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      department: "",
      costCenter: "",
      neededBy: "",
      justification: "",
      metadata: {},
      lines: [{ subcategoryId: "", description: "", quantity: 1, uom: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "lines" });
  const lines = form.watch("lines");
  const selectedSubcategoryId = form.watch("lines.0.subcategoryId");
  const allSubcategories = subcategories.data ?? [];
  const formSchemaQuery = usePrFormSchema(selectedSubcategoryId || undefined);
  const activeFormSchema =
    formSchemaQuery.data &&
    selectedSubcategoryId &&
    (formSchemaQuery.data.requestedSubcategoryId === selectedSubcategoryId ||
      formSchemaQuery.data.resolvedSubcategoryId === selectedSubcategoryId ||
      formSchemaQuery.data.subcategory.id === selectedSubcategoryId)
      ? formSchemaQuery.data
      : null;
  const lineBindings = activeFormSchema?.lineBindings;
  const uomPolicy = activeFormSchema?.uomPolicy ?? null;
  const neededByMetadataPaths = activeFormSchema?.coreFieldBindings?.neededBy ?? [];
  const dynamicFields = (activeFormSchema?.sections.find((s) => s.id === "subcategory")?.fields ?? [])
    .filter((f) => f.path.startsWith("metadata."));
  const dynamicFieldKeys = useMemo(() => new Set(dynamicFields.map((field) => field.key)), [dynamicFields]);
  const existingDocuments = existingReq.data?.attachments ?? [];
  const requiredDocumentFields = dynamicFields.filter((field) => field.inputType === "file" && field.required);
  const latestReturnedAudit = useMemo(
    () => existingAudit.find((event) => event.action === "PR_INFO_REQUESTED"),
    [existingAudit],
  );
  const pendingRequiredDocumentCount = useMemo(
    () => {
      let pending = 0;
      for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
        for (const field of requiredDocumentFields) {
          const hasDocument =
            Boolean(lineDynamicDocumentFiles[lineIndex]?.[field.key]) ||
            existingDocuments.some((document) => document.fieldKey === `line_${lineIndex + 1}_${field.key}`);
          if (!hasDocument) pending += 1;
        }
      }
      return pending;
    },
    [existingDocuments, lineDynamicDocumentFiles, lines.length, requiredDocumentFields],
  );
  const uomFieldKey = useMemo(() => {
    if (!uomPolicy?.fieldPath?.startsWith("metadata.")) return null;
    return uomPolicy.fieldPath.slice("metadata.".length);
  }, [uomPolicy]);
  const uomOptions = uomPolicy?.options ?? [];
  const selectedMetadataUom = uomFieldKey ? String(form.watch(`metadata.${uomFieldKey}` as any) ?? "") : "";
  const resolvedLineUom = selectedMetadataUom || uomPolicy?.defaultValue || "";
  const hasCategoryLineBridgeFields = Boolean(
    (lineBindings?.description?.length ?? 0) ||
      (lineBindings?.quantity?.length ?? 0) ||
      (lineBindings?.uom?.length ?? 0),
  );
  const metadataErrors = ((form.formState.errors as Record<string, unknown>).metadata ?? {}) as Record<string, { message?: string }>;
  const departmentOptions = useMemo(
    () =>
      organizationAdminSettings.data?.settings.departments?.filter((department) => department.isActive).map((department) => department.name) ??
      runtimeConfig.companyDepartments,
    [organizationAdminSettings.data?.settings.departments],
  );
  const costCentreOptions = useMemo(
    () =>
      organizationAdminSettings.data?.settings.costCentres?.filter((costCentre) => costCentre.isActive).map((costCentre) => costCentre.code) ??
      runtimeConfig.companyCostCentres,
    [organizationAdminSettings.data?.settings.costCentres],
  );

  const level1Options = useMemo(
    () => [...new Set(allSubcategories.map((s) => s.level1))].sort((a, b) => formatDomainLabel(a).localeCompare(formatDomainLabel(b))),
    [allSubcategories],
  );
  const level2Options = useMemo(
    () =>
      [...new Set(allSubcategories.filter((s) => s.level1 === selectedLevel1).map((s) => s.level2))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [allSubcategories, selectedLevel1],
  );
  const level3Options = useMemo(
    () =>
      allSubcategories
        .filter((s) => s.level1 === selectedLevel1 && s.level2 === selectedLevel2)
        .sort((a, b) => a.level3.localeCompare(b.level3)),
    [allSubcategories, selectedLevel1, selectedLevel2],
  );
  const selectedSubcategory = useMemo(
    () => allSubcategories.find((subcategory) => subcategory.id === selectedSubcategoryId) ?? null,
    [allSubcategories, selectedSubcategoryId],
  );
  const lineSubcategoryIds = useMemo(() => lines.map((line) => line.subcategoryId || ""), [lines]);
  const lineFormSchemas = useQueries({
    queries: lineSubcategoryIds.map((subcategoryId) => ({
      queryKey: ["taxonomy", "pr-form-schema", subcategoryId, runtimeConfig.useMockApi ? "mock" : "live"],
      queryFn: () =>
        runtimeConfig.useMockApi
          ? mockApi.getPrFormSchema(subcategoryId)
          : liveApi.getPrFormSchema(subcategoryId),
      enabled: Boolean(subcategoryId),
      staleTime: 5 * 60 * 1000,
    })),
  });
  const populatedDynamicFields = useMemo(
    () =>
      dynamicFields.filter((def) => !isMissing(form.getValues(`metadata.${def.key}` as any))).map((def) => ({
        ...def,
        value: form.getValues(`metadata.${def.key}` as any),
      })),
    [dynamicFields, form],
  );

  const populateLineDynamicFromMetadata = (metadata: Record<string, unknown> | null | undefined) => {
    if (!metadata || typeof metadata !== "object") return;
    const raw = (metadata as Record<string, unknown>).lineDynamicDetails;
    if (!Array.isArray(raw)) return;
    const mapped: Record<number, Record<string, unknown>> = {};
    raw.forEach((entry, idx) => {
      if (entry && typeof entry === "object") mapped[idx] = entry as Record<string, unknown>;
    });
    setLineDynamicValues(mapped);
  };

  useEffect(() => {
    if (!selectedSubcategoryId || allSubcategories.length === 0) return;
    const selected = allSubcategories.find((s) => s.id === selectedSubcategoryId);
    if (!selected) return;
    if (!selectedLevel1) setSelectedLevel1(selected.level1);
    if (!selectedLevel2) setSelectedLevel2(selected.level2);
  }, [selectedSubcategoryId, allSubcategories, selectedLevel1, selectedLevel2]);

  useEffect(() => {
    if (!editId || !existingReq.data || isPrefilled) return;
    const existing = existingReq.data;
    form.reset({
      title: existing.title,
      department: existing.department,
      costCenter: existing.costCenter,
      neededBy: existing.neededBy ?? "",
      justification: existing.justification ?? "",
      metadata: (existing.metadata as Record<string, unknown>) ?? {},
      lines:
        existing.lineItems.length > 0
          ? existing.lineItems.map((line) => ({
              subcategoryId: line.subcategoryId ?? existing.subcategoryId ?? "",
              description: line.description,
              quantity: line.quantity,
              uom: line.uom ?? "",
            }))
          : [{ subcategoryId: existing.subcategoryId ?? "", description: "", quantity: 1, uom: "" }],
    });

    const selected = allSubcategories.find((s) => s.id === existing.subcategoryId);
    if (selected) {
      setSelectedLevel1(selected.level1);
      setSelectedLevel2(selected.level2);
    }
    populateLineDynamicFromMetadata((existing.metadata as Record<string, unknown>) ?? {});
    setIsPrefilled(true);
  }, [allSubcategories, editId, existingReq.data, form, isPrefilled]);

  useEffect(() => {
      form.setValue("lines.0.uom", "", { shouldDirty: false });
  }, [form, selectedSubcategoryId]);

  useEffect(() => {
    if (!uomFieldKey) return;
    const currentValue = String(form.getValues(`metadata.${uomFieldKey}` as any) ?? "").trim();
    const preferredValue = currentValue || uomPolicy?.defaultValue || (uomOptions.length === 1 ? uomOptions[0] : "");
    if (preferredValue && preferredValue !== currentValue) {
      form.setValue(`metadata.${uomFieldKey}` as any, preferredValue, { shouldDirty: false });
    }
    if (preferredValue) {
      form.setValue("lines.0.uom", preferredValue, { shouldDirty: false });
    }
  }, [form, uomFieldKey, uomOptions, uomPolicy?.defaultValue]);

  const toPositiveNumber = (value: unknown) => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  const getValueByPath = (path: string) => form.getValues(path as any);

  const firstDefinedValue = (paths: string[] | undefined) => {
    if (!paths || paths.length === 0) return undefined;
    for (const p of paths) {
      const v = getValueByPath(p);
      if (!isMissing(v)) return v;
    }
    return undefined;
  };

  const deriveLineFromMetadata = () => {
    const description = String(firstDefinedValue(lineBindings?.description) ?? "").trim();
    const qty = toPositiveNumber(firstDefinedValue(lineBindings?.quantity)) ?? 1;
    const uom = resolvedLineUom || String(firstDefinedValue(lineBindings?.uom) ?? "").trim();
    return { subcategoryId: selectedSubcategoryId ?? "", description, quantity: qty, uom };
  };

  const applyDynamicToFirstLine = () => {
    if (!syncCategoryFieldsToFirstLine) return;
    const description = String(firstDefinedValue(lineBindings?.description) ?? "").trim();
    const qty = toPositiveNumber(firstDefinedValue(lineBindings?.quantity));
    const uom = resolvedLineUom || String(firstDefinedValue(lineBindings?.uom) ?? "").trim();

    if (description) form.setValue("lines.0.description", description, { shouldDirty: true });
    if (qty != null) form.setValue("lines.0.quantity", qty, { shouldDirty: true });
    if (uom) form.setValue("lines.0.uom", uom, { shouldDirty: true });
  };

  const createCustomLevel3Category = async () => {
    if (!selectedLevel1 || !selectedLevel2) {
      toast.error("Select level 1 and level 2 first");
      return;
    }
    const level3 = customLevel3Name.trim();
    if (!level3) {
      toast.error("Enter a level 3 category name");
      return;
    }

    try {
      const created = await createCustomSubcategory.mutateAsync({
        level1: selectedLevel1,
        level2: selectedLevel2,
        level3,
        baseSubcategoryId: level3Options[0]?.id,
      });
      form.setValue("lines.0.subcategoryId", created.id, { shouldDirty: true, shouldValidate: true });
      form.setValue("metadata", {});
      form.clearErrors(["lines.0.subcategoryId", "metadata"]);
      setCustomLevel3Name("");
      setShowCreateLevel3Inline(false);
      toast.success("Custom level 3 category created");
    } catch (error) {
      console.error(error);
      toast.error("Could not create custom level 3 category");
    }
  };

  const syncNeededByToMetadata = (value: string) => {
    for (const path of neededByMetadataPaths) {
      form.setValue(path as any, value, { shouldDirty: true });
      form.clearErrors(path as any);
    }
  };

  const applyLocationSuggestion = (fieldKey: string, suggestion: LocationSuggestion) => {
    const setMetadataIfPresent = (keys: string[], value?: string) => {
      if (!value) return;
      const targetKey = keys.find((key) => dynamicFieldKeys.has(key));
      if (!targetKey) return;
      form.setValue(`metadata.${targetKey}` as any, value, { shouldDirty: true });
      form.clearErrors(`metadata.${targetKey}` as any);
    };

    form.setValue(`metadata.${fieldKey}` as any, suggestion.label, { shouldDirty: true });
    form.clearErrors(`metadata.${fieldKey}` as any);

    setMetadataIfPresent(["address1", "address_line1", "site_address", "street_address"], suggestion.address.line1);
    setMetadataIfPresent(["city", "town", "municipality"], suggestion.address.city);
    setMetadataIfPresent(["province", "state", "region"], suggestion.address.province);
    setMetadataIfPresent(["postal_code", "postcode", "zip_code"], suggestion.address.postalCode);
    setMetadataIfPresent(["country"], suggestion.address.country);
    setMetadataIfPresent(["country_code"], suggestion.address.countryCode);
    setMetadataIfPresent(["latitude", "lat"], String(suggestion.lat));
    setMetadataIfPresent(["longitude", "lng", "lon"], String(suggestion.lng));
  };

  const hasExistingDocumentForField = (fieldKey: string) =>
    existingDocuments.some((document) => document.fieldKey === fieldKey);

  const withLineDynamicMetadata = (metadata: Record<string, unknown>) => ({
    ...metadata,
    lineDynamicDetails: form.getValues("lines").map((_, lineIndex) => lineDynamicValues[lineIndex] ?? {}),
  });

  const uploadPendingDocuments = async (requisitionId: string) => {
    for (const [fieldKey, file] of Object.entries(dynamicDocumentFiles)) {
      if (!file) continue;
      const definition = dynamicFields.find((field) => field.key === fieldKey);
      await uploadDocument.mutateAsync({
        requisitionId,
        file,
        fieldKey,
        label: definition?.label ?? fieldKey,
      });
    }

    for (const [lineIndexRaw, docs] of Object.entries(lineDynamicDocumentFiles)) {
      const lineIndex = Number(lineIndexRaw);
      for (const [fieldKey, file] of Object.entries(docs ?? {})) {
        if (!file) continue;
        const definition = dynamicFields.find((field) => field.key === fieldKey);
        await uploadDocument.mutateAsync({
          requisitionId,
          file,
          fieldKey: `line_${lineIndex + 1}_${fieldKey}`,
          label: `Line ${lineIndex + 1}: ${definition?.label ?? fieldKey}`,
        });
      }
    }
  };

  const saveDraftPartial = async () => {
    const values = form.getValues();
    if (!values.title.trim()) {
      toast.error("Title is required to save a draft.");
      return;
    }

    const lineItems = (values.lines ?? [])
      .filter((line) => line.description.trim().length > 0 && Number(line.quantity) > 0)
      .map((line, index) => ({
        id: `line-${index + 1}`,
        subcategoryId: line.subcategoryId,
        description: line.description,
        quantity: line.quantity,
        uom: line.uom,
        metadata: lineDynamicValues[index] ?? {},
      }));

    if (editId) {
      const updated = await updateReq.mutateAsync({
        id: editId,
        title: values.title,
        department: values.department,
        costCenter: values.costCenter,
        justification: values.justification,
        currency: "ZAR",
        subcategoryId: values.lines[0]?.subcategoryId || undefined,
        metadata: withLineDynamicMetadata(values.metadata as Record<string, unknown>),
        lineItems,
        editSource: editSource === "rfq" ? "RFQ" : undefined,
        validateRequired: isApprovedEdit,
      });
      if (!updated) return;
      await uploadPendingDocuments(updated.id);
      toast.success(isApprovedEdit ? "PR changes saved" : "Draft requisition updated", {
        description: `${updated.prNumber} has been saved.`,
      });
      router.push(`/requisitions/${updated.id}`);
      return;
    }

    const created = await createDraftReq.mutateAsync({
      title: values.title,
      department: values.department,
      costCenter: values.costCenter,
      justification: values.justification,
      currency: "ZAR",
      subcategoryId: values.lines[0]?.subcategoryId || undefined,
      metadata: withLineDynamicMetadata(values.metadata as Record<string, unknown>),
      lineItems,
    });
    await uploadPendingDocuments(created.id);
    toast.success("Draft requisition saved", { description: `${created.prNumber} is ready to resume later.` });
    router.push(`/requisitions/${created.id}`);
  };

  const validateDynamicMetadata = () => {
    let ok = true;
    for (let lineIndex = 0; lineIndex < fields.length; lineIndex += 1) {
      const schemaForLine = lineFormSchemas[lineIndex]?.data;
      const lineFields =
        (schemaForLine?.sections.find((section) => section.id === "subcategory")?.fields ?? [])
          .filter((field) => field.path.startsWith("metadata."))
          .filter((field) => {
            const bound = new Set(
              [
                ...(schemaForLine?.lineBindings?.description ?? []),
                ...(schemaForLine?.lineBindings?.quantity ?? []),
                ...(schemaForLine?.lineBindings?.uom ?? []),
              ]
                .filter((path) => path.startsWith("metadata."))
                .map((path) => path.slice("metadata.".length)),
            );
            return !bound.has(field.key);
          });
      for (const def of lineFields) {
        if (!def.required) continue;
        if (def.inputType === "file") {
          const hasDocument =
            Boolean(lineDynamicDocumentFiles[lineIndex]?.[def.key]) ||
            existingDocuments.some((document) => document.fieldKey === `line_${lineIndex + 1}_${def.key}`);
          if (!hasDocument) ok = false;
          continue;
        }
        const value = lineDynamicValues[lineIndex]?.[def.key];
        if (isMissing(value)) {
          ok = false;
        }
      }
    }
    if (!ok) {
      toast.error("Complete required dynamic details for each line item.");
    }
    return ok;
  };

  const nextStep = async () => {
    if (step === 1) {
      const staticValid = await form.trigger([
        "title",
        "department",
        "costCenter",
        ...(neededByMetadataPaths.length > 0 ? (["neededBy"] as const) : []),
        "justification",
      ]);
      if (neededByMetadataPaths.length > 0 && isMissing(form.getValues("neededBy"))) {
        form.setError("neededBy", { type: "required", message: "Needed By is required" });
      } else {
        form.clearErrors("neededBy");
      }
      if (!staticValid || (neededByMetadataPaths.length > 0 && isMissing(form.getValues("neededBy")))) return;
    }
    if (step === 2) {
      const linesValid = await form.trigger("lines");
      const dynamicValid = validateDynamicMetadata();
      if (!linesValid || !dynamicValid) return;
    }
    setStep((s) => Math.min(3, s + 1));
  };

  const submitRequisition = form.handleSubmit(async (values) => {
    syncNeededByToMetadata(values.neededBy ?? "");
    if (!validateDynamicMetadata()) {
      setStep(2);
      return;
    }
    const lineItems = values.lines.map((line, i) => ({
      id: `line-${i + 1}`,
      subcategoryId: line.subcategoryId,
      description: line.description,
      quantity: line.quantity,
      uom: line.uom,
      metadata: lineDynamicValues[i] ?? {},
    }));

    if (editId) {
      const updated = await updateReq.mutateAsync({
        id: editId,
        title: values.title,
        department: values.department,
        costCenter: values.costCenter,
        justification: values.justification,
        currency: "ZAR",
        subcategoryId: values.lines[0]?.subcategoryId || undefined,
        metadata: withLineDynamicMetadata(values.metadata as Record<string, unknown>),
        lineItems,
        editSource: editSource === "rfq" ? "RFQ" : undefined,
        validateRequired: isApprovedEdit,
      });
      if (!updated) return;
      await uploadPendingDocuments(updated.id);
      toast.success("Requisition updated", { description: `${updated.prNumber} has been saved.` });
      router.push(`/requisitions/${updated.id}`);
      return;
    }

    const created = await createDraftReq.mutateAsync({
      title: values.title,
      department: values.department,
      costCenter: values.costCenter,
      justification: values.justification,
      currency: "ZAR",
      subcategoryId: values.lines[0]?.subcategoryId || undefined,
      metadata: withLineDynamicMetadata(values.metadata as Record<string, unknown>),
      lineItems,
    });
    await uploadPendingDocuments(created.id);
    const submitted = await submitDraftReq.mutateAsync(created.id);
    if (!submitted) return;
    toast.success("Requisition submitted", { description: `${submitted.prNumber} has been submitted.` });
    router.push(`/requisitions/${submitted.id}`);
  });

  const saveDraft = form.handleSubmit(async (values) => {
    syncNeededByToMetadata(values.neededBy ?? "");
    const lineItems = values.lines.map((line, i) => ({
      id: `line-${i + 1}`,
      subcategoryId: line.subcategoryId,
      description: line.description,
      quantity: line.quantity,
      uom: line.uom,
      metadata: lineDynamicValues[i] ?? {},
    }));
    if (editId) {
      const updated = await updateReq.mutateAsync({
        id: editId,
        title: values.title,
        department: values.department,
        costCenter: values.costCenter,
        justification: values.justification,
        currency: "ZAR",
        subcategoryId: values.lines[0]?.subcategoryId || undefined,
        metadata: withLineDynamicMetadata(values.metadata as Record<string, unknown>),
        lineItems,
        editSource: editSource === "rfq" ? "RFQ" : undefined,
        validateRequired: isApprovedEdit,
      });
      if (!updated) return;
      await uploadPendingDocuments(updated.id);
      toast.success(isApprovedEdit ? "PR changes saved" : "Draft requisition updated", {
        description: `${updated.prNumber} has been saved.`,
      });
      router.push(`/requisitions/${updated.id}`);
      return;
    }

    const created = await createDraftReq.mutateAsync({
      title: values.title,
      department: values.department,
      costCenter: values.costCenter,
      justification: values.justification,
      currency: "ZAR",
      subcategoryId: values.lines[0]?.subcategoryId || undefined,
      metadata: withLineDynamicMetadata(values.metadata as Record<string, unknown>),
      lineItems,
    });
    await uploadPendingDocuments(created.id);
    toast.success("Draft requisition saved", { description: `${created.prNumber} is ready to resume later.` });
    router.push(`/requisitions/${created.id}`);
  });

  const submitEditedDraft = form.handleSubmit(async (values) => {
    if (!editId) return;
    syncNeededByToMetadata(values.neededBy ?? "");
    if (!validateDynamicMetadata()) {
      setStep(2);
      return;
    }
    const lineItems = values.lines.map((line, i) => ({
      id: `line-${i + 1}`,
      subcategoryId: line.subcategoryId,
      description: line.description,
      quantity: line.quantity,
      uom: line.uom,
      metadata: lineDynamicValues[i] ?? {},
    }));
    const updated = await updateReq.mutateAsync({
      id: editId,
      title: values.title,
      department: values.department,
      costCenter: values.costCenter,
      justification: values.justification,
      currency: "ZAR",
      subcategoryId: values.lines[0]?.subcategoryId || undefined,
      metadata: withLineDynamicMetadata(values.metadata as Record<string, unknown>),
      lineItems,
      editSource: editSource === "rfq" ? "RFQ" : undefined,
      validateRequired: false,
    });
    if (!updated) return;
    await uploadPendingDocuments(updated.id);
    const submitted = await submitDraftReq.mutateAsync(updated.id);
    if (!submitted) return;
    toast.success("Requisition submitted", { description: `${submitted.prNumber} has been submitted.` });
    router.push(`/requisitions/${submitted.id}`);
  });

  return (
    <div className="space-y-6">
      <WizardHero
        title={editId ? "Edit Requisition" : "Create Requisition"}
        description={
          editId
            ? editSource === "rfq"
              ? "Resume the PR wizard from RFQ. Saved changes remain tracked in audit and RFQ visibility."
              : "Resume the full PR wizard with the saved draft state."
            : "Three-step guided submission with policy-safe defaults and live document checks."
        }
      />
      {existingReq.error ? <ApiErrorAlert error={existingReq.error} /> : null}
      {subcategories.error ? <ApiErrorAlert error={subcategories.error} /> : null}
      {formSchemaQuery.error ? <ApiErrorAlert error={formSchemaQuery.error} /> : null}
      {createDraftReq.error ? <ApiErrorAlert error={createDraftReq.error} /> : null}
      {updateReq.error ? <ApiErrorAlert error={updateReq.error} /> : null}
      {submitDraftReq.error ? <ApiErrorAlert error={submitDraftReq.error} /> : null}
      {uploadDocument.error ? <ApiErrorAlert error={uploadDocument.error} /> : null}
      {subcategories.isLoading ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 shadow-[var(--shadow-sm)]">Loading category taxonomy...</div>
      ) : null}
      {editId && existingReq.isLoading ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 shadow-[var(--shadow-sm)]">Loading draft requisition...</div>
      ) : null}
      {existingReq.data?.status === "RETURNED" ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">This PR was returned for more information.</p>
          <p className="mt-1">
            {typeof latestReturnedAudit?.after?.reason === "string"
              ? latestReturnedAudit.after.reason
              : "Update the requisition, then resubmit it for review."}
          </p>
        </div>
      ) : null}
      {existingReq.data?.editedAfterApprovalAt ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          <p className="font-medium">This approved PR has already been edited.</p>
          <p className="mt-1">Changes remain approved, but they are tracked in audit and shown in RFQ with an Edited badge.</p>
        </div>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-3">
        <StepChip number={1} title="Requisition Basics" active={step === 1} complete={step > 1} />
        <StepChip number={2} title="Line Items" active={step === 2} complete={step > 2} />
        <StepChip number={3} title="Review & Submit" active={step === 3} complete={false} />
      </section>

      <Card className="rounded-3xl border-[var(--border)] bg-white shadow-[var(--shadow-sm)]">
        <CardHeader className="border-b border-[var(--border)] pb-4">
          <CardTitle className="flex items-center gap-2 text-[var(--text-primary)]">
            {step === 1 ? <Layers3 className="h-5 w-5 text-[var(--secondary)]" /> : step === 2 ? <ListChecks className="h-5 w-5 text-[var(--secondary)]" /> : <ClipboardList className="h-5 w-5 text-[var(--secondary)]" />}
            Step {step} of 3
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              className="space-y-6"
              onSubmit={(event) => {
                event.preventDefault();
              }}
            >
              {step === 1 && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="md:col-span-2 grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs text-slate-600">Domain (Level 1)</label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                        value={selectedLevel1}
                        onChange={(event) => {
                          setSelectedLevel1(event.target.value);
                          setSelectedLevel2("");
                          setShowCreateLevel3Inline(false);
                        }}
                      >
                        <option value="">Select domain</option>
                        {level1Options.map((level1) => (
                          <option key={level1} value={level1}>
                            {formatDomainLabel(level1)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-slate-600">Level 2</label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background disabled:opacity-50"
                        value={selectedLevel2}
                        disabled={!selectedLevel1}
                        onChange={(event) => setSelectedLevel2(event.target.value)}
                      >
                        <option value="">{selectedLevel1 ? "Select level 2" : "Select domain first"}</option>
                        {level2Options.map((level2) => (
                          <option key={level2} value={level2}>
                            {level2}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="department"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Department</FormLabel>
                        <FormControl>
                          <select
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                            value={field.value}
                            onChange={(event) => field.onChange(event.target.value)}
                          >
                            <option value="">Select department</option>
                            {departmentOptions.map((department) => (
                              <option key={department} value={department}>
                                {department}
                              </option>
                            ))}
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="costCenter"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cost center</FormLabel>
                        <FormControl>
                          <select
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                            value={field.value}
                            onChange={(event) => field.onChange(event.target.value)}
                          >
                            <option value="">Select cost centre</option>
                            {costCentreOptions.map((costCentre) => (
                              <option key={costCentre} value={costCentre}>
                                {costCentre}
                              </option>
                            ))}
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="neededBy"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Needed by</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            {...field}
                            onChange={(event) => {
                              field.onChange(event.target.value);
                              syncNeededByToMetadata(event.target.value);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="md:col-span-2">
                    <FormField
                      control={form.control}
                      name="justification"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Justification</FormLabel>
                          <FormControl>
                            <Textarea rows={4} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                </div>
              )}

              {step === 2 && (
                <div className="space-y-3">
                  {requiredDocumentFields.length > 0 ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                      <p className="font-medium">Document check</p>
                      <p className="mt-1">
                        {pendingRequiredDocumentCount > 0
                          ? `${pendingRequiredDocumentCount} required document${pendingRequiredDocumentCount === 1 ? "" : "s"} still pending before submit.`
                          : "All required documents are attached."}
                      </p>
                    </div>
                  ) : null}
                  {hasCategoryLineBridgeFields ? (
                    <div className="rounded-lg border border-dashed p-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm text-slate-700">
                          Relevant category fields (description, quantity, UOM) can mirror to the first line item.
                          Line items remain editable.
                        </p>
                        <label className="flex items-center gap-2 text-xs text-slate-700">
                          <input
                            type="checkbox"
                            checked={syncCategoryFieldsToFirstLine}
                            onChange={(e) => setSyncCategoryFieldsToFirstLine(e.target.checked)}
                          />
                          Mirror category fields to first line
                        </label>
                      </div>
                    </div>
                  ) : null}
                  {fields.map((field, index) => (
                    <div key={field.id} className="grid gap-3 rounded-lg border p-3 md:grid-cols-[220px_1fr_110px_110px_auto]">
                      <FormField
                        control={form.control}
                        name={`lines.${index}.subcategoryId`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Level 3</FormLabel>
                            <FormControl>
                              <select
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                                value={field.value}
                                onChange={(event) => {
                                  const next = event.target.value;
                                  if (next === "__create_custom_level3__") {
                                    setActiveLineDynamicIndex(index);
                                    setShowCreateLevel3Inline(true);
                                    return;
                                  }
                                  field.onChange(next);
                                }}
                              >
                                <option value="">{selectedLevel2 ? "Select level 3" : "Select level 1/2 first"}</option>
                                {level3Options.map((subcategory) => (
                                  <option key={subcategory.id} value={subcategory.id}>
                                    {subcategory.level3}
                                  </option>
                                ))}
                                {selectedLevel2 ? <option value="__create_custom_level3__">+ Create new Level 3 category</option> : null}
                              </select>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`lines.${index}.description`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`lines.${index}.quantity`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Qty</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min={1}
                                value={Number(field.value ?? 1)}
                                onChange={(event) => field.onChange(Number(event.target.value))}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`lines.${index}.uom`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>UOM</FormLabel>
                            <FormControl>
                              {uomOptions.length > 0 ? (
                                <select
                                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background disabled:opacity-50"
                                  value={String(field.value ?? "")}
                                  disabled={Boolean(uomPolicy?.locked)}
                                  onChange={(event) => field.onChange(event.target.value)}
                                >
                                  <option value="">{uomPolicy?.locked ? "Inherited from subcategory" : "Select unit"}</option>
                                  {uomOptions.map((option) => (
                                    <option key={option} value={option}>
                                      {option}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <Input value={field.value ?? ""} onChange={field.onChange} placeholder="e.g. m2" />
                              )}
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="flex items-end">
                        <div className="flex gap-2">
                          <Button type="button" variant="outline" onClick={() => setActiveLineDynamicIndex(index)}>
                            Dynamic Details
                          </Button>
                          <Button variant="outline" type="button" disabled={fields.length <= 1} onClick={() => remove(index)}>
                            Remove
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between">
                    <Button type="button" variant="secondary" onClick={() => append(deriveLineFromMetadata())}>
                      Add another item (same subcategory)
                    </Button>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" onClick={() => setStep(1)}>
                      Edit basics
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setStep(2)}>
                      Edit line items
                    </Button>
                  </div>

                  <Card className="rounded-3xl border-[var(--border)] bg-white shadow-none">
                    <CardHeader className="border-b border-[var(--border)] pb-4">
                      <CardTitle>PR Review</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <p className="text-slate-500">Title</p>
                          <p className="font-medium">{form.getValues("title")}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Needed by</p>
                          <p className="font-medium">{form.getValues("neededBy") || "-"}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Department</p>
                          <p className="font-medium">{form.getValues("department")}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Cost center</p>
                          <p className="font-medium">{form.getValues("costCenter")}</p>
                        </div>
                        <div className="md:col-span-2">
                          <p className="text-slate-500">Subcategory</p>
                          <p className="font-medium">
                            {selectedSubcategory
                              ? `${selectedSubcategory.level1} / ${selectedSubcategory.level2} / ${selectedSubcategory.level3}`
                              : form.getValues("lines.0.subcategoryId")}
                          </p>
                        </div>
                        <div className="md:col-span-2">
                          <p className="text-slate-500">Justification</p>
                          <p className="font-medium whitespace-pre-wrap">{form.getValues("justification")}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="rounded-3xl border-[var(--border)] bg-white shadow-none">
                    <CardHeader className="border-b border-[var(--border)] pb-4">
                      <CardTitle>Line Items</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {lines.map((line, index) => (
                        <div key={`${line.description}-${index}`} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-slate-900">Item {index + 1}</p>
                            <p className="text-xs text-slate-500">
                              Qty {line.quantity}
                              {line.uom ? ` ${line.uom}` : ""}
                            </p>
                          </div>
                          <div className="space-y-3 text-sm">
                            <div>
                              <p className="text-slate-500">Description</p>
                              <p className="font-medium whitespace-pre-wrap">{line.description || "-"}</p>
                            </div>
                            <div className="grid gap-3 md:grid-cols-2">
                              <div>
                                <p className="text-slate-500">Quantity</p>
                                <p className="font-medium">{line.quantity}</p>
                              </div>
                              <div>
                                <p className="text-slate-500">Unit</p>
                                <p className="font-medium">{line.uom || "-"}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  <Card className="rounded-3xl border-[var(--border)] bg-white shadow-none">
                    <CardHeader className="border-b border-[var(--border)] pb-4">
                      <CardTitle>Category-Specific Fields</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      {populatedDynamicFields.length === 0 ? (
                        <p className="text-slate-500">No category-specific values captured.</p>
                      ) : (
                        <div className="grid gap-3 md:grid-cols-2">
                          {populatedDynamicFields.map((field) => (
                            <div key={field.path} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                              <p className="text-slate-500">{field.label}</p>
                              <p className="font-medium break-words whitespace-pre-wrap">
                                {formatDynamicValue(field.value)}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="rounded-3xl border-[var(--border)] bg-white shadow-none">
                    <CardHeader className="border-b border-[var(--border)] pb-4">
                      <CardTitle>Documents</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div
                        className={`rounded-2xl border p-4 ${
                          pendingRequiredDocumentCount > 0
                            ? "border-amber-200 bg-amber-50 text-amber-900"
                            : "border-emerald-200 bg-emerald-50 text-emerald-900"
                        }`}
                      >
                        <p className="font-medium">Document readiness</p>
                        <p className="mt-1">
                          {requiredDocumentFields.length === 0
                            ? "No required documents for this subcategory."
                            : pendingRequiredDocumentCount > 0
                              ? `${pendingRequiredDocumentCount} required document${pendingRequiredDocumentCount === 1 ? "" : "s"} still pending.`
                              : "All required documents are attached and ready for submit."}
                        </p>
                      </div>
                      {requiredDocumentFields.length > 0 ? (
                        <div className="space-y-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                          <p className="font-medium">Required before submit</p>
                          {requiredDocumentFields.map((field) => {
                            const satisfied = lines.every((_, lineIndex) => {
                              return (
                                Boolean(lineDynamicDocumentFiles[lineIndex]?.[field.key]) ||
                                existingDocuments.some((document) => document.fieldKey === `line_${lineIndex + 1}_${field.key}`)
                              );
                            });
                            return (
                              <div key={`required-${field.key}`} className="flex items-center justify-between gap-3">
                                <span>{field.label}</span>
                                <span className={satisfied ? "text-emerald-700" : "text-amber-700"}>
                                  {satisfied ? "Attached" : "Pending"}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                      {existingDocuments.length === 0 && Object.values(dynamicDocumentFiles).every((file) => !file) && Object.values(lineDynamicDocumentFiles).every((docs) => Object.values(docs ?? {}).every((file) => !file)) ? (
                        <p className="text-slate-500">No documents attached yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {existingDocuments.map((document) => (
                            <div key={document.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                              <p className="font-medium">{document.label ?? document.name}</p>
                              <p className="text-slate-500">{document.name}</p>
                            </div>
                          ))}
                          {Object.entries(dynamicDocumentFiles)
                            .filter(([, file]) => Boolean(file))
                            .map(([fieldKey, file]) => {
                              const definition = dynamicFields.find((field) => field.key === fieldKey);
                              return (
                                <div key={`dynamic-${fieldKey}`} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                                  <p className="font-medium">{definition?.label ?? fieldKey}</p>
                                  <p className="text-slate-500">{file?.name}</p>
                                </div>
                              );
                            })}
                          {Object.entries(lineDynamicDocumentFiles).flatMap(([lineIndexRaw, docs]) =>
                            Object.entries(docs ?? {})
                              .filter(([, file]) => Boolean(file))
                              .map(([fieldKey, file]) => {
                                const isSupportingDoc = fieldKey.startsWith("supporting_documents");
                                const definition = dynamicFields.find((field) => field.key === fieldKey);
                                const lineIndex = Number(lineIndexRaw) + 1;
                                return (
                                  <div key={`line-dynamic-${lineIndexRaw}-${fieldKey}`} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                                    <p className="font-medium">Line {lineIndex}: {isSupportingDoc ? "Supporting Document" : definition?.label ?? fieldKey}</p>
                                    <p className="text-slate-500">{file?.name}</p>
                                  </div>
                                );
                              }),
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}

              <Dialog
                open={activeLineDynamicIndex !== null}
                onOpenChange={(open) => {
                  if (!open) setActiveLineDynamicIndex(null);
                }}
              >
                <DialogContent className="max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>
                      {activeLineDynamicIndex !== null ? `Line ${activeLineDynamicIndex + 1} Dynamic Details` : "Dynamic Details"}
                    </DialogTitle>
                  </DialogHeader>
                  {dynamicFields.length === 0 ? (
                    <p className="text-sm text-slate-600">No additional fields required for this subcategory.</p>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <label className="mb-1 block text-sm font-medium">Comment</label>
                        <Textarea
                          rows={3}
                          value={String((lineDynamicValues[activeLineDynamicIndex ?? 0]?.comment as string | undefined) ?? "")}
                          onChange={(e) => {
                            const lineIndex = activeLineDynamicIndex ?? 0;
                            setLineDynamicValues((current) => ({
                              ...current,
                              [lineIndex]: { ...(current[lineIndex] ?? {}), comment: e.target.value },
                            }));
                          }}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium">Supporting documents</label>
                        <Input
                          type="file"
                          multiple
                          onChange={(e) => {
                            const lineIndex = activeLineDynamicIndex ?? 0;
                            const files = Array.from(e.target.files ?? []);
                            if (files.length === 0) return;
                            setLineDynamicDocumentFiles((current) => ({
                              ...current,
                              [lineIndex]: {
                                ...(current[lineIndex] ?? {}),
                                ...Object.fromEntries(files.map((file, idx) => [`supporting_documents_${idx + 1}_${Date.now()}`, file])),
                              },
                            }));
                          }}
                        />
                      </div>
                      {dynamicFields.map((def) => {
                        const lineIndex = activeLineDynamicIndex ?? 0;
                        const value = lineDynamicValues[lineIndex]?.[def.key];
                        const setValue = (nextValue: unknown) => {
                          setLineDynamicValues((current) => ({
                            ...current,
                            [lineIndex]: { ...(current[lineIndex] ?? {}), [def.key]: nextValue },
                          }));
                        };

                        if (def.inputType === "file") {
                          return (
                            <div key={`line-${lineIndex}-${def.key}`}>
                              <label className="mb-1 block text-sm font-medium">
                                {def.label} {def.required ? <span className="text-red-600">*</span> : null}
                              </label>
                              <Input
                                type="file"
                                onChange={(e) => {
                                  const file = e.target.files?.[0] ?? null;
                                  setLineDynamicDocumentFiles((current) => ({
                                    ...current,
                                    [lineIndex]: { ...(current[lineIndex] ?? {}), [def.key]: file },
                                  }));
                                }}
                              />
                            </div>
                          );
                        }

                        if (def.inputType === "textarea") {
                          return (
                            <div key={`line-${lineIndex}-${def.key}`}>
                              <label className="mb-1 block text-sm font-medium">{def.label}</label>
                              <Textarea rows={3} value={String(value ?? "")} onChange={(e) => setValue(e.target.value)} />
                            </div>
                          );
                        }

                        if (def.inputType === "checkbox") {
                          return (
                            <label key={`line-${lineIndex}-${def.key}`} className="flex items-center gap-2 text-sm font-medium">
                              <input type="checkbox" checked={Boolean(value)} onChange={(e) => setValue(e.target.checked)} />
                              {def.label}
                            </label>
                          );
                        }

                        if (def.inputType === "select") {
                          return (
                            <div key={`line-${lineIndex}-${def.key}`}>
                              <label className="mb-1 block text-sm font-medium">{def.label}</label>
                              <select
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                                value={String(value ?? "")}
                                onChange={(e) => setValue(e.target.value)}
                              >
                                <option value="">Select {def.label.toLowerCase()}</option>
                                {(def.options ?? []).map((option) => (
                                  <option key={option} value={option}>
                                    {option}
                                  </option>
                                ))}
                              </select>
                            </div>
                          );
                        }

                        return (
                          <div key={`line-${lineIndex}-${def.key}`}>
                            <label className="mb-1 block text-sm font-medium">{def.label}</label>
                            <Input
                              type={def.inputType === "number" ? "number" : def.inputType === "date" ? "date" : "text"}
                              value={String(value ?? "")}
                              onChange={(e) =>
                                setValue(def.inputType === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value)
                              }
                            />
                          </div>
                        );
                      })}
                      <div className="flex justify-end">
                        <Button type="button" onClick={() => setActiveLineDynamicIndex(null)}>
                          Done
                        </Button>
                      </div>
                    </div>
                  )}
                </DialogContent>
              </Dialog>

              <div className="flex items-center justify-between pt-4">
                <Button type="button" variant="outline" className="rounded-full" disabled={step === 1} onClick={() => setStep((s) => Math.max(1, s - 1))}>
                  Back
                </Button>
                {step < 3 ? (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-full"
                      disabled={createDraftReq.isPending || updateReq.isPending || submitDraftReq.isPending || uploadDocument.isPending}
                      onClick={() => void saveDraftPartial()}
                    >
                      Save draft
                    </Button>
                    <Button type="button" className="rounded-full" onClick={nextStep}>
                      Next
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    {editId ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-full"
                        disabled={createDraftReq.isPending || updateReq.isPending || submitDraftReq.isPending || uploadDocument.isPending}
                        onClick={() => void saveDraft()}
                      >
                        {isApprovedEdit ? "Save PR changes" : "Save draft changes"}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-full"
                        disabled={createDraftReq.isPending || submitDraftReq.isPending || uploadDocument.isPending}
                        onClick={() => void saveDraft()}
                      >
                        Save draft
                      </Button>
                    )}
                    {!isApprovedEdit ? (
                      <div className="flex flex-col items-end gap-1">
                        <Button
                          type="button"
                          className="rounded-full"
                          disabled={createDraftReq.isPending || updateReq.isPending || submitDraftReq.isPending || uploadDocument.isPending}
                          onClick={() => void (editId ? submitEditedDraft() : submitRequisition())}
                        >
                          Submit for approval
                        </Button>
                        {pendingRequiredDocumentCount > 0 ? (
                          <p className="text-xs text-amber-700">Submit is blocked until all required documents are attached.</p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
