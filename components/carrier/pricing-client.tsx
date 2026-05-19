"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Percent, Search, X } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  applyPercentageUplift,
  upsertCarrierPrice,
  type CatalogEntryWithPrice,
} from "@/server/actions/carrier-pricing.action";

const CATEGORY_LABEL: Record<string, string> = {
  furniture: "Έπιπλα",
  appliances: "Συσκευές",
  electronics: "Ηλεκτρονικά",
  boxes: "Κούτες",
  other: "Άλλα",
};

interface Props {
  items: CatalogEntryWithPrice[];
}

export function PricingClient({ items }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("ALL");
  const [showOnly, setShowOnly] = useState<"ALL" | "SET" | "UNSET">("ALL");

  const categories = useMemo(() => {
    const s = new Set(items.map((i) => i.category ?? "other"));
    return Array.from(s).sort();
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      if (category !== "ALL" && (it.category ?? "other") !== category)
        return false;
      if (showOnly === "SET" && !it.price) return false;
      if (showOnly === "UNSET" && it.price) return false;
      if (!q) return true;
      return (
        it.nameEl.toLowerCase().includes(q) ||
        it.nameEn.toLowerCase().includes(q) ||
        it.key.toLowerCase().includes(q)
      );
    });
  }, [items, query, category, showOnly]);

  // Group by category.
  const grouped = useMemo(() => {
    const map = new Map<string, CatalogEntryWithPrice[]>();
    for (const it of filtered) {
      const cat = it.category ?? "other";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(it);
    }
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3 shadow-[var(--shadow-card)] lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip
            active={category === "ALL"}
            onClick={() => setCategory("ALL")}
            label="Όλες"
          />
          {categories.map((c) => (
            <Chip
              key={c}
              active={category === c}
              onClick={() => setCategory(c)}
              label={CATEGORY_LABEL[c] ?? c}
            />
          ))}
          <span className="mx-2 h-5 w-px bg-border" />
          <Chip
            active={showOnly === "ALL"}
            onClick={() => setShowOnly("ALL")}
            label="Όλα"
          />
          <Chip
            active={showOnly === "SET"}
            onClick={() => setShowOnly("SET")}
            label="Με τιμή"
          />
          <Chip
            active={showOnly === "UNSET"}
            onClick={() => setShowOnly("UNSET")}
            label="Χωρίς τιμή"
          />
        </div>
        <div className="flex items-center gap-2">
          <BulkUplift onApplied={() => router.refresh()} />
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Αναζήτηση…"
              className="h-9 w-full rounded-lg border border-border bg-background pl-8 pr-3 text-sm outline-none focus:border-[var(--color-brand-blue)] md:w-56"
            />
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center text-sm text-muted-foreground">
          Καμία αντιστοιχία στα φίλτρα.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {grouped.map(([cat, list]) => (
            <section
              key={cat}
              className="rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]"
            >
              <h2 className="border-b border-border px-4 py-2.5 font-display text-sm font-bold uppercase tracking-wide text-muted-foreground">
                {CATEGORY_LABEL[cat] ?? cat}{" "}
                <span className="ml-1 text-[10px] font-normal">
                  ({list.length})
                </span>
              </h2>
              <ul className="divide-y divide-border">
                {list.map((it) => (
                  <PricingRow key={it.key} it={it} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function PricingRow({ it }: { it: CatalogEntryWithPrice }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState<null | "ok" | "err">(null);
  const [base, setBase] = useState(
    it.price ? String(it.price.basePriceCents / 100) : "",
  );
  const [crane, setCrane] = useState(
    it.price ? String(it.price.craneSurchargeCents / 100) : "",
  );
  const [packing, setPacking] = useState(
    it.price ? String(it.price.packingSurchargeCents / 100) : "",
  );

  const isDirty =
    String((it.price?.basePriceCents ?? 0) / 100) !== (base || "0") ||
    String((it.price?.craneSurchargeCents ?? 0) / 100) !== (crane || "0") ||
    String((it.price?.packingSurchargeCents ?? 0) / 100) !==
      (packing || "0");

  const save = () => {
    setSaved(null);
    start(async () => {
      const r = await upsertCarrierPrice({
        itemKey: it.key,
        basePriceEur: base || "0",
        craneSurchargeEur: crane || "0",
        packingSurchargeEur: packing || "0",
      });
      if (r.ok) {
        setSaved("ok");
        router.refresh();
        setTimeout(() => setSaved(null), 2000);
      } else {
        setSaved("err");
      }
    });
  };

  return (
    <li className="grid items-center gap-3 px-4 py-3 sm:grid-cols-[1.5fr_repeat(3,_1fr)_auto]">
      <div className="min-w-0">
        <p className="truncate font-semibold text-foreground">{it.nameEl}</p>
        <p className="truncate text-[11px] text-muted-foreground">
          {it.nameEn}
          {it.defaultVolumeM3 != null && ` · ${it.defaultVolumeM3.toFixed(2)} m³`}
        </p>
      </div>
      <PriceInput
        label="Βασική"
        value={base}
        onChange={setBase}
        hint="ανά τεμάχιο"
      />
      <PriceInput
        label="+ Γερανός"
        value={crane}
        onChange={setCrane}
        hint="προσθετικό"
      />
      <PriceInput
        label="+ Αμπαλάζ"
        value={packing}
        onChange={setPacking}
        hint="προσθετικό"
      />
      <button
        type="button"
        onClick={save}
        disabled={pending || !isDirty}
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-xs font-bold transition-colors",
          isDirty
            ? "bg-foreground text-background hover:bg-foreground/90"
            : "bg-secondary text-muted-foreground",
          saved === "ok" && "bg-emerald-600 text-white",
          saved === "err" && "bg-rose-600 text-white",
        )}
        title={!isDirty ? "Καμία αλλαγή" : undefined}
      >
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : saved === "ok" ? (
          <Check className="size-3.5" />
        ) : saved === "err" ? (
          <X className="size-3.5" />
        ) : null}
        {saved === "ok"
          ? "Αποθηκεύτηκε"
          : saved === "err"
            ? "Σφάλμα"
            : "Αποθήκευση"}
      </button>
    </li>
  );
}

function PriceInput({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase text-muted-foreground">
        {label}
      </span>
      <div className="relative">
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="—"
          className="h-9 w-full rounded-md border border-border bg-background pl-2.5 pr-7 text-sm font-semibold tabular-nums outline-none focus:border-[var(--color-brand-blue)]"
        />
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          €
        </span>
      </div>
      {hint && <span className="text-[9px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

function BulkUplift({ onApplied }: { onApplied: () => void }) {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [percent, setPercent] = useState("");

  const apply = () => {
    const n = Number(percent);
    if (!Number.isFinite(n)) return;
    if (
      !confirm(
        `Εφαρμογή ${n > 0 ? "+" : ""}${n}% σε ΟΛΕΣ τις τιμές σου;`,
      )
    )
      return;
    start(async () => {
      const r = await applyPercentageUplift(n);
      if (r.ok) {
        setOpen(false);
        setPercent("");
        onApplied();
      } else {
        alert(r.error);
      }
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-semibold hover:bg-secondary"
        title="Bulk αναπροσαρμογή"
      >
        <Percent className="size-3.5" />
        Αναπροσαρμογή
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5 rounded-md border border-border bg-background p-1">
      <input
        type="number"
        value={percent}
        onChange={(e) => setPercent(e.target.value)}
        placeholder="+5"
        step="1"
        className="h-7 w-16 rounded bg-secondary px-2 text-xs outline-none"
      />
      <span className="text-xs text-muted-foreground">%</span>
      <button
        type="button"
        onClick={apply}
        disabled={pending || !percent}
        className="rounded bg-foreground px-2 py-1 text-[11px] font-bold text-background disabled:opacity-50"
      >
        {pending ? (
          <Loader2 className="size-3 animate-spin" />
        ) : (
          "Εφαρμογή"
        )}
      </button>
      <button
        type="button"
        onClick={() => {
          setOpen(false);
          setPercent("");
        }}
        className="rounded p-1 text-muted-foreground hover:bg-secondary"
      >
        <X className="size-3" />
      </button>
    </div>
  );
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
        "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
        active
          ? "bg-foreground text-background"
          : "bg-secondary text-muted-foreground hover:bg-secondary/70 hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}
