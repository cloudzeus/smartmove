"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { updateBranchOfferings } from "@/server/actions/branch-offerings.action";
import {
  BRANCH_OFFERING_TYPES,
  type BranchOfferingType,
} from "@/lib/branch-offerings";
import { cn } from "@/lib/utils";

interface Props {
  branch: {
    id: string;
    name: string;
    address: string | null;
    offersToOthers: boolean;
    offeredServices: BranchOfferingType[];
    offeringsNotes: string | null;
  };
}

const SERVICE_META: Record<BranchOfferingType, { label: string; icon: string; tint: string }> = {
  CRANE:          { label: "Γερανός",            icon: "🏗",  tint: "bg-orange-50 text-orange-800 ring-orange-200" },
  PACKING:        { label: "Πακετάρισμα/Αμπαλάζ", icon: "📦", tint: "bg-violet-50 text-violet-800 ring-violet-200" },
  LOADING:        { label: "Φόρτωση (προσωπικό)", icon: "⬆",  tint: "bg-sky-50 text-sky-800 ring-sky-200" },
  UNLOADING:      { label: "Ξεφόρτωμα (προσωπικό)",icon: "⬇", tint: "bg-rose-50 text-rose-800 ring-rose-200" },
  ASSEMBLY:       { label: "Συναρμολόγηση",       icon: "🔧", tint: "bg-teal-50 text-teal-800 ring-teal-200" },
  STORAGE:        { label: "Αποθήκευση",          icon: "🏬", tint: "bg-amber-50 text-amber-800 ring-amber-200" },
  CLEANUP:        { label: "Καθαρισμός",          icon: "🧹", tint: "bg-emerald-50 text-emerald-800 ring-emerald-200" },
  VEHICLE_RENTAL: { label: "Φορτηγό με οδηγό",   icon: "🚚", tint: "bg-indigo-50 text-indigo-800 ring-indigo-200" },
  DRIVER:         { label: "Μόνο οδηγός",         icon: "👤", tint: "bg-slate-50 text-slate-800 ring-slate-200" },
  OTHER:          { label: "Άλλο",                icon: "•",  tint: "bg-muted text-foreground/70 ring-border" },
};

export function BranchOfferingsEditor({ branch }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [enabled, setEnabled] = useState(branch.offersToOthers);
  const [services, setServices] = useState<Set<BranchOfferingType>>(
    new Set(branch.offeredServices),
  );
  const [notes, setNotes] = useState(branch.offeringsNotes ?? "");

  function toggle(s: BranchOfferingType) {
    setServices((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }

  function handleSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await updateBranchOfferings({
        branchId: branch.id,
        offersToOthers: enabled,
        services: enabled ? Array.from(services) : [],
        notes: enabled ? notes : "",
      });
      if (res.ok) {
        setSaved(true);
        router.refresh();
        setTimeout(() => setSaved(false), 2000);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="cx-card overflow-hidden">
      {/* Branch header */}
      <div className="flex items-center gap-2 border-b border-border bg-[var(--cx-accent-soft)] px-3 py-2">
        <Building2 className="size-3.5 text-[var(--cx-accent)]" />
        <div className="min-w-0 flex-1">
          <p className="cx-h2 truncate">{branch.name}</p>
          {branch.address && (
            <p className="truncate text-[11px] text-muted-foreground">{branch.address}</p>
          )}
        </div>
        {enabled && services.size > 0 && (
          <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200">
            🤝 {services.size} υπηρ.
          </span>
        )}
      </div>

      <div className="space-y-3 p-3">
        {/* Master toggle */}
        <label className="flex items-start gap-2.5">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="mt-0.5 size-4 accent-[var(--cx-accent)]"
          />
          <div className="flex-1">
            <p className="text-[13px] font-semibold text-foreground">
              Παρέχει υπηρεσίες σε άλλους μεταφορείς
            </p>
            <p className="text-[11px] text-muted-foreground">
              Όταν ενεργό, το branch εμφανίζεται στη λίστα partners ως subcontractor —
              μπορεί να δεχτεί quote requests για γερανό, αμπαλάζ, εξοπλισμό, οδηγούς.
            </p>
          </div>
        </label>

        {/* Services grid — only when enabled */}
        {enabled && (
          <>
            <div className="space-y-1.5">
              <label className="cx-eyebrow">Διαθέσιμες υπηρεσίες</label>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {BRANCH_OFFERING_TYPES.map((s) => {
                  const meta = SERVICE_META[s];
                  const on = services.has(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggle(s)}
                      className={cn(
                        "inline-flex h-9 items-center justify-start gap-1.5 rounded-md border px-2 text-[11px] font-semibold cx-transition cx-press",
                        on
                          ? `${meta.tint} ring-1 ring-inset border-transparent`
                          : "border-border bg-card text-muted-foreground hover:bg-[var(--cx-hover)] hover:text-foreground",
                      )}
                    >
                      <span aria-hidden className="text-[14px] leading-none">{meta.icon}</span>
                      <span className="truncate">{meta.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <label className="cx-eyebrow">Σημειώσεις (προαιρετικά)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="π.χ. Γερανός 20t, διαθέσιμος Δευ-Παρ 8:00-17:00. Τηλέφωνο επικοινωνίας: ..."
                rows={2}
                className="w-full resize-none rounded-md border border-border bg-background px-2.5 py-1.5 text-[12px] outline-none focus:border-[var(--cx-accent)] focus:ring-1 focus:ring-[var(--cx-accent)]"
              />
            </div>
          </>
        )}

        {error && (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] text-rose-800">
            {error}
          </div>
        )}
        {saved && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] text-emerald-800">
            ✓ Αποθηκεύτηκε
          </div>
        )}

        <div className="flex items-center justify-end border-t border-border pt-2">
          <Button size="sm" onClick={handleSave} disabled={pending}>
            {pending ? "Αποθήκευση…" : "Αποθήκευση"}
          </Button>
        </div>
      </div>
    </div>
  );
}
