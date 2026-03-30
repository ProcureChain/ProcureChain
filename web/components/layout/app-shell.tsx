"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Building2,
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
  { href: "/bids", label: "Bids", icon: Scale },
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
];

function Sidebar() {
  const pathname = usePathname();
  const nav = runtimeConfig.isSupplierPortal ? supplierNav : organizationNav;
  const portalLabel = runtimeConfig.isSupplierPortal ? "test_supplier" : "test_org";
  const portalSubLabel = runtimeConfig.isSupplierPortal ? "Supplier Test User" : "Organization Test User";

  return (
    <aside className="flex h-full flex-col border-r bg-white">
      <div className="flex h-16 items-center gap-2 border-b px-4">
        <div className="rounded bg-emerald-100 p-2 text-emerald-700">
          <Building2 className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-semibold">{portalLabel}</p>
          <p className="text-xs text-slate-500">{portalSubLabel}</p>
        </div>
      </div>
      <nav className="space-y-1 p-3">
        {nav.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition",
                active ? "bg-slate-900 text-white" : "hover:bg-slate-100",
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
    ["pc_portal", "pc_actor_id", "pc_actor_name", "pc_actor_initials", "pc_actor_roles", "pc_supplier_id"].forEach((name) => {
      document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
    });
    window.location.href = "/login";
  };

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="grid min-h-screen md:grid-cols-[248px_1fr]">
          <div className="hidden border-r bg-white md:block" />
          <div>
            <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-white px-4 md:px-6" />
            <main className="mx-auto w-full max-w-[1400px] p-4 md:p-6">{children}</main>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="grid min-h-screen md:grid-cols-[248px_1fr]">
        <div className="hidden md:block">
          <Sidebar />
        </div>
        <div>
          <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-white px-4 md:px-6">
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
              <Input placeholder="Search PR, supplier, policy..." className="h-10" />
            </div>
            <Button variant="ghost" size="icon" aria-label="Notifications">
              <Bell className="h-4 w-4" />
            </Button>
            <Button variant="outline" className="hidden md:inline-flex" onClick={logout}>
              Log out
            </Button>
            <Avatar className="h-8 w-8">
              <AvatarFallback>{runtimeConfig.actorInitials}</AvatarFallback>
            </Avatar>
          </header>
          <main className="mx-auto w-full max-w-[1400px] p-4 md:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
