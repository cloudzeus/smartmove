import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import type { WizardStep } from "./wizard-types";

const STEPS: Array<{ key: WizardStep; label: string; sub: string }> = [
  { key: "method", label: "Μέθοδος", sub: "Πώς θα μετρήσουμε" },
  { key: "inventory", label: "Αντικείμενα", sub: "Λίστα & όγκος" },
  { key: "stops", label: "Σημεία", sub: "Παραλαβές & παραδόσεις" },
  { key: "details", label: "Στοιχεία", sub: "Συμβόλαιο & υποβολή" },
];

interface WizardStepperProps {
  current: WizardStep;
}

export function WizardStepper({ current }: WizardStepperProps) {
  const currentIndex = STEPS.findIndex((s) => s.key === current);

  return (
    <ol className="grid grid-cols-2 gap-2 rounded-2xl border border-border bg-card p-2 shadow-[var(--shadow-card)] sm:grid-cols-4 sm:gap-3 sm:p-3">
      {STEPS.map((s, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        return (
          <li
            key={s.key}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors",
              active && "bg-[var(--color-brand-blue-light)]",
              done && "opacity-90",
            )}
          >
            <span
              className={cn(
                "grid size-9 shrink-0 place-items-center rounded-full font-display text-sm font-bold transition-colors",
                done
                  ? "bg-emerald-600 text-white"
                  : active
                    ? "bg-[var(--color-brand-blue)] text-white"
                    : "bg-secondary text-muted-foreground",
              )}
            >
              {done ? <Check className="size-4" /> : i + 1}
            </span>
            <span className="flex min-w-0 flex-col leading-tight">
              <span
                className={cn(
                  "text-sm font-semibold",
                  active
                    ? "text-[var(--color-brand-blue-deep)]"
                    : "text-foreground",
                )}
              >
                {s.label}
              </span>
              <span className="hidden truncate text-[11px] text-muted-foreground sm:inline">
                {s.sub}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
