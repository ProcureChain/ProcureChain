import { Suspense } from "react";

import { BidComparisonPageClient } from "./comparison-page-client";

export default function BidComparisonPage() {
  return (
    <Suspense fallback={<div className="rounded-xl border bg-white p-8 text-sm text-slate-500">Loading bid comparison...</div>}>
      <BidComparisonPageClient />
    </Suspense>
  );
}
