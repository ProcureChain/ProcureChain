"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Truck } from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSuppliers } from "@/lib/query-hooks";
import { getSessionProfile, SESSION_COOKIE_KEYS, type PortalType } from "@/lib/session";

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; SameSite=Lax`;
}

export default function LoginPage() {
  const router = useRouter();
  const [portal, setPortal] = useState<PortalType>("organization");
  const defaults = useMemo(() => getSessionProfile(portal), [portal]);
  const [displayName, setDisplayName] = useState(defaults.actorName);
  const { data: suppliers = [] } = useSuppliers();
  const [supplierId, setSupplierId] = useState("");
  const defaultTestSupplier = useMemo(
    () => suppliers.find((supplier) => supplier.name === "test_supplier") ?? suppliers[0],
    [suppliers],
  );

  useEffect(() => {
    if (portal !== "supplier") return;
    if (supplierId) return;
    if (!defaultTestSupplier?.id) return;
    setSupplierId(defaultTestSupplier.id);
  }, [defaultTestSupplier, portal, supplierId]);

  const applyPortal = () => {
    const profile = {
      ...defaults,
      actorName: displayName.trim() || defaults.actorName,
      actorInitials: (displayName.trim() || defaults.actorName)
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("")
        .slice(0, 2) || defaults.actorInitials,
      supplierId:
        portal === "supplier"
          ? supplierId || defaultTestSupplier?.id || undefined
          : undefined,
    };

    setCookie(SESSION_COOKIE_KEYS.portal, profile.portal);
    setCookie(SESSION_COOKIE_KEYS.actorId, profile.actorId);
    setCookie(SESSION_COOKIE_KEYS.actorName, profile.actorName);
    setCookie(SESSION_COOKIE_KEYS.actorInitials, profile.actorInitials);
    setCookie(SESSION_COOKIE_KEYS.actorRoles, profile.actorRoles.join(","));
    if (profile.supplierId) {
      setCookie(SESSION_COOKIE_KEYS.supplierId, profile.supplierId);
    } else {
      document.cookie = `${SESSION_COOKIE_KEYS.supplierId}=; Path=/; Max-Age=0; SameSite=Lax`;
    }

    router.replace("/dashboard");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#e2f7ef,_transparent_30%),radial-gradient(circle_at_bottom_right,_#dbeafe,_transparent_25%),#f8fafc]">
      <div className="mx-auto flex min-h-screen max-w-5xl items-center px-6 py-10">
        <div className="grid w-full gap-8 lg:grid-cols-[1.1fr_420px]">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/70 px-4 py-2 text-sm font-medium text-emerald-700">
              <Building2 className="h-4 w-4" />
              ProcureChain Dev Access
            </div>
            <PageHeader
              title="Choose a testing portal"
              description="This is a lightweight test login only. It sets a local session profile for organization or supplier workflows."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Card className={portal === "organization" ? "border-slate-900 shadow-sm" : ""}>
                <CardHeader>
                  <CardTitle className="text-base">Organization Portal</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-slate-600">
                  Procurement-side workspace: requisitions, RFx, bids, purchase orders, audit, settings.
                </CardContent>
              </Card>
              <Card className={portal === "supplier" ? "border-slate-900 shadow-sm" : ""}>
                <CardHeader>
                  <CardTitle className="text-base">Supplier Portal</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-slate-600">
                  Supplier-side workspace: dashboard, open opportunities, PO response, invoice submission.
                </CardContent>
              </Card>
            </div>
          </div>

          <Card className="border-slate-200 bg-white/90 shadow-xl backdrop-blur">
            <CardHeader>
              <CardTitle>Test Login</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <Tabs
                value={portal}
                onValueChange={(value) => {
                  const nextPortal = value as PortalType;
                  setPortal(nextPortal);
                  setDisplayName(getSessionProfile(nextPortal).actorName);
                }}
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="organization">Organization</TabsTrigger>
                  <TabsTrigger value="supplier">Supplier</TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="rounded-xl border bg-slate-50 p-4 text-sm text-slate-600">
                <div className="flex items-center gap-2 font-medium text-slate-900">
                  {portal === "organization" ? <Building2 className="h-4 w-4" /> : <Truck className="h-4 w-4" />}
                  {portal === "organization" ? "Organization access" : "Supplier access"}
                </div>
                <p className="mt-2">
                  Roles: <span className="font-mono text-xs">{defaults.actorRoles.join(", ")}</span>
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="displayName">
                  Display name
                </label>
                <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              </div>

              {portal === "supplier" ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Supplier profile</label>
                  <Select value={supplierId} onValueChange={setSupplierId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select supplier profile" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              <Button className="w-full" onClick={applyPortal}>
                Continue to {portal === "organization" ? "Organization" : "Supplier"} Portal
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
