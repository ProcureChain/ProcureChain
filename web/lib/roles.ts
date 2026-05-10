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
  PR_APPROVE: ["APPROVER", "MANAGER", "ADMIN"],
  RFQ_RELEASE: ["BUYER", "MANAGER", "ADMIN"],
  RFQ_OPEN: ["BUYER", "MANAGER", "ADMIN"],
  RFQ_AWARD: ["APPROVER", "MANAGER", "ADMIN"],
  BID_EVALUATE: ["BUYER", "APPROVER", "MANAGER", "ADMIN"],
  BID_RECOMMEND: ["APPROVER", "MANAGER", "ADMIN"],
  PO_RELEASE: ["BUYER", "MANAGER", "ADMIN"],
  PO_SUPPLIER_RESPOND: ["SUPPLIER", "BUYER", "MANAGER", "ADMIN"],
  PO_CLOSE: ["APPROVER", "MANAGER", "ADMIN"],
  COI_REVIEW: ["APPROVER", "MANAGER", "ADMIN"],
  POLICY_EDIT: ["MANAGER", "ADMIN"],
  SOD_EDIT: ["ADMIN"],
  GOV_EXPORT: ["MANAGER", "ADMIN"],
  RETENTION_RUN: ["ADMIN"],
};

const LEGACY_ROLE_MAP: Record<string, string> = {
  SUPERADMIN: "ADMIN",
  PROCUREMENT_OFFICER: "BUYER",
  PROCUREMENT_MANAGER: "MANAGER",
  COMPLIANCE_OFFICER: "APPROVER",
  FINANCE_MANAGER: "APPROVER",
  EVALUATOR: "APPROVER",
};

function normalizeActorRoles(actorRoles: string[]) {
  return actorRoles
    .map((role) => role.trim().toUpperCase())
    .map((role) => LEGACY_ROLE_MAP[role] ?? role)
    .filter(Boolean);
}

export function canPerformAction(action: AppAction, actorRoles = runtimeConfig.actorRoles) {
  const normalizedRoles = normalizeActorRoles(actorRoles);
  if (normalizedRoles.includes("ADMIN")) {
    return true;
  }
  const allowedRoles = ACTION_ROLES[action] ?? [];
  return normalizedRoles.some((role) => allowedRoles.includes(role));
}

export function permissionHint(action: AppAction) {
  const normalizedRoles = normalizeActorRoles(runtimeConfig.actorRoles);
  if (normalizedRoles.includes("ADMIN")) {
    return "ADMIN override active";
  }
  const roles = ACTION_ROLES[action] ?? [];
  return `Requires role: ${roles.join(", ")}`;
}
