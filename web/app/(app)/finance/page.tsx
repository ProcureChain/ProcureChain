import { Suspense } from "react";

import { FinanceClient } from "./finance-client";

export default function FinancePage() {
  return (
    <Suspense fallback={<div className="rounded-xl border bg-white p-8 text-sm text-slate-500">Loading finance...</div>}>
      <FinanceClient />
    </Suspense>
  );
}
