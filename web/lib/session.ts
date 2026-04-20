export type PortalType = "organization" | "supplier";

export const SESSION_COOKIE_KEYS = {
  portal: "pc_portal",
  tenantId: "pc_tenant_id",
  companyId: "pc_company_id",
  actorId: "pc_actor_id",
  actorName: "pc_actor_name",
  actorInitials: "pc_actor_initials",
  actorRoles: "pc_actor_roles",
  supplierId: "pc_supplier_id",
} as const;

export type SessionProfile = {
  portal: PortalType;
  tenantId: string;
  companyId: string;
  actorId: string;
  actorName: string;
  actorInitials: string;
  actorRoles: string[];
  supplierId?: string;
};

export const ORGANIZATION_SESSION: SessionProfile = {
  portal: "organization",
  tenantId: "dev-tenant",
  companyId: "dev-company",
  actorId: "org-kyle",
  actorName: "Kyle",
  actorInitials: "KY",
  actorRoles: [
    "SUPERADMIN",
    "PROCUREMENT_OFFICER",
    "PROCUREMENT_MANAGER",
    "COMPLIANCE_OFFICER",
    "ADMIN",
    "EVALUATOR",
  ],
};

export const SUPPLIER_SESSION: SessionProfile = {
  portal: "supplier",
  tenantId: "dev-tenant",
  companyId: "dev-company",
  actorId: "supplier-test-user",
  actorName: "test_supplier",
  actorInitials: "TS",
  actorRoles: ["SUPPLIER"],
  supplierId: undefined,
};

export function getSessionProfile(portal: PortalType) {
  return portal === "supplier" ? SUPPLIER_SESSION : ORGANIZATION_SESSION;
}

export function readBrowserSessionProfile(): Partial<SessionProfile> | null {
  if (typeof document === "undefined") return null;

  const cookieMap = new Map(
    document.cookie
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const eq = part.indexOf("=");
        if (eq === -1) return [part, ""];
        return [part.slice(0, eq), decodeURIComponent(part.slice(eq + 1))];
      }),
  );

  const portal = cookieMap.get(SESSION_COOKIE_KEYS.portal) as PortalType | undefined;
  const tenantId = cookieMap.get(SESSION_COOKIE_KEYS.tenantId);
  const companyId = cookieMap.get(SESSION_COOKIE_KEYS.companyId);
  const actorId = cookieMap.get(SESSION_COOKIE_KEYS.actorId);
  const actorName = cookieMap.get(SESSION_COOKIE_KEYS.actorName);
  const actorInitials = cookieMap.get(SESSION_COOKIE_KEYS.actorInitials);
  const actorRoles = cookieMap.get(SESSION_COOKIE_KEYS.actorRoles)
    ?.split(",")
    .map((role) => role.trim().toUpperCase())
    .filter(Boolean);
  const supplierId = cookieMap.get(SESSION_COOKIE_KEYS.supplierId);

  if (!portal && !actorRoles?.length) return null;

  return {
    portal,
    tenantId: tenantId || undefined,
    companyId: companyId || undefined,
    actorId: actorId || undefined,
    actorName: actorName || undefined,
    actorInitials: actorInitials || undefined,
    actorRoles,
    supplierId: supplierId || undefined,
  };
}
