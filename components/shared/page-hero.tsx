import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

interface Crumb {
  href?: string;
  label: string;
}

export interface KpiItem {
  label: string;
  value: string | number;
  /** Optional delta string e.g. "+12%" or "−3" */
  delta?: string;
  deltaTone?: "positive" | "negative" | "neutral";
}

export type HeroTone = "blue" | "red" | "emerald" | "amber";

interface PageHeroProps {
  eyebrow?: string;
  title: string;
  description?: string;
  crumbs?: Crumb[];
  action?: React.ReactNode;
  kpis?: KpiItem[];
  tone?: HeroTone;
}

/**
 * Universal hero used at the top of every dashboard/admin page.
 *
 *  - subtle dual radial gradient + dot-grid backdrop for depth
 *  - breadcrumbs · eyebrow · large title · description
 *  - right-aligned actions slot
 *  - optional inline KPI strip with delta badges
 */
export function PageHero({
  eyebrow,
  title,
  description,
  crumbs,
  action,
  kpis,
  tone = "blue",
}: PageHeroProps) {
  const toneMap = {
    blue:
      "before:bg-[radial-gradient(900px_280px_at_-10%_-30%,rgba(37,99,235,0.18),transparent_55%),radial-gradient(700px_240px_at_120%_-20%,rgba(239,68,68,0.10),transparent_55%)]",
    red:
      "before:bg-[radial-gradient(900px_280px_at_-10%_-30%,rgba(239,68,68,0.18),transparent_55%),radial-gradient(700px_240px_at_120%_-20%,rgba(37,99,235,0.10),transparent_55%)]",
    emerald:
      "before:bg-[radial-gradient(900px_280px_at_-10%_-30%,rgba(16,185,129,0.18),transparent_55%),radial-gradient(700px_240px_at_120%_-20%,rgba(37,99,235,0.10),transparent_55%)]",
    amber:
      "before:bg-[radial-gradient(900px_280px_at_-10%_-30%,rgba(245,158,11,0.18),transparent_55%),radial-gradient(700px_240px_at_120%_-20%,rgba(37,99,235,0.10),transparent_55%)]",
  } as const;

  return (
    <section
      className={cn(
        "relative overflow-hidden border-b border-border bg-white",
        "before:pointer-events-none before:absolute before:inset-0 before:-z-0",
        toneMap[tone],
        "after:pointer-events-none after:absolute after:inset-0 after:-z-0 after:bg-[radial-gradient(circle_at_1px_1px,rgba(15,23,42,0.05)_1px,transparent_0)] after:[background-size:24px_24px] after:opacity-50 after:[mask-image:linear-gradient(to_bottom,black_30%,transparent)]",
      )}
    >
      <div className="relative mx-auto max-w-[1400px] px-4 py-7 sm:px-6 lg:px-8 lg:py-9">
        {crumbs && crumbs.length > 0 && (
          <nav className="mb-3 flex items-center gap-1 text-xs text-muted-foreground">
            {crumbs.map((c, i) => (
              <span key={`${c.label}-${i}`} className="flex items-center gap-1">
                {c.href ? (
                  <Link
                    href={c.href}
                    className="transition-colors hover:text-foreground"
                  >
                    {c.label}
                  </Link>
                ) : (
                  <span className="text-foreground">{c.label}</span>
                )}
                {i < crumbs.length - 1 && (
                  <ChevronRight className="size-3.5 text-muted-foreground/60" />
                )}
              </span>
            ))}
          </nav>
        )}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            {eyebrow && (
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--color-brand-blue)]">
                {eyebrow}
              </p>
            )}
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-[2rem] lg:text-[2.25rem]">
              {title}
            </h1>
            {description && (
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                {description}
              </p>
            )}
          </div>
          {action && (
            <div className="flex shrink-0 items-center gap-2">{action}</div>
          )}
        </div>

        {kpis && kpis.length > 0 && (
          <ul className="mt-6 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
            {kpis.map((k) => (
              <li
                key={k.label}
                className="flex flex-col gap-1 bg-white/95 px-5 py-4 backdrop-blur"
              >
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                  {k.label}
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-2xl font-bold text-foreground tabular-nums">
                    {k.value}
                  </span>
                  {k.delta && (
                    <span
                      className={cn(
                        "text-xs font-bold",
                        k.deltaTone === "negative"
                          ? "text-destructive"
                          : k.deltaTone === "neutral"
                            ? "text-muted-foreground"
                            : "text-emerald-600",
                      )}
                    >
                      {k.delta}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
