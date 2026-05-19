"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarClock,
  Euro,
  Lock,
  MapPin,
  Package,
  Search,
  Truck,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { LeadSummary } from "@/server/actions/carrier-leads.action";

interface Props {
  leads: LeadSummary[];
}

type FilterTab = "ALL" | "OPEN" | "BIDDED";

export function LeadsClient({ leads }: Props) {
  const [tab, setTab] = useState<FilterTab>("ALL");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads.filter((l) => {
      if (tab === "OPEN" && l.myOffer) return false;
      if (tab === "BIDDED" && !l.myOffer) return false;
      if (!q) return true;
      return (
        l.fromLocality.toLowerCase().includes(q) ||
        l.toLocality.toLowerCase().includes(q) ||
        l.type.toLowerCase().includes(q)
      );
    });
  }, [leads, tab, query]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3 shadow-[var(--shadow-card)] md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-1.5">
          <Chip
            active={tab === "ALL"}
            onClick={() => setTab("ALL")}
            label={`Όλα · ${leads.length}`}
          />
          <Chip
            active={tab === "OPEN"}
            onClick={() => setTab("OPEN")}
            label={`Χωρίς προσφορά · ${leads.filter((l) => !l.myOffer).length}`}
          />
          <Chip
            active={tab === "BIDDED"}
            onClick={() => setTab("BIDDED")}
            label={`Έχω προσφέρει · ${leads.filter((l) => l.myOffer).length}`}
          />
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Αναζήτηση περιοχής…"
            className="h-9 w-full rounded-lg border border-border bg-background pl-8 pr-3 text-sm outline-none focus:border-[var(--color-brand-blue)] md:w-56"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
          <Package className="mx-auto size-10 text-muted-foreground" />
          <p className="mt-3 text-sm font-semibold text-foreground">
            Δεν υπάρχουν διαθέσιμα αιτήματα αυτή τη στιγμή
          </p>
          <p className="text-xs text-muted-foreground">
            Δοκίμασε διαφορετικό φίλτρο ή έλεγξε ξανά σύντομα.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {filtered.map((l) => (
            <li key={l.id}>
              <LeadRow l={l} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LeadRow({ l }: { l: LeadSummary }) {
  const ref = l.id.slice(-8).toUpperCase();
  const isBidded = Boolean(l.myOffer);
  return (
    <Link
      href={`/carrier/leads/${l.id}`}
      className={cn(
        "grid items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 transition-colors hover:bg-secondary/40",
        "grid-cols-[auto_1.5fr_auto_auto_auto_auto] sm:gap-4",
      )}
    >
      {/* status dot — color is the ONLY semantic cue */}
      <span
        className={cn(
          "size-2 shrink-0 rounded-full",
          isBidded ? "bg-amber-500" : "bg-sky-500",
        )}
        aria-label={isBidded ? "Έχεις προσφέρει" : "Νέο"}
      />

      {/* From → To + meta line */}
      <div className="min-w-0">
        <p className="flex min-w-0 items-center gap-1 truncate text-[13px] font-semibold text-foreground">
          <span className="truncate">{l.fromLocality}</span>
          <ArrowSep />
          <span className="truncate">{l.toLocality}</span>
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10px] text-muted-foreground">
          <span className="font-mono">#{ref}</span>
          <span>{typeLabel(l.type)}</span>
          <span>
            {l.itemsCount} τεμ · {l.totalVolumeM3.toFixed(1)} m³
          </span>
        </p>
      </div>

      {/* date */}
      <div className="hidden text-right text-[10px] text-muted-foreground sm:block">
        <p>{l.preferredDate ? formatDate(l.preferredDate) : "Ευέλικτη"}</p>
        {l.flexDays > 0 && <p className="text-[9px]">±{l.flexDays} ημ.</p>}
      </div>

      {/* customer estimate */}
      <div className="hidden text-right text-[10px] sm:block">
        {l.estimatedPriceMinCents != null && l.estimatedPriceMaxCents != null ? (
          <>
            <p className="text-muted-foreground">Εκτίμηση</p>
            <p className="text-[12px] font-semibold tabular-nums text-foreground">
              {Math.round(l.estimatedPriceMinCents / 100)}–
              {Math.round(l.estimatedPriceMaxCents / 100)}€
            </p>
          </>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </div>

      {/* offers count */}
      <div className="hidden text-right text-[10px] text-muted-foreground sm:block">
        <p>προσφορές</p>
        <p className="text-[12px] font-semibold tabular-nums text-foreground">
          {l.offersCount}
        </p>
      </div>

      {/* my offer or new chip */}
      {l.myOffer ? (
        <span className="inline-flex shrink-0 items-center rounded-full border border-amber-300 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-amber-800">
          {Math.round(l.myOffer.priceCents / 100)}€
        </span>
      ) : (
        <span className="inline-flex shrink-0 items-center rounded-full border border-sky-300 px-2 py-0.5 text-[10px] font-semibold text-sky-800">
          Νέο
        </span>
      )}
    </Link>
  );
}

function ArrowSep() {
  return <span className="shrink-0 text-muted-foreground/60">→</span>;
}

function Chip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
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
      {label}
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

function typeLabel(v: string): string {
  switch (v) {
    case "HOUSE":
      return "Κατοικία";
    case "FURNITURE":
      return "Έπιπλα";
    case "BUSINESS":
      return "Επαγγελματικό";
    case "HEAVY":
      return "Βαρέα";
    default:
      return v;
  }
}
