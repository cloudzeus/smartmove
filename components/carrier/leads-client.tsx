"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";

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
    <div className="flex flex-col gap-2.5">
      <div className="cx-card flex flex-col gap-2 p-2 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-1">
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
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Αναζήτηση περιοχής…"
            className="h-7 w-full rounded-md border border-border bg-background pl-7 pr-2.5 text-[12px] outline-none focus:border-[var(--cx-accent)] focus:ring-1 focus:ring-[var(--cx-accent)] md:w-56"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="cx-card border-dashed bg-muted/30 px-4 py-8 text-center">
          <p className="text-[12px] font-semibold text-foreground">
            Δεν υπάρχουν διαθέσιμα αιτήματα αυτή τη στιγμή
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Δοκίμασε διαφορετικό φίλτρο ή έλεγξε ξανά σύντομα.
          </p>
        </div>
      ) : (
        <ul className="cx-card divide-y divide-[var(--cx-divider)] overflow-hidden">
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
        "grid items-center gap-3 px-3 py-1.5 cx-transition hover:bg-[var(--cx-hover)] active:bg-[var(--cx-accent-soft)]",
        "grid-cols-[auto_1.5fr_auto_auto_auto_auto] sm:gap-4",
      )}
    >
      <span
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          isBidded ? "bg-amber-500" : "bg-sky-500",
        )}
        aria-label={isBidded ? "Έχεις προσφέρει" : "Νέο"}
      />

      <div className="min-w-0">
        <p className="flex min-w-0 items-center gap-1 truncate text-[12px] font-semibold text-foreground">
          <span className="truncate">{l.fromLocality}</span>
          <ArrowSep />
          <span className="truncate">{l.toLocality}</span>
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[10px] text-muted-foreground">
          <span className="font-mono">#{ref}</span>
          <span>· {typeLabel(l.type)}</span>
          <span>· {l.itemsCount} τεμ · {l.totalVolumeM3.toFixed(1)} m³</span>
        </p>
      </div>

      <div className="hidden text-right text-[10px] text-muted-foreground sm:block">
        <p>{l.preferredDate ? formatDate(l.preferredDate) : "Ευέλικτη"}</p>
        {l.flexDays > 0 && <p className="text-[9px]">±{l.flexDays} ημ.</p>}
      </div>

      <div className="hidden text-right text-[10px] sm:block">
        {l.estimatedPriceMinCents != null && l.estimatedPriceMaxCents != null ? (
          <>
            <p className="text-muted-foreground">Εκτίμηση</p>
            <p className="text-[11px] font-semibold tabular-nums text-foreground">
              {Math.round(l.estimatedPriceMinCents / 100)}–{Math.round(l.estimatedPriceMaxCents / 100)}€
            </p>
          </>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </div>

      <div className="hidden text-right text-[10px] text-muted-foreground sm:block">
        <p>προσφορές</p>
        <p className="text-[11px] font-semibold tabular-nums text-foreground">{l.offersCount}</p>
      </div>

      {l.myOffer ? (
        <span className="inline-flex shrink-0 items-center rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-amber-800 ring-1 ring-inset ring-amber-200">
          {Math.round(l.myOffer.priceCents / 100)}€
        </span>
      ) : (
        <span className="inline-flex shrink-0 items-center rounded-full bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-800 ring-1 ring-inset ring-sky-200">
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
        "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[11px] font-semibold cx-transition cx-press",
        active
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:bg-[var(--cx-hover)] hover:text-foreground active:bg-[var(--cx-accent-soft)]",
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
