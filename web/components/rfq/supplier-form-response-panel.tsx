"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { ApiErrorAlert } from "@/components/common/api-error-alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRfqSupplierForms, useSupplierFormResponseAction } from "@/lib/query-hooks";

type DraftState = Record<
  string,
  {
    response: Record<string, unknown>;
    documents: Record<string, Array<{ name: string; type?: string; sizeBytes?: number }>>;
  }
>;

export function SupplierFormResponsePanel({ rfqId }: { rfqId: string }) {
  const { data: assignments = [], error } = useRfqSupplierForms(rfqId);
  const responseAction = useSupplierFormResponseAction();
  const [drafts, setDrafts] = useState<DraftState>({});

  useEffect(() => {
    setDrafts((current) => {
      const next = { ...current };
      for (const assignment of assignments) {
        if (next[assignment.id]) continue;
        const response = assignment.responses?.[0];
        next[assignment.id] = {
          response: (response?.response as Record<string, unknown> | null) ?? {},
          documents: (response?.documents as Record<string, Array<{ name: string; type?: string; sizeBytes?: number }>> | null) ?? {},
        };
      }
      return next;
    });
  }, [assignments]);

  const summary = useMemo(() => {
    const required = assignments.filter((assignment) => assignment.isRequired);
    const complete = required.filter((assignment) => assignment.responses?.[0]?.isComplete).length;
    return { required: required.length, complete };
  }, [assignments]);

  if (error) return <ApiErrorAlert error={error} />;
  if (assignments.length === 0) return null;

  const setFieldValue = (assignmentId: string, key: string, value: unknown) => {
    setDrafts((current) => ({
      ...current,
      [assignmentId]: {
        response: {
          ...(current[assignmentId]?.response ?? {}),
          [key]: value,
        },
        documents: current[assignmentId]?.documents ?? {},
      },
    }));
  };

  const setDocumentValue = (assignmentId: string, key: string, files: FileList | null) => {
    const attachments = Array.from(files ?? []).map((file) => ({
      name: file.name,
      type: file.type || "application/octet-stream",
      sizeBytes: file.size,
    }));
    setDrafts((current) => ({
      ...current,
      [assignmentId]: {
        response: current[assignmentId]?.response ?? {},
        documents: {
          ...(current[assignmentId]?.documents ?? {}),
          [key]: attachments,
        },
      },
    }));
  };

  const saveResponse = async (assignmentId: string) => {
    const draft = drafts[assignmentId] ?? { response: {}, documents: {} };
    try {
      const result = await responseAction.mutateAsync({
        rfqId,
        assignmentId,
        response: draft.response,
        documents: draft.documents,
      });
      if (result.isComplete) {
        toast.success("Supplier form completed");
      } else {
        toast.error("Supplier form saved but still incomplete");
      }
    } catch (err) {
      console.error(err);
      toast.error("Supplier form save failed");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Attached Supplier Forms</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border bg-slate-50 px-3 py-2 text-sm text-slate-700">
          Required forms completed: <span className="font-semibold">{summary.complete}</span> / {summary.required}
        </div>
        {responseAction.error ? <ApiErrorAlert error={responseAction.error} /> : null}
        {assignments.map((assignment) => {
          const response = assignment.responses?.[0];
          const draft = drafts[assignment.id] ?? { response: {}, documents: {} };
          return (
            <div key={assignment.id} className="rounded-lg border p-4">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-900">{assignment.template.name}</p>
                  {assignment.template.description ? (
                    <p className="text-sm text-slate-500">{assignment.template.description}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  {assignment.isRequired ? <Badge variant="secondary">Required</Badge> : <Badge variant="outline">Optional</Badge>}
                  {response?.isComplete ? <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Complete</Badge> : <Badge variant="outline">Pending</Badge>}
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {assignment.template.fields.map((field) => {
                  const fieldId = `${assignment.id}-${field.key}`;
                  const value = draft.response[field.key];
                  const attachments = draft.documents[field.key] ?? [];
                  if (field.type === "DOCUMENT") {
                    return (
                      <div key={fieldId} className="space-y-2 md:col-span-2">
                        <Label htmlFor={fieldId}>{field.label}{field.required ? " *" : ""}</Label>
                        <Input id={fieldId} type="file" multiple onChange={(event) => setDocumentValue(assignment.id, field.key, event.target.files)} />
                        {attachments.length > 0 ? (
                          <div className="rounded-md border bg-slate-50 p-3 text-xs text-slate-700">
                            {attachments.map((file) => (
                              <p key={`${file.name}-${file.sizeBytes}`}>{file.name}</p>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  }

                  if (field.type === "NUMBER") {
                    return (
                      <div key={fieldId} className="space-y-2">
                        <Label htmlFor={fieldId}>{field.label}{field.required ? " *" : ""}</Label>
                        <Input
                          id={fieldId}
                          type="number"
                          value={typeof value === "number" || typeof value === "string" ? String(value) : ""}
                          onChange={(event) => setFieldValue(assignment.id, field.key, event.target.value)}
                        />
                      </div>
                    );
                  }

                  return (
                    <div key={fieldId} className="space-y-2 md:col-span-2">
                      <Label htmlFor={fieldId}>{field.label}{field.required ? " *" : ""}</Label>
                      <Textarea
                        id={fieldId}
                        value={typeof value === "string" ? value : ""}
                        onChange={(event) => setFieldValue(assignment.id, field.key, event.target.value)}
                        rows={4}
                      />
                    </div>
                  );
                })}
              </div>
              {response?.missingFields?.length ? (
                <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  Missing required fields: {response.missingFields.map((field) => field.label).join(", ")}
                </div>
              ) : null}
              <div className="mt-4 flex justify-end">
                <Button size="sm" onClick={() => saveResponse(assignment.id)} disabled={responseAction.isPending}>
                  {responseAction.isPending ? "Saving..." : "Save Form"}
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
