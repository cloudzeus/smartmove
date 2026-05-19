"use client";

import Link from "next/link";
import { Bell, CreditCard, Shield, User } from "lucide-react";

import { cn } from "@/lib/utils";

const TABS = [
  { key: "profile", label: "Προφίλ", icon: User },
  { key: "billing", label: "Στοιχεία χρέωσης", icon: CreditCard },
  { key: "retention", label: "Διατήρηση δεδομένων", icon: Shield },
  { key: "notifications", label: "Ειδοποιήσεις", icon: Bell },
] as const;

export function SettingsTabs({ current }: { current: string }) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-2xl border border-border bg-card p-1 shadow-[var(--shadow-card)]">
      {TABS.map((t) => {
        const active = current === t.key;
        return (
          <Link
            key={t.key}
            href={`/dashboard/settings?tab=${t.key}`}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-[var(--color-brand-blue)] text-white shadow-sm"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            <t.icon className="size-4" />
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
