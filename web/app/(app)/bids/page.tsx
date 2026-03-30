import { Suspense } from "react";

import { BidsPageClient } from "./bids-page-client";

export default function BidsPage() {
  return (
    <Suspense fallback={<div className="rounded-xl border bg-white p-8 text-sm text-slate-500">Loading bids...</div>}>
      <BidsPageClient />
    </Suspense>
  );
}
