"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Building,
  Edit2,
  Home,
  Loader2,
  MapPin,
  MoreVertical,
  Package,
  Sparkles,
  Star,
  Trash2,
  Trees,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { deleteLocation } from "@/server/actions/locations.action";
import {
  LocationDialog,
  type LocationFormValues,
} from "./location-dialog";

interface LocationCardProps {
  location: {
    id: string;
    name: string;
    type: string;
    address: string;
    postal?: string | null;
    city?: string | null;
    floor: number;
    elevator: string;
    notes?: string | null;
    isPrimary: boolean;
    _count?: { items: number };
  };
}

const TYPE_LABEL: Record<string, string> = {
  HOME: "Κατοικία",
  OFFICE: "Γραφείο",
  STORAGE: "Αποθήκη",
  COUNTRY_HOUSE: "Εξοχικό",
  OTHER: "Άλλο",
};

const TYPE_ICON: Record<string, typeof Home> = {
  HOME: Home,
  OFFICE: Building,
  STORAGE: Package,
  COUNTRY_HOUSE: Trees,
  OTHER: Sparkles,
};

const ELEVATOR_LABEL: Record<string, string> = {
  NONE: "Όχι",
  SMALL: "Μικρό ασανσέρ",
  MEDIUM: "Μεσαίο ασανσέρ",
  LARGE: "Μεγάλο ασανσέρ",
};

export function LocationCard({ location }: LocationCardProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleting, start] = useTransition();
  const Icon = TYPE_ICON[location.type] ?? Home;

  function handleDelete() {
    if (
      !confirm(
        `Διαγραφή της διεύθυνσης "${location.name}"; Τα έπιπλα δεν θα διαγραφούν.`,
      )
    )
      return;
    start(async () => {
      const res = await deleteLocation(location.id);
      if (res.ok) router.refresh();
      else alert(res.error);
    });
  }

  const formValues: LocationFormValues = {
    id: location.id,
    name: location.name,
    type: location.type,
    address: location.address,
    postal: location.postal ?? undefined,
    city: location.city ?? undefined,
    floor: location.floor,
    elevator: location.elevator,
    notes: location.notes ?? undefined,
    isPrimary: location.isPrimary,
  };

  return (
    <>
      <article
        className={cn(
          "group relative flex flex-col gap-3 rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-pop)]",
          location.isPrimary
            ? "border-[var(--color-brand-blue)]/40"
            : "border-border",
        )}
      >
        {location.isPrimary && (
          <span className="absolute -top-2 left-5 inline-flex items-center gap-1 rounded-full bg-[var(--color-brand-blue)] px-2 py-0.5 text-[10px] font-bold uppercase text-white">
            <Star className="size-2.5 fill-white" />
            Κύρια
          </span>
        )}

        <header className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "grid size-11 place-items-center rounded-xl",
                location.isPrimary
                  ? "bg-[var(--color-brand-blue)] text-white"
                  : "bg-[var(--color-brand-blue-light)] text-[var(--color-brand-blue-deep)]",
              )}
            >
              <Icon className="size-5" />
            </span>
            <div>
              <h3 className="font-display text-base font-bold text-foreground">
                {location.name}
              </h3>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {TYPE_LABEL[location.type] ?? location.type}
              </p>
            </div>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              onBlur={() => setTimeout(() => setMenuOpen(false), 150)}
              className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <MoreVertical className="size-4" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-9 z-20 w-44 overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-pop)]">
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setEditing(true);
                    setMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-foreground hover:bg-secondary"
                >
                  <Edit2 className="size-3.5" />
                  Επεξεργασία
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleDelete();
                  }}
                  disabled={deleting}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-destructive hover:bg-destructive/5"
                >
                  {deleting ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="size-3.5" />
                  )}
                  Διαγραφή
                </button>
              </div>
            )}
          </div>
        </header>

        <div className="text-sm">
          <p className="flex items-start gap-2 text-foreground">
            <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
            <span className="leading-snug">
              {location.address}
              {location.postal && `, ${location.postal}`}
              {location.city && `, ${location.city}`}
            </span>
          </p>
          {location.notes && (
            <p className="mt-2 rounded-lg bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
              {location.notes}
            </p>
          )}
        </div>

        <footer className="mt-auto flex flex-wrap items-center gap-2 border-t border-border pt-3 text-[11px] text-muted-foreground">
          <span className="rounded-full bg-secondary px-2 py-0.5 font-medium">
            {floorLabel(location.floor)}
          </span>
          <span className="rounded-full bg-secondary px-2 py-0.5 font-medium">
            {ELEVATOR_LABEL[location.elevator] ?? location.elevator}
          </span>
          {location._count && location._count.items > 0 && (
            <span className="ml-auto rounded-full bg-[var(--color-brand-blue-light)] px-2 py-0.5 font-semibold text-[var(--color-brand-blue-deep)]">
              {location._count.items} αντικείμενα
            </span>
          )}
        </footer>
      </article>

      <LocationDialog
        open={editing}
        onOpenChange={setEditing}
        initial={formValues}
      />
    </>
  );
}

function floorLabel(n: number): string {
  if (n < 0) return `${Math.abs(n)}ο υπόγειο`;
  if (n === 0) return "Ισόγειο";
  if (n === 1) return "1ος όροφος";
  return `${n}ος όροφος`;
}
