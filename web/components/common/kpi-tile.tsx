import { ArrowUpRight } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function KpiTile({ label, value, delta }: { label: string; value: string; delta: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-slate-600">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tracking-tight">{value}</p>
        <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
          <ArrowUpRight className="h-3.5 w-3.5" />
          {delta}
        </p>
      </CardContent>
    </Card>
  );
}
