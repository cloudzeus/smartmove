import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { cn } from "@/lib/utils";

interface MetricCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  hint?: string;
  deltaPct?: number;
  deltaTone?: "positive" | "negative" | "neutral";
  href?: string;
  accent?: "blue" | "red" | "emerald" | "amber" | "violet";
  sparkline?: number[];
}

const ACCENTS = {
  blue:    { ring: "ring-[var(--color-brand-blue)]/15", iconBg: "bg-gradient-to-br from-[var(--color-brand-blue)] to-[#3B82F6]", iconText: "text-white", bar: "bg-[var(--color-brand-blue)]" },
  red:     { ring: "ring-[var(--color-brand-red)]/15",  iconBg: "bg-gradient-to-br from-[var(--color-brand-red)] to-[#F87171]",  iconText: "text-white", bar: "bg-[var(--color-brand-red)]" },
  emerald: { ring: "ring-emerald-500/15",                iconBg: "bg-gradient-to-br from-emerald-500 to-emerald-400",             iconText: "text-white", bar: "bg-emerald-500" },
  amber:   { ring: "ring-amber-500/15",                  iconBg: "bg-gradient-to-br from-amber-500 to-amber-400",                 iconText: "text-white", bar: "bg-amber-500" },
  violet:  { ring: "ring-violet-500/15",                 iconBg: "bg-gradient-to-br from-violet-500 to-violet-400",                iconText: "text-white", bar: "bg-violet-500" },
} as const;

export function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
  deltaPct,
  deltaTone,
  href,
  accent = "blue",
  sparkline,
}: MetricCardProps) {
  const a = ACCENTS[accent];
  const isNeg = typeof deltaPct === "number" && deltaPct < 0;
  const tone =
    deltaTone ??
    (typeof deltaPct === "number"
      ? deltaPct === 0
        ? "neutral"
        : isNeg
          ? "negative"
          : "positive"
      : "neutral");

  const inner = (
    <div
      className={cn(
        "group relative h-full overflow-hidden rounded-2xl border border-border bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_1px_3px_rgba(15,23,42,0.06)] transition-all sm:p-5",
        "hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(15,23,42,0.08)]",
        "ring-1",
        a.ring,
      )}
    >
      <span className={cn("absolute inset-x-0 top-0 h-0.5", a.bar)} aria-hidden />

      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            "grid size-11 place-items-center rounded-xl shadow-md ring-2 ring-white",
            a.iconBg,
            a.iconText,
          )}
        >
          <Icon className="size-5" />
        </span>
        {href && (
          <ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
        )}
      </div>

      <div className="mt-3 sm:mt-4">
        <p className="font-display text-2xl font-extrabold leading-none text-foreground tabular-nums sm:text-[2rem]">
          {value}
        </p>
        <p className="mt-1.5 text-xs font-medium text-foreground sm:text-sm">{label}</p>
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          {typeof deltaPct === "number" && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                tone === "positive" && "bg-emerald-50 text-emerald-700",
                tone === "negative" && "bg-red-50 text-red-700",
                tone === "neutral" && "bg-secondary text-muted-foreground",
              )}
            >
              {isNeg ? <ArrowDownRight className="size-3" /> : <ArrowUpRight className="size-3" />}
              {Math.abs(deltaPct).toFixed(0)}%
            </span>
          )}
          {hint && <span className="truncate">{hint}</span>}
        </div>
      </div>

      {sparkline && sparkline.length >= 2 && (
        <div className="mt-4 -mb-2">
          <Sparkline data={sparkline} accent={accent} />
        </div>
      )}
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

function Sparkline({
  data,
  accent,
}: {
  data: number[];
  accent: keyof typeof ACCENTS;
}) {
  const width = 200;
  const height = 36;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const step = data.length > 1 ? width / (data.length - 1) : width;

  const points = data
    .map((v, i) => {
      const x = i * step;
      const y = height - ((v - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const last = (data.length - 1) * step;
  const areaPath = `M0,${height} L${points.split(" ").join(" L")} L${last},${height} Z`;

  const colorClass = {
    blue: "text-[var(--color-brand-blue)]",
    red: "text-[var(--color-brand-red)]",
    emerald: "text-emerald-500",
    amber: "text-amber-500",
    violet: "text-violet-500",
  }[accent];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={cn("h-9 w-full", colorClass)}
    >
      <path d={areaPath} fill="currentColor" opacity={0.12} />
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
