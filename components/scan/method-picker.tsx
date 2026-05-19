"use client";

import {
  ArrowRight,
  Camera,
  CheckCircle2,
  ListChecks,
  Sparkles,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { InventoryMethod } from "./wizard-types";

interface MethodPickerProps {
  onSelect: (method: InventoryMethod) => void;
}

export function MethodPicker({ onSelect }: MethodPickerProps) {
  return (
    <div className="flex flex-col gap-6">
      <header className="text-center">
        <h2 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Πώς θες να δημιουργήσεις τη λίστα αντικειμένων;
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
          Διάλεξε τον τρόπο που σε εξυπηρετεί. Μπορείς πάντα να αλλάξεις ή να
          προσθέσεις αντικείμενα στο επόμενο βήμα.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <MethodCard
          recommended
          icon={Sparkles}
          title="AI σκανάρισμα από φωτογραφίες"
          subtitle="Γρήγορα · ~10 δευτερόλεπτα"
          features={[
            "Ανέβασε έως 4 φωτογραφίες (panorama)",
            "Το AI αναγνωρίζει αντικείμενα & διαστάσεις",
            "Εκτιμά αυτόματα συνολικό όγκο σε m³",
            "Μπορείς να διορθώσεις / αφαιρέσεις",
          ]}
          accent="blue"
          onClick={() => onSelect("ai")}
        />
        <MethodCard
          icon={ListChecks}
          title="Επιλογή αντικειμένων μία-μία"
          subtitle="Χειροκίνητα · κάθε λεπτομέρεια"
          features={[
            "Έτοιμη λίστα με συνηθισμένα έπιπλα & συσκευές",
            "Ορίζεις ποσότητα ανά αντικείμενο",
            "Πρόσθεσε προαιρετικά φωτογραφία",
            "Πρόσθεσε δικά σου ειδικά αντικείμενα",
          ]}
          accent="neutral"
          onClick={() => onSelect("manual")}
        />
      </div>
    </div>
  );
}

interface MethodCardProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  features: readonly string[];
  accent: "blue" | "neutral";
  recommended?: boolean;
  onClick: () => void;
}

function MethodCard({
  icon: Icon,
  title,
  subtitle,
  features,
  accent,
  recommended,
  onClick,
}: MethodCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex h-full flex-col gap-4 rounded-2xl border-2 p-6 text-left shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-pop)]",
        accent === "blue"
          ? "border-[var(--color-brand-blue)]/30 bg-[var(--color-brand-blue-light)]/60 hover:border-[var(--color-brand-blue)]"
          : "border-border bg-card hover:border-[var(--color-brand-blue)]/40",
      )}
    >
      {recommended && (
        <span className="absolute right-4 top-4 rounded-full bg-[var(--color-brand-red)] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
          Προτείνεται
        </span>
      )}

      <span
        className={cn(
          "grid size-12 place-items-center rounded-xl",
          accent === "blue"
            ? "bg-[var(--color-brand-blue)] text-white"
            : "bg-secondary text-foreground",
        )}
      >
        <Icon className="size-6" />
      </span>

      <div>
        <h3 className="font-display text-lg font-bold text-foreground">
          {title}
        </h3>
        <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
      </div>

      <ul className="flex flex-col gap-2 text-sm text-foreground">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <CheckCircle2
              className={cn(
                "mt-0.5 size-4 shrink-0",
                accent === "blue"
                  ? "text-[var(--color-brand-blue)]"
                  : "text-emerald-600",
              )}
            />
            {f}
          </li>
        ))}
      </ul>

      <span className="mt-auto flex items-center gap-1 pt-2 text-sm font-semibold text-[var(--color-brand-blue-deep)] transition-transform group-hover:translate-x-0.5">
        {accent === "blue" ? (
          <>
            <Camera className="size-4" />
            Ξεκίνα σκανάρισμα
          </>
        ) : (
          <>
            <ListChecks className="size-4" />
            Επιλογή αντικειμένων
          </>
        )}
        <ArrowRight className="size-4" />
      </span>
    </button>
  );
}
