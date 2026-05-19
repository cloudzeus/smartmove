"use client";

import { useState } from "react";

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
import { volumeM3 } from "./manual-item-presets";
import type { JobItem } from "./wizard-types";

interface CustomItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (item: Omit<JobItem, "id" | "source">) => void;
}

export function CustomItemDialog({
  open,
  onOpenChange,
  onAdd,
}: CustomItemDialogProps) {
  const [name, setName] = useState("");
  const [length, setLength] = useState(80);
  const [width, setWidth] = useState(60);
  const [height, setHeight] = useState(60);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  function reset() {
    setName("");
    setLength(80);
    setWidth(60);
    setHeight(60);
    setQuantity(1);
    setNotes("");
    setPhotoUrl(null);
  }

  function submit() {
    if (!name.trim()) return;
    onAdd({
      name: notes ? `${name.trim()} (${notes.slice(0, 40)})` : name.trim(),
      quantity,
      length_cm: length,
      width_cm: width,
      height_cm: height,
      volume_m3: volumeM3({
        length_cm: length,
        width_cm: width,
        height_cm: height,
      }),
      photoDataUrl: photoUrl ?? undefined,
    });
    reset();
    onOpenChange(false);
  }

  const computedVolume = volumeM3({
    length_cm: length,
    width_cm: width,
    height_cm: height,
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Πρόσθεσε δικό σου αντικείμενο</DialogTitle>
          <DialogDescription>
            Όνομα, διαστάσεις και προαιρετικά φωτογραφία.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-foreground">
              Όνομα αντικειμένου
            </span>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="π.χ. ντουλάπι από παππού"
              autoFocus
            />
          </label>

          <div className="grid grid-cols-3 gap-2">
            <NumberField label="Μήκος (cm)" value={length} onChange={setLength} />
            <NumberField label="Πλάτος (cm)" value={width} onChange={setWidth} />
            <NumberField label="Ύψος (cm)" value={height} onChange={setHeight} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <NumberField
              label="Ποσότητα"
              value={quantity}
              onChange={setQuantity}
              min={1}
            />
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-foreground">
                Όγκος (μονάδα)
              </span>
              <div className="flex h-11 items-center justify-center rounded-lg border border-border bg-secondary/40 text-sm font-bold text-[var(--color-brand-blue-deep)]">
                {computedVolume.toFixed(3)} m³
              </div>
            </div>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-foreground">
              Σημειώσεις (προαιρετικό)
            </span>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="π.χ. ευαίσθητο, χρειάζεται αμπαλάζ"
              rows={2}
            />
          </label>

          <ImageUploader
            value={photoUrl}
            onChange={setPhotoUrl}
            purpose="scan-item"
            label="Φωτογραφία (προαιρετικό)"
            hint="Ανεβαίνει στο BunnyCDN"
            preview="wide"
          />
        </div>

        <div className="flex gap-2 border-t border-border pt-3">
          <Button
            variant="outline"
            className="h-10 flex-1"
            onClick={() => onOpenChange(false)}
          >
            Άκυρο
          </Button>
          <Button
            className="h-10 flex-1"
            disabled={!name.trim()}
            onClick={submit}
          >
            Προσθήκη
          </Button>
        </div>
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
        className="h-11 w-full rounded-lg border border-input bg-card px-3 text-sm font-medium text-foreground focus-visible:border-[var(--color-brand-blue)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
      />
    </label>
  );
}
