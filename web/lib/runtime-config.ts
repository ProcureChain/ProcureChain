import { readBrowserSessionProfile } from "@/lib/session";

const parseBoolean = (value: string | undefined, fallback: boolean) => {
  if (value == null) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
};

const parseCsv = (value: string | undefined, fallback: string[]) => {
  if (!value) return fallback;
  return value
    .split(",")
    .map((part) => part.trim().toUpperCase())
    .filter(Boolean);
};

const parseCsvRaw = (value: string | undefined, fallback: string[]) => {
  if (!value) return fallback;
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
};

const baseConfig = {
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8080",
  tenantId: process.env.NEXT_PUBLIC_TENANT_ID ?? "dev-tenant",
  companyId: process.env.NEXT_PUBLIC_COMPANY_ID ?? "dev-company",
  actorId: process.env.NEXT_PUBLIC_ACTOR_ID ?? "kyle-supertest",
  actorName: process.env.NEXT_PUBLIC_ACTOR_NAME ?? "Kyle",
  actorInitials: process.env.NEXT_PUBLIC_ACTOR_INITIALS ?? "KY",
  actorRoles: parseCsv(process.env.NEXT_PUBLIC_ACTOR_ROLES, ["PROCUREMENT_OFFICER"]),
  useMockApi: parseBoolean(process.env.NEXT_PUBLIC_USE_MOCK, false),
  defaultSubcategoryId: process.env.NEXT_PUBLIC_DEFAULT_SUBCATEGORY_ID ?? "FAC-SRV-MNT-001",
  companyDepartments: parseCsvRaw(process.env.NEXT_PUBLIC_COMPANY_DEPARTMENTS, [
    "Operations",
    "Finance",
    "IT",
    "Procurement",
  ]),
  companyCostCentres: parseCsvRaw(process.env.NEXT_PUBLIC_COMPANY_COST_CENTRES, [
    "OPS-001",
    "FIN-001",
    "IT-001",
    "PROC-001",
  ]),
  organizationCountry: (process.env.NEXT_PUBLIC_ORGANIZATION_COUNTRY ?? "ZA").toUpperCase(),
};

const sessionOverride = () => readBrowserSessionProfile();

export const runtimeConfig = {
  get apiBaseUrl() {
    return baseConfig.apiBaseUrl;
  },
  get tenantId() {
    return baseConfig.tenantId;
  },
  get companyId() {
    return baseConfig.companyId;
  },
  get actorId() {
    return sessionOverride()?.actorId ?? baseConfig.actorId;
  },
  get actorName() {
    return sessionOverride()?.actorName ?? baseConfig.actorName;
  },
  get actorInitials() {
    return sessionOverride()?.actorInitials ?? baseConfig.actorInitials;
  },
  get actorRoles() {
    return sessionOverride()?.actorRoles ?? baseConfig.actorRoles;
  },
  get portal() {
    return sessionOverride()?.portal ?? "organization";
  },
  get supplierId() {
    return sessionOverride()?.supplierId ?? undefined;
  },
  get isSupplierPortal() {
    return this.portal === "supplier" || this.actorRoles.includes("SUPPLIER");
  },
  get useMockApi() {
    return baseConfig.useMockApi;
  },
  get defaultSubcategoryId() {
    return baseConfig.defaultSubcategoryId;
  },
  get companyDepartments() {
    return baseConfig.companyDepartments;
  },
  get companyCostCentres() {
    return baseConfig.companyCostCentres;
  },
  get organizationCountry() {
    return baseConfig.organizationCountry;
  },
};
