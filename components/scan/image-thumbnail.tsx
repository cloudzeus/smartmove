"use client";

import { RotateCw, X } from "lucide-react";

import { cn } from "@/lib/utils";

export interface ScanImage {
  id: string;
  file: File;
  dataUrl: string;
  /** Rotation in degrees (0, 90, 180, 270) */
  rotation: 0 | 90 | 180 | 270;
}

interface ImageThumbnailProps {
  image: ScanImage;
  index: number;
  onRotate: (id: string) => void;
  onRemove: (id: string) => void;
  active?: boolean;
  onSelect?: (id: string) => void;
}

export function ImageThumbnail({
  image,
  index,
  onRotate,
  onRemove,
  active,
  onSelect,
}: ImageThumbnailProps) {
  return (
    <div
      className={cn(
        "group relative aspect-square w-full overflow-hidden rounded-xl border-2 bg-muted shadow-sm",
        active
          ? "border-[var(--color-brand-blue)] ring-2 ring-[var(--color-brand-blue)]/30"
          : "border-border",
      )}
    >
      <button
        type="button"
        onClick={() => onSelect?.(image.id)}
        className="absolute inset-0 size-full"
        title={`Επιλογή φωτογραφίας ${index + 1}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.dataUrl}
          alt={`Φωτογραφία ${index + 1}`}
          className="size-full object-cover transition-transform"
          style={{ transform: `rotate(${image.rotation}deg)` }}
          draggable={false}
        />
      </button>

      {/* Index badge */}
      <span className="pointer-events-none absolute left-1.5 top-1.5 rounded-md bg-foreground/80 px-1.5 py-0.5 text-[10px] font-bold text-white">
        {index + 1}
      </span>

      {/* Action buttons */}
      <div className="absolute right-1.5 top-1.5 flex flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRotate(image.id);
          }}
          title="Περιστροφή 90°"
          className="grid size-7 place-items-center rounded-md bg-white/95 text-foreground shadow-sm transition-colors hover:bg-[var(--color-brand-blue)] hover:text-white"
        >
          <RotateCw className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(image.id);
          }}
          title="Αφαίρεση"
          className="grid size-7 place-items-center rounded-md bg-white/95 text-foreground shadow-sm transition-colors hover:bg-destructive hover:text-white"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
