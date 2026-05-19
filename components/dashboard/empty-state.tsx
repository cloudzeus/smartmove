import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  cta?: {
    label: string;
    href: string;
    primary?: boolean;
  };
  secondaryCta?: {
    label: string;
    href: string;
  };
  variant?: "card" | "plain";
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  cta,
  secondaryCta,
  variant = "card",
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-5 px-6 py-16 text-center",
        variant === "card" &&
          "rounded-2xl border border-dashed border-border bg-card",
      )}
    >
      <div className="relative">
        <span className="absolute inset-0 -z-10 rounded-3xl bg-[var(--color-brand-blue-light)] blur-xl opacity-60" />
        <div className="grid size-16 place-items-center rounded-2xl border border-border bg-gradient-to-br from-[var(--color-brand-blue-light)] to-card text-[var(--color-brand-blue-deep)]">
          <Icon className="size-7" strokeWidth={1.75} />
        </div>
      </div>
      <div className="max-w-md">
        <h3 className="font-display text-lg font-bold text-foreground">
          {title}
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      {(cta || secondaryCta) && (
        <div className="flex flex-col gap-2 sm:flex-row">
          {cta && (
            <Link
              href={cta.href}
              className={cn(
                "inline-flex h-10 items-center justify-center rounded-lg px-5 text-sm font-bold transition-colors",
                cta.primary !== false
                  ? "bg-[var(--color-brand-blue)] text-white shadow-[var(--shadow-cta)] hover:bg-[var(--color-brand-blue-deep)]"
                  : "border border-border bg-card text-foreground hover:bg-secondary",
              )}
            >
              {cta.label}
            </Link>
          )}
          {secondaryCta && (
            <Link
              href={secondaryCta.href}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-card px-5 text-sm font-medium text-foreground hover:bg-secondary"
            >
              {secondaryCta.label}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
