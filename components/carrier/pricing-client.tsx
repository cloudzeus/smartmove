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
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Αναζήτηση αντικειμένου…"
              className="h-10 w-full rounded-lg border-2 border-border bg-white pl-9 pr-3 text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-[var(--color-brand-blue)] focus:ring-2 focus:ring-[var(--color-brand-blue)]/20 md:w-64"
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

  const hasPrice = !!it.price;

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
    <li
      className={cn(
        "grid items-center gap-3 px-4 py-3.5 transition-colors hover:bg-secondary/30",
        "sm:grid-cols-[1.5fr_repeat(3,_minmax(110px,_1fr))_auto]",
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          className={cn(
            "size-2 shrink-0 rounded-full",
            hasPrice ? "bg-emerald-500" : "bg-border",
          )}
          aria-hidden
          title={hasPrice ? "Έχει τιμή" : "Χωρίς τιμή"}
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-foreground">{it.nameEl}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {it.nameEn}
            {it.defaultVolumeM3 != null &&
              ` · ${it.defaultVolumeM3.toFixed(2)} m³`}
          </p>
        </div>
      </div>
      <PriceInput
        label="Βασική"
        sublabel="ανά τεμάχιο"
        value={base}
        onChange={setBase}
        tone="primary"
      />
      <PriceInput
        label="+ Γερανός"
        sublabel="προσθετικό"
        value={crane}
        onChange={setCrane}
        tone="amber"
      />
      <PriceInput
        label="+ Αμπαλάζ"
        sublabel="προσθετικό"
        value={packing}
        onChange={setPacking}
        tone="violet"
      />
      <button
        type="button"
        onClick={save}
        disabled={pending || !isDirty}
        className={cn(
          "inline-flex h-10 items-center gap-1.5 rounded-lg px-4 text-xs font-bold transition-colors disabled:cursor-not-allowed",
          isDirty
            ? "bg-[var(--color-brand-blue)] text-white shadow-sm hover:bg-[var(--color-brand-blue-deep)]"
            : "bg-secondary text-muted-foreground",
          saved === "ok" && "!bg-emerald-600 text-white",
          saved === "err" && "!bg-rose-600 text-white",
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
  sublabel,
  value,
  onChange,
  tone = "primary",
}: {
  label: string;
  sublabel?: string;
  value: string;
  onChange: (v: string) => void;
  tone?: "primary" | "amber" | "violet";
}) {
  const filled = value !== "" && value !== "0";
  const ringTone =
    tone === "amber"
      ? "focus:border-amber-500 focus:ring-amber-500/20"
      : tone === "violet"
        ? "focus:border-violet-500 focus:ring-violet-500/20"
        : "focus:border-[var(--color-brand-blue)] focus:ring-[var(--color-brand-blue)]/20";
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-baseline gap-1 text-[11px] font-bold uppercase tracking-wide text-foreground">
        {label}
        {sublabel && (
          <span className="text-[9px] font-normal normal-case tracking-normal text-muted-foreground">
            · {sublabel}
          </span>
        )}
      </span>
      <div
        className={cn(
          "relative flex items-center rounded-lg border-2 bg-white shadow-[inset_0_1px_0_rgba(15,23,42,0.03)] transition-colors",
          filled ? "border-foreground/30" : "border-border",
          "focus-within:ring-2",
          ringTone,
        )}
      >
        <span className="pointer-events-none flex h-10 w-9 items-center justify-center border-r border-border bg-secondary/60 text-sm font-bold text-foreground">
          €
        </span>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0,00"
          className="h-10 w-full rounded-r-lg bg-transparent px-2.5 text-base font-bold tabular-nums text-foreground outline-none placeholder:font-normal placeholder:text-muted-foreground/50"
        />
      </div>
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
    <div className="flex items-center gap-1.5 rounded-lg border-2 border-border bg-white p-1 shadow-sm">
      <input
        type="number"
        value={percent}
        onChange={(e) => setPercent(e.target.value)}
        placeholder="+5"
        step="1"
        className="h-8 w-16 rounded border border-border bg-white px-2 text-sm font-bold tabular-nums text-foreground outline-none focus:border-[var(--color-brand-blue)]"
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
        "inline-flex h-8 items-center rounded-full border px-3 text-xs font-semibold transition-colors",
        active
          ? "border-[var(--color-brand-blue)] bg-[var(--color-brand-blue)] text-white shadow-sm"
          : "border-border bg-white text-foreground hover:border-[var(--color-brand-blue)]/40 hover:bg-secondary",
      )}
    >
      {label}
    </button>
  );
}
