"use client";

import { ReactNode } from "react";
import { Toaster } from "sonner";

import { QueryProvider } from "@/components/providers/query-provider";
import { TooltipProvider } from "@/components/ui/tooltip";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <TooltipProvider delayDuration={120}>
        {children}
        <Toaster richColors position="top-right" />
      </TooltipProvider>
    </QueryProvider>
  );
}
