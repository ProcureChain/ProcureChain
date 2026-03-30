"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import { ApiErrorAlert } from "@/components/common/api-error-alert";
import { PageHeader } from "@/components/common/page-header";
import { PermissionNote } from "@/components/common/permission-note";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePolicyAction, useProcurementPolicy, useSoDRules } from "@/lib/query-hooks";
import { canPerformAction, permissionHint } from "@/lib/roles";

const SOD_ACTIONS = ["RFQ_RELEASE", "RFQ_OPEN", "RFQ_AWARD", "COI_REVIEW", "BID_EVALUATE", "BID_RECOMMEND"];

export default function SettingsPage() {
  const { data: policy, error: policyError } = useProcurementPolicy();
  const { data: sodRules = [], error: sodError } = useSoDRules();
  const policyAction = usePolicyAction();

  const [budgetAmount, setBudgetAmount] = useState("3000");
  const [resolved, setResolved] = useState<{ band: string; method: string } | null>(null);
  const [sodAction, setSodAction] = useState("RFQ_AWARD");
  const [allowedRoles, setAllowedRoles] = useState("PROCUREMENT_MANAGER,COMPLIANCE_OFFICER");

  const sodMap = useMemo(() => new Map(sodRules.map((rule) => [rule.action, rule])), [sodRules]);

  const savePolicy = async () => {
    if (!policy) return;
    try {
      await policyAction.mutateAsync({
        type: "update-procurement",
        data: {
          lowThreshold: Number(policy.lowThreshold),
          midThreshold: Number(policy.midThreshold),
          lowMethod: policy.lowMethod,
          midMethod: policy.midMethod,
          highMethod: policy.highMethod,
          emergencyMethod: policy.emergencyMethod,
          emergencyEnabled: policy.emergencyEnabled,
          requireEmergencyJustification: policy.requireEmergencyJustification,
        },
      });
      toast.success("Procurement policy updated");
    } catch (err) {
      toast.error("Policy update failed");
      console.error(err);
    }
  };

  const resolveMethod = async () => {
    try {
      const result = (await policyAction.mutateAsync({
        type: "resolve-method",
        data: {
          budgetAmount: Number(budgetAmount),
          isEmergency: false,
        },
      })) as { band: string; method: string };
      setResolved({ band: result.band, method: result.method });
    } catch (err) {
      toast.error("Method resolution failed");
      console.error(err);
    }
  };

  const saveSod = async () => {
    try {
      await policyAction.mutateAsync({
        type: "upsert-sod",
        action: sodAction,
        data: {
          allowedRoles: allowedRoles
            .split(",")
            .map((r) => r.trim().toUpperCase())
            .filter(Boolean),
          isActive: true,
        },
      });
      toast.success("SoD rule updated");
    } catch (err) {
      toast.error("SoD update failed");
      console.error(err);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Settings" description="Tenant policy, SoD controls, and method resolution." />

      {policyError ? <ApiErrorAlert error={policyError} /> : null}
      {sodError ? <ApiErrorAlert error={sodError} /> : null}
      {policyAction.error ? <ApiErrorAlert error={policyAction.error} /> : null}

      <Tabs defaultValue="policies" className="space-y-4">
        <TabsList>
          <TabsTrigger value="policies">Policies</TabsTrigger>
          <TabsTrigger value="resolve">Method Resolver</TabsTrigger>
          <TabsTrigger value="sod">SoD Matrix</TabsTrigger>
        </TabsList>

        <TabsContent value="policies">
          <Card>
            <CardHeader>
              <CardTitle>Procurement Policy</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 md:grid-cols-2">
              <Input value={String(policy?.lowThreshold ?? "")} disabled placeholder="Low threshold" />
              <Input value={String(policy?.midThreshold ?? "")} disabled placeholder="Mid threshold" />
              <Input value={policy?.lowMethod ?? ""} disabled placeholder="Low method" />
              <Input value={policy?.midMethod ?? ""} disabled placeholder="Mid method" />
              <Input value={policy?.highMethod ?? ""} disabled placeholder="High method" />
              <Input value={policy?.emergencyMethod ?? ""} disabled placeholder="Emergency method" />
              <div className="md:col-span-2">
                {!canPerformAction("POLICY_EDIT") ? <PermissionNote message={permissionHint("POLICY_EDIT")} /> : null}
                <Button onClick={savePolicy} disabled={policyAction.isPending || !policy || !canPerformAction("POLICY_EDIT")}>
                  Re-save Current Policy
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resolve">
          <Card>
            <CardHeader>
              <CardTitle>Resolve Procurement Method</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Input value={budgetAmount} onChange={(e) => setBudgetAmount(e.target.value)} placeholder="RFQ budget amount" />
              <Button onClick={resolveMethod} disabled={policyAction.isPending}>
                Resolve
              </Button>
              {resolved ? <p className="text-sm text-slate-700">Band: {resolved.band} • Method: {resolved.method}</p> : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sod">
          <Card>
            <CardHeader>
              <CardTitle>SoD Rule Editor</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <select
                className="h-10 rounded-md border px-3 text-sm"
                value={sodAction}
                onChange={(e) => {
                  setSodAction(e.target.value);
                  const found = sodMap.get(e.target.value);
                  if (found) setAllowedRoles(found.allowedRoles.join(","));
                }}
              >
                {SOD_ACTIONS.map((action) => (
                  <option key={action} value={action}>
                    {action}
                  </option>
                ))}
              </select>
              <Input value={allowedRoles} onChange={(e) => setAllowedRoles(e.target.value)} placeholder="Allowed roles CSV" />
              {!canPerformAction("SOD_EDIT") ? <PermissionNote message={permissionHint("SOD_EDIT")} /> : null}
              <Button onClick={saveSod} disabled={policyAction.isPending || !canPerformAction("SOD_EDIT")}>
                Save SoD Rule
              </Button>
              <div className="text-xs text-slate-500">
                Existing: {sodRules.map((rule) => `${rule.action}=[${rule.allowedRoles.join("|")}]`).join(" • ") || "none"}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
