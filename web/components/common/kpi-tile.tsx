import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function KpiTile({
  label,
  value,
  delta,
  href,
}: {
  label: string;
  value: string;
  delta: string;
  href?: string;
}) {
  const content = (
    <Card className="border-[var(--border)] bg-[var(--surface-background)] shadow-[var(--shadow-sm)]">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-[var(--text-secondary)]">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">{value}</p>
        <p className="mt-2 flex items-center gap-1 text-xs text-[var(--text-muted)]">
          <ArrowUpRight className="h-3.5 w-3.5" />
          {delta}
        </p>
      </CardContent>
    </Card>
  );

  if (!href) return content;

  return (
    <Link href={href} className="block transition-transform duration-150 hover:-translate-y-0.5">
      {content}
    </Link>
  );
}
