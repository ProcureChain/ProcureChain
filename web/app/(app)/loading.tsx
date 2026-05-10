export default function AppRouteLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-sm)]">
        <div className="h-4 w-40 rounded bg-slate-200" />
        <div className="mt-3 h-8 w-72 max-w-full rounded bg-slate-200" />
        <div className="mt-2 h-4 w-96 max-w-full rounded bg-slate-100" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-sm)]">
            <div className="h-3 w-24 rounded bg-slate-200" />
            <div className="mt-4 h-8 w-28 rounded bg-slate-200" />
            <div className="mt-4 h-2 w-full rounded bg-slate-100" />
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.45fr_1fr]">
        <div className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-sm)]">
          <div className="h-4 w-44 rounded bg-slate-200" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-10 w-full rounded bg-slate-100" />
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-sm)]">
          <div className="h-4 w-36 rounded bg-slate-200" />
          <div className="mt-4 h-56 rounded-xl bg-slate-100" />
          <div className="mt-4 h-3 w-3/4 rounded bg-slate-200" />
        </div>
      </div>
    </div>
  );
}
