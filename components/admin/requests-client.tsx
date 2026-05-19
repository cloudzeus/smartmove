"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarClock,
  Euro,
  LayoutGrid,
  Map as MapIcon,
  MapPin,
  Package,
  Search,
  Table as TableIcon,
  User as UserIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { RequestsMap } from "./requests-map";

type Status = "DRAFT" | "PUBLISHED" | "AWARDED" | "COMPLETED" | "CANCELLED";

export interface AdminRequest {
  id: string;
  status: Status;
  type: string;
  fromAddress: string;
  toAddress: string;
  fromLat: number | null;
  fromLng: number | null;
  toLat: number | null;
  toLng: number | null;
  preferredDate: Date | null;
  publishedAt: Date;
  createdAt: Date;
  itemsCount: number;
  totalVolumeM3: number;
  estimatedPriceMinCents: number | null;
  estimatedPriceMaxCents: number | null;
  offersCount: number;
  user: { id: string; name: string | null; email: string };
}

const STATUS_CONFIG: Record<
  Status,
  { label: string; cardClass: string; badgeClass: string; dotClass: string }
> = {
  DRAFT: {
    label: "Πρόχειρο",
    cardClass:
      "border-slate-200 bg-gradient-to-br from-slate-50 to-white dark:from-slate-900/30 dark:to-card",
    badgeClass: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
    dotClass: "bg-slate-400",
  },
  PUBLISHED: {
    label: "Δημοσιευμένο",
    cardClass:
      "border-sky-200 bg-gradient-to-br from-sky-50 to-white dark:from-sky-950/30 dark:to-card",
    badgeClass: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
    dotClass: "bg-sky-500",
  },
  AWARDED: {
    label: "Ανατέθηκε",
    cardClass:
      "border-amber-200 bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/30 dark:to-card",
    badgeClass:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
    dotClass: "bg-amber-500",
  },
  COMPLETED: {
    label: "Ολοκληρώθηκε",
    cardClass:
      "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/30 dark:to-card",
    badgeClass:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
    dotClass: "bg-emerald-500",
  },
  CANCELLED: {
    label: "Ακυρώθηκε",
    cardClass:
      "border-rose-200 bg-gradient-to-br from-rose-50 to-white dark:from-rose-950/30 dark:to-card",
    badgeClass: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200",
    dotClass: "bg-rose-500",
  },
};

const STATUS_ORDER: Status[] = [
  "PUBLISHED",
  "AWARDED",
  "COMPLETED",
  "DRAFT",
  "CANCELLED",
];

type View = "cards" | "table" | "map";

interface Props {
  requests: AdminRequest[];
  maptilerApiKey?: string;
}

export function RequestsClient({ requests, maptilerApiKey }: Props) {
  const [view, setView] = useState<View>("cards");
  const [statusFilter, setStatusFilter] = useState<Status | "ALL">("ALL");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return requests.filter((r) => {
      if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
      if (!q) return true;
      return (
        r.fromAddress.toLowerCase().includes(q) ||
        r.toAddress.toLowerCase().includes(q) ||
        r.user.email.toLowerCase().includes(q) ||
        (r.user.name?.toLowerCase().includes(q) ?? false) ||
        r.id.toLowerCase().includes(q)
      );
    });
  }, [requests, statusFilter, query]);

  const counts = useMemo(() => {
    const map: Record<Status | "ALL", number> = {
      ALL: requests.length,
      DRAFT: 0,
      PUBLISHED: 0,
      AWARDED: 0,
      COMPLETED: 0,
      CANCELLED: 0,
    };
    for (const r of requests) map[r.status] += 1;
    return map;
  }, [requests]);

  return (
    <div className="flex flex-col gap-5">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3 shadow-[var(--shadow-card)] md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          <FilterChip
            active={statusFilter === "ALL"}
            onClick={() => setStatusFilter("ALL")}
            label={`Όλα · ${counts.ALL}`}
            dotClass="bg-foreground/60"
          />
          {STATUS_ORDER.map((s) => (
            <FilterChip
              key={s}
              active={statusFilter === s}
              onClick={() => setStatusFilter(s)}
              label={`${STATUS_CONFIG[s].label} · ${counts[s]}`}
              dotClass={STATUS_CONFIG[s].dotClass}
            />
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Αναζήτηση…"
              className="h-9 w-full rounded-lg border border-border bg-background pl-8 pr-3 text-sm outline-none focus:border-[var(--color-brand-blue)] md:w-56"
            />
          </div>
          <div className="flex rounded-lg border border-border bg-background p-0.5">
            <ViewToggle
              active={view === "cards"}
              onClick={() => setView("cards")}
              icon={LayoutGrid}
              label="Κάρτες"
            />
            <ViewToggle
              active={view === "table"}
              onClick={() => setView("table")}
              icon={TableIcon}
              label="Πίνακας"
            />
            {maptilerApiKey && (
              <ViewToggle
                active={view === "map"}
                onClick={() => setView("map")}
                icon={MapIcon}
                label="Χάρτης"
              />
            )}
          </div>
        </div>
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
          <Package className="mx-auto size-10 text-muted-foreground" />
          <p className="mt-3 text-sm font-semibold text-foreground">
            Κανένα αίτημα
          </p>
          <p className="text-xs text-muted-foreground">
            Δοκίμασε διαφορετικό φίλτρο ή όρο αναζήτησης.
          </p>
        </div>
      )}

      {/* Views */}
      {filtered.length > 0 && view === "cards" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((r) => (
            <RequestCard key={r.id} r={r} />
          ))}
        </div>
      )}

      {filtered.length > 0 && view === "table" && (
        <RequestsTable requests={filtered} />
      )}

      {view === "map" && maptilerApiKey && (
        <RequestsMap
          apiKey={maptilerApiKey}
          requests={filtered}
          statusConfig={STATUS_CONFIG}
        />
      )}
    </div>
  );
}

