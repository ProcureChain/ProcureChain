import { ReqStatus } from "@/lib/types";

export const STATUS_META: Record<ReqStatus, { label: string; className: string }> = {
  DRAFT: { label: "Draft", className: "bg-slate-100 text-slate-700" },
  SUBMITTED: { label: "Submitted", className: "bg-blue-100 text-blue-700" },
  UNDER_REVIEW: { label: "Under Review", className: "bg-amber-100 text-amber-800" },
  APPROVED: { label: "Approved", className: "bg-emerald-100 text-emerald-700" },
  REJECTED: { label: "Rejected", className: "bg-rose-100 text-rose-700" },
  RETURNED: { label: "Returned", className: "bg-orange-100 text-orange-700" },
  CANCELLED: { label: "Cancelled", className: "bg-zinc-100 text-zinc-600" },
  CONVERTED_TO_RFQ: { label: "Converted to RFQ", className: "bg-cyan-100 text-cyan-700" },
  CLOSED: { label: "Closed", className: "bg-violet-100 text-violet-700" },
};
