"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  Box,
  Briefcase,
  ChefHat,
  Layers,
  Minus,
  Plus,
  ShowerHead,
  Sofa,
  Sun,
  Trees,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  CATEGORY_LABELS,
  ITEM_PRESETS,
  type ItemCategory,
  volumeM3,
} from "./manual-item-presets";
import type { JobItem } from "./wizard-types";
import { CustomItemDialog } from "./custom-item-dialog";

const CATEGORY_ICONS: Record<ItemCategory, React.ComponentType<{ className?: string }>> = {
  living: Sofa,
  bedroom: Layers,
  kitchen: ChefHat,
  bathroom: ShowerHead,
  office: Briefcase,
  outdoor: Sun,
  boxes: Box,
};

const CATEGORY_ORDER: ItemCategory[] = [
  "living",
  "bedroom",
  "kitchen",
  "office",
  "bathroom",
  "outdoor",
  "boxes",
];

interface ManualItemPickerProps {
  items: JobItem[];
  onChange: (items: JobItem[]) => void;
  onContinue: () => void;
  onBack: () => void;
}

export function ManualItemPicker({
  items,
  onChange,
  onContinue,
  onBack,
}: ManualItemPickerProps) {
  const [activeCategory, setActiveCategory] = useState<ItemCategory>("living");
  const [customOpen, setCustomOpen] = useState(false);
  const [search, setSearch] = useState("");

  const quantities = useMemo(() => {
    const map = new Map<string, number>();
    for (const it of items) {
      if (it.source === "manual") {
        map.set(it.id, it.quantity);
      }
    }
    return map;
  }, [items]);

  function setQuantity(presetId: string, qty: number) {
    const preset = ITEM_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    const existing = items.find((i) => i.id === presetId);
    if (qty <= 0) {
      onChange(items.filter((i) => i.id !== presetId));
      return;
    }
    if (existing) {
      onChange(
        items.map((i) =>
          i.id === presetId ? { ...i, quantity: qty } : i,
        ),
      );
    } else {
      onChange([
        ...items,
        {
          id: preset.id,
          name: preset.name,
          quantity: qty,
          length_cm: preset.length_cm,
          width_cm: preset.width_cm,
          height_cm: preset.height_cm,
          volume_m3: volumeM3(preset),
          category: CATEGORY_LABELS[preset.category],
          source: "manual",
        },
      ]);
    }
  }

  function addCustom(item: Omit<JobItem, "source" | "id">) {
    const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    onChange([...items, { ...item, id, source: "manual" }]);
  }

  function removeItem(id: string) {
    onChange(items.filter((i) => i.id !== id));
  }

  const filteredPresets = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ITEM_PRESETS.filter((p) => {
      if (q.length > 0) {
        return p.name.toLowerCase().includes(q);
      }
      return p.category === activeCategory;
    });
  }, [activeCategory, search]);

  const totalCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalVolume = items.reduce(
    (sum, i) => sum + i.volume_m3 * i.quantity,
    0,
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      {/* Picker */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Επιλογή αντικειμένων</CardTitle>
          <CardDescription>
            Διάλεξε κατηγορία και πρόσθεσε όσα αντικείμενα έχεις. Πάτα{" "}
            <kbd className="rounded border border-border bg-secondary px-1 text-[10px]">
              +
            </kbd>{" "}
            για να αυξήσεις την ποσότητα.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {/* Search */}
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Αναζήτηση: π.χ. καναπές, ψυγείο, ντουλάπα…"
            className="h-11 w-full rounded-lg border border-input bg-background px-4 text-sm font-medium text-foreground placeholder:font-normal placeholder:text-muted-foreground focus-visible:border-[var(--color-brand-blue)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          />

          {/* Category chips */}
          {!search && (
            <div className="flex flex-wrap gap-2">
              {CATEGORY_ORDER.map((cat) => {
                const Icon = CATEGORY_ICONS[cat];
                const active = cat === activeCategory;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActiveCategory(cat)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                      active
                        ? "border-[var(--color-brand-blue)] bg-[var(--color-brand-blue)] text-white"
                        : "border-border bg-card text-foreground hover:border-[var(--color-brand-blue)]/40",
                    )}
                  >
                    <Icon className="size-3.5" />
                    {CATEGORY_LABELS[cat]}
                  </button>
                );
              })}
            </div>
          )}

          {/* Item grid */}
          {filteredPresets.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Δεν βρέθηκαν αντικείμενα. Πρόσθεσε δικό σου.
            </div>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {filteredPresets.map((p) => {
                const qty = quantities.get(p.id) ?? 0;
                const active = qty > 0;
                return (
                  <li key={p.id}>
                    <div
                      className={cn(
                        "flex items-center justify-between gap-3 rounded-xl border bg-card p-3 transition-colors",
                        active
                          ? "border-[var(--color-brand-blue)]/40 bg-[var(--color-brand-blue-light)]/40"
                          : "border-border hover:border-[var(--color-brand-blue)]/30",
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {p.name}
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {p.length_cm}×{p.width_cm}×{p.height_cm} cm ·{" "}
                          {volumeM3(p).toFixed(2)} m³
                        </p>
                      </div>
                      <QuantityControl
                        value={qty}
                        onChange={(v) => setQuantity(p.id, v)}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <Button
            variant="outline"
            className="h-11 text-sm"
            onClick={() => setCustomOpen(true)}
          >
            <Plus className="mr-2 size-4" />
            Πρόσθεσε δικό σου αντικείμενο
          </Button>
        </CardContent>
      </Card>

      {/* Summary side */}
      <div className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Λίστα μου</CardTitle>
            <CardDescription>
              {totalCount === 0
                ? "Καμία επιλογή ακόμα"
                : `${totalCount} αντικείμενα · ${totalVolume.toFixed(2)} m³`}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {items.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                Πάτα <kbd className="rounded border bg-secondary px-1">+</kbd> σε
                οποιοδήποτε αντικείμενο για να ξεκινήσεις.
              </p>
            ) : (
              <ul className="max-h-[360px] space-y-1.5 overflow-y-auto">
                {items.map((it) => (
                  <li
                    key={it.id}
                    className="flex items-center justify-between gap-2 rounded-lg bg-secondary/50 px-3 py-2 text-sm"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-foreground">
                        {it.quantity}× {it.name}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {(it.volume_m3 * it.quantity).toFixed(2)} m³
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => removeItem(it.id)}
                      className="text-[11px] font-medium text-destructive hover:underline"
                    >
                      Αφαίρεση
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="rounded-xl bg-[var(--color-brand-blue-light)] p-3 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Συνολικός όγκος
              </p>
              <p className="font-display text-2xl font-bold text-[var(--color-brand-blue-deep)]">
                {totalVolume.toFixed(2)} m³
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Button
                className="h-12 w-full text-base shadow-[var(--shadow-cta)]"
                disabled={items.length === 0}
                onClick={onContinue}
              >
                Συνέχεια
                <ArrowRight className="ml-1 size-4" />
              </Button>
              <Button
                variant="ghost"
                className="h-10 w-full text-sm"
                onClick={onBack}
              >
                Πίσω στις επιλογές
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <CustomItemDialog
        open={customOpen}
        onOpenChange={setCustomOpen}
        onAdd={addCustom}
      />
    </div>
  );
}

function QuantityControl({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  if (value === 0) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 px-3"
        onClick={() => onChange(1)}
      >
        <Plus className="mr-1 size-3.5" />
        Προσθήκη
      </Button>
    );
  }
  return (
    <div className="inline-flex items-center overflow-hidden rounded-lg border border-[var(--color-brand-blue)] bg-card">
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        className="grid size-9 place-items-center text-foreground transition-colors hover:bg-[var(--color-brand-blue-light)]"
        aria-label="Μείωση"
      >
        <Minus className="size-3.5" />
      </button>
      <span className="min-w-[2.5rem] text-center text-sm font-bold text-foreground tabular-nums">
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className="grid size-9 place-items-center text-foreground transition-colors hover:bg-[var(--color-brand-blue-light)]"
        aria-label="Αύξηση"
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}

export { Trees };
