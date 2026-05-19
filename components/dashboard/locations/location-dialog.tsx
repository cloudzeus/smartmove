"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Building,
  Home,
  Loader2,
  MapPin,
  Package,
  Plus,
  Sparkles,
  Trees,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PlacesInput } from "@/components/marketing/places-input";
import { upsertLocation } from "@/server/actions/locations.action";

const TYPES = [
  { value: "HOME", label: "Κατοικία", icon: Home },
  { value: "OFFICE", label: "Γραφείο", icon: Building },
  { value: "STORAGE", label: "Αποθήκη", icon: Package },
  { value: "COUNTRY_HOUSE", label: "Εξοχικό", icon: Trees },
  { value: "OTHER", label: "Άλλο", icon: Sparkles },
] as const;

const ELEVATORS = [
  { value: "NONE", label: "Όχι" },
  { value: "SMALL", label: "Μικρό" },
  { value: "MEDIUM", label: "Μεσαίο" },
  { value: "LARGE", label: "Μεγάλο" },
] as const;

export interface LocationFormValues {
  id?: string;
  name?: string;
  type?: string;
  address?: string;
  postal?: string;
  city?: string;
  floor?: number;
  elevator?: string;
  notes?: string;
  isPrimary?: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: LocationFormValues | null;
}

export function LocationDialog({ open, onOpenChange, initial }: Props) {
  const router = useRouter();
  const [type, setType] = useState<string>(initial?.type ?? "HOME");
  const [elevator, setElevator] = useState<string>(initial?.elevator ?? "NONE");
  const [floor, setFloor] = useState<number>(initial?.floor ?? 0);
  const [isPrimary, setIsPrimary] = useState<boolean>(
    initial?.isPrimary ?? false,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const editing = !!initial?.id;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const payload = {
      id: initial?.id,
      name: String(fd.get("name") ?? ""),
      type,
      address: String(fd.get("address") ?? ""),
      postal: String(fd.get("postal") ?? "") || undefined,
      city: String(fd.get("city") ?? "") || undefined,
      floor,
      elevator,
      notes: String(fd.get("notes") ?? "") || undefined,
      isPrimary,
    };
    start(async () => {
      const res = await upsertLocation(payload);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Επεξεργασία διεύθυνσης" : "Νέα διεύθυνση"}
          </DialogTitle>
          <DialogDescription>
            Δώσε ένα ξεχωριστό όνομα — π.χ. <strong>Σπίτι Αθήνα</strong> ή{" "}
            <strong>Εξοχικό Σύρος</strong> — για εύκολη χρήση σε μελλοντικά αιτήματα.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-foreground">
              Όνομα τοποθεσίας
            </span>
            <Input
              name="name"
              defaultValue={initial?.name}
              required
              placeholder="π.χ. Σπίτι Αθήνα"
              autoFocus
            />
          </label>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-foreground">Τύπος</span>
            <div className="grid grid-cols-5 gap-1.5">
              {TYPES.map((t) => {
                const active = type === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setType(t.value)}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-xl border-2 px-2 py-2.5 text-[11px] font-medium transition-colors",
                      active
                        ? "border-[var(--color-brand-blue)] bg-[var(--color-brand-blue-light)] text-[var(--color-brand-blue-deep)]"
                        : "border-border bg-card text-muted-foreground hover:border-[var(--color-brand-blue)]/40",
                    )}
                  >
                    <t.icon className="size-4" />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          <PlacesInput
            name="address"
            label="Διεύθυνση"
            placeholder="π.χ. Πατησίων 60, Αθήνα"
            defaultValue={initial?.address}
            required
            icon={<MapPin className="size-4 text-[var(--color-brand-blue)]" />}
          />

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-foreground">ΤΚ</span>
              <Input
                name="postal"
                defaultValue={initial?.postal}
                placeholder="11476"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-foreground">Πόλη</span>
              <Input
                name="city"
                defaultValue={initial?.city}
                placeholder="Αθήνα"
              />
            </label>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <label className="col-span-1 flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-foreground">
                Όροφος
              </span>
              <input
                type="number"
                min={-2}
                max={30}
                value={floor}
                onChange={(e) => setFloor(Number(e.target.value) || 0)}
                className="h-11 w-full rounded-lg border border-input bg-card px-2 text-center text-sm font-bold text-foreground focus-visible:border-[var(--color-brand-blue)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
              />
            </label>
            <div className="col-span-3 flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-foreground">
                Ασανσέρ
              </span>
              <div className="grid grid-cols-4 gap-1.5">
                {ELEVATORS.map((e) => {
                  const active = elevator === e.value;
                  return (
                    <button
                      key={e.value}
                      type="button"
                      onClick={() => setElevator(e.value)}
                      className={cn(
                        "h-11 rounded-lg border-2 text-xs font-semibold transition-colors",
                        active
                          ? "border-[var(--color-brand-blue)] bg-[var(--color-brand-blue-light)] text-[var(--color-brand-blue-deep)]"
                          : "border-border bg-card text-muted-foreground hover:border-[var(--color-brand-blue)]/40",
                      )}
                    >
                      {e.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-foreground">
              Σημειώσεις (προαιρετικό)
            </span>
            <Textarea
              name="notes"
              defaultValue={initial?.notes}
              rows={2}
              placeholder="Στενός δρόμος, ώρες πρόσβασης, κλπ."
            />
          </label>

          <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-secondary/40 p-3 text-xs text-foreground">
            <input
              type="checkbox"
              checked={isPrimary}
              onChange={(e) => setIsPrimary(e.target.checked)}
              className="size-4 cursor-pointer rounded border-border accent-[var(--color-brand-blue)]"
            />
            <span>Όρισέ την ως κύρια διεύθυνση</span>
          </label>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
              {error}
            </div>
          )}

          <div className="flex gap-2 border-t border-border pt-3">
            <Button
              type="button"
              variant="outline"
              className="h-10 flex-1"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Άκυρο
            </Button>
            <Button
              type="submit"
              className="h-10 flex-1 shadow-[var(--shadow-cta)]"
              disabled={pending}
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : editing ? (
                "Αποθήκευση"
              ) : (
                <>
                  <Plus className="mr-1 size-4" />
                  Προσθήκη
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
