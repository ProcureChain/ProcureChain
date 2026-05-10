"use client";

import { useEffect, useMemo, useState } from "react";
import { Fragment } from "react";
import { toast } from "sonner";
import { CheckCircle2, GitBranch, Globe2, Mail, Plus, ShieldCheck, UserCog, Users, Wallet } from "lucide-react";

import { ApiErrorAlert } from "@/components/common/api-error-alert";
import { PageHeader } from "@/components/common/page-header";
import { PermissionNote } from "@/components/common/permission-note";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useOrganizationAdminSettings, useOrganizationAdminSettingsAction, useOrganizationProfile } from "@/lib/query-hooks";
import { formatMoney } from "@/lib/format";
import { canPerformAction, permissionHint } from "@/lib/roles";
import type { OrganizationApprovalRoute, OrganizationBudgetAllocation, OrganizationCostCentre, OrganizationDepartment } from "@/lib/types";

const USER_ROLE_OPTIONS = [
  "REQUESTER",
  "APPROVER",
  "BUYER",
  "MANAGER",
  "EXECUTIVE",
  "ADMIN",
];
const STANDARD_ROLE_OPTIONS = [...USER_ROLE_OPTIONS];

const ROLE_PERMISSION_GROUPS: Array<{
  group: string;
  actions: Array<{ key: string; label: string }>;
}> = [
  {
    group: "Procurement Operations",
    actions: [
      { key: "create_pr", label: "Create requisitions (PRs)" },
      { key: "edit_pr", label: "Edit requisitions and line items" },
      { key: "release_rfq", label: "Release RFQs" },
      { key: "award_rfq", label: "Award RFQs and create POs" },
    ],
  },
  {
    group: "Supplier & Bid Management",
    actions: [
      { key: "view_supplier", label: "View supplier directory and profiles" },
      { key: "compare_bids", label: "Access bid comparison views" },
      { key: "recommend_bid", label: "Recommend bids for approval" },
    ],
  },
  {
    group: "Financial Controls",
    actions: [
      { key: "manage_budget", label: "Manage budgets and cost centres" },
      { key: "approve_invoice", label: "Review/sign invoices and upload PoP" },
      { key: "close_po", label: "Close purchase orders" },
    ],
  },
  {
    group: "Administration",
    actions: [
      { key: "manage_users", label: "Create users and assign roles" },
      { key: "view_audit", label: "View workflow chat and audit trails" },
      { key: "manage_settings", label: "Manage organisation settings" },
    ],
  },
];

const DEFAULT_ROLE_PERMISSION_MAP: Record<string, string[]> = {
  REQUESTER: ["create_pr", "edit_pr", "view_supplier", "view_audit"],
  APPROVER: ["award_rfq", "recommend_bid", "approve_invoice", "close_po", "view_audit"],
  BUYER: ["release_rfq", "view_supplier", "compare_bids", "recommend_bid", "view_audit"],
  MANAGER: ["create_pr", "edit_pr", "release_rfq", "award_rfq", "view_supplier", "compare_bids", "recommend_bid", "manage_budget", "approve_invoice", "close_po", "manage_users", "view_audit", "manage_settings"],
  EXECUTIVE: ["view_audit"],
  ADMIN: ["create_pr", "edit_pr", "release_rfq", "award_rfq", "view_supplier", "compare_bids", "recommend_bid", "manage_budget", "approve_invoice", "close_po", "manage_users", "view_audit", "manage_settings"],
};

type SettingsTab = "users" | "structure" | "budgets";

function verificationClass(status?: string | null) {
  if (status === "VERIFIED") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "UNDER_REVIEW") return "border-blue-200 bg-blue-50 text-blue-700";
  if (status === "REJECTED") return "border-red-200 bg-red-50 text-red-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function toggleSelection(values: string[], value: string) {
  return values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value];
}

function rolesRequireDepartmentScope(roles: string[]) {
  return roles.some((role) => role !== "ADMIN" && role !== "EXECUTIVE");
}

function resolvePrimaryRole(roles: string[]) {
  const priority = ["ADMIN", "MANAGER", "BUYER", "APPROVER", "REQUESTER", "EXECUTIVE"];
  for (const role of priority) {
    if (roles.includes(role)) return role;
  }
  return roles[0] ?? "REQUESTER";
}

function SettingsShell({
  title,
  description,
  action,
  hideHeaderBorder = false,
  hideCardBorder = false,
  plain = false,
  children,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  hideHeaderBorder?: boolean;
  hideCardBorder?: boolean;
  plain?: boolean;
  children: React.ReactNode;
}) {
  if (plain) {
    return (
      <div>
        <div className={`flex flex-wrap items-start justify-between gap-4 px-1 py-1 ${hideHeaderBorder ? "" : "border-b border-[var(--border)]"}`}>
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">{title}</h2>
            <p className="mt-1 text-sm leading-5 text-[var(--text-secondary)]">{description}</p>
          </div>
          {action ? <div className="flex items-center gap-2">{action}</div> : null}
        </div>
        <div className="px-0 py-4">{children}</div>
      </div>
    );
  }

  return (
    <Card className={`rounded-[24px] bg-white shadow-[var(--shadow-sm)] ${hideCardBorder ? "border-transparent" : "border-[var(--border)]"}`}>
      <CardContent className="p-0">
        <div className={`flex flex-wrap items-start justify-between gap-4 px-5 py-4 ${hideHeaderBorder ? "" : "border-b border-[var(--border)]"}`}>
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">{title}</h2>
            <p className="mt-1 text-sm leading-5 text-[var(--text-secondary)]">{description}</p>
          </div>
          {action ? <div className="flex items-center gap-2">{action}</div> : null}
        </div>
        <div className="px-5 py-5">{children}</div>
      </CardContent>
    </Card>
  );
}

function FieldRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2.5 border-b border-[var(--border)] py-3 md:grid-cols-[200px_minmax(0,1fr)] md:items-center">
      <div>
        <p className="text-sm font-medium text-[var(--text-primary)]">{label}</p>
        {hint ? <p className="mt-0.5 text-xs leading-5 text-[var(--text-muted)]">{hint}</p> : null}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function MiniStat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">{label}</p>
          <p className="mt-1.5 text-base font-semibold text-[var(--text-primary)]">{value}</p>
        </div>
        <div className="rounded-xl bg-white p-2 text-[var(--secondary)] shadow-[var(--shadow-sm)]">{icon}</div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { data: orgProfile, error: orgProfileError } = useOrganizationProfile();
  const { data: adminSettings, error: adminSettingsError } = useOrganizationAdminSettings();
  const adminAction = useOrganizationAdminSettingsAction();

  const [activeTab, setActiveTab] = useState<SettingsTab>("users");
  const [departments, setDepartments] = useState<OrganizationDepartment[]>([]);
  const [costCentres, setCostCentres] = useState<OrganizationCostCentre[]>([]);
  const [departmentBudgets, setDepartmentBudgets] = useState<OrganizationBudgetAllocation[]>([]);
  const [costCentreBudgets, setCostCentreBudgets] = useState<OrganizationBudgetAllocation[]>([]);
  const [approvalRoutes, setApprovalRoutes] = useState<OrganizationApprovalRoute[]>([]);
  const [totalBudget, setTotalBudget] = useState("0");
  const [budgetCurrency, setBudgetCurrency] = useState("ZAR");

  const [newDepartmentCode, setNewDepartmentCode] = useState("");
  const [newDepartmentName, setNewDepartmentName] = useState("");
  const [newCostCentreCode, setNewCostCentreCode] = useState("");
  const [newCostCentreName, setNewCostCentreName] = useState("");
  const [newCostCentreDepartmentId, setNewCostCentreDepartmentId] = useState("");
  const [departmentModalOpen, setDepartmentModalOpen] = useState(false);
  const [costCentreModalOpen, setCostCentreModalOpen] = useState(false);
  const [structureView, setStructureView] = useState<"departments" | "costCentres">("departments");
  const [selectedDepartmentBudgetScopeId, setSelectedDepartmentBudgetScopeId] = useState("");
  const [selectedDepartmentBudgetAmount, setSelectedDepartmentBudgetAmount] = useState("");
  const [selectedCostCentreBudgetScopeId, setSelectedCostCentreBudgetScopeId] = useState("");
  const [selectedCostCentreBudgetAmount, setSelectedCostCentreBudgetAmount] = useState("");

  const [newUserFullName, setNewUserFullName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserJobTitle, setNewUserJobTitle] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<string>("REQUESTER");
  const [newUserDepartmentIds, setNewUserDepartmentIds] = useState<string[]>([]);
  const [createUserModalOpen, setCreateUserModalOpen] = useState(false);
  const [customRoles, setCustomRoles] = useState<Array<{ id: string; name: string; permissions: string[] }>>([]);
  const [userPermissionOverrides, setUserPermissionOverrides] = useState<Array<{ userId: string; permissions: string[] }>>([]);
  const [selectedRole, setSelectedRole] = useState<string>("REQUESTER");
  const [newCustomRoleName, setNewCustomRoleName] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [userAccessView, setUserAccessView] = useState<"users" | "roles">("users");

  useEffect(() => {
    if (!adminSettings) return;
    setDepartments(adminSettings.settings.departments ?? []);
    setCostCentres(adminSettings.settings.costCentres ?? []);
    setDepartmentBudgets(adminSettings.settings.departmentBudgets ?? []);
    setCostCentreBudgets(adminSettings.settings.costCentreBudgets ?? []);
    setApprovalRoutes(adminSettings.settings.approvalRoutes ?? []);
    setCustomRoles(adminSettings.settings.customRoles ?? []);
    setUserPermissionOverrides(adminSettings.settings.userPermissionOverrides ?? []);
    setTotalBudget(String(adminSettings.settings.totalBudget ?? 0));
    setBudgetCurrency(adminSettings.settings.budgetCurrency ?? "ZAR");
    if (!selectedUserId && adminSettings.users.length > 0) {
      setSelectedUserId(adminSettings.users[0].id);
    }
  }, [adminSettings]);

  const canManageAdmin = canPerformAction("POLICY_EDIT") || canPerformAction("SOD_EDIT");
  const activeDepartments = departments.filter((department) => department.isActive);
  const activeCostCentres = costCentres.filter((costCentre) => costCentre.isActive);
  const departmentCodeMap = useMemo(() => new Map(departments.map((department) => [department.id, department.code])), [departments]);
  const allRoleOptions = [...STANDARD_ROLE_OPTIONS, ...customRoles.map((role) => role.name)];
  const selectedCustomRole = customRoles.find((role) => role.name === selectedRole);
  const selectedRolePermissions = new Set(
    selectedCustomRole?.permissions ??
      DEFAULT_ROLE_PERMISSION_MAP[selectedRole] ??
      [],
  );
  const selectedRoleIsStandard = STANDARD_ROLE_OPTIONS.includes(selectedRole);
  const selectedUser = adminSettings?.users.find((user) => user.id === selectedUserId);
  const selectedUserPrimaryRole = selectedUser ? resolvePrimaryRole(selectedUser.roles ?? []) : "REQUESTER";
  const selectedUserOverride = userPermissionOverrides.find((entry) => entry.userId === selectedUserId);

  const saveAdminSettings = async (successMessage: string) => {
    try {
      await adminAction.mutateAsync({
        type: "save-settings",
        data: {
          departments,
          costCentres,
          totalBudget: Number(totalBudget || 0),
          budgetCurrency,
          departmentBudgets,
          costCentreBudgets,
          approvalRoutes,
          customRoles,
          userPermissionOverrides,
        },
      });
      toast.success(successMessage);
    } catch (error) {
      console.error(error);
      toast.error("Failed to update organisation settings");
    }
  };

  const createUser = async () => {
    if (!newUserFullName.trim() || !newUserEmail.trim()) {
      toast.error("Full name and email are required");
      return;
    }
    try {
      const requiresDepartment = rolesRequireDepartmentScope([newUserRole]);
      if (requiresDepartment && newUserDepartmentIds.length === 0) {
        toast.error("Assign at least one department for this role selection");
        return;
      }
      const result = (await adminAction.mutateAsync({
        type: "create-user",
        data: {
          fullName: newUserFullName.trim(),
          email: newUserEmail.trim().toLowerCase(),
          password: newUserPassword.trim() || undefined,
          jobTitle: newUserJobTitle.trim() || undefined,
          roles: [newUserRole],
          departmentIds: requiresDepartment ? newUserDepartmentIds : [],
        },
      })) as { invite?: { inviteUrl?: string } | null };
      if (result?.invite?.inviteUrl) {
        await navigator.clipboard.writeText(result.invite.inviteUrl);
        toast.success("User created and invite link copied");
      } else {
        toast.success("Organisation user created");
      }
      setNewUserFullName("");
      setNewUserEmail("");
      setNewUserJobTitle("");
      setNewUserPassword("");
      setNewUserRole("REQUESTER");
      setNewUserDepartmentIds([]);
      setCreateUserModalOpen(false);
    } catch (error) {
      console.error(error);
      toast.error("Failed to create organisation user");
    }
  };

  const triggerInvite = async (userId: string) => {
    try {
      const result = await adminAction.mutateAsync({ type: "invite-user", userId });
      const inviteUrl = (result as any)?.inviteUrl;
      if (!inviteUrl) throw new Error("Invite URL missing");
      await navigator.clipboard.writeText(inviteUrl);
      toast.success("Invite link copied");
    } catch (error) {
      console.error(error);
      toast.error("Failed to issue invite link");
    }
  };

  const triggerReset = async (userId: string) => {
    try {
      const result = await adminAction.mutateAsync({ type: "reset-user-password", userId });
      const token = (result as any)?.token;
      if (!token) throw new Error("Reset token missing");
      await navigator.clipboard.writeText(token);
      toast.success("Password reset token copied");
    } catch (error) {
      console.error(error);
      toast.error("Failed to issue password reset");
    }
  };

  const updateUser = async (userId: string, data: { isActive?: boolean; roles?: string[]; departmentIds?: string[] }) => {
    try {
      await adminAction.mutateAsync({ type: "update-user", userId, data });
      toast.success("User updated");
    } catch (error) {
      console.error(error);
      toast.error("Failed to update user");
    }
  };

  const addDepartment = () => {
    if (!newDepartmentCode.trim() || !newDepartmentName.trim()) {
      toast.error("Department code and name are required");
      return;
    }
    setDepartments((current) => [...current, { id: crypto.randomUUID(), code: newDepartmentCode.trim().toUpperCase(), name: newDepartmentName.trim(), isActive: true }]);
    setNewDepartmentCode("");
    setNewDepartmentName("");
    setDepartmentModalOpen(false);
  };

  const addCostCentre = () => {
    if (!newCostCentreCode.trim() || !newCostCentreName.trim()) {
      toast.error("Cost centre code and name are required");
      return;
    }
    setCostCentres((current) => [...current, { id: crypto.randomUUID(), code: newCostCentreCode.trim().toUpperCase(), name: newCostCentreName.trim(), departmentId: newCostCentreDepartmentId || undefined, isActive: true }]);
    setNewCostCentreCode("");
    setNewCostCentreName("");
    setNewCostCentreDepartmentId("");
    setCostCentreModalOpen(false);
  };

  const upsertDepartmentBudget = (scopeId: string, amount: string) => {
    setDepartmentBudgets((current) => {
      const numeric = Number(amount || 0);
      const existing = current.find((entry) => entry.scopeId === scopeId);
      if (existing) return current.map((entry) => (entry.scopeId === scopeId ? { ...entry, amount: numeric } : entry));
      return [...current, { id: crypto.randomUUID(), scopeId, amount: numeric }];
    });
  };

  const upsertCostCentreBudget = (scopeId: string, amount: string) => {
    setCostCentreBudgets((current) => {
      const numeric = Number(amount || 0);
      const existing = current.find((entry) => entry.scopeId === scopeId);
      if (existing) return current.map((entry) => (entry.scopeId === scopeId ? { ...entry, amount: numeric } : entry));
      return [...current, { id: crypto.randomUUID(), scopeId, amount: numeric }];
    });
  };

  const addOrUpdateDepartmentBudget = () => {
    if (!selectedDepartmentBudgetScopeId) {
      toast.error("Select a department");
      return;
    }
    upsertDepartmentBudget(selectedDepartmentBudgetScopeId, selectedDepartmentBudgetAmount);
    setSelectedDepartmentBudgetAmount("");
    setSelectedDepartmentBudgetScopeId("");
  };

  const addOrUpdateCostCentreBudget = () => {
    if (!selectedCostCentreBudgetScopeId) {
      toast.error("Select a cost centre");
      return;
    }
    upsertCostCentreBudget(selectedCostCentreBudgetScopeId, selectedCostCentreBudgetAmount);
    setSelectedCostCentreBudgetAmount("");
    setSelectedCostCentreBudgetScopeId("");
  };

  const structureAction = <Button onClick={() => void saveAdminSettings("Organisation structure updated")} disabled={adminAction.isPending || !canManageAdmin}>Save Structure</Button>;
  const budgetsAction = <Button onClick={() => void saveAdminSettings("Budget controls updated")} disabled={adminAction.isPending || !canManageAdmin}>Save Budgets</Button>;
  const saveRolePermissions = async () => {
    await saveAdminSettings("Role settings updated");
  };

  const toggleRolePermission = (role: string, actionKey: string) => {
    const match = customRoles.find((entry) => entry.name === role);
    if (!match) return;
    setCustomRoles((current) =>
      current.map((entry) => {
        if (entry.name !== role) return entry;
        const next = new Set(entry.permissions);
        if (next.has(actionKey)) next.delete(actionKey);
        else next.add(actionKey);
        return { ...entry, permissions: Array.from(next) };
      }),
    );
  };

  const updateUserPermissionOverride = (userId: string, actionKey: string) => {
    setUserPermissionOverrides((current) => {
      const existing = current.find((entry) => entry.userId === userId);
      const nextPermissions = new Set(existing?.permissions ?? []);
      if (nextPermissions.has(actionKey)) nextPermissions.delete(actionKey);
      else nextPermissions.add(actionKey);
      const next = current.filter((entry) => entry.userId !== userId);
      if (nextPermissions.size === 0) return next;
      return [...next, { userId, permissions: Array.from(nextPermissions) }];
    });
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Settings" description="Structured organisation controls for users, budgeting, and workflow routing." />

      {orgProfileError ? <ApiErrorAlert error={orgProfileError} /> : null}
      {adminSettingsError ? <ApiErrorAlert error={adminSettingsError} /> : null}
      {adminAction.error ? <ApiErrorAlert error={adminAction.error} /> : null}
      {!canManageAdmin ? <PermissionNote message={permissionHint("POLICY_EDIT")} /> : null}

      <div className="space-y-4">
        <div className="flex justify-end">
          <Badge variant="outline" className={verificationClass(orgProfile?.verificationStatus)}>
            {orgProfile?.verificationStatus?.replaceAll("_", " ") ?? "Profile Missing"}
          </Badge>
        </div>
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as SettingsTab)} className="mt-5">
          <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start">
            <div className="rounded-xl bg-transparent p-2">
              <TabsList className="grid w-full grid-cols-2 gap-1 bg-transparent p-0 lg:grid-cols-1">
                <TabsTrigger value="users" className="h-9 justify-start rounded-lg px-3 text-sm">Users & Access</TabsTrigger>
                <TabsTrigger value="structure" className="h-9 justify-start rounded-lg px-3 text-sm">Structure</TabsTrigger>
                <TabsTrigger value="budgets" className="h-9 justify-start rounded-lg px-3 text-sm">Budgets</TabsTrigger>
              </TabsList>
            </div>

            <div className="min-w-0">
          <TabsContent value="users" className="space-y-4 mt-0">
            <Card className="rounded-2xl border-[var(--border)] bg-white">
              <CardContent className="p-0">
                <div className="border-b border-[var(--border)] px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">User Roles & Permissions</p>
                    <div className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-1">
                      <button
                        type="button"
                        onClick={() => setUserAccessView("users")}
                        className={`rounded-md px-3 py-1.5 text-sm ${userAccessView === "users" ? "bg-white text-[var(--text-primary)] shadow-sm" : "text-[var(--text-secondary)]"}`}
                      >
                        Users
                      </button>
                      <button
                        type="button"
                        onClick={() => setUserAccessView("roles")}
                        className={`rounded-md px-3 py-1.5 text-sm ${userAccessView === "roles" ? "bg-white text-[var(--text-primary)] shadow-sm" : "text-[var(--text-secondary)]"}`}
                      >
                        Roles
                      </button>
                    </div>
                  </div>
                </div>
                {userAccessView === "roles" ? (
                  <div className="grid gap-4 p-4 lg:grid-cols-[260px_minmax(0,1fr)]">
                    <div className="space-y-2">
                      {allRoleOptions.map((role) => {
                        const active = selectedRole === role;
                        return (
                          <button
                            key={role}
                            type="button"
                            onClick={() => setSelectedRole(role)}
                            className={`w-full rounded-lg border px-3 py-2 text-left text-sm font-semibold ${active ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--border)] bg-white text-[var(--text-primary)]"}`}
                          >
                            {role.replaceAll("_", " ")}
                          </button>
                        );
                      })}
                      <div className="space-y-2 rounded-lg border border-[var(--border)] p-2">
                        <Input value={newCustomRoleName} onChange={(e) => setNewCustomRoleName(e.target.value)} placeholder="Custom role name" />
                        <Button
                          type="button"
                          className="w-full"
                          disabled={!canManageAdmin}
                          onClick={() => {
                            const name = newCustomRoleName.trim();
                            if (!name) return;
                            if (allRoleOptions.includes(name)) {
                              toast.error("Role already exists");
                              return;
                            }
                            setCustomRoles((current) => [...current, { id: crypto.randomUUID(), name, permissions: [] }]);
                            setSelectedRole(name);
                            setNewCustomRoleName("");
                          }}
                        >
                          Add Custom Role
                        </Button>
                      </div>
                      <Button type="button" className="w-full" disabled={!canManageAdmin} onClick={() => void saveRolePermissions()}>
                        Save Role Permissions
                      </Button>
                    </div>
                    <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
                      <table className="min-w-full text-sm">
                        <thead className="bg-[var(--surface-muted)] text-left text-[var(--text-muted)]">
                          <tr>
                            <th className="px-4 py-2.5 font-medium">Action</th>
                            <th className="px-3 py-2.5 text-center font-medium">{selectedRole.replaceAll("_", " ")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ROLE_PERMISSION_GROUPS.map((group) => (
                            <Fragment key={group.group}>
                              <tr className="border-t border-[var(--border)] bg-white">
                                <td colSpan={2} className="px-4 py-2.5 font-semibold text-[var(--text-primary)]">{group.group}</td>
                              </tr>
                              {group.actions.map((action) => (
                                <tr key={action.key} className="border-t border-[var(--border)]">
                                  <td className="px-4 py-2.5">{action.label}</td>
                                  <td className="px-3 py-2.5 text-center">
                                    <input
                                      type="checkbox"
                                      checked={selectedRolePermissions.has(action.key)}
                                      disabled={!canManageAdmin || selectedRoleIsStandard}
                                      onChange={() => toggleRolePermission(selectedRole, action.key)}
                                      className="h-4 w-4 accent-[var(--primary)]"
                                    />
                                  </td>
                                </tr>
                              ))}
                            </Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-0 lg:grid-cols-[340px_minmax(0,1fr)]">
                    <div className="border-r border-[var(--border)] p-4">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-[var(--text-primary)]">Organization Users</p>
                        <Dialog open={createUserModalOpen} onOpenChange={setCreateUserModalOpen}>
                          <DialogTrigger asChild>
                            <Button size="sm" className="bg-[var(--primary)] text-white hover:bg-[var(--primary)]/90" disabled={!canManageAdmin}>
                              <Plus className="mr-1 h-4 w-4" />
                              Create User
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Create New User</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-3">
                              <Input value={newUserFullName} onChange={(e) => setNewUserFullName(e.target.value)} placeholder="Full name" />
                              <Input value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} placeholder="Email" />
                              <Input value={newUserJobTitle} onChange={(e) => setNewUserJobTitle(e.target.value)} placeholder="Job title" />
                              <Input type="password" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} placeholder="Optional password" />
                              <select className="h-10 w-full rounded-md border px-3 text-sm" value={newUserRole} onChange={(e) => setNewUserRole(e.target.value)}>
                                {allRoleOptions.map((role) => <option key={role} value={role}>{role.replaceAll("_", " ")}</option>)}
                              </select>
                              {rolesRequireDepartmentScope([newUserRole]) ? (
                                <div className="space-y-2">
                                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Department Access</p>
                                  <div className="flex flex-wrap gap-2">
                                    {activeDepartments.map((department) => {
                                      const active = newUserDepartmentIds.includes(department.id);
                                      return (
                                        <button
                                          key={department.id}
                                          type="button"
                                          onClick={() => setNewUserDepartmentIds((current) => toggleSelection(current, department.id))}
                                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${active ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--border)] bg-white text-[var(--text-secondary)]"}`}
                                        >
                                          {department.code} - {department.name}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              ) : null}
                              <Button onClick={() => void createUser()} disabled={adminAction.isPending || !canManageAdmin} className="w-full">
                                Create User
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                      <div className="space-y-2">
                        {adminSettings?.users.map((user) => {
                          const active = user.id === selectedUserId;
                          return (
                            <button
                              key={user.id}
                              type="button"
                              onClick={() => setSelectedUserId(user.id)}
                              className={`w-full rounded-lg border px-3 py-2 text-left ${active ? "border-[var(--primary)] bg-[var(--portal-org-bg)]" : "border-[var(--border)] bg-white"}`}
                            >
                              <p className="text-sm font-semibold text-[var(--text-primary)]">{user.fullName}</p>
                              <p className="text-xs text-[var(--text-secondary)]">{user.email}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="p-4">
                      {selectedUser ? (
                        <div className="space-y-4">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <p className="font-semibold text-[var(--text-primary)]">{selectedUser.fullName}</p>
                            <p className="mt-1 text-sm text-[var(--text-secondary)]">{selectedUser.email}</p>
                            <p className="mt-1 text-sm text-[var(--text-muted)]">{selectedUser.jobTitle ?? "No job title"}</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className={selectedUser.isActive ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-600"}>{selectedUser.isActive ? "Active" : "Inactive"}</Badge>
                            <Button variant="outline" size="sm" disabled={adminAction.isPending || !canManageAdmin} onClick={() => void updateUser(selectedUser.id, { isActive: !selectedUser.isActive })}>{selectedUser.isActive ? "Deactivate" : "Activate"}</Button>
                            <Button variant="outline" size="sm" disabled={adminAction.isPending || !canManageAdmin} onClick={() => void triggerInvite(selectedUser.id)}>Copy Invite</Button>
                            <Button variant="outline" size="sm" disabled={adminAction.isPending || !canManageAdmin} onClick={() => void triggerReset(selectedUser.id)}>Copy Reset</Button>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <select
                            className="h-9 min-w-[240px] rounded-md border px-3 text-sm"
                            value={selectedUserPrimaryRole}
                            disabled={adminAction.isPending || !canManageAdmin}
                            onChange={(e) => {
                              const nextRole = e.target.value;
                              const needsDepartmentScope = rolesRequireDepartmentScope([nextRole]);
                              const nextDepartmentIds = needsDepartmentScope
                                ? (selectedUser.departmentIds?.length ? selectedUser.departmentIds : activeDepartments[0] ? [activeDepartments[0].id] : [])
                                : [];
                              void updateUser(selectedUser.id, { roles: [nextRole], departmentIds: nextDepartmentIds });
                            }}
                          >
                            {allRoleOptions.map((role) => <option key={role} value={role}>{role.replaceAll("_", " ")}</option>)}
                          </select>
                        </div>

                        {rolesRequireDepartmentScope([selectedUserPrimaryRole]) ? (
                          <div className="space-y-1.5">
                            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Department Access</p>
                            <div className="flex flex-wrap gap-2">
                              {activeDepartments.map((department) => {
                                const active = (selectedUser.departmentIds ?? []).includes(department.id);
                                return (
                                  <button
                                    key={department.id}
                                    type="button"
                                    disabled={adminAction.isPending || !canManageAdmin}
                                    onClick={() => {
                                      const nextDepartmentIds = toggleSelection(selectedUser.departmentIds ?? [], department.id);
                                      if (nextDepartmentIds.length === 0) {
                                        toast.error("At least one department is required for this user");
                                        return;
                                      }
                                      void updateUser(selectedUser.id, { departmentIds: nextDepartmentIds });
                                    }}
                                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${active ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--border)] bg-white text-[var(--text-secondary)]"}`}
                                  >
                                    {department.code}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ) : null}

                        <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
                          <table className="min-w-full text-sm">
                            <thead className="bg-[var(--surface-muted)] text-left text-[var(--text-muted)]">
                              <tr>
                                <th className="px-4 py-2.5 font-medium">Permission</th>
                                <th className="px-3 py-2.5 text-center font-medium">Override</th>
                              </tr>
                            </thead>
                            <tbody>
                              {ROLE_PERMISSION_GROUPS.map((group) => (
                                <Fragment key={`${selectedUser.id}-${group.group}`}>
                                  <tr className="border-t border-[var(--border)] bg-white">
                                    <td colSpan={2} className="px-4 py-2.5 font-semibold text-[var(--text-primary)]">{group.group}</td>
                                  </tr>
                                  {group.actions.map((action) => {
                                    const checked = (selectedUserOverride?.permissions ?? []).includes(action.key);
                                    return (
                                      <tr key={`${selectedUser.id}-${action.key}`} className="border-t border-[var(--border)]">
                                        <td className="px-4 py-2.5">{action.label}</td>
                                        <td className="px-3 py-2.5 text-center">
                                          <input
                                            type="checkbox"
                                            className="h-4 w-4 accent-[var(--primary)]"
                                            checked={checked}
                                            disabled={adminAction.isPending || !canManageAdmin}
                                            onChange={() => updateUserPermissionOverride(selectedUser.id, action.key)}
                                          />
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </Fragment>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <Button type="button" size="sm" variant="outline" disabled={adminAction.isPending || !canManageAdmin} onClick={() => void saveRolePermissions()}>
                          Save User Override
                        </Button>
                        </div>
                      ) : (
                        <p className="text-sm text-[var(--text-muted)]">No users found.</p>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="structure" className="space-y-4 mt-0">
            <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-4">
              <MiniStat label="Departments" value={String(activeDepartments.length)} icon={<Users className="h-4 w-4" />} />
              <MiniStat label="Cost Centres" value={String(activeCostCentres.length)} icon={<Wallet className="h-4 w-4" />} />
              <MiniStat label="Linked Centres" value={String(costCentres.filter((costCentre) => Boolean(costCentre.departmentId)).length)} icon={<GitBranch className="h-4 w-4" />} />
              <MiniStat label="Source" value="Settings" icon={<ShieldCheck className="h-4 w-4" />} />
            </div>

            <SettingsShell title="Departments & Cost Centres" description="Maintain the active organisational structures available during PR and RFQ creation." action={structureAction}>
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-1">
                    <button
                      type="button"
                      onClick={() => setStructureView("departments")}
                      className={`rounded-md px-3 py-1.5 text-sm ${structureView === "departments" ? "bg-white text-[var(--text-primary)] shadow-sm" : "text-[var(--text-secondary)]"}`}
                    >
                      Departments
                    </button>
                    <button
                      type="button"
                      onClick={() => setStructureView("costCentres")}
                      className={`rounded-md px-3 py-1.5 text-sm ${structureView === "costCentres" ? "bg-white text-[var(--text-primary)] shadow-sm" : "text-[var(--text-secondary)]"}`}
                    >
                      Cost Centres
                    </button>
                  </div>

                  {structureView === "departments" ? (
                    <Dialog open={departmentModalOpen} onOpenChange={setDepartmentModalOpen}>
                      <DialogTrigger asChild>
                        <Button type="button" variant="outline" size="sm">Add New Department</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add Department</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-[var(--text-primary)]">Code</p>
                            <Input value={newDepartmentCode} onChange={(e) => setNewDepartmentCode(e.target.value)} placeholder="Code" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-[var(--text-primary)]">Department name</p>
                            <Input value={newDepartmentName} onChange={(e) => setNewDepartmentName(e.target.value)} placeholder="Department name" />
                          </div>
                          <Button type="button" className="w-full" onClick={addDepartment}>Create Department</Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  ) : (
                    <Dialog open={costCentreModalOpen} onOpenChange={setCostCentreModalOpen}>
                      <DialogTrigger asChild>
                        <Button type="button" variant="outline" size="sm">Add New Cost Centre</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add Cost Centre</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-[var(--text-primary)]">Code</p>
                            <Input value={newCostCentreCode} onChange={(e) => setNewCostCentreCode(e.target.value)} placeholder="Code" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-[var(--text-primary)]">Cost centre name</p>
                            <Input value={newCostCentreName} onChange={(e) => setNewCostCentreName(e.target.value)} placeholder="Cost centre name" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-[var(--text-primary)]">Department</p>
                            <select className="h-10 w-full rounded-md border px-3 text-sm" value={newCostCentreDepartmentId} onChange={(e) => setNewCostCentreDepartmentId(e.target.value)}>
                              <option value="">Link department</option>
                              {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                            </select>
                          </div>
                          <Button type="button" className="w-full" onClick={addCostCentre}>Create Cost Centre</Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>

                <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
                  {structureView === "departments" ? (
                    <table className="min-w-full text-sm">
                      <thead className="bg-[var(--surface-muted)] text-left text-[var(--text-muted)]">
                        <tr>
                          <th className="px-3 py-2 font-medium">Code</th>
                          <th className="px-3 py-2 font-medium">Name</th>
                          <th className="px-3 py-2 font-medium">Status</th>
                          <th className="px-3 py-2 font-medium">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {departments.map((department) => (
                          <tr key={department.id} className="border-t border-[var(--border)]">
                            <td className="px-3 py-2"><Input value={department.code} onChange={(e) => setDepartments((current) => current.map((item) => (item.id === department.id ? { ...item, code: e.target.value.toUpperCase() } : item)))} /></td>
                            <td className="px-3 py-2"><Input value={department.name} onChange={(e) => setDepartments((current) => current.map((item) => (item.id === department.id ? { ...item, name: e.target.value } : item)))} /></td>
                            <td className="px-3 py-2"><Badge variant="outline" className={department.isActive ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-600"}>{department.isActive ? "Active" : "Disabled"}</Badge></td>
                            <td className="px-3 py-2"><Button type="button" variant="outline" size="sm" onClick={() => setDepartments((current) => current.map((item) => (item.id === department.id ? { ...item, isActive: !item.isActive } : item)))}>{department.isActive ? "Disable" : "Enable"}</Button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <table className="min-w-full text-sm">
                      <thead className="bg-[var(--surface-muted)] text-left text-[var(--text-muted)]">
                        <tr>
                          <th className="px-3 py-2 font-medium">Code</th>
                          <th className="px-3 py-2 font-medium">Name</th>
                          <th className="px-3 py-2 font-medium">Department</th>
                          <th className="px-3 py-2 font-medium">Status</th>
                          <th className="px-3 py-2 font-medium">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {costCentres.map((costCentre) => (
                          <tr key={costCentre.id} className="border-t border-[var(--border)]">
                            <td className="px-3 py-2"><Input value={costCentre.code} onChange={(e) => setCostCentres((current) => current.map((item) => (item.id === costCentre.id ? { ...item, code: e.target.value.toUpperCase() } : item)))} /></td>
                            <td className="px-3 py-2"><Input value={costCentre.name} onChange={(e) => setCostCentres((current) => current.map((item) => (item.id === costCentre.id ? { ...item, name: e.target.value } : item)))} /></td>
                            <td className="px-3 py-2">
                              <select className="h-10 w-full rounded-md border px-3 text-sm" value={costCentre.departmentId ?? ""} onChange={(e) => setCostCentres((current) => current.map((item) => (item.id === costCentre.id ? { ...item, departmentId: e.target.value || undefined } : item)))}>
                                <option value="">No department link</option>
                                {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                              </select>
                            </td>
                            <td className="px-3 py-2"><Badge variant="outline" className={costCentre.isActive ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-600"}>{costCentre.isActive ? "Active" : "Disabled"}</Badge></td>
                            <td className="px-3 py-2"><Button type="button" variant="outline" size="sm" onClick={() => setCostCentres((current) => current.map((item) => (item.id === costCentre.id ? { ...item, isActive: !item.isActive } : item)))}>{costCentre.isActive ? "Disable" : "Enable"}</Button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </SettingsShell>
          </TabsContent>

          <TabsContent value="budgets" className="space-y-4 mt-0">
            <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-4">
              <MiniStat label="Total Budget" value={formatMoney(Number(totalBudget || 0), budgetCurrency || "ZAR")} icon={<Wallet className="h-4 w-4" />} />
              <MiniStat label="Currency" value={budgetCurrency || "ZAR"} icon={<Globe2 className="h-4 w-4" />} />
              <MiniStat label="Dept Budgets" value={String(departmentBudgets.length)} icon={<Users className="h-4 w-4" />} />
              <MiniStat label="Centre Budgets" value={String(costCentreBudgets.length)} icon={<CheckCircle2 className="h-4 w-4" />} />
            </div>

            <SettingsShell title="Budget Controls" description="These values are used during RFQ creation to validate available organisational budget." action={budgetsAction}>
              <FieldRow label="Total budget" hint="Organisation-wide ceiling checked before RFQ creation.">
                <div className="grid gap-2.5 md:grid-cols-[minmax(0,1fr)_180px]">
                  <Input value={totalBudget} onChange={(e) => setTotalBudget(e.target.value)} placeholder="Total organisation budget" />
                  <Input value={budgetCurrency} onChange={(e) => setBudgetCurrency(e.target.value.toUpperCase())} placeholder="Currency" />
                </div>
              </FieldRow>
              <FieldRow label="Department budgets" hint={`Assign budget by department in ${budgetCurrency || "ZAR"}.`}>
                <div className="space-y-3">
                  <div className="grid gap-2.5 md:grid-cols-[minmax(0,1fr)_180px_auto]">
                    <select className="h-10 rounded-md border px-3 text-sm" value={selectedDepartmentBudgetScopeId} onChange={(e) => setSelectedDepartmentBudgetScopeId(e.target.value)}>
                      <option value="">Select department</option>
                      {departments.map((department) => (
                        <option key={department.id} value={department.id}>
                          {department.code} - {department.name}
                        </option>
                      ))}
                    </select>
                    <Input value={selectedDepartmentBudgetAmount} onChange={(e) => setSelectedDepartmentBudgetAmount(e.target.value)} placeholder={`Amount (${budgetCurrency || "ZAR"})`} />
                    <Button type="button" variant="outline" onClick={addOrUpdateDepartmentBudget}>Add / Update</Button>
                  </div>
                  <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
                    <table className="min-w-full text-sm">
                      <thead className="bg-[var(--surface-muted)] text-left text-[var(--text-muted)]">
                        <tr>
                          <th className="px-3 py-2 font-medium">Department</th>
                          <th className="px-3 py-2 font-medium">Code</th>
                          <th className="px-3 py-2 font-medium">Budget ({budgetCurrency || "ZAR"})</th>
                          <th className="px-3 py-2 font-medium">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {departmentBudgets.map((allocation) => {
                          const department = departments.find((item) => item.id === allocation.scopeId);
                          if (!department) return null;
                          return (
                            <tr key={allocation.id} className="border-t border-[var(--border)]">
                              <td className="px-3 py-2">{department.name}</td>
                              <td className="px-3 py-2">{department.code}</td>
                              <td className="px-3 py-2">
                                <Input value={String(allocation.amount)} onChange={(e) => upsertDepartmentBudget(department.id, e.target.value)} />
                              </td>
                              <td className="px-3 py-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setDepartmentBudgets((current) => current.filter((entry) => entry.id !== allocation.id))}
                                >
                                  Remove
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                        {departmentBudgets.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-3 py-4 text-center text-[var(--text-muted)]">No department budgets added.</td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </div>
              </FieldRow>
              <FieldRow label="Cost centre budgets" hint={`Assign budget by cost centre in ${budgetCurrency || "ZAR"}.`}>
                <div className="space-y-3">
                  <div className="grid gap-2.5 md:grid-cols-[minmax(0,1fr)_180px_auto]">
                    <select className="h-10 rounded-md border px-3 text-sm" value={selectedCostCentreBudgetScopeId} onChange={(e) => setSelectedCostCentreBudgetScopeId(e.target.value)}>
                      <option value="">Select cost centre</option>
                      {costCentres.map((costCentre) => (
                        <option key={costCentre.id} value={costCentre.id}>
                          {costCentre.code} - {costCentre.name}
                        </option>
                      ))}
                    </select>
                    <Input value={selectedCostCentreBudgetAmount} onChange={(e) => setSelectedCostCentreBudgetAmount(e.target.value)} placeholder={`Amount (${budgetCurrency || "ZAR"})`} />
                    <Button type="button" variant="outline" onClick={addOrUpdateCostCentreBudget}>Add / Update</Button>
                  </div>
                  <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
                    <table className="min-w-full text-sm">
                      <thead className="bg-[var(--surface-muted)] text-left text-[var(--text-muted)]">
                        <tr>
                          <th className="px-3 py-2 font-medium">Cost Centre</th>
                          <th className="px-3 py-2 font-medium">Code</th>
                          <th className="px-3 py-2 font-medium">Department</th>
                          <th className="px-3 py-2 font-medium">Budget ({budgetCurrency || "ZAR"})</th>
                          <th className="px-3 py-2 font-medium">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {costCentreBudgets.map((allocation) => {
                          const costCentre = costCentres.find((item) => item.id === allocation.scopeId);
                          if (!costCentre) return null;
                          return (
                            <tr key={allocation.id} className="border-t border-[var(--border)]">
                              <td className="px-3 py-2">{costCentre.name}</td>
                              <td className="px-3 py-2">{costCentre.code}</td>
                              <td className="px-3 py-2">{costCentre.departmentId ? departments.find((department) => department.id === costCentre.departmentId)?.name ?? "-" : "-"}</td>
                              <td className="px-3 py-2">
                                <Input value={String(allocation.amount)} onChange={(e) => upsertCostCentreBudget(costCentre.id, e.target.value)} />
                              </td>
                              <td className="px-3 py-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setCostCentreBudgets((current) => current.filter((entry) => entry.id !== allocation.id))}
                                >
                                  Remove
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                        {costCentreBudgets.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-3 py-4 text-center text-[var(--text-muted)]">No cost centre budgets added.</td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </div>
              </FieldRow>
            </SettingsShell>
          </TabsContent>

            </div>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
