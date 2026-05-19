"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Edit2,
  Loader2,
  MapPin,
  MoreVertical,
  PackageOpen,
  Plus,
  Trash2,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { deleteItem, moveItem } from "@/server/actions/inventory.action";
import { ItemDialog, type ItemFormValues } from "./item-dialog";

export interface InventoryItem {
  id: string;
  name: string;
  category?: string | null;
  locationId?: string | null;
  length_cm: number;
  width_cm: number;
  height_cm: number;
  volume_m3: number;
  weight_kg?: number | null;
  quantity: number;
  condition?: string | null;
  photoUrl?: string | null;
  notes?: string | null;
}

export interface InventoryLocation {
  id: string;
  name: string;
  type: string;
  city?: string | null;
}

interface InventoryBoardProps {
  locations: InventoryLocation[];
  items: InventoryItem[];
}

const UNASSIGNED = "__none__";

const CONDITION_LABEL: Record<string, string> = {
  ASSEMBLED: "Συναρμολογημένο",
  MODULAR: "Αποσυναρμολογείται",
  FRAGILE: "Εύθραυστο",
  EXTRA_CARE: "Πολύτιμο",
};

export function InventoryBoard({ locations, items }: InventoryBoardProps) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<ItemFormValues | null>(null);

  const grouped = new Map<string, InventoryItem[]>();
  grouped.set(UNASSIGNED, []);
  for (const loc of locations) grouped.set(loc.id, []);
  for (const item of items) {
    const key = item.locationId ?? UNASSIGNED;
    if (!grouped.has(key)) grouped.set(UNASSIGNED, [...(grouped.get(UNASSIGNED) ?? []), item]);
    else grouped.get(key)!.push(item);
  }

  const sections = [
    ...locations.map((loc) => ({
      key: loc.id,
      name: loc.name,
      sub: loc.city ?? null,
      type: loc.type,
      items: grouped.get(loc.id) ?? [],
    })),
    {
      key: UNASSIGNED,
      name: "Χωρίς τοποθεσία",
      sub: null,
      type: "OTHER",
      items: grouped.get(UNASSIGNED) ?? [],
    },
  ].filter((s) => s.items.length > 0 || s.key !== UNASSIGNED);

  return (
    <>
      <div className="mb-5 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {items.length} αντικείμενα · {items
            .reduce((s, i) => s + i.volume_m3 * i.quantity, 0)
            .toFixed(2)}{" "}
          m³ συνολικά
        </p>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[var(--color-brand-blue)] px-5 text-sm font-bold text-white shadow-[var(--shadow-cta)] hover:bg-[var(--color-brand-blue-deep)]"
        >
          <Plus className="size-4" />
          Νέο αντικείμενο
        </button>
      </div>

      <div className="flex flex-col gap-8">
        {sections.map((section) => (
          <section key={section.key}>
            <header className="mb-3 flex items-center justify-between gap-3 border-b border-border pb-2">
              <div className="flex items-center gap-2">
                <MapPin className="size-4 text-[var(--color-brand-blue)]" />
                <h3 className="font-display text-base font-bold text-foreground">
                  {section.name}
                </h3>
                {section.sub && (
                  <span className="text-xs text-muted-foreground">
                    · {section.sub}
                  </span>
                )}
              </div>
              <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                {section.items.length} αντ.
              </span>
            </header>

            {section.items.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border bg-card px-4 py-6 text-center text-xs text-muted-foreground">
                Κανένα αντικείμενο σε αυτή την τοποθεσία.
              </p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {section.items.map((item) => (
                  <li key={item.id}>
                    <ItemCard
                      item={item}
                      locations={locations}
                      onEdit={() =>
                        setEditing({
                          id: item.id,
                          name: item.name,
                          category: item.category ?? undefined,
                          locationId: item.locationId,
                          length_cm: item.length_cm,
                          width_cm: item.width_cm,
                          height_cm: item.height_cm,
                          weight_kg: item.weight_kg ?? undefined,
                          quantity: item.quantity,
                          condition: item.condition,
                          photoUrl: item.photoUrl,
                          notes: item.notes ?? undefined,
                        })
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      <ItemDialog
        open={adding}
        onOpenChange={setAdding}
        locations={locations.map((l) => ({ id: l.id, name: l.name }))}
      />
      <ItemDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        locations={locations.map((l) => ({ id: l.id, name: l.name }))}
        initial={editing}
      />
    </>
  );
}

function ItemCard({
  item,
  locations,
  onEdit,
}: {
  item: InventoryItem;
  locations: InventoryLocation[];
  onEdit: () => void;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [pending, start] = useTransition();

  function onDelete() {
    if (!confirm(`Διαγραφή του "${item.name}";`)) return;
    start(async () => {
      const res = await deleteItem(item.id);
      if (res.ok) router.refresh();
      else alert(res.error);
    });
  }

  function onMove(locationId: string | null) {
    start(async () => {
      const res = await moveItem(item.id, locationId);
      if (res.ok) {
        setMoveOpen(false);
        setMenuOpen(false);
        router.refresh();
      } else alert(res.error);
    });
  }

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:border-[var(--color-brand-blue)]/30 hover:shadow-[var(--shadow-pop)]">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-secondary/40">
        {item.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.photoUrl}
            alt={item.name}
            className="size-full object-cover"
          />
        ) : (
          <div className="grid size-full place-items-center text-muted-foreground/60">
            <PackageOpen className="size-10" strokeWidth={1.5} />
          </div>
        )}
        {item.quantity > 1 && (
          <span className="absolute left-2 top-2 rounded-md bg-foreground/85 px-1.5 py-0.5 text-[10px] font-bold text-white">
            ×{item.quantity}
          </span>
        )}
        <div className="absolute right-1.5 top-1.5">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            onBlur={() => setTimeout(() => { setMenuOpen(false); setMoveOpen(false); }, 200)}
            className="grid size-8 place-items-center rounded-lg bg-white/95 text-foreground shadow-sm transition-colors hover:bg-secondary"
          >
            <MoreVertical className="size-4" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-9 z-20 w-44 overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-pop)]">
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onEdit();
                  setMenuOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-foreground hover:bg-secondary"
              >
                <Edit2 className="size-3.5" />
                Επεξεργασία
              </button>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setMoveOpen((v) => !v);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-foreground hover:bg-secondary"
              >
                <MapPin className="size-3.5" />
                Μετακίνηση σε…
              </button>
              {moveOpen && (
                <div className="border-t border-border bg-secondary/30 px-1 py-1">
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onMove(null);
                    }}
                    disabled={pending}
                    className="block w-full rounded px-2 py-1.5 text-left text-[11px] text-muted-foreground hover:bg-card"
                  >
                    — Καμία —
                  </button>
                  {locations.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        onMove(l.id);
                      }}
                      disabled={pending || l.id === item.locationId}
                      className={cn(
                        "block w-full rounded px-2 py-1.5 text-left text-[11px] font-medium",
                        l.id === item.locationId
                          ? "bg-[var(--color-brand-blue-light)] text-[var(--color-brand-blue-deep)]"
                          : "text-foreground hover:bg-card",
                      )}
                    >
                      {l.name}
                    </button>
                  ))}
                </div>
              )}
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onDelete();
                }}
                disabled={pending}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-destructive hover:bg-destructive/5"
              >
                {pending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Trash2 className="size-3.5" />
                )}
                Διαγραφή
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="font-display text-sm font-bold leading-snug text-foreground line-clamp-1">
          {item.name}
        </h3>
        {item.category && (
          <p className="text-[11px] text-muted-foreground">{item.category}</p>
        )}
        <dl className="grid grid-cols-3 gap-1 text-center text-[10px]">
          <div className="rounded-md bg-secondary/60 px-1 py-1">
            <dt className="uppercase text-muted-foreground">Μ</dt>
            <dd className="font-semibold text-foreground">{item.length_cm}cm</dd>
          </div>
          <div className="rounded-md bg-secondary/60 px-1 py-1">
            <dt className="uppercase text-muted-foreground">Π</dt>
            <dd className="font-semibold text-foreground">{item.width_cm}cm</dd>
          </div>
          <div className="rounded-md bg-secondary/60 px-1 py-1">
            <dt className="uppercase text-muted-foreground">Υ</dt>
            <dd className="font-semibold text-foreground">{item.height_cm}cm</dd>
          </div>
        </dl>
        <div className="mt-auto flex items-center justify-between border-t border-border pt-2 text-xs">
          <span className="font-bold text-foreground">
            {(item.volume_m3 * item.quantity).toFixed(3)} m³
          </span>
          {item.condition && (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
              {CONDITION_LABEL[item.condition] ?? item.condition}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
