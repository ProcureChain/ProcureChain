"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2, LockKeyhole, Mail, ShieldCheck, Truck } from "lucide-react";
import { toast } from "sonner";

import { BrandLogo } from "@/components/common/brand-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLoginAction } from "@/lib/query-hooks";
import { SESSION_COOKIE_KEYS, type PortalType } from "@/lib/session";

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; SameSite=Lax`;
}

function initialsFromName(name: string) {
  return (
    name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("")
      .slice(0, 2) || "PC"
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [portal, setPortal] = useState<PortalType>("organization");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const loginAction = useLoginAction();

  const applyPortal = async () => {
    const trimmedIdentifier = identifier.trim();
    if (!trimmedIdentifier) {
      toast.error("Enter your email or identifier");
      return;
    }
    if (!password.trim()) {
      toast.error("Enter your password");
      return;
    }
    try {
      const session = await loginAction.mutateAsync({
        portal,
        identifier: trimmedIdentifier,
        password,
      });

      setCookie(SESSION_COOKIE_KEYS.portal, session.portal);
      setCookie(SESSION_COOKIE_KEYS.tenantId, session.tenantId);
      setCookie(SESSION_COOKIE_KEYS.companyId, session.companyId);
      setCookie(SESSION_COOKIE_KEYS.actorId, session.actorId);
      setCookie(SESSION_COOKIE_KEYS.actorName, session.actorName);
      setCookie(SESSION_COOKIE_KEYS.actorInitials, initialsFromName(session.actorName));
      setCookie(SESSION_COOKIE_KEYS.actorRoles, session.actorRoles.join(","));
      if (session.supplierId) {
        setCookie(SESSION_COOKIE_KEYS.supplierId, session.supplierId);
      } else {
        document.cookie = `${SESSION_COOKIE_KEYS.supplierId}=; Path=/; Max-Age=0; SameSite=Lax`;
      }

      router.replace("/dashboard");
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Login failed");
    }
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,#f7f6f1_0%,#eef4ff_48%,#e9f8f3_100%)]">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center px-6 py-10">
        <div className="grid w-full gap-8 lg:grid-cols-[1.05fr_460px]">
          <div className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-[linear-gradient(155deg,rgba(255,255,255,0.92)_0%,rgba(243,247,255,0.94)_52%,rgba(236,248,243,0.92)_100%)] p-8 shadow-[0_24px_80px_rgba(45,51,74,0.12)] lg:p-10">
            <div className="absolute -right-10 top-8 h-40 w-40 rounded-full bg-[radial-gradient(circle,#c7dcff_0%,rgba(199,220,255,0)_72%)]" />
            <div className="absolute bottom-0 left-0 h-48 w-48 rounded-full bg-[radial-gradient(circle,#cfeee1_0%,rgba(207,238,225,0)_72%)]" />
            <div className="relative space-y-8">
              <div className="inline-flex rounded-2xl border border-slate-200/80 bg-white/85 px-4 py-3 shadow-sm backdrop-blur">
                <BrandLogo variant="horizontal" className="w-[220px]" imageClassName="w-full" priority />
              </div>

              <div className="max-w-2xl space-y-4">
                <h1 className="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                  Sign in to manage procurement workflows from request to payment.
                </h1>
                <p className="max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
                  Access the organization workspace or supplier portal from one secure entry point.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <Card className="border-white/70 bg-white/80 shadow-sm backdrop-blur">
                  <CardContent className="space-y-3 p-5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">Buyer Operations</p>
                      <p className="mt-1 text-sm leading-6 text-slate-600">Requisitions, RFQs, bid review, approvals, and purchase orders.</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-white/70 bg-white/80 shadow-sm backdrop-blur">
                  <CardContent className="space-y-3 p-5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                      <Truck className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">Supplier Actions</p>
                      <p className="mt-1 text-sm leading-6 text-slate-600">Opportunities, bids, PO response, invoice submission, and status tracking.</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-white/70 bg-white/80 shadow-sm backdrop-blur">
                  <CardContent className="space-y-3 p-5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">Workflow Control</p>
                      <p className="mt-1 text-sm leading-6 text-slate-600">Shared visibility across approvals, audit events, communications, and payment steps.</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>

          <Card className="border-white/80 bg-white/92 shadow-[0_24px_80px_rgba(45,51,74,0.14)] backdrop-blur">
            <CardContent className="space-y-6 p-7">
              <div className="space-y-2">
                <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">Sign In</p>
                <h2 className="text-3xl font-semibold tracking-tight text-slate-950">Access your account</h2>
                <p className="text-sm leading-6 text-slate-600">
                  Continue into the correct workspace for your role.
                </p>
              </div>

              <Tabs value={portal} onValueChange={(value) => setPortal(value as PortalType)}>
                <TabsList className="grid w-full grid-cols-2 rounded-xl bg-slate-100 p-1">
                  <TabsTrigger value="organization" className="rounded-lg">Organization</TabsTrigger>
                  <TabsTrigger value="supplier" className="rounded-lg">Supplier</TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="identifier">
                  {portal === "organization" ? "Work Email" : "Email or Supplier Identifier"}
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="identifier"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="h-11 border-slate-200 bg-white pl-10"
                    placeholder={portal === "organization" ? "name@company.com" : "supplier email or supplier name"}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="password">
                  Password
                </label>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 border-slate-200 bg-white pl-10"
                    placeholder="Enter your password"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end">
                <button
                  type="button"
                  className="text-sm font-medium text-slate-500 transition hover:text-slate-700"
                  onClick={() => toast.message("Forgot password flow will be connected to the real auth service.")}
                >
                  Forgot password?
                </button>
              </div>

              <Button className="h-11 w-full gap-2 rounded-xl" disabled={loginAction.isPending} onClick={() => void applyPortal()}>
                Continue
                <ArrowRight className="h-4 w-4" />
              </Button>

              <div className="flex flex-col gap-3 border-t border-slate-200 pt-5 text-sm text-slate-600">
                <p>New to ProcureChain?</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Button asChild variant="outline" className="h-11 rounded-xl border-slate-200 bg-white">
                    <Link href="/signup/organization">Sign Up as Organization</Link>
                  </Button>
                  <Button asChild variant="outline" className="h-11 rounded-xl border-slate-200 bg-white">
                    <Link href="/signup/supplier">Sign Up as Supplier</Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
