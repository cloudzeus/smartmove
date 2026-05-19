import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight } from "lucide-react";

import { cn } from "@/lib/utils";

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  description?: string;
  href?: string;
  accent?: "blue" | "red" | "emerald" | "amber";
}

export function StatCard({
  icon: Icon,
  label,
  value,
  description,
  href,
  accent = "blue",
}: StatCardProps) {
  const accentMap = {
    blue: "bg-[var(--color-brand-blue-light)] text-[var(--color-brand-blue-deep)]",
    red: "bg-[var(--color-brand-red-light)] text-[var(--color-brand-red-deep)]",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
  } as const;

  const inner = (
    <div className="group relative flex h-full flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:border-[var(--color-brand-blue)]/30 hover:shadow-[var(--shadow-pop)]">
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            "grid size-10 place-items-center rounded-xl",
            accentMap[accent],
          )}
        >
          <Icon className="size-5" />
        </span>
        {href && (
          <ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        )}
      </div>
      <div>
        <p className="font-display text-2xl font-bold text-foreground sm:text-3xl">
          {value}
        </p>
        <p className="mt-0.5 text-sm font-medium text-foreground">{label}</p>
        {description && (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
    </div>
  );

  return href ? (
    <Link href={href} className="block h-full">
      {inner}
    </Link>
  ) : (
    <div className="block h-full">{inner}</div>
  );
}
