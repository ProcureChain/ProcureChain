"use client";

import { useParams } from "next/navigation";
import { toast } from "sonner";
import { Building2, CheckCircle2, FileText, Globe2, Mail, Phone, ShieldCheck, Star, Truck, Users, XCircle } from "lucide-react";

import { ApiErrorAlert } from "@/components/common/api-error-alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSupplier, useSupplierVerificationAction } from "@/lib/query-hooks";
import { formatCountryWithFlag, formatDateTime, formatSubcategoryLabel } from "@/lib/format";

function verificationClass(status: string) {
  if (status === "VERIFIED") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "UNDER_REVIEW") return "border-blue-200 bg-blue-50 text-blue-700";
  if (status === "REJECTED") return "border-red-200 bg-red-50 text-red-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function scoreClass(score?: number) {
  if (score == null) return "border-[var(--border)] bg-white text-[var(--text-secondary)]";
  if (score >= 85) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (score >= 70) return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-red-200 bg-red-50 text-red-700";
}

function letterGrade(score?: number) {
  if (score == null) return "-";
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "E";
}

function averageDefined(values: Array<number | undefined>) {
  const clean = values.filter((value): value is number => typeof value === "number");
  if (clean.length === 0) return undefined;
  return Math.round(clean.reduce((sum, value) => sum + value, 0) / clean.length);
}

function complianceInsight(score?: number) {
  if (score == null) return "AI insight: Compliance readiness is not yet scored. Complete the supplier profile and verification evidence to generate a reliable grade.";
  if (score >= 90) return "AI insight: Strong compliance posture with minimal readiness gaps for procurement activity.";
  if (score >= 80) return "AI insight: Good compliance readiness. Minor profile or evidence gaps may still need review.";
  if (score >= 70) return "AI insight: Moderate readiness. Review compliance evidence before high-value awards.";
  if (score >= 60) return "AI insight: Compliance needs attention before relying on this supplier for critical sourcing.";
  return "AI insight: Significant readiness gaps. Verification and documentation should be prioritised.";
}

function performanceInsight(score?: number) {
  if (score == null) return "AI insight: Performance is not yet scored. Delivery, quality, and risk outcomes will improve this report once trading history exists.";
  if (score >= 90) return "AI insight: Strong service delivery record with low operational risk indicators.";
  if (score >= 80) return "AI insight: Reliable supplier performance. Continue monitoring delivery and quality consistency.";
  if (score >= 70) return "AI insight: Acceptable performance with some areas that should be monitored during active orders.";
  if (score >= 60) return "AI insight: Performance requires closer oversight before assigning sensitive or urgent work.";
  return "AI insight: Weak performance indicators. Use caution and request corrective actions before future awards.";
}

function ComplianceScoreCard({
  complianceScore,
  profileScore,
}: {
  complianceScore?: number;
  profileScore?: number;
}) {
  const readinessScore = averageDefined([complianceScore, profileScore]);
  const grade = letterGrade(readinessScore);
  return (
    <Card className="overflow-hidden rounded-[28px] border-[var(--border)] bg-white shadow-[var(--shadow-sm)]">
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
              <ShieldCheck className="h-4 w-4 text-[var(--secondary)]" />
              Supplier Scorecard
            </div>
            <h2 className="mt-3 text-2xl font-semibold text-[var(--text-primary)]">Compliance</h2>
          </div>
          <div className={`flex h-20 w-20 items-center justify-center rounded-[24px] border text-4xl font-semibold ${scoreClass(readinessScore)}`}>
            {grade}
          </div>
        </div>
        <p className="mt-5 rounded-2xl bg-[var(--surface-muted)] p-4 text-sm leading-6 text-[var(--text-secondary)]">{complianceInsight(readinessScore)}</p>
      </CardContent>
    </Card>
  );
}

function PerformanceScoreCard({
  deliveryScore,
  qualityScore,
  riskScore,
}: {
  deliveryScore?: number;
  qualityScore?: number;
  riskScore?: number;
}) {
  const performanceScore = averageDefined([deliveryScore, qualityScore, riskScore]);
  return (
    <Card className="overflow-hidden rounded-[28px] border-[var(--border)] bg-white shadow-[var(--shadow-sm)]">
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
              <Truck className="h-4 w-4 text-[var(--secondary)]" />
              Supplier Scorecard
            </div>
            <h2 className="mt-3 text-2xl font-semibold text-[var(--text-primary)]">Company Performance</h2>
          </div>
          <div className={`flex h-20 min-w-20 items-center justify-center rounded-[24px] border px-5 text-3xl font-semibold ${scoreClass(performanceScore)}`}>
            {performanceScore ?? "-"}
          </div>
        </div>
        <p className="mt-5 rounded-2xl bg-[var(--surface-muted)] p-4 text-sm leading-6 text-[var(--text-secondary)]">{performanceInsight(performanceScore)}</p>
      </CardContent>
    </Card>
  );
}

