"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, Plus } from "lucide-react";

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
import { ImageUploader } from "@/components/shared/image-uploader";
import { upsertItem } from "@/server/actions/inventory.action";

const CONDITIONS = [
  { value: "ASSEMBLED", label: "Συναρμολογημένο" },
  { value: "MODULAR", label: "Αποσυναρμολογείται" },
  { value: "FRAGILE", label: "Εύθραυστο" },
  { value: "EXTRA_CARE", label: "Πολύτιμο" },
] as const;

export interface ItemFormValues {
  id?: string;
  name?: string;
  category?: string;
  locationId?: string | null;
  length_cm?: number;
  width_cm?: number;
  height_cm?: number;
  weight_kg?: number;
  quantity?: number;
  condition?: string | null;
  photoUrl?: string | null;
  notes?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locations: Array<{ id: string; name: string }>;
  initial?: ItemFormValues | null;
}

export function ItemDialog({ open, onOpenChange, locations, initial }: Props) {
  const router = useRouter();
  const [length, setLength] = useState<number>(initial?.length_cm ?? 80);
  const [width, setWidth] = useState<number>(initial?.width_cm ?? 60);
  const [height, setHeight] = useState<number>(initial?.height_cm ?? 60);
  const [quantity, setQuantity] = useState<number>(initial?.quantity ?? 1);
  const [locationId, setLocationId] = useState<string>(
    initial?.locationId ?? "",
  );
  const [condition, setCondition] = useState<string>(initial?.condition ?? "");
  const [photoUrl, setPhotoUrl] = useState<string | null>(
    initial?.photoUrl ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const editing = !!initial?.id;

  const volume = useMemo(
    () => (length * width * height) / 1_000_000,
    [length, width, height],
  );

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const payload = {
      id: initial?.id,
      name: String(fd.get("name") ?? ""),
      category: String(fd.get("category") ?? "") || undefined,
      locationId: locationId || null,
      length_cm: length,
      width_cm: width,
      height_cm: height,
      weight_kg: fd.get("weight_kg")
        ? Number(fd.get("weight_kg"))
        : undefined,
      quantity,
      condition: condition || undefined,
      photoUrl,
      notes: String(fd.get("notes") ?? "") || undefined,
    };
    start(async () => {
      const res = await upsertItem(payload);
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
            {editing ? "Επεξεργασία αντικειμένου" : "Νέο αντικείμενο"}
          </DialogTitle>
          <DialogDescription>
            Πρόσθεσε ένα έπιπλο ή αντικείμενο στη λίστα σου. Τα στοιχεία θα
            χρησιμοποιηθούν σε μελλοντικά αιτήματα μεταφοράς.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="col-span-2 flex flex-col gap-1.5 sm:col-span-1">
              <span className="text-xs font-semibold text-foreground">Όνομα</span>
              <Input
                name="name"
                defaultValue={initial?.name}
                required
                placeholder="π.χ. Καναπές σαλονιού"
                autoFocus
              />
            </label>
            <label className="col-span-2 flex flex-col gap-1.5 sm:col-span-1">
              <span className="text-xs font-semibold text-foreground">
                Κατηγορία (προαιρετικό)
              </span>
              <Input
                name="category"
                defaultValue={initial?.category}
                placeholder="π.χ. Σαλόνι"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-foreground">
              Βρίσκεται στην τοποθεσία
            </span>
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="h-11 rounded-lg border border-input bg-card px-3 text-sm font-medium text-foreground focus-visible:border-[var(--color-brand-blue)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
            >
              <option value="">— Καμία τοποθεσία —</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            {locations.length === 0 && (
              <span className="text-[11px] text-muted-foreground">
                Δεν έχεις διευθύνσεις ακόμα — μπορείς να το προσθέσεις και αργότερα.
              </span>
            )}
          </label>

          <div className="grid grid-cols-3 gap-2">
            <NumberField label="Μήκος (cm)" value={length} onChange={setLength} />
            <NumberField label="Πλάτος (cm)" value={width} onChange={setWidth} />
            <NumberField label="Ύψος (cm)" value={height} onChange={setHeight} />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <NumberField
              label="Ποσότητα"
              value={quantity}
              onChange={setQuantity}
              min={1}
            />
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-foreground">
                Βάρος (kg)
              </span>
              <Input
                type="number"
                step="0.1"
                min={0}
                name="weight_kg"
                defaultValue={initial?.weight_kg}
                placeholder="—"
              />
            </label>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-foreground">
                Όγκος (μονάδα)
              </span>
              <div className="flex h-11 items-center justify-center rounded-lg border border-border bg-secondary/40 text-sm font-bold text-[var(--color-brand-blue-deep)]">
                {volume.toFixed(3)} m³
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-foreground">
              Κατάσταση (προαιρετικό)
            </span>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {CONDITIONS.map((c) => {
                const active = condition === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setCondition(active ? "" : c.value)}
                    className={cn(
                      "rounded-lg border-2 px-2 py-2 text-xs font-semibold transition-colors",
                      active
                        ? "border-[var(--color-brand-blue)] bg-[var(--color-brand-blue-light)] text-[var(--color-brand-blue-deep)]"
                        : "border-border bg-card text-muted-foreground hover:border-[var(--color-brand-blue)]/40",
                    )}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>

          <ImageUploader
            value={photoUrl}
            onChange={setPhotoUrl}
            purpose="saved-item"
            label="Φωτογραφία (προαιρετικό)"
            hint="JPG, PNG, WebP · έως 5MB · ανεβαίνει στο BunnyCDN"
            preview="wide"
          />

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-foreground">
              Σημειώσεις (προαιρετικό)
            </span>
            <Textarea
              name="notes"
              defaultValue={initial?.notes}
              rows={2}
              placeholder="π.χ. αποσυναρμολογείται, χρειάζεται 2 άτομα"
            />
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

function NumberField({
  label,
  value,
  onChange,
  min = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-foreground">{label}</span>
      <input
        type="number"
        min={min}
        value={value}
        onChange={(e) => onChange(Math.max(min, Number(e.target.value) || min))}
        className="h-11 rounded-lg border border-input bg-card px-3 text-center text-sm font-bold text-foreground focus-visible:border-[var(--color-brand-blue)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
      />
    </label>
  );
}
