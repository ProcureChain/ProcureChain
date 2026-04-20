"use client";

import { useParams } from "next/navigation";
import { toast } from "sonner";

import { ApiErrorAlert } from "@/components/common/api-error-alert";
import { PageHeader } from "@/components/common/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSupplier, useSupplierVerificationAction } from "@/lib/query-hooks";
import { formatDateTime } from "@/lib/format";

export default function SupplierDetailPage() {
  const params = useParams<{ id: string }>();
  const supplierId = params.id;
  const { data, error } = useSupplier(supplierId);
  const verificationAction = useSupplierVerificationAction();

  const updateVerification = async (verificationStatus: "VERIFIED" | "REJECTED") => {
    try {
      await verificationAction.mutateAsync({
        id: supplierId,
        verificationStatus,
      });
      toast.success(`Supplier marked as ${verificationStatus}`);
    } catch (err) {
      console.error(err);
      toast.error("Supplier verification update failed");
    }
  };

  if (error) return <ApiErrorAlert error={error} />;
  if (!data) return <div className="rounded-xl border bg-white p-8 text-sm text-slate-500">Loading supplier...</div>;

  const verificationStatus = data.onboardingProfile?.verificationStatus ?? "PENDING";

  return (
    <div className="space-y-4">
      <PageHeader
        title={data.name}
        description={`Supplier profile, onboarding review, and verification controls.`}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Verification</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500">Status</span>
              <Badge variant={verificationStatus === "VERIFIED" ? "default" : "secondary"}>
                {verificationStatus}
              </Badge>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500">Tier</span>
              <span className="font-medium">{data.onboardingProfile?.tier ?? "-"}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500">Profile Score</span>
              <span className="font-medium">{data.profileScore ?? "-"}</span>
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                disabled={verificationAction.isPending || verificationStatus === "VERIFIED"}
                onClick={() => void updateVerification("VERIFIED")}
              >
                Mark Verified
              </Button>
              <Button
                variant="outline"
                disabled={verificationAction.isPending || verificationStatus === "REJECTED"}
                onClick={() => void updateVerification("REJECTED")}
              >
                Reject
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="font-medium">Status:</span> {data.status}</p>
            <p><span className="font-medium">Country:</span> {data.country}</p>
            <p><span className="font-medium">Compliance Score:</span> {data.complianceScore ?? "-"}</p>
            <p><span className="font-medium">Delivery Score:</span> {data.deliveryScore ?? "-"}</p>
            <p><span className="font-medium">Quality Score:</span> {data.qualityScore ?? "-"}</p>
            <p><span className="font-medium">Risk Score:</span> {data.riskScore ?? "-"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tags</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {data.tags.length === 0 ? <p className="text-sm text-slate-500">No tags assigned.</p> : null}
            {data.tags.map((tag) => (
              <Badge key={tag}>{tag}</Badge>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Verification Documents</CardTitle>
        </CardHeader>
        <CardContent>
          {data.documents && data.documents.length > 0 ? (
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
                  {data.documents.map((document) => (
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
            <p className="text-sm text-slate-500">No verification documents uploaded yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contacts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.contacts.map((contact) => (
            <div key={contact.id} className="rounded-lg border p-3 text-sm">
              <p className="font-medium">{contact.name}</p>
              <p className="text-slate-600">{contact.email}</p>
              {contact.phone ? <p className="text-slate-600">{contact.phone}</p> : null}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
