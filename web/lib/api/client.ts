import { runtimeConfig } from "@/lib/runtime-config";

export class ApiError extends Error {
  statusCode: number;
  code?: string;
  details?: unknown;
  path?: string;
  requestId?: string | null;

  constructor(input: {
    message: string;
    statusCode: number;
    code?: string;
    details?: unknown;
    path?: string;
    requestId?: string | null;
  }) {
    super(input.message);
    this.name = "ApiError";
    this.statusCode = input.statusCode;
    this.code = input.code;
    this.details = input.details;
    this.path = input.path;
    this.requestId = input.requestId;
  }
}

const REQUEST_TIMEOUT_MS = 12000;

const buildUrl = (path: string, query?: Record<string, string | number | undefined>) => {
  const normalizedBase = runtimeConfig.apiBaseUrl.endsWith("/")
    ? runtimeConfig.apiBaseUrl
    : `${runtimeConfig.apiBaseUrl}/`;
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
  const url = new URL(normalizedPath, normalizedBase);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value == null || value === "") continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
};

export const extractError = async (response: Response) => {
  const requestId = response.headers.get("x-request-id");
  const fallbackMessage = `HTTP ${response.status}`;

  try {
    const body = (await response.json()) as {
      message?: string;
      statusCode?: number;
      code?: string;
      details?: unknown;
      path?: string;
      requestId?: string | null;
    };

    return new ApiError({
      message: body.message ?? fallbackMessage,
      statusCode: body.statusCode ?? response.status,
      code: body.code,
      details: body.details,
      path: body.path,
      requestId: body.requestId ?? requestId,
    });
  } catch {
    return new ApiError({
      message: fallbackMessage,
      statusCode: response.status,
      requestId,
    });
  }
};

export async function apiRequest<T>(
  path: string,
  init?: RequestInit & {
    query?: Record<string, string | number | undefined>;
    tenantId?: string;
    companyId?: string;
  },
): Promise<T> {
  const requestId = crypto.randomUUID();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    const isFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;
    const baseHeaders: Record<string, string> = {
      "x-request-id": requestId,
      "x-tenant-id": init?.tenantId ?? runtimeConfig.tenantId,
      "x-company-id": init?.companyId ?? runtimeConfig.companyId,
      "x-user-id": runtimeConfig.actorId,
      "x-user-roles": runtimeConfig.actorRoles.join(","),
    };
    if (runtimeConfig.isSupplierPortal && runtimeConfig.supplierId) {
      baseHeaders["x-partner-id"] = runtimeConfig.supplierId;
      baseHeaders["x-partner-user-id"] = runtimeConfig.actorId;
    }
    if (!isFormData) {
      baseHeaders["content-type"] = "application/json";
    }
    response = await fetch(buildUrl(path, init?.query), {
      ...init,
      headers: {
        ...baseHeaders,
        ...(init?.headers as Record<string, string> | undefined),
      },
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timeoutId);
    if ((error as Error).name === "AbortError") {
      throw new ApiError({
        message: `Request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`,
        statusCode: 408,
        code: "REQUEST_TIMEOUT",
        requestId,
      });
    }
    throw new ApiError({
      message: "Network request failed",
      statusCode: 0,
      code: "NETWORK_ERROR",
      requestId,
    });
  }
  clearTimeout(timeoutId);

  if (!response.ok) {
    throw await extractError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
