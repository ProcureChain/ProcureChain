"use client";

import { useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/data/data-table";
import { ApiErrorAlert } from "@/components/common/api-error-alert";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAuditEvents } from "@/lib/query-hooks";
import { formatDateTime } from "@/lib/format";
import { AuditEvent } from "@/lib/types";

export default function AuditPage() {
  const { data = [], error } = useAuditEvents();
  const [entityType, setEntityType] = useState("ALL");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<AuditEvent | null>(null);

  const filtered = useMemo(
    () =>
      data.filter((e) => {
        const entityOk = entityType === "ALL" ? true : e.entityType === entityType;
        const q = search.toLowerCase();
        const queryOk = e.action.toLowerCase().includes(q) || e.actor.toLowerCase().includes(q);
        return entityOk && queryOk;
      }),
    [data, entityType, search],
  );

  const columns = useMemo<ColumnDef<AuditEvent>[]>(
    () => [
      { accessorKey: "entityType", header: "Entity" },
      { accessorKey: "action", header: "Action" },
      { accessorKey: "actor", header: "Actor" },
      { accessorKey: "at", header: "Timestamp", cell: ({ row }) => formatDateTime(row.original.at) },
      {
        id: "details",
        header: "",
        cell: ({ row }) => (
          <Button size="sm" variant="outline" onClick={() => setSelected(row.original)}>
            View
          </Button>
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-5">
      <PageHeader title="Audit Log" description="Immutable activity timeline with filters and export placeholder." actions={<Button variant="outline">Export</Button>} />

      <div className="grid gap-3 rounded-xl border bg-white p-3 md:grid-cols-[1fr_220px]">
        <Input placeholder="Search action or actor" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select value={entityType} onValueChange={setEntityType}>
          <SelectTrigger>
            <SelectValue placeholder="Entity type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All entities</SelectItem>
            <SelectItem value="PR">PR</SelectItem>
            <SelectItem value="RFQ">RFQ</SelectItem>
            <SelectItem value="BID">BID</SelectItem>
            <SelectItem value="POLICY">Policy</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error ? <ApiErrorAlert error={error} /> : <DataTable columns={columns} data={filtered} />}

      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Event detail</SheetTitle>
          </SheetHeader>
          {selected && (
            <div className="mt-5 space-y-3 text-sm">
              <p>
                <span className="font-medium">Action:</span> {selected.action}
              </p>
              <p>
                <span className="font-medium">Details:</span> {selected.details}
              </p>
              <p>
                <span className="font-medium">Before:</span> {JSON.stringify(selected.before ?? {}, null, 2)}
              </p>
              <p>
                <span className="font-medium">After:</span> {JSON.stringify(selected.after ?? {}, null, 2)}
              </p>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
