import { Suspense } from "react";

import { FinanceClient } from "../finance/finance-client";

export default function InvoicesPage() {
  return (
    <Suspense fallback={<div className="rounded-xl border bg-white p-8 text-sm text-slate-500">Loading invoices...</div>}>
      <FinanceClient />
    </Suspense>
  );
}
