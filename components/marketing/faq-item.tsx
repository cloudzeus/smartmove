"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";

import { cn } from "@/lib/utils";

interface FaqItemProps {
  q: string;
  a: string;
  defaultOpen?: boolean;
}

export function FaqItem({ q, a, defaultOpen = false }: FaqItemProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card transition-colors",
        open && "border-[var(--color-brand-blue)]/40 shadow-[var(--shadow-card)]",
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <span className="font-display text-base font-semibold text-foreground sm:text-lg">
          {q}
        </span>
        <span
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-full text-foreground transition-colors",
            open
              ? "bg-[var(--color-brand-blue)] text-white"
              : "bg-secondary text-secondary-foreground",
          )}
        >
          {open ? <Minus className="size-4" /> : <Plus className="size-4" />}
        </span>
      </button>
      {open && (
        <div className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground">
          {a}
        </div>
      )}
    </div>
  );
}