function DetailCard({ label, value, icon, note }: { label: string; value: string; icon: React.ReactNode; note?: string }) {
  return (
    <Card className="rounded-3xl border-[var(--border)] bg-white shadow-[var(--shadow-sm)]">
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-[var(--surface-muted)] p-3 text-[var(--secondary)]">{icon}</div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--text-secondary)]">{label}</p>
            <p className="mt-1 truncate text-lg font-semibold text-[var(--text-primary)]">{value || "-"}</p>
            {note ? <p className="mt-1 text-sm text-[var(--text-muted)]">{note}</p> : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

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
  const primaryContact = data.contacts[0];
  const managed = Boolean(data.onboardingProfile || (data.documents?.length ?? 0) > 0);

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[32px] border border-[var(--border)] bg-[linear-gradient(135deg,#2D334A_0%,#444A74_100%)] text-white shadow-[var(--shadow-lg)]">
        <div className="grid gap-6 p-6 lg:grid-cols-[1.35fr_0.65fr] lg:p-8">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-3xl border border-white/15 bg-white/10 p-4">
                <Building2 className="h-8 w-8" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/65">Supplier Profile</p>
                <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">{data.name}</h1>
              </div>
            </div>
            <p className="mt-5 max-w-3xl text-sm leading-6 text-white/75">
              Supplier verification, score breakdown, category coverage, uploaded documents, and contact details.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Badge variant="outline" className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${verificationClass(verificationStatus)}`}>
                {verificationStatus.replaceAll("_", " ")}
              </Badge>
              <Badge variant="outline" className="rounded-full border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white">
                {managed ? "Organisation Supplier" : "Public Directory"}
              </Badge>
              <Badge variant="outline" className="rounded-full border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white">
                {formatCountryWithFlag(data.country)}
              </Badge>
            </div>
          </div>

          <div className="rounded-3xl border border-white/15 bg-white/10 p-5">
            <p className="text-sm text-white/70">Compliance Grade</p>
            <p className="mt-3 text-5xl font-semibold tracking-tight">{letterGrade(averageDefined([data.complianceScore, data.profileScore]))}</p>
            <p className="mt-3 text-sm leading-6 text-white/70">
              {verificationStatus === "VERIFIED"
                ? "Supplier is verified and available for procurement workflows."
                : "Supplier requires verification review before full trust can be applied."}
            </p>
            <div className="mt-5 flex gap-2">
              <Button
                className="rounded-full bg-white text-[var(--primary)] hover:bg-white/90"
                disabled={verificationAction.isPending || verificationStatus === "VERIFIED"}
                onClick={() => void updateVerification("VERIFIED")}
              >
                <CheckCircle2 className="h-4 w-4" />
                Mark Verified
              </Button>
              <Button
                variant="outline"
                className="rounded-full border-white/20 bg-white/10 text-white hover:bg-white/15 hover:text-white"
                disabled={verificationAction.isPending || verificationStatus === "REJECTED"}
                onClick={() => void updateVerification("REJECTED")}
              >
                <XCircle className="h-4 w-4" />
                Reject
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-4">
        <DetailCard label="Country" value={formatCountryWithFlag(data.country)} icon={<Globe2 className="h-5 w-5" />} note={`Status: ${data.status}`} />
        <DetailCard label="Primary Contact" value={primaryContact?.name ?? "-"} icon={<Users className="h-5 w-5" />} note={primaryContact?.email ?? "No contact email"} />
        <DetailCard label="Tier" value={data.onboardingProfile?.tier ?? "-"} icon={<Star className="h-5 w-5" />} note="Onboarding score tier" />
        <DetailCard label="Documents" value={String(data.documents?.length ?? 0)} icon={<FileText className="h-5 w-5" />} note="Verification documents" />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <ComplianceScoreCard complianceScore={data.complianceScore} profileScore={data.profileScore} />
        <PerformanceScoreCard deliveryScore={data.deliveryScore} qualityScore={data.qualityScore} riskScore={data.riskScore} />
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <Card className="rounded-[28px] border-[var(--border)] bg-white shadow-[var(--shadow-sm)]">
          <CardHeader>
            <CardTitle>Category Coverage</CardTitle>
          </CardHeader>
          <CardContent>
            {data.tags.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">No tags assigned.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {data.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="rounded-full px-3 py-1">
                    {formatSubcategoryLabel(tag)}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-[var(--border)] bg-white shadow-[var(--shadow-sm)]">
          <CardHeader>
            <CardTitle>Contacts</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {data.contacts.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">No contacts captured.</p>
            ) : (
              data.contacts.map((contact) => (
                <div key={contact.id} className="rounded-3xl border border-[var(--border)] bg-[var(--surface-muted)] p-4 text-sm">
                  <p className="font-semibold text-[var(--text-primary)]">{contact.name}</p>
                  <p className="mt-2 flex items-center gap-2 text-[var(--text-secondary)]">
                    <Mail className="h-4 w-4 text-[var(--secondary)]" />
                    {contact.email}
                  </p>
                  {contact.phone ? (
                    <p className="mt-1 flex items-center gap-2 text-[var(--text-secondary)]">
                      <Phone className="h-4 w-4 text-[var(--secondary)]" />
                      {contact.phone}
                    </p>
                  ) : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      <Card className="rounded-[28px] border-[var(--border)] bg-white shadow-[var(--shadow-sm)]">
        <CardHeader>
          <CardTitle>Verification Documents</CardTitle>
        </CardHeader>
        <CardContent>
          {data.documents && data.documents.length > 0 ? (
            <div className="overflow-hidden rounded-3xl border border-[var(--border)]">
              <table className="w-full text-sm">
                <thead className="bg-[var(--surface-muted)] text-left text-[var(--text-muted)]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Filename</th>
                    <th className="px-4 py-3 font-medium">Uploaded</th>
                  </tr>
                </thead>
                <tbody>
                  {data.documents.map((document) => (
                    <tr key={document.id} className="border-t border-[var(--border)]">
                      <td className="px-4 py-3">{document.label ?? document.fieldKey}</td>
                      <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{document.originalName}</td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">{formatDateTime(document.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-6 text-sm text-[var(--text-muted)]">
              No verification documents uploaded yet.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
