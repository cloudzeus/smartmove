import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Canonical compact stat card used across the carrier admin.
 *
 * Layout (horizontal, density 9/10):
 *   ┌─────────────────────────────────────────────┐
 *   │ ▌ LABEL                       22  ↑12%      │
 *   │ ▌ sublabel                                  │
 *   │   ────────────────                          │  ← optional progress
 *   └─────────────────────────────────────────────┘
 *
 * - Label (10px eyebrow) + optional sublabel (10px muted) on the left.
 * - Big number (20px tabular semibold) on the right.
 * - Optional delta chip beside the number.
 * - Optional 1px progress bar below.
 * - Optional left accent rail (1-2px) in a semantic tone.
 * - Optional `href` makes the whole card a hoverable Link.
 */

export type StatTone = "success" | "info" | "warning" | "amber" | "danger" | "neutral";

const TONE: Record<StatTone, { num: string; rail: string }> = {
  success: { num: "text-emerald-700", rail: "bg-emerald-500" },
  info:    { num: "text-sky-700",     rail: "bg-sky-500" },
  warning: { num: "text-amber-700",   rail: "bg-amber-500" },
  amber:   { num: "text-amber-700",   rail: "bg-amber-500" },
  danger:  { num: "text-rose-700",    rail: "bg-rose-500" },
  neutral: { num: "text-foreground",  rail: "bg-muted-foreground/40" },
};

export interface StatCellProps {
  label: string;
  value: string | number;
  sublabel?: string;
  href?: string;
  delta?: number | null;
  /** 0–100 progress bar below the value. */
  progress?: number;
  tone?: StatTone;
  className?: string;
}

export function StatCell({
  label, value, sublabel, href, delta, progress, tone = "neutral", className,
}: StatCellProps) {
  const t = TONE[tone];
  const body = (
    <>
      <span aria-hidden className={cn("absolute left-0 top-0 h-full w-0.5", t.rail)} />
      <div className="min-w-0 flex-1">
        <p className="cx-eyebrow truncate text-[10px]">{label}</p>
        {sublabel && <p className="truncate text-[10px] text-muted-foreground">{sublabel}</p>}
        {progress != null && (
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full cx-transition", tone === "neutral" ? "bg-foreground/60" : t.rail)}
              style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
            />
          </div>
        )}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={cn("font-display text-[20px] font-semibold leading-none tabular-nums tracking-tight", t.num)}>
          {value}
        </span>
        {delta != null && (
          <span
            className={cn(
              "text-[10px] font-semibold tabular-nums",
              delta >= 0 ? "text-emerald-700" : "text-rose-700",
            )}
          >
            {delta >= 0 ? "↑" : "↓"}{Math.abs(delta).toFixed(0)}%
          </span>
        )}
      </div>
    </>
  );

  const baseCls = cn(
    "cx-card relative flex items-center gap-2.5 overflow-hidden px-2.5 py-2 cx-transition",
    href && "hover:bg-[var(--cx-hover)] active:bg-[var(--cx-accent-soft)]",
    className,
  );

  if (href) return <Link href={href} className={baseCls}>{body}</Link>;
  return <div className={baseCls}>{body}</div>;
}

/**
 * Standard grid container for a row of stat cells.
 * 2 cols on mobile, scales to 3-4 on larger screens via `cols` prop.
 */
export function StatRow({
  children,
  cols = 4,
  className,
}: {
  children: React.ReactNode;
  cols?: 2 | 3 | 4;
  className?: string;
}) {
  const colsCls =
    cols === 2 ? "grid-cols-2"
    : cols === 3 ? "grid-cols-2 lg:grid-cols-3"
    : "grid-cols-2 lg:grid-cols-4";
  return <div className={cn("grid gap-2", colsCls, className)}>{children}</div>;
}
