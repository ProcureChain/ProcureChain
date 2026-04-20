"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  FileSearch,
  FileText,
  LayoutDashboard,
  Menu,
  Scale,
  ScrollText,
  PackageCheck,
  Settings,
  Shield,
  Truck,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { BrandLogo } from "@/components/common/brand-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { runtimeConfig } from "@/lib/runtime-config";
import { useHydrated } from "@/lib/use-hydrated";
import { cn } from "@/lib/utils";

const organizationNav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/requisitions", label: "Requisitions", icon: FileSearch },
  { href: "/rfqs", label: "RFx", icon: FileText },
  { href: "/purchase-orders", label: "Purchase Orders", icon: PackageCheck },
  { href: "/suppliers", label: "Suppliers", icon: Truck },
  { href: "/audit", label: "Audit", icon: Shield },
  { href: "/settings", label: "Settings", icon: Settings },
];

const supplierNav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/supplier/rfqs", label: "RFx", icon: FileText },
  { href: "/supplier/bids", label: "Bids", icon: Scale },
  { href: "/supplier/purchase-orders", label: "Purchase Orders", icon: PackageCheck },
  { href: "/supplier/invoices", label: "Invoices", icon: ScrollText },
  { href: "/supplier/profile", label: "Profile", icon: Settings },
];

function Sidebar() {
  const pathname = usePathname();
  const nav = runtimeConfig.isSupplierPortal ? supplierNav : organizationNav;
  const portalLabel = runtimeConfig.isSupplierPortal ? "test_supplier" : "test_org";
  const portalSubLabel = runtimeConfig.isSupplierPortal ? "Supplier Test User" : "Organization Test User";
  const portalBadgeClass = runtimeConfig.isSupplierPortal
    ? "border-[var(--portal-supplier-accent)]/20 bg-[var(--portal-supplier-bg)] text-[var(--portal-supplier-accent)]"
    : "border-[var(--portal-org-accent)]/20 bg-[var(--portal-org-bg)] text-[var(--portal-org-accent)]";

  return (
    <aside className="flex h-full flex-col border-r border-[var(--border)] bg-[var(--surface-background)]">
      <div className="flex h-16 items-center gap-3 border-b border-[var(--border)] px-5">
        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-[var(--border)] bg-white p-1 shadow-[var(--shadow-sm)]">
          <BrandLogo variant="mark" imageClassName="max-h-8 w-auto" priority />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--text-primary)]">{portalLabel}</p>
          <p className="text-xs text-[var(--text-muted)]">{portalSubLabel}</p>
        </div>
        <Badge variant="outline" className={cn("ml-auto hidden rounded-md text-[10px] md:inline-flex", portalBadgeClass)}>
          {runtimeConfig.isSupplierPortal ? "Supplier Portal" : "Org Portal"}
        </Badge>
      </div>
      <nav className="space-y-1 p-4">
        {nav.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
                active
                  ? "bg-[var(--primary)] text-white shadow-sm"
                  : "text-[var(--text-secondary)] hover:bg-[var(--muted)] hover:text-[var(--text-primary)]",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated();
  const logout = () => {
    ["pc_portal", "pc_tenant_id", "pc_company_id", "pc_actor_id", "pc_actor_name", "pc_actor_initials", "pc_actor_roles", "pc_supplier_id"].forEach((name) => {
      document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
    });
    window.location.href = "/login";
  };

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-[var(--background)]">
        <div className="grid min-h-screen md:grid-cols-[248px_1fr]">
          <div className="hidden border-r border-[var(--border)] bg-[var(--surface-background)] md:block" />
          <div>
            <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-[var(--border)] bg-[var(--surface-background)] px-4 md:px-6" />
            <main className="mx-auto w-full max-w-[1400px] p-4 md:p-6">{children}</main>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="grid min-h-screen md:grid-cols-[248px_1fr]">
        <div className="hidden md:block">
          <Sidebar />
        </div>
        <div>
          <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-[var(--border)] bg-[var(--surface-background)] px-4 md:px-6">
            <Sheet>
              <SheetTrigger asChild>
                <Button size="icon" variant="outline" className="md:hidden">
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0">
                <Sidebar />
              </SheetContent>
            </Sheet>
            <div className="relative w-full max-w-xl">
              <Input placeholder="Search PRs, RFQs, Suppliers..." className="enterprise-input h-10 border-[var(--border)] bg-white text-[var(--text-primary)] placeholder:text-[var(--text-muted)]" />
            </div>
            <Badge variant="outline" className="hidden rounded-md border-[var(--border-strong)] bg-[var(--muted)] text-[var(--text-secondary)] lg:inline-flex">
              Demo Environment
            </Badge>
            <p className="hidden max-w-xs text-xs text-[var(--text-muted)] xl:block">
              Live dev data. Requester chat is browser-local for this demo.
            </p>
            <Button variant="ghost" size="icon" aria-label="Notifications">
              <Bell className="h-4 w-4" />
            </Button>
            <Button variant="outline" className="hidden md:inline-flex" onClick={logout}>
              Log out
            </Button>
            <Avatar className="h-8 w-8 border border-[var(--border)]">
              <AvatarFallback className="bg-[var(--muted)] text-[var(--text-secondary)]">{runtimeConfig.actorInitials}</AvatarFallback>
            </Avatar>
          </header>
          <main className="mx-auto w-full max-w-[1400px] p-4 md:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
