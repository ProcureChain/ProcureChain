import { runtimeConfig } from "@/lib/runtime-config";

export type AppAction =
  | "PR_APPROVE"
  | "RFQ_RELEASE"
  | "RFQ_OPEN"
  | "RFQ_AWARD"
  | "BID_EVALUATE"
  | "BID_RECOMMEND"
  | "PO_RELEASE"
  | "PO_SUPPLIER_RESPOND"
  | "PO_CLOSE"
  | "COI_REVIEW"
  | "POLICY_EDIT"
  | "SOD_EDIT"
  | "GOV_EXPORT"
  | "RETENTION_RUN";

const ACTION_ROLES: Record<AppAction, string[]> = {
  PR_APPROVE: ["PROCUREMENT_OFFICER", "PROCUREMENT_MANAGER", "COMPLIANCE_OFFICER"],
  RFQ_RELEASE: ["PROCUREMENT_OFFICER", "PROCUREMENT_MANAGER"],
  RFQ_OPEN: ["PROCUREMENT_OFFICER", "PROCUREMENT_MANAGER"],
  RFQ_AWARD: ["PROCUREMENT_MANAGER", "COMPLIANCE_OFFICER"],
  BID_EVALUATE: ["PROCUREMENT_OFFICER", "PROCUREMENT_MANAGER", "EVALUATOR"],
  BID_RECOMMEND: ["PROCUREMENT_MANAGER", "COMPLIANCE_OFFICER"],
  PO_RELEASE: ["PROCUREMENT_OFFICER", "PROCUREMENT_MANAGER"],
  PO_SUPPLIER_RESPOND: ["SUPPLIER", "PROCUREMENT_OFFICER", "PROCUREMENT_MANAGER"],
  PO_CLOSE: ["PROCUREMENT_OFFICER", "PROCUREMENT_MANAGER"],
  COI_REVIEW: ["COMPLIANCE_OFFICER"],
  POLICY_EDIT: ["PROCUREMENT_MANAGER", "COMPLIANCE_OFFICER", "ADMIN"],
  SOD_EDIT: ["COMPLIANCE_OFFICER", "ADMIN"],
  GOV_EXPORT: ["PROCUREMENT_MANAGER", "COMPLIANCE_OFFICER", "ADMIN"],
  RETENTION_RUN: ["COMPLIANCE_OFFICER", "ADMIN"],
};

export function canPerformAction(action: AppAction, actorRoles = runtimeConfig.actorRoles) {
  if (actorRoles.map((role) => role.toUpperCase()).includes("SUPERADMIN")) {
    return true;
  }
  const allowedRoles = ACTION_ROLES[action] ?? [];
  return actorRoles.some((role) => allowedRoles.includes(role));
}

export function permissionHint(action: AppAction) {
  if (runtimeConfig.actorRoles.map((role) => role.toUpperCase()).includes("SUPERADMIN")) {
    return "SUPERADMIN override active";
  }
  const roles = ACTION_ROLES[action] ?? [];
  return `Requires role: ${roles.join(", ")}`;
}
