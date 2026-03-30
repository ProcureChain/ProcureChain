"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";

import { ApiErrorAlert } from "@/components/common/api-error-alert";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useRfq, useSupplierFormAction } from "@/lib/query-hooks";
import { SupplierFormField } from "@/lib/types";

export default function NewRfqSupplierFormPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: rfq, error } = useRfq(params.id);
  const formAction = useSupplierFormAction();

  const [releaseMode, setReleaseMode] = useState<"PRIVATE" | "LOCAL" | "GLOBAL">("PRIVATE");
  const [saveForReuse, setSaveForReuse] = useState(true);
  const [newFormName, setNewFormName] = useState("");
  const [newFormDescription, setNewFormDescription] = useState("");
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [newFieldKey, setNewFieldKey] = useState("");
  const [newFieldType, setNewFieldType] = useState<"TEXT" | "NUMBER" | "DOCUMENT">("TEXT");
  const [newFieldRequired, setNewFieldRequired] = useState(false);
  const [draftFields, setDraftFields] = useState<SupplierFormField[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const search = new URLSearchParams(window.location.search);
    const mode = search.get("releaseMode");
    if (mode && ["PRIVATE", "LOCAL", "GLOBAL"].includes(mode)) {
      setReleaseMode(mode as "PRIVATE" | "LOCAL" | "GLOBAL");
    }
  }, []);

  if (error) return <ApiErrorAlert error={error} />;
  if (!rfq) return <div className="rounded-xl border bg-white p-8 text-sm text-slate-500">Loading RFQ...</div>;

  const addDraftField = () => {
    const label = newFieldLabel.trim();
    const key = newFieldKey.trim();
    if (!label || !key) {
      toast.error("Field label and key are required");
      return;
    }
    if (draftFields.some((field) => field.key === key)) {
      toast.error("Field key must be unique");
      return;
    }
    setDraftFields((prev) => [
      ...prev,
      { id: crypto.randomUUID(), key, label, type: newFieldType, required: newFieldRequired },
    ]);
    setNewFieldLabel("");
    setNewFieldKey("");
    setNewFieldType("TEXT");
    setNewFieldRequired(false);
  };

  const attachAndReturn = async () => {
    if (!newFormName.trim() || draftFields.length === 0) return;
    await formAction.mutateAsync({
      type: "attach-rfq-form",
      rfqId: rfq.id,
      name: newFormName,
      description: newFormDescription || undefined,
      fields: draftFields,
      isRequired: true,
      saveForReuse,
    });
    router.push(`/rfqs/${rfq.id}?formAttached=1&releaseMode=${releaseMode}`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create Additional RFQ Form"
        description="Build an additional supplier-response form, attach it to this RFQ, then return to release."
        actions={
          <Button variant="outline" onClick={() => router.push(`/rfqs/${rfq.id}`)}>
            Cancel
          </Button>
        }
      />

      {formAction.error ? <ApiErrorAlert error={formAction.error} /> : null}

      <Card>
        <CardHeader>
          <CardTitle>RFQ Context</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-700">
          <p><span className="font-medium">RFQ:</span> {rfq.title}</p>
          <p><span className="font-medium">RFQ ID:</span> {rfq.id}</p>
          <p><span className="font-medium">Planned release mode:</span> {releaseMode}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Form Builder</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="form-name">Form name</Label>
            <Input id="form-name" value={newFormName} onChange={(e) => setNewFormName(e.target.value)} placeholder="Form name" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="form-description">Description</Label>
            <Textarea
              id="form-description"
              value={newFormDescription}
              onChange={(e) => setNewFormDescription(e.target.value)}
              placeholder="Optional instructions for suppliers"
            />
          </div>

          <div className="grid gap-2 md:grid-cols-4">
            <Input value={newFieldLabel} onChange={(e) => setNewFieldLabel(e.target.value)} placeholder="Field label" />
            <Input value={newFieldKey} onChange={(e) => setNewFieldKey(e.target.value)} placeholder="field_key" />
            <Select value={newFieldType} onValueChange={(value) => setNewFieldType(value as "TEXT" | "NUMBER" | "DOCUMENT")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TEXT">Text</SelectItem>
                <SelectItem value="NUMBER">Number</SelectItem>
                <SelectItem value="DOCUMENT">Document Upload</SelectItem>
              </SelectContent>
            </Select>
            <label className="flex items-center gap-2 rounded-md border px-3 text-sm">
              <input type="checkbox" checked={newFieldRequired} onChange={(e) => setNewFieldRequired(e.target.checked)} />
              Required
            </label>
          </div>

          <Button variant="outline" onClick={addDraftField} disabled={formAction.isPending}>
            Add Field
          </Button>

          <div className="space-y-2 rounded-md border p-3 text-sm">
            {draftFields.length === 0 ? (
              <p className="text-slate-500">No fields added yet.</p>
            ) : (
              draftFields.map((field) => (
                <div key={field.id} className="flex items-center justify-between">
                  <span>
                    {field.label} ({field.key}) - {field.type}
                    {field.required ? " - required" : ""}
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => setDraftFields((prev) => prev.filter((item) => item.id !== field.id))}>
                    Remove
                  </Button>
                </div>
              ))
            )}
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={saveForReuse} onChange={(e) => setSaveForReuse(e.target.checked)} />
            Save for reuse in future RFQs
          </label>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => router.push(`/rfqs/${rfq.id}`)}>
              Back to RFQ
            </Button>
            <Button disabled={!newFormName.trim() || draftFields.length === 0 || formAction.isPending} onClick={() => void attachAndReturn()}>
              Add Form
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
