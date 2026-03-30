import { formatDateTime } from "@/lib/format";

export interface TimelineItem {
  id: string;
  title: string;
  actor?: string;
  note?: string;
  at: string;
}

export function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <ol className="relative space-y-6 border-l border-slate-200 pl-6">
      {items.map((item) => (
        <li key={item.id} className="relative">
          <span className="absolute -left-[1.7rem] top-1.5 h-3 w-3 rounded-full bg-slate-300" />
          <div className="rounded-lg border bg-white p-3">
            <p className="text-sm font-medium text-slate-900">{item.title}</p>
            <p className="mt-1 text-xs text-slate-500">
              {item.actor ? `${item.actor} • ` : ""}
              {formatDateTime(item.at)}
            </p>
            {item.note ? <p className="mt-2 text-sm text-slate-700">{item.note}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