export type StatusConfigMap = typeof STATUS_CONFIG;

function RequestCard({ r }: { r: AdminRequest }) {
  const cfg = STATUS_CONFIG[r.status];
  const ref = r.id.slice(-8).toUpperCase();
  return (
    <Link
      href={`/admin/requests/${r.id}`}
      className={cn(
        "group flex flex-col gap-3 rounded-2xl border p-4 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:shadow-lg",
        cfg.cardClass,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] font-bold text-muted-foreground">
          #{ref}
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
            cfg.badgeClass,
          )}
        >
          <span className={cn("size-1.5 rounded-full", cfg.dotClass)} />
          {cfg.label}
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-start gap-2 text-xs">
          <MapPin className="mt-0.5 size-3.5 shrink-0 text-sky-600" />
          <span className="line-clamp-1 font-semibold text-foreground">
            {r.fromAddress}
          </span>
        </div>
        <div className="flex items-start gap-2 text-xs">
          <MapPin className="mt-0.5 size-3.5 shrink-0 text-rose-600" />
          <span className="line-clamp-1 font-semibold text-foreground">
            {r.toAddress}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <UserIcon className="size-3" />
          <span className="line-clamp-1">{r.user.name ?? r.user.email}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <CalendarClock className="size-3" />
          {r.preferredDate ? formatDate(r.preferredDate) : "Ευέλικτη"}
        </span>
        <span className="flex items-center gap-1.5">
          <Package className="size-3" />
          {r.itemsCount} τεμ · {r.totalVolumeM3.toFixed(1)}m³
        </span>
        <span className="flex items-center gap-1.5">
          <Euro className="size-3" />
          {r.offersCount} προσφορές
        </span>
      </div>

      {(r.estimatedPriceMinCents ?? null) !== null &&
        (r.estimatedPriceMaxCents ?? null) !== null && (
          <div className="border-t border-border/60 pt-2 text-xs">
            <span className="text-muted-foreground">Εκτίμηση:</span>{" "}
            <span className="font-bold text-foreground">
              {Math.round((r.estimatedPriceMinCents ?? 0) / 100)}€ –{" "}
              {Math.round((r.estimatedPriceMaxCents ?? 0) / 100)}€
            </span>
          </div>
        )}
    </Link>
  );
}

function RequestsTable({ requests }: { requests: AdminRequest[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
      <table className="w-full text-sm">
        <thead className="bg-secondary/40 text-[11px] uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left font-semibold">#</th>
            <th className="px-3 py-2 text-left font-semibold">Κατάσταση</th>
            <th className="px-3 py-2 text-left font-semibold">Πελάτης</th>
            <th className="px-3 py-2 text-left font-semibold">Διαδρομή</th>
            <th className="px-3 py-2 text-left font-semibold">Ημ/νία</th>
            <th className="px-3 py-2 text-right font-semibold">Τεμάχια</th>
            <th className="px-3 py-2 text-right font-semibold">m³</th>
            <th className="px-3 py-2 text-right font-semibold">Προσφορές</th>
            <th className="px-3 py-2 text-right font-semibold">Εκτίμηση</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {requests.map((r) => {
            const cfg = STATUS_CONFIG[r.status];
            const ref = r.id.slice(-8).toUpperCase();
            return (
              <tr
                key={r.id}
                className="cursor-pointer transition-colors hover:bg-secondary/40"
                onClick={() => {
                  window.location.href = `/admin/requests/${r.id}`;
                }}
              >
                <td className="px-3 py-2 font-mono text-[11px] font-bold text-muted-foreground">
                  #{ref}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                      cfg.badgeClass,
                    )}
                  >
                    <span className={cn("size-1.5 rounded-full", cfg.dotClass)} />
                    {cfg.label}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="font-semibold text-foreground">
                    {r.user.name ?? "—"}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {r.user.email}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="line-clamp-1 text-[12px]">
                    <span className="font-semibold text-foreground">
                      {r.fromAddress}
                    </span>
                  </div>
                  <div className="line-clamp-1 text-[12px] text-muted-foreground">
                    → {r.toAddress}
                  </div>
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {r.preferredDate ? formatDate(r.preferredDate) : "Ευέλικτη"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {r.itemsCount}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {r.totalVolumeM3.toFixed(1)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {r.offersCount}
                </td>
                <td className="px-3 py-2 text-right text-xs font-semibold tabular-nums text-foreground">
                  {r.estimatedPriceMinCents != null &&
                  r.estimatedPriceMaxCents != null
                    ? `${Math.round(r.estimatedPriceMinCents / 100)}–${Math.round(r.estimatedPriceMaxCents / 100)}€`
                    : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  dotClass,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  dotClass: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors",
        active
          ? "bg-foreground text-background"
          : "bg-secondary text-muted-foreground hover:bg-secondary/70 hover:text-foreground",
      )}
    >
      <span className={cn("size-1.5 rounded-full", dotClass)} />
      {label}
    </button>
  );
}

function ViewToggle({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof LayoutGrid;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold transition-colors",
        active
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:text-foreground",
      )}
      aria-label={label}
    >
      <Icon className="size-3.5" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("el-GR", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  }).format(d);
}
