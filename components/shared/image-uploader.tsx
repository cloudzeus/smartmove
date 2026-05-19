"use client";

import { useState, useTransition } from "react";
import { AlertCircle, ImagePlus, Loader2, X } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  uploadImage,
  type UploadPurpose,
} from "@/server/actions/upload.action";

interface ImageUploaderProps {
  value: string | null;
  onChange: (url: string | null) => void;
  purpose: UploadPurpose;
  /** Hidden input name for form submission. */
  name?: string;
  maxMB?: number;
  label?: string;
  hint?: string;
  /** "square" 24x24, "wide" 16:9 etc. — controls preview frame. */
  preview?: "square" | "wide" | "tall";
  /** Display variant: stacked (default) or inline (compact). */
  variant?: "card" | "inline";
}

const PREVIEW_CLASS: Record<NonNullable<ImageUploaderProps["preview"]>, string> = {
  square: "size-24",
  wide: "aspect-video w-40",
  tall: "h-32 w-24",
};

export function ImageUploader({
  value,
  onChange,
  purpose,
  name = "imageUrl",
  maxMB = 5,
  label = "Εικόνα",
  hint,
  preview = "square",
  variant = "card",
}: ImageUploaderProps) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > maxMB * 1024 * 1024) {
      setError(`Μέγιστο ${maxMB}MB.`);
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("Μόνο εικόνες.");
      return;
    }

    start(async () => {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("purpose", purpose);
      if (value) fd.append("replaceUrl", value);
      const res = await uploadImage(fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onChange(res.url);
    });
  }

  async function remove() {
    if (!value) return;
    setError(null);
    onChange(null);
  }

  return (
    <div className={cn("flex flex-col gap-2", variant === "inline" && "w-fit")}>
      {variant === "card" && (
        <span className="text-xs font-semibold text-foreground">{label}</span>
      )}
      <div
        className={cn(
          "flex items-center gap-4",
          variant === "inline" && "gap-2",
        )}
      >
        <div
          className={cn(
            "relative grid shrink-0 place-items-center overflow-hidden rounded-2xl border-2 border-dashed bg-secondary/30 text-muted-foreground",
            value && "border-solid border-border bg-card",
            pending && "opacity-60",
            PREVIEW_CLASS[preview],
          )}
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value}
              alt={label}
              className="size-full object-contain p-1"
            />
          ) : (
            <ImagePlus className="size-7" strokeWidth={1.5} />
          )}
          {pending && (
            <span className="absolute inset-0 grid place-items-center bg-background/60">
              <Loader2 className="size-5 animate-spin text-[var(--color-brand-blue)]" />
            </span>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <label
            className={cn(
              "inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary",
              pending && "pointer-events-none opacity-60",
            )}
          >
            <ImagePlus className="size-4" />
            {value ? "Αλλαγή" : "Επιλογή εικόνας"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={pick}
              disabled={pending}
            />
          </label>
          {value && (
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-destructive hover:underline disabled:opacity-50"
            >
              <X className="size-3.5" />
              Αφαίρεση
            </button>
          )}
          {hint && (
            <p className="text-[11px] text-muted-foreground">{hint}</p>
          )}
        </div>
      </div>
      <input type="hidden" name={name} value={value ?? ""} readOnly />
      {error && (
        <p className="flex items-start gap-1.5 text-xs text-destructive">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
