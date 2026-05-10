"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import { ApiErrorAlert } from "@/components/common/api-error-alert";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSupplierDocumentAction, useSupplierDocuments, useSupplierProfile } from "@/lib/query-hooks";
import { formatDateTime, formatSubcategoryLabel } from "@/lib/format";

const verificationFields = [
  { key: "company_registration_certificate", label: "Company Registration Certificate" },
  { key: "tax_vat_certificate", label: "Tax / VAT Certificate" },
  { key: "bank_confirmation_letter", label: "Bank Confirmation Letter" },
];

export default function SupplierProfilePage() {
  const profile = useSupplierProfile();
  const documents = useSupplierDocuments();
  const uploadAction = useSupplierDocumentAction();
  const [fieldKey, setFieldKey] = useState(verificationFields[0].key);
  const [file, setFile] = useState<File | null>(null);

  const verificationStatus = profile.data?.onboardingProfile?.verificationStatus ?? "PENDING";
  const scoreBreakdown = useMemo(() => {
    const raw = profile.data?.onboardingProfile?.scoreBreakdown;
    if (!raw || typeof raw !== "object") return [];
    return Object.entries(raw).filter(([, value]) => typeof value === "number");
  }, [profile.data?.onboardingProfile?.scoreBreakdown]);

  const upload = async () => {
    if (!file) return;
    const label = verificationFields.find((entry) => entry.key === fieldKey)?.label ?? fieldKey;
    try {
      await uploadAction.mutateAsync({ fieldKey, label, file });
      setFile(null);
      const input = document.getElementById("supplier-doc-file") as HTMLInputElement | null;
      if (input) input.value = "";
      toast.success("Supplier verification document uploaded");
    } catch (err) {
      console.error(err);
      toast.error("Supplier document upload failed");
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Supplier Profile" description="Review onboarding status, score breakdown, category coverage, and upload verification documents." />
      {profile.error ? <ApiErrorAlert error={profile.error} /> : null}
      {documents.error ? <ApiErrorAlert error={documents.error} /> : null}
      {uploadAction.error ? <ApiErrorAlert error={uploadAction.error} /> : null}

      {!profile.data ? (
        <div className="rounded-xl border bg-white p-8 text-sm text-slate-500">Loading supplier profile...</div>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader><CardTitle>Verification</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500">Status</span>
                  <Badge variant={verificationStatus === "VERIFIED" ? "default" : "secondary"}>{verificationStatus}</Badge>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500">Tier</span>
                  <span className="font-medium">{profile.data.onboardingProfile?.tier ?? "-"}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500">Profile Score</span>
                  <span className="font-medium">{profile.data.profileScore ?? "-"}</span>
                </div>
                <p className="text-xs text-slate-500">Bid submission stays blocked until verification status becomes VERIFIED.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Supplier Details</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p><span className="font-medium">Company:</span> {profile.data.name}</p>
                <p><span className="font-medium">Registration:</span> {profile.data.registrationNumber ?? "-"}</p>
                <p><span className="font-medium">Email:</span> {profile.data.email ?? "-"}</p>
                <p><span className="font-medium">Phone:</span> {profile.data.phone ?? "-"}</p>
                <p><span className="font-medium">Country:</span> {profile.data.country ?? "-"}</p>
                <p><span className="font-medium">Website:</span> {profile.data.website ?? "-"}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Coverage</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p><span className="font-medium">Years in operation:</span> {profile.data.onboardingProfile?.yearsInOperation ?? "-"}</p>
                <p><span className="font-medium">Employees:</span> {profile.data.onboardingProfile?.employeeCountRange ?? "-"}</p>
                <p><span className="font-medium">Regions:</span> {(profile.data.onboardingProfile?.regionsServed ?? []).join(", ") || "-"}</p>
                <div>
                  <p className="font-medium">Subcategories</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {profile.data.tags.length === 0 ? <span className="text-slate-500">No categories assigned</span> : profile.data.tags.map((tag) => (
                      <Badge key={tag.id} variant="outline">
                        {formatSubcategoryLabel(tag.subcategory?.level3 ?? tag.subcategory?.name, tag.subcategoryId)}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <Card>
              <CardHeader><CardTitle>Score Breakdown</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {scoreBreakdown.length === 0 ? (
                  <EmptyState title="No score breakdown" description="Scoring details will appear once onboarding questionnaire results are available." />
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {scoreBreakdown.map(([key, value]) => (
                      <div key={key} className="rounded-xl border bg-slate-50 p-4">
                        <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">{key}</p>
                        <p className="mt-2 text-2xl font-semibold text-slate-900">{Number(value)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Upload Verification Documents</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label>Document Type</Label>
                  <select value={fieldKey} onChange={(e) => setFieldKey(e.target.value)} className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm">
                    {verificationFields.map((entry) => <option key={entry.key} value={entry.key}>{entry.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="supplier-doc-file">Document File</Label>
                  <Input id="supplier-doc-file" type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                </div>
                <Button className="w-full" disabled={!file || uploadAction.isPending} onClick={() => void upload()}>
                  {uploadAction.isPending ? "Uploading..." : "Upload Document"}
                </Button>
                <p className="text-xs text-slate-500">Uploading a verification document moves the supplier status to UNDER_REVIEW until verification is completed.</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Verification Documents</CardTitle></CardHeader>
            <CardContent>
              {documents.data && documents.data.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b bg-slate-50 text-left">
                        <th className="px-3 py-2 font-medium">Type</th>
                        <th className="px-3 py-2 font-medium">Filename</th>
                        <th className="px-3 py-2 font-medium">Uploaded</th>
                      </tr>
                    </thead>
                    <tbody>
                      {documents.data.map((document) => (
                        <tr key={document.id} className="border-b">
                          <td className="px-3 py-2">{document.label ?? document.fieldKey}</td>
                          <td className="px-3 py-2">{document.originalName}</td>
                          <td className="px-3 py-2">{formatDateTime(document.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-slate-500">No supplier verification documents uploaded yet.</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
