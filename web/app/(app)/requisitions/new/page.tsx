"use client";

import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ApiErrorAlert } from "@/components/common/api-error-alert";
import { LocationAutocompleteField } from "@/components/forms/location-autocomplete-field";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { runtimeConfig } from "@/lib/runtime-config";
import { useAuditEvents, useCreateDraftRequisition, usePrFormSchema, useRequisition, useRequisitionDocumentUpload, useSubmitDraftRequisition, useTaxonomySubcategories, useUpdateRequisition } from "@/lib/query-hooks";
import { LocationSuggestion, PrFormSchemaField } from "@/lib/types";

const lineSchema = z.object({
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
  subcategoryId: z.string().min(1, "Subcategory is required"),
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

export default function NewRequisitionPage() {
  const [editId, setEditId] = useState<string | null>(null);
  const [editSource, setEditSource] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [isPrefilled, setIsPrefilled] = useState(false);
  const [syncCategoryFieldsToFirstLine, setSyncCategoryFieldsToFirstLine] = useState(true);
  const [selectedLevel1, setSelectedLevel1] = useState("");
  const [selectedLevel2, setSelectedLevel2] = useState("");
  const [supportingFiles, setSupportingFiles] = useState<File[]>([]);
  const [dynamicDocumentFiles, setDynamicDocumentFiles] = useState<Record<string, File | null>>({});
  const router = useRouter();
  const createDraftReq = useCreateDraftRequisition();
  const updateReq = useUpdateRequisition();
  const submitDraftReq = useSubmitDraftRequisition();
  const uploadDocument = useRequisitionDocumentUpload();
  const subcategories = useTaxonomySubcategories();
  const existingReq = useRequisition(editId ?? "");
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
      subcategoryId: "",
      metadata: {},
      lines: [{ description: "", quantity: 1, uom: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "lines" });
  const lines = form.watch("lines");
  const selectedSubcategoryId = form.watch("subcategoryId");
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
    () =>
      requiredDocumentFields.filter(
        (field) => !Boolean(dynamicDocumentFiles[field.key]) && !existingDocuments.some((document) => document.fieldKey === field.key),
      ).length,
    [dynamicDocumentFiles, existingDocuments, requiredDocumentFields],
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

  const level1Options = useMemo(
    () => [...new Set(allSubcategories.map((s) => s.level1))].sort((a, b) => a.localeCompare(b)),
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
  const populatedDynamicFields = useMemo(
    () =>
      dynamicFields.filter((def) => !isMissing(form.getValues(`metadata.${def.key}` as any))).map((def) => ({
        ...def,
        value: form.getValues(`metadata.${def.key}` as any),
      })),
    [dynamicFields, form],
  );

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
      subcategoryId: existing.subcategoryId ?? "",
      metadata: (existing.metadata as Record<string, unknown>) ?? {},
      lines:
        existing.lineItems.length > 0
          ? existing.lineItems.map((line) => ({
              description: line.description,
              quantity: line.quantity,
              uom: line.uom ?? "",
            }))
          : [{ description: "", quantity: 1, uom: "" }],
    });

    const selected = allSubcategories.find((s) => s.id === existing.subcategoryId);
    if (selected) {
      setSelectedLevel1(selected.level1);
      setSelectedLevel2(selected.level2);
    }
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
    return { description, quantity: qty, uom };
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

  const uploadPendingDocuments = async (requisitionId: string) => {
    for (const file of supportingFiles) {
      await uploadDocument.mutateAsync({
        requisitionId,
        file,
        fieldKey: "supporting_documents",
        label: "Supporting Document",
      });
    }

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
  };

  const saveDraftPartial = async () => {
    const values = form.getValues();
    if (!values.title.trim() || !values.subcategoryId) {
      toast.error("Title and Level 3 subcategory are required to save a draft.");
      return;
    }

    const lineItems = (values.lines ?? [])
      .filter((line) => line.description.trim().length > 0 && Number(line.quantity) > 0)
      .map((line, index) => ({
        id: `line-${index + 1}`,
        description: line.description,
        quantity: line.quantity,
        uom: line.uom,
      }));

    if (editId) {
      const updated = await updateReq.mutateAsync({
        id: editId,
        title: values.title,
        department: values.department,
        costCenter: values.costCenter,
        justification: values.justification,
        currency: "ZAR",
        subcategoryId: values.subcategoryId,
        metadata: values.metadata,
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
      subcategoryId: values.subcategoryId,
      metadata: values.metadata,
      lineItems,
    });
    await uploadPendingDocuments(created.id);
    toast.success("Draft requisition saved", { description: `${created.prNumber} is ready to resume later.` });
    router.push(`/requisitions/${created.id}`);
  };

  const validateDynamicMetadata = () => {
    let ok = true;
    for (const def of dynamicFields) {
      if (def.inputType === "file") {
        const hasDocument = Boolean(dynamicDocumentFiles[def.key]) || hasExistingDocumentForField(def.key);
        if (def.required && !hasDocument) {
          form.setError(`metadata.${def.key}` as any, {
            type: "required",
            message: def.message ?? `${def.label} document is required`,
          });
          ok = false;
        } else {
          form.clearErrors(`metadata.${def.key}` as any);
        }
        continue;
      }
      const value = form.getValues(`metadata.${def.key}` as any);
      if (def.required && isMissing(value)) {
        form.setError(`metadata.${def.key}` as any, {
          type: "required",
          message: def.message ?? `${def.label} is required`,
        });
        ok = false;
      } else {
        form.clearErrors(`metadata.${def.key}` as any);
      }
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
        "subcategoryId",
      ]);
      if (neededByMetadataPaths.length > 0 && isMissing(form.getValues("neededBy"))) {
        form.setError("neededBy", { type: "required", message: "Needed By is required" });
      } else {
        form.clearErrors("neededBy");
      }
      const dynamicValid = validateDynamicMetadata();
      if (!staticValid || !dynamicValid || (neededByMetadataPaths.length > 0 && isMissing(form.getValues("neededBy")))) return;
    }
    if (step === 2) {
      const linesValid = await form.trigger("lines");
      if (!linesValid) return;
    }
    setStep((s) => Math.min(3, s + 1));
  };

  const submitRequisition = form.handleSubmit(async (values) => {
    syncNeededByToMetadata(values.neededBy ?? "");
    if (!validateDynamicMetadata()) {
      setStep(1);
      return;
    }
    const lineItems = values.lines.map((line, i) => ({
      id: `line-${i + 1}`,
      description: line.description,
      quantity: line.quantity,
      uom: line.uom,
    }));

    if (editId) {
      const updated = await updateReq.mutateAsync({
        id: editId,
        title: values.title,
        department: values.department,
        costCenter: values.costCenter,
        justification: values.justification,
        currency: "ZAR",
        subcategoryId: values.subcategoryId,
        metadata: values.metadata,
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
      subcategoryId: values.subcategoryId,
      metadata: values.metadata,
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
      description: line.description,
      quantity: line.quantity,
      uom: line.uom,
    }));
    if (editId) {
      const updated = await updateReq.mutateAsync({
        id: editId,
        title: values.title,
        department: values.department,
        costCenter: values.costCenter,
        justification: values.justification,
        currency: "ZAR",
        subcategoryId: values.subcategoryId,
        metadata: values.metadata,
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
      subcategoryId: values.subcategoryId,
      metadata: values.metadata,
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
      setStep(1);
      return;
    }
    const lineItems = values.lines.map((line, i) => ({
      id: `line-${i + 1}`,
      description: line.description,
      quantity: line.quantity,
      uom: line.uom,
    }));
    const updated = await updateReq.mutateAsync({
      id: editId,
      title: values.title,
      department: values.department,
      costCenter: values.costCenter,
      justification: values.justification,
      currency: "ZAR",
      subcategoryId: values.subcategoryId,
      metadata: values.metadata,
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
      <PageHeader
        title={editId ? "Edit Requisition" : "Create Requisition"}
        description={
          editId
            ? editSource === "rfq"
              ? "Resume the PR wizard from RFQ. Saved changes will be tracked in audit."
              : "Resume the full PR wizard with the saved draft state."
            : "Three-step guided submission with policy-safe defaults."
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
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">Loading category taxonomy...</div>
      ) : null}
      {editId && existingReq.isLoading ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">Loading draft requisition...</div>
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

      <Card>
        <CardHeader>
          <CardTitle>Step {step} of 3</CardTitle>
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
                  <FormField
                    control={form.control}
                    name="subcategoryId"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Level 3 subcategory</FormLabel>
                        <div className="grid gap-3 md:grid-cols-3">
                          <div>
                            <label className="mb-1 block text-xs text-slate-600">Domain (Level 1)</label>
                            <select
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                              value={selectedLevel1}
                              onChange={(event) => {
                                const nextLevel1 = event.target.value;
                                setSelectedLevel1(nextLevel1);
                                setSelectedLevel2("");
                                field.onChange("");
                                form.setValue("metadata", {});
                                form.clearErrors(["subcategoryId", "metadata"]);
                              }}
                            >
                              <option value="">Select domain</option>
                              {level1Options.map((level1) => (
                                <option key={level1} value={level1}>
                                  {level1}
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
                              onChange={(event) => {
                                const nextLevel2 = event.target.value;
                                setSelectedLevel2(nextLevel2);
                                field.onChange("");
                                form.setValue("metadata", {});
                                form.clearErrors(["subcategoryId", "metadata"]);
                              }}
                            >
                              <option value="">{selectedLevel1 ? "Select level 2" : "Select domain first"}</option>
                              {level2Options.map((level2) => (
                                <option key={level2} value={level2}>
                                  {level2}
                                </option>
                              ))}
                            </select>
                          </div>
                          <FormControl>
                            <div>
                              <label className="mb-1 block text-xs text-slate-600">Level 3</label>
                              <select
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background disabled:opacity-50"
                                value={field.value}
                                disabled={!selectedLevel1 || !selectedLevel2}
                                onChange={(event) => {
                                  field.onChange(event.target.value);
                                  form.setValue("metadata", {});
                                  form.clearErrors("metadata");
                                }}
                              >
                              <option value="">
                                  {selectedLevel2
                                    ? level3Options.length
                                      ? "Select level 3 subcategory"
                                      : "No level 3 options (check taxonomy load/error above)"
                                    : "Select level 2 first"}
                              </option>
                                {level3Options.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.level3} ({s.id})
                                  </option>
                                ))}
                              </select>
                            </div>
                          </FormControl>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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
                            {runtimeConfig.companyDepartments.map((department) => (
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
                            {runtimeConfig.companyCostCentres.map((costCentre) => (
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
                  {neededByMetadataPaths.length > 0 ? (
                    <div className="md:col-span-2 -mt-2 text-xs text-slate-500">
                      This subcategory requires a date field from Appendix C. The standard Needed By field is used as the single source of truth.
                    </div>
                  ) : null}
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
                  <div className="md:col-span-2 space-y-3 rounded-lg border border-dashed p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Category-specific required fields</p>
                        <p className="text-xs text-slate-600">
                          Loaded from Appendix C rule-pack field catalog for the selected Level 3 subcategory.
                        </p>
                      </div>
                      {formSchemaQuery.isFetching ? <p className="text-xs text-slate-500">Loading…</p> : null}
                    </div>
                    {activeFormSchema ? (
                      <div className="rounded-md bg-slate-50 p-3 text-xs text-slate-700">
                        <div>PR Form Key: <span className="font-medium">{activeFormSchema.keys.prFormKey}</span></div>
                        <div>PR Rule Pack: <span className="font-medium">{activeFormSchema.validation.rulePackKey}</span></div>
                        <div>Service Family: <span className="font-medium">{activeFormSchema.serviceFamily}</span></div>
                        <div>
                          UOM Policy:{" "}
                          <span className="font-medium">
                            {activeFormSchema.uomPolicy
                              ? `${activeFormSchema.uomPolicy.options.join(", ") || "free"}${activeFormSchema.uomPolicy.locked ? " (locked)" : ""}`
                              : "not configured"}
                          </span>
                        </div>
                        <div>
                          Fields: <span className="font-medium">{activeFormSchema.validation.fieldCount ?? dynamicFields.length}</span>
                          {" • "}
                          Required: <span className="font-medium">{activeFormSchema.validation.requiredFieldCount}</span>
                        </div>
                        <div className="mt-2 border-t border-slate-200 pt-2">
                          <div className="mb-1 font-medium">Line Bindings (UAT debug)</div>
                          <div>
                            Description: <span className="font-mono">{(activeFormSchema.lineBindings?.description ?? []).join(" -> ") || "-"}</span>
                          </div>
                          <div>
                            Quantity: <span className="font-mono">{(activeFormSchema.lineBindings?.quantity ?? []).join(" -> ") || "-"}</span>
                          </div>
                          <div>
                            UOM: <span className="font-mono">{(activeFormSchema.lineBindings?.uom ?? []).join(" -> ") || "-"}</span>
                          </div>
                        </div>
                      </div>
                    ) : null}
                    {!selectedSubcategoryId ? (
                      <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-600">
                        Select a Level 3 subcategory first. Category-specific fields only appear after a subcategory is chosen.
                      </div>
                    ) : formSchemaQuery.isFetching && !activeFormSchema ? (
                      <p className="text-sm text-slate-600">Loading subcategory schema…</p>
                    ) : activeFormSchema ? (
                      <div className="space-y-3">
                        {requiredDocumentFields.length > 0 ? (
                          <div className="rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
                            Required documents for this subcategory:
                            <span className="ml-1 font-medium">
                              {requiredDocumentFields.map((field) => field.label).join(", ")}
                            </span>
                            <p className="mt-2 text-xs">
                              You can save a draft without them, but final submit is blocked until each required document is attached.
                            </p>
                          </div>
                        ) : null}
                        {dynamicFields.length === 0 ? (
                          <p className="text-sm text-slate-600">No additional metadata fields returned for this subcategory.</p>
                        ) : null}
                        <div className="grid gap-4 md:grid-cols-2">
                        <div className="md:col-span-2">
                          <label className="mb-1 block text-sm font-medium">Comment (all categories)</label>
                          <Textarea
                            rows={3}
                            value={String(form.watch("metadata.comment") ?? "")}
                            onChange={(e) => form.setValue("metadata.comment", e.target.value, { shouldDirty: true })}
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="mb-1 block text-sm font-medium">Supporting documents (all categories)</label>
                          <Input
                            type="file"
                            multiple
                            onChange={(e) => {
                              const files = Array.from(e.target.files ?? []);
                              setSupportingFiles(files);
                              form.setValue("metadata.supportingDocumentNames", files.map((f) => f.name), { shouldDirty: true });
                            }}
                          />
                          <p className="mt-1 text-xs text-slate-500">
                            Files are stored locally in dev. Move this to object/blob storage before production.
                          </p>
                          {existingDocuments.filter((document) => !document.fieldKey || document.fieldKey === "supporting_documents").length > 0 ? (
                            <p className="mt-1 text-xs text-slate-700">
                              Existing:{" "}
                              {existingDocuments
                                .filter((document) => !document.fieldKey || document.fieldKey === "supporting_documents")
                                .map((document) => document.name)
                                .join(", ")}
                            </p>
                          ) : null}
                          {Array.isArray(form.watch("metadata.supportingDocumentNames")) &&
                          (form.watch("metadata.supportingDocumentNames") as unknown[]).length > 0 ? (
                            <p className="mt-1 text-xs text-slate-700">
                              Selected: {(form.watch("metadata.supportingDocumentNames") as string[]).join(", ")}
                            </p>
                          ) : null}
                        </div>
                        {dynamicFields.map((def) => {
                          const fieldName = `metadata.${def.key}` as any;
                          const error = metadataErrors?.[def.key]?.message;
                          const inputKind = fieldInput(def);
                          if (inputKind === "textarea") {
                            return (
                              <div key={def.path} className="md:col-span-2">
                                <label className="mb-1 block text-sm font-medium">
                                  {def.label} {def.required ? <span className="text-red-600">*</span> : null}
                                </label>
                                <Textarea
                                  rows={3}
                                  {...form.register(fieldName)}
                                  onChange={(e) => {
                                    form.setValue(fieldName, e.target.value, { shouldDirty: true });
                                    form.clearErrors(fieldName);
                                  }}
                                />
                                {def.message ? <p className="mt-1 text-xs text-slate-500">{def.message}</p> : null}
                                {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
                              </div>
                            );
                          }
                          if (inputKind === "checkbox") {
                            return (
                              <div key={def.path} className="rounded-md border p-3">
                                <label className="flex items-start gap-2 text-sm font-medium">
                                  <input
                                    type="checkbox"
                                    className="mt-0.5"
                                    checked={Boolean(form.watch(fieldName))}
                                    onChange={(e) => {
                                      form.setValue(fieldName, e.target.checked, { shouldDirty: true });
                                      form.clearErrors(fieldName);
                                    }}
                                  />
                                  <span>
                                    {def.label} {def.required ? <span className="text-red-600">*</span> : null}
                                  </span>
                                </label>
                                {def.message ? <p className="mt-1 text-xs text-slate-500">{def.message}</p> : null}
                                {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
                              </div>
                            );
                          }
                          if (inputKind === "file") {
                            return (
                              <div key={def.path} className="md:col-span-2">
                                <label className="mb-1 block text-sm font-medium">
                                  {def.label} {def.required ? <span className="text-red-600">*</span> : null}
                                </label>
                                <Input
                                  type="file"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0] ?? null;
                                    setDynamicDocumentFiles((current) => ({ ...current, [def.key]: file }));
                                    form.setValue(fieldName, file?.name ?? "", { shouldDirty: true });
                                    form.clearErrors(fieldName);
                                  }}
                                />
                                {hasExistingDocumentForField(def.key) ? (
                                  <p className="mt-1 text-xs text-slate-700">
                                    Existing:{" "}
                                    {existingDocuments
                                      .filter((document) => document.fieldKey === def.key)
                                      .map((document) => document.name)
                                      .join(", ")}
                                  </p>
                                ) : null}
                                {dynamicDocumentFiles[def.key] ? (
                                  <p className="mt-1 text-xs text-slate-700">Selected: {dynamicDocumentFiles[def.key]?.name}</p>
                                ) : null}
                                {def.message ? <p className="mt-1 text-xs text-slate-500">{def.message}</p> : null}
                                {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
                              </div>
                            );
                          }
                          if (inputKind === "milestones") {
                            const milestones = Array.isArray(form.watch(fieldName)) ? (form.watch(fieldName) as Array<{ text?: string; date?: string }>) : [];
                            return (
                              <div key={def.path} className="md:col-span-2 space-y-3 rounded-md border p-3">
                                <div className="flex items-center justify-between gap-3">
                                  <label className="block text-sm font-medium">
                                    {def.label} {def.required ? <span className="text-red-600">*</span> : null}
                                  </label>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      form.setValue(fieldName, [...milestones, { text: "", date: "" }], { shouldDirty: true });
                                      form.clearErrors(fieldName);
                                    }}
                                  >
                                    Add milestone
                                  </Button>
                                </div>
                                {milestones.length === 0 ? (
                                  <p className="text-xs text-slate-500">No milestones added yet.</p>
                                ) : (
                                  <div className="space-y-3">
                                    {milestones.map((milestone, index) => (
                                      <div key={`${def.key}-${index}`} className="grid gap-3 rounded-md border p-3 md:grid-cols-[1fr_180px_auto]">
                                        <Input
                                          placeholder="Milestone text"
                                          value={milestone.text ?? ""}
                                          onChange={(e) => {
                                            const next = [...milestones];
                                            next[index] = { ...next[index], text: e.target.value };
                                            form.setValue(fieldName, next, { shouldDirty: true });
                                            form.clearErrors(fieldName);
                                          }}
                                        />
                                        <Input
                                          type="date"
                                          value={milestone.date ?? ""}
                                          onChange={(e) => {
                                            const next = [...milestones];
                                            next[index] = { ...next[index], date: e.target.value };
                                            form.setValue(fieldName, next, { shouldDirty: true });
                                            form.clearErrors(fieldName);
                                          }}
                                        />
                                        <Button
                                          type="button"
                                          variant="outline"
                                          onClick={() => {
                                            const next = milestones.filter((_, itemIndex) => itemIndex !== index);
                                            form.setValue(fieldName, next, { shouldDirty: true });
                                            form.clearErrors(fieldName);
                                          }}
                                        >
                                          Remove
                                        </Button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {def.message ? <p className="text-xs text-slate-500">{def.message}</p> : null}
                                {error ? <p className="text-xs text-red-600">{error}</p> : null}
                              </div>
                            );
                          }
                          if (inputKind === "select") {
                            return (
                              <div key={def.path}>
                                <label className="mb-1 block text-sm font-medium">
                                  {def.label} {def.required ? <span className="text-red-600">*</span> : null}
                                </label>
                                <select
                                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                                  value={String(form.watch(fieldName) ?? "")}
                                  onChange={(e) => {
                                    form.setValue(fieldName, e.target.value, { shouldDirty: true });
                                    form.clearErrors(fieldName);
                                    applyDynamicToFirstLine();
                                  }}
                                >
                                  <option value="">Select {def.label.toLowerCase()}</option>
                                  {(def.options ?? []).map((option) => (
                                    <option key={option} value={option}>
                                      {option}
                                    </option>
                                  ))}
                                </select>
                                {def.message ? <p className="mt-1 text-xs text-slate-500">{def.message}</p> : null}
                                {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
                              </div>
                            );
                          }
                          return (
                            <div key={def.path}>
                              <label className="mb-1 block text-sm font-medium">
                                {def.label} {def.required ? <span className="text-red-600">*</span> : null}
                              </label>
                              {isLocationAutocompleteField(def) ? (
                                <LocationAutocompleteField
                                  value={String(form.watch(fieldName) ?? "")}
                                  placeholder={def.message ?? "Search location"}
                                  country={runtimeConfig.organizationCountry}
                                  onChange={(value) => {
                                    form.setValue(fieldName, value, { shouldDirty: true });
                                    form.clearErrors(fieldName);
                                  }}
                                  onSelect={(suggestion) => applyLocationSuggestion(def.key, suggestion)}
                                />
                              ) : uomFieldKey === def.key && uomOptions.length > 0 ? (
                                <select
                                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background disabled:opacity-50"
                                  value={String(form.watch(fieldName) ?? "")}
                                  disabled={Boolean(uomPolicy?.locked)}
                                  onChange={(e) => {
                                    form.setValue(fieldName, e.target.value, { shouldDirty: true });
                                    form.clearErrors(fieldName);
                                    applyDynamicToFirstLine();
                                  }}
                                >
                                  <option value="">{uomPolicy?.locked ? "Unit inherited from subcategory" : "Select unit"}</option>
                                  {uomOptions.map((option) => (
                                    <option key={option} value={option}>
                                      {option}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <Input
                                  type={def.inputType === "number" ? "number" : def.inputType === "date" ? "date" : "text"}
                                  {...form.register(fieldName)}
                                  onChange={(e) => {
                                    const rawValue = e.target.value;
                                    const nextValue =
                                      def.inputType === "number" ? (rawValue === "" ? "" : Number(rawValue)) : rawValue;
                                    form.setValue(fieldName, nextValue, { shouldDirty: true });
                                    form.clearErrors(fieldName);
                                    applyDynamicToFirstLine();
                                  }}
                                />
                              )}
                              {def.message ? <p className="mt-1 text-xs text-slate-500">{def.message}</p> : null}
                              {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
                            </div>
                          );
                        })}
                        </div>
                      </div>
                    ) : null}
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
                    <div key={field.id} className="grid gap-3 rounded-lg border p-3 md:grid-cols-[1fr_110px_110px_auto]">
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
                        <Button variant="outline" type="button" disabled={fields.length <= 1} onClick={() => remove(index)}>
                          Remove
                        </Button>
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

                  <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                    <Card>
                      <CardHeader>
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
                                : form.getValues("subcategoryId")}
                            </p>
                          </div>
                          <div className="md:col-span-2">
                            <p className="text-slate-500">Justification</p>
                            <p className="font-medium whitespace-pre-wrap">{form.getValues("justification")}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Category Data</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3 text-sm">
                        <div className="rounded-lg bg-slate-50 p-3">
                          <p className="text-slate-500">Form key</p>
                          <p className="font-medium">{activeFormSchema?.keys.prFormKey ?? "-"}</p>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-3">
                          <p className="text-slate-500">Rule pack</p>
                          <p className="font-medium break-all">{activeFormSchema?.validation.rulePackKey ?? "-"}</p>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-3">
                          <p className="text-slate-500">Dynamic fields completed</p>
                          <p className="font-medium">{populatedDynamicFields.length}/{dynamicFields.length}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle>Line Items</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {lines.map((line, index) => (
                        <div key={`${line.description}-${index}`} className="rounded-lg border p-4">
                          <div className="grid gap-3 md:grid-cols-[1fr_120px_140px] text-sm">
                            <div>
                              <p className="text-slate-500">Description</p>
                              <p className="font-medium">{line.description}</p>
                            </div>
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
                      ))}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Category-Specific Fields</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      {populatedDynamicFields.length === 0 ? (
                        <p className="text-slate-500">No category-specific values captured.</p>
                      ) : (
                        <div className="grid gap-3 md:grid-cols-2">
                          {populatedDynamicFields.map((field) => (
                            <div key={field.path} className="rounded-lg border p-3">
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

                  <Card>
                    <CardHeader>
                      <CardTitle>Documents</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div
                        className={`rounded-lg border p-3 ${
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
                        <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                          <p className="font-medium">Required before submit</p>
                          {requiredDocumentFields.map((field) => {
                            const satisfied = Boolean(dynamicDocumentFiles[field.key]) || hasExistingDocumentForField(field.key);
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
                      {existingDocuments.length === 0 && supportingFiles.length === 0 && Object.values(dynamicDocumentFiles).every((file) => !file) ? (
                        <p className="text-slate-500">No documents attached yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {existingDocuments.map((document) => (
                            <div key={document.id} className="rounded-lg border p-3">
                              <p className="font-medium">{document.label ?? document.name}</p>
                              <p className="text-slate-500">{document.name}</p>
                            </div>
                          ))}
                          {supportingFiles.map((file) => (
                            <div key={`supporting-${file.name}`} className="rounded-lg border p-3">
                              <p className="font-medium">Supporting Document</p>
                              <p className="text-slate-500">{file.name}</p>
                            </div>
                          ))}
                          {Object.entries(dynamicDocumentFiles)
                            .filter(([, file]) => Boolean(file))
                            .map(([fieldKey, file]) => {
                              const definition = dynamicFields.find((field) => field.key === fieldKey);
                              return (
                                <div key={`dynamic-${fieldKey}`} className="rounded-lg border p-3">
                                  <p className="font-medium">{definition?.label ?? fieldKey}</p>
                                  <p className="text-slate-500">{file?.name}</p>
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}

              <div className="flex items-center justify-between pt-4">
                <Button type="button" variant="outline" disabled={step === 1} onClick={() => setStep((s) => Math.max(1, s - 1))}>
                  Back
                </Button>
                {step < 3 ? (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={createDraftReq.isPending || updateReq.isPending || submitDraftReq.isPending || uploadDocument.isPending}
                      onClick={() => void saveDraftPartial()}
                    >
                      Save draft
                    </Button>
                    <Button type="button" onClick={nextStep}>
                      Next
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    {editId ? (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={createDraftReq.isPending || updateReq.isPending || submitDraftReq.isPending || uploadDocument.isPending}
                        onClick={() => void saveDraft()}
                      >
                        {isApprovedEdit ? "Save PR changes" : "Save draft changes"}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
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
