"use client";

import { useParams } from "next/navigation";

import { ApiErrorAlert } from "@/components/common/api-error-alert";
import { PageHeader } from "@/components/common/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSupplier } from "@/lib/query-hooks";

export default function SupplierDetailPage() {
  const params = useParams<{ id: string }>();
  const { data, error } = useSupplier(params.id);

  if (error) return <ApiErrorAlert error={error} />;
  if (!data) return <div className="rounded-xl border bg-white p-8 text-sm text-slate-500">Loading supplier...</div>;

  return (
    <div className="space-y-4">
      <PageHeader title={data.name} description={`Status: ${data.status}`} />
      <Card>
        <CardHeader>
          <CardTitle>Tags</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {data.tags.map((tag) => (
            <Badge key={tag}>{tag}</Badge>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Contacts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.contacts.map((contact) => (
            <div key={contact.id} className="rounded-lg border p-3 text-sm">
              <p className="font-medium">{contact.name}</p>
              <p className="text-slate-600">{contact.email}</p>
              {contact.phone ? <p className="text-slate-600">{contact.phone}</p> : null}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
