import { NextRequest, NextResponse } from "next/server";

const buildApiUrl = (request: NextRequest) => {
  const configuredBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8080";
  const normalizedBase = configuredBase.endsWith("/") ? configuredBase : `${configuredBase}/`;
  const url = new URL("audit/events", normalizedBase);
  request.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.set(key, value);
  });
  return url;
};

export async function GET(request: NextRequest) {
  const upstream = await fetch(buildApiUrl(request), {
    method: "GET",
    headers: {
      "x-request-id": request.headers.get("x-request-id") ?? crypto.randomUUID(),
      "x-tenant-id": request.headers.get("x-tenant-id") ?? "dev-tenant",
      "x-company-id": request.headers.get("x-company-id") ?? "dev-company",
      "x-user-id": request.headers.get("x-user-id") ?? "kyle-supertest",
      "x-user-roles":
        request.headers.get("x-user-roles") ??
        "SUPERADMIN,PROCUREMENT_OFFICER,PROCUREMENT_MANAGER,COMPLIANCE_OFFICER,ADMIN,EVALUATOR",
    },
    cache: "no-store",
  });

  const body = await upstream.text();
  return new NextResponse(body, {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "application/json; charset=utf-8",
      "x-request-id": upstream.headers.get("x-request-id") ?? "",
    },
  });
}
