"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { LocationDialog } from "./location-dialog";

export function AddLocationButton({
  variant = "primary",
}: {
  variant?: "primary" | "outline";
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          variant === "primary"
            ? "inline-flex h-10 items-center gap-1.5 rounded-lg bg-[var(--color-brand-blue)] px-5 text-sm font-bold text-white shadow-[var(--shadow-cta)] hover:bg-[var(--color-brand-blue-deep)]"
            : "inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-secondary"
        }
      >
        <Plus className="size-4" />
        Νέα διεύθυνση
      </button>
      <LocationDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
