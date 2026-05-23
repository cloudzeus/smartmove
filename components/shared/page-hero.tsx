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
 * Universal page hero.
 *
 * - Default: SmartMove marketplace style — gradient + dot-grid + large title + bold KPIs.
 * - Inside `.carrier-shell`: compact Outlook-style — no decoration, smaller type,
 *   horizontal KPI cells matching the carrier dashboard.
 *
 * Variant switch via Tailwind arbitrary variant `[.carrier-shell_&]:`.
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
        // Carrier compact overrides:
        "[.carrier-shell_&]:bg-background [.carrier-shell_&]:before:hidden [.carrier-shell_&]:after:hidden",
      )}
    >
      <div className="relative mx-auto max-w-[1440px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-9 [.carrier-shell_&]:max-w-[1440px] [.carrier-shell_&]:px-4 [.carrier-shell_&]:py-3 [.carrier-shell_&]:sm:px-5 [.carrier-shell_&]:sm:py-3.5 [.carrier-shell_&]:lg:px-5 [.carrier-shell_&]:lg:py-4">
        {crumbs && crumbs.length > 0 && (
          <nav className="mb-3 flex items-center gap-1 text-xs text-muted-foreground [.carrier-shell_&]:mb-1.5 [.carrier-shell_&]:text-[10px]">
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
                  <ChevronRight className="size-3.5 text-muted-foreground/60 [.carrier-shell_&]:size-3" />
                )}
              </span>
            ))}
          </nav>
        )}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between [.carrier-shell_&]:gap-2 [.carrier-shell_&]:sm:items-center">
          <div className="min-w-0">
            {eyebrow && (
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--color-brand-blue)] [.carrier-shell_&]:mb-0 [.carrier-shell_&]:text-[10px] [.carrier-shell_&]:font-semibold [.carrier-shell_&]:tracking-[0.06em] [.carrier-shell_&]:text-muted-foreground">
                {eyebrow}
              </p>
            )}
            <h1 className="font-display text-[1.5rem] font-extrabold leading-tight tracking-tight text-foreground sm:text-[2rem] lg:text-[2.25rem] [.carrier-shell_&]:text-[20px] [.carrier-shell_&]:font-semibold [.carrier-shell_&]:leading-tight [.carrier-shell_&]:tracking-[-0.02em] [.carrier-shell_&]:sm:text-[20px] [.carrier-shell_&]:lg:text-[20px]">
              {title}
            </h1>
            {description && (
              <p className="mt-2 hidden max-w-3xl text-sm leading-relaxed text-muted-foreground sm:block sm:text-base [.carrier-shell_&]:mt-0.5 [.carrier-shell_&]:block [.carrier-shell_&]:text-[11px] [.carrier-shell_&]:leading-snug [.carrier-shell_&]:sm:text-[11px]">
                {description}
              </p>
            )}
          </div>
          {action && (
            <div className="flex w-full shrink-0 items-center gap-2 [&>a]:flex-1 [&>a]:justify-center sm:w-auto sm:[&>a]:flex-none">{action}</div>
          )}
        </div>

        {kpis && kpis.length > 0 && (
          <ul
            className={cn(
              // Default: bordered rounded grid with bold numbers
              "mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:mt-6 lg:grid-cols-4",
              // Carrier: separate compact cells, smaller gap, horizontal layout
              "[.carrier-shell_&]:mt-2.5 [.carrier-shell_&]:bg-transparent [.carrier-shell_&]:gap-2 [.carrier-shell_&]:rounded-none [.carrier-shell_&]:border-0 [.carrier-shell_&]:sm:mt-3",
            )}
            style={{
              // Auto-fit columns based on kpi count under carrier
              gridTemplateColumns: undefined,
            }}
          >
            {kpis.map((k) => (
              <li
                key={k.label}
                className={cn(
                  "flex flex-col gap-1 bg-white/95 px-3 py-3 backdrop-blur sm:px-5 sm:py-4",
                  // Carrier: horizontal compact cell matching dashboard KpiCell
                  "[.carrier-shell_&]:cx-card [.carrier-shell_&]:flex-row [.carrier-shell_&]:items-center [.carrier-shell_&]:gap-2.5 [.carrier-shell_&]:bg-card [.carrier-shell_&]:px-2.5 [.carrier-shell_&]:py-2 [.carrier-shell_&]:sm:px-2.5 [.carrier-shell_&]:sm:py-2 [.carrier-shell_&]:backdrop-blur-none",
                )}
              >
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground [.carrier-shell_&]:flex-1 [.carrier-shell_&]:truncate [.carrier-shell_&]:text-[10px] [.carrier-shell_&]:font-semibold [.carrier-shell_&]:tracking-[0.06em] [.carrier-shell_&]:normal-case [.carrier-shell_&]:uppercase">
                  {k.label}
                </span>
                <div className="flex items-baseline gap-2 [.carrier-shell_&]:gap-1.5">
                  <span className="font-display text-xl font-bold text-foreground tabular-nums sm:text-2xl [.carrier-shell_&]:text-[20px] [.carrier-shell_&]:font-semibold [.carrier-shell_&]:leading-none [.carrier-shell_&]:tracking-[-0.02em] [.carrier-shell_&]:sm:text-[20px]">
                    {k.value}
                  </span>
                  {k.delta && (
                    <span
                      className={cn(
                        "text-xs font-bold [.carrier-shell_&]:text-[10px] [.carrier-shell_&]:font-semibold",
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
