"use client";

import { useState } from "react";
import { toast } from "sonner";

import { ApiErrorAlert } from "@/components/common/api-error-alert";
import { PageHeader } from "@/components/common/page-header";
import { PermissionNote } from "@/components/common/permission-note";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuditEvidence, useGovernanceAction, useGovernanceExports, useRetentionPolicy, useRetentionRuns } from "@/lib/query-hooks";
import { canPerformAction, permissionHint } from "@/lib/roles";

const EXPORT_TYPES = ["TENDER_REGISTER", "BID_OPENING_RECORD", "EVALUATION_PACK", "AWARD_REPORT_NOTICE", "COI_REGISTER", "RETENTION_LOG"];

export default function GovernancePage() {
  const { data: exports = [], error: exportsError } = useGovernanceExports();
  const { data: retentionPolicy, error: retentionPolicyError } = useRetentionPolicy();
  const { data: retentionRuns = [], error: retentionRunsError } = useRetentionRuns();
  const { data: evidence, error: evidenceError } = useAuditEvidence();
  const govAction = useGovernanceAction();

  const [exportType, setExportType] = useState("TENDER_REGISTER");
  const [retentionDays, setRetentionDays] = useState("3650");

  const runAction = async (task: () => Promise<unknown>, success: string, failure: string) => {
    try {
      await task();
      toast.success(success);
    } catch (err) {
      toast.error(failure);
      console.error(err);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Governance" description="Government exports, retention policy execution, and audit evidence checks." />
      {exportsError ? <ApiErrorAlert error={exportsError} /> : null}
      {retentionPolicyError ? <ApiErrorAlert error={retentionPolicyError} /> : null}
      {retentionRunsError ? <ApiErrorAlert error={retentionRunsError} /> : null}
      {evidenceError ? <ApiErrorAlert error={evidenceError} /> : null}
      {govAction.error ? <ApiErrorAlert error={govAction.error} /> : null}

      <Card>
        <CardHeader>
          <CardTitle>Generate Government Export</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {!canPerformAction("GOV_EXPORT") ? <PermissionNote message={permissionHint("GOV_EXPORT")} /> : null}
          <select className="h-10 rounded-md border px-3 text-sm" value={exportType} onChange={(e) => setExportType(e.target.value)}>
            {EXPORT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <Button disabled={!canPerformAction("GOV_EXPORT")} onClick={() => runAction(() => govAction.mutateAsync({ type: "generate-export", exportType, format: "CSV" }), "Export generated", "Export generation failed")}>
            Generate CSV
          </Button>
          <Button variant="outline" disabled={!canPerformAction("GOV_EXPORT")} onClick={() => runAction(() => govAction.mutateAsync({ type: "generate-export", exportType, format: "PDF" }), "Export generated", "Export generation failed")}>
            Generate PDF
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Retention Policy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!canPerformAction("RETENTION_RUN") ? <PermissionNote message={permissionHint("RETENTION_RUN")} /> : null}
          <p className="text-sm text-slate-600">
            Current: days={retentionPolicy?.auditRetentionDays ?? "-"} immutable={String(retentionPolicy?.enforceImmutability)} allowPurge={String(retentionPolicy?.allowPurge)}
          </p>
          <div className="flex flex-wrap gap-2">
            <Input value={retentionDays} onChange={(e) => setRetentionDays(e.target.value)} placeholder="Retention days" className="max-w-[220px]" />
            <Button
              disabled={!canPerformAction("RETENTION_RUN")}
              onClick={() =>
                runAction(
                  () => govAction.mutateAsync({ type: "update-retention", retention: { auditRetentionDays: Number(retentionDays), enforceImmutability: true, allowPurge: false } }),
                  "Retention policy updated",
                  "Retention policy update failed",
                )
              }
            >
              Update Policy
            </Button>
            <Button variant="outline" disabled={!canPerformAction("RETENTION_RUN")} onClick={() => runAction(() => govAction.mutateAsync({ type: "run-retention", dryRun: true }), "Retention dry run complete", "Retention run failed")}>
              Run Dry-Run
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Audit Evidence</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {evidence ? (
            <p>
              valid={String(evidence.valid)} checked={evidence.checked}
              {evidence.brokenEventId ? ` brokenEventId=${evidence.brokenEventId}` : ""}
            </p>
          ) : (
            <p className="text-slate-500">No evidence result yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Generated Exports</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {exports.length === 0 ? <p className="text-slate-500">No exports generated.</p> : exports.map((item) => <p key={item.id}>{item.exportType} • {item.format} • rows={item.rowCount} • {item.id}</p>)}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Retention Runs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {retentionRuns.length === 0 ? <p className="text-slate-500">No runs logged.</p> : retentionRuns.map((run) => <p key={run.id}>{run.mode} • eligible={run.eligibleCount} • purged={run.purgedCount} • {run.createdAt}</p>)}
        </CardContent>
      </Card>
    </div>
  );
}
