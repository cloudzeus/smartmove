import Link from "next/link";
import { Phone } from "lucide-react";

export function PhoneRequiredBanner() {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-amber-300/60 bg-amber-50 p-4 sm:p-5 shadow-[var(--shadow-card)]">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-500 text-white">
        <Phone className="size-5" />
      </span>
      <div className="flex flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-display text-sm font-bold text-foreground">
            Συμπλήρωσε τον αριθμό τηλεφώνου σου
          </p>
          <p className="text-xs text-muted-foreground">
            Είναι υποχρεωτικός για επικοινωνία με μεταφορείς και ολοκλήρωση
            αιτημάτων.
          </p>
        </div>
        <Link
          href="/dashboard/settings?tab=profile"
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-amber-600 px-4 text-sm font-bold text-white shadow-sm transition-colors hover:bg-amber-700"
        >
          Συμπλήρωση τώρα
        </Link>
      </div>
    </div>
  );
}
