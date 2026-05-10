import { runtimeConfig } from "@/lib/runtime-config";

export const formatMoney = (value: number, currency = "ZAR") =>
  new Intl.NumberFormat(runtimeConfig.organizationLanguage, {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
  })
    .formatToParts(value)
    .filter((part) => part.type !== "literal")
    .map((part) => part.value)
    .join("");

export const formatDate = (iso?: string) => {
  if (!iso) return "-";
  return new Intl.DateTimeFormat(runtimeConfig.organizationLanguage, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
};

export const formatDateTime = (iso?: string) => {
  if (!iso) return "-";
  return new Intl.DateTimeFormat(runtimeConfig.organizationLanguage, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
};

export const formatBusinessRef = (prefix: string, value?: string) => {
  if (!value) return "-";
  return `${prefix}-${value.slice(0, 8).toUpperCase()}`;
};

export const formatDomainLabel = (value?: string) => {
  if (!value) return "-";
  const normalized = value.trim();
  if (normalized === "Operations & Maintenance") return "MRO";
  return normalized;
};

const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  angola: "AO",
  congo: "CG",
  ethiopia: "ET",
  mozambique: "MZ",
  namibia: "NA",
  nigeria: "NG",
  "republic of congo": "CG",
  "south africa": "ZA",
  "united states": "US",
  usa: "US",
};

function countryFlagFromCode(code?: string) {
  const normalized = code?.trim().toUpperCase();
  if (!normalized || !/^[A-Z]{2}$/.test(normalized)) return "";
  return String.fromCodePoint(...[...normalized].map((char) => 127397 + char.charCodeAt(0)));
}

export const formatCountryWithFlag = (value?: string | null) => {
  const country = value?.trim();
  if (!country) return "-";

  const countryCode = /^[A-Za-z]{2}$/.test(country) ? country.toUpperCase() : COUNTRY_NAME_TO_CODE[country.toLowerCase()];
  const flag = countryFlagFromCode(countryCode);
  return flag ? `${flag} ${country}` : country;
};

const CODE_LABEL_PATTERN = /^[A-Z0-9]+(?:[_-][A-Z0-9]+)+$/;

function titleCaseWords(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((word) => {
      const upper = word.toUpperCase();
      if (["IT", "MRO", "PPE", "HVAC", "OEM", "SCADA", "PLC", "HMI", "UPS", "NDT", "ISO", "3PL"].includes(upper)) {
        return upper;
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

function humanizeCodeLabel(value: string) {
  const normalized = value.trim().replace(/-/g, "_");
  const parts = normalized.split("_").filter(Boolean);
  const trimmedParts =
    parts.length > 2 && parts[0].length <= 4 && parts[1].length <= 4 ? parts.slice(2) : parts;
  return titleCaseWords(trimmedParts.join(" "));
}

export const formatSubcategoryLabel = (primary?: string | null, fallback?: string | null) => {
  const preferred = primary?.trim();
  if (preferred && !CODE_LABEL_PATTERN.test(preferred)) {
    return preferred;
  }

  const backup = fallback?.trim();
  if (backup && !CODE_LABEL_PATTERN.test(backup)) {
    return backup;
  }

  if (preferred) return humanizeCodeLabel(preferred);
  if (backup) return humanizeCodeLabel(backup);
  return "-";
};

export const daysOld = (iso: string) => {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
};
