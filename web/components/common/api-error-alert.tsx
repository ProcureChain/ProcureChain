import { AlertTriangle } from "lucide-react";

import { ApiError } from "@/lib/api/client";

export function ApiErrorAlert({ error }: { error: unknown }) {
  if (!error) return null;

  const apiError = error instanceof ApiError ? error : null;
  const title = apiError?.message ?? "Failed to load data";

  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
      <p className="flex items-center gap-2 font-medium">
        <AlertTriangle className="h-4 w-4" />
        {title}
      </p>
      {apiError ? (
        <p className="mt-2 text-xs text-rose-800">
          code={apiError.code ?? "UNKNOWN"} status={apiError.statusCode}
          {apiError.requestId ? ` requestId=${apiError.requestId}` : ""}
        </p>
      ) : null}
    </div>
  );
}
