import { Badge } from "@/components/ui/badge";
import { STATUS_META } from "@/lib/constants";
import { ReqStatus } from "@/lib/types";

export function StatusBadge({ status }: { status: ReqStatus }) {
  const meta = STATUS_META[status];
  return (
    <Badge className={meta.className} variant="secondary">
      {meta.label}
    </Badge>
  );
}
