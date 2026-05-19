"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  Check,
  ChevronDown,
  Euro,
  Loader2,
  Plus,
  Sparkles,
  Sun,
  Sunrise,
  Sunset,
  Trash2,
  Truck,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  getOfferSuggestion,
  submitOffer,
  withdrawOffer,
  type CarrierVehicleOption,
} from "@/server/actions/carrier-leads.action";
import type { OfferPricingBreakdown } from "@/lib/offer-pricing";

type Period = "MORNING" | "AFTERNOON" | "EVENING";
interface ProposedSlot {
  date: string;
  period: Period;
}

interface ExistingOffer {
  id: string;
  priceCents: number;
  estimatedDays: number | null;
  notes: string | null;
  status: string;
  validUntil: Date;
  proposedSlots: ProposedSlot[];
}

interface Props {
  moveRequestId: string;
  existing?: ExistingOffer;
  estimateMin: number | null;
  estimateMax: number | null;
  vehicles: CarrierVehicleOption[];
}

export function OfferForm({
  moveRequestId,
  existing,
  estimateMin,
  estimateMax,
  vehicles,
}: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [feedback, setFeedback] = useState<
    { ok: true; msg: string } | { ok: false; msg: string } | null
  >(null);

  const [priceEur, setPriceEur] = useState<string>(
    existing ? String(Math.round(existing.priceCents / 100)) : "",
  );
  const [estimatedDays, setEstimatedDays] = useState<string>(
    existing?.estimatedDays != null ? String(existing.estimatedDays) : "",
  );
  const [notes, setNotes] = useState<string>(existing?.notes ?? "");
  const [validDays, setValidDays] = useState<string>("7");
  const [vehicleId, setVehicleId] = useState<string>("");
  const [slots, setSlots] = useState<ProposedSlot[]>(
    existing?.proposedSlots ?? [],
  );
  const [newSlotDate, setNewSlotDate] = useState<string>("");
  const [newSlotPeriod, setNewSlotPeriod] = useState<Period>("MORNING");
  const [suggestion, setSuggestion] = useState<OfferPricingBreakdown | null>(
    null,
  );
  const [suggestPending, suggestStart] = useTransition();

  const calcSuggestion = (vid: string) => {
    suggestStart(async () => {
      const r = await getOfferSuggestion(moveRequestId, vid || null);
      setSuggestion(r);
      if (r && r.totalCents > 0) {
        setPriceEur(String(Math.round(r.totalCents / 100)));
      }
    });
  };

  const submit = () => {
    setFeedback(null);
    start(async () => {
      const r = await submitOffer({
        moveRequestId,
        priceEur,
        estimatedDays: estimatedDays || undefined,
        notes,
        validDays,
        proposedSlots: slots,
      });
      if (r.ok) {
        setFeedback({
          ok: true,
          msg: existing
            ? "Η προσφορά σου ενημερώθηκε."
            : "Η προσφορά σου υποβλήθηκε.",
        });
        router.refresh();
      } else {
        setFeedback({ ok: false, msg: r.error });
      }
    });
  };

  const remove = () => {
    if (!existing) return;
    if (!confirm("Σίγουρα θες να αποσύρεις την προσφορά;")) return;
    start(async () => {
      const r = await withdrawOffer(existing.id);
      if (r.ok) {
        setFeedback({ ok: true, msg: "Η προσφορά αποσύρθηκε." });
        setPriceEur("");
        setEstimatedDays("");
        setNotes("");
        router.refresh();
      } else {
        setFeedback({ ok: false, msg: r.error ?? "Σφάλμα" });
      }
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {existing && (
        <div className="rounded-lg bg-[var(--color-brand-blue-deep)]/10 px-3 py-2 text-xs">
          <span className="font-bold uppercase text-[var(--color-brand-blue-deep)]">
            Ενεργή προσφορά · {existing.status}
          </span>
          <p className="mt-0.5 text-muted-foreground">
            Λήγει: {formatDate(existing.validUntil)}
          </p>
        </div>
      )}

      {/* Vehicle selector + auto-calc */}
      <Field label="Όχημα (για υπολογισμό κόστους)">
        <div className="flex gap-1.5">
          <select
            value={vehicleId}
            onChange={(e) => {
              setVehicleId(e.target.value);
              if (e.target.value) calcSuggestion(e.target.value);
            }}
            className="h-9 flex-1 rounded-lg border border-border bg-background px-2 text-sm outline-none focus:border-[var(--color-brand-blue)]"
          >
            <option value="">— Χωρίς όχημα —</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id} disabled={!v.hasBase}>
                {v.plate}
                {v.brand && ` · ${v.brand}${v.model ? " " + v.model : ""}`}
                {v.capacityM3 != null && ` · ${v.capacityM3}m³`}
                {!v.hasBase && " (χωρίς βάση)"}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => calcSuggestion(vehicleId)}
            disabled={suggestPending}
            className="inline-flex h-9 items-center gap-1 rounded-lg border border-border bg-background px-2.5 text-xs font-semibold hover:bg-secondary disabled:opacity-50"
            title="Υπολογισμός από catalog + όχημα"
          >
            {suggestPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Sparkles className="size-3.5" />
            )}
            Auto
          </button>
        </div>
      </Field>

      {suggestion && (
        <div className="rounded-lg border border-border bg-secondary/30 p-2.5 text-xs">
          <p className="mb-1.5 flex items-center justify-between font-semibold text-foreground">
            <span>Προτεινόμενη τιμή</span>
            <span className="font-display text-base text-[var(--color-brand-blue-deep)]">
              {Math.round(suggestion.totalCents / 100)}€
            </span>
          </p>
          <ul className="space-y-0.5 text-[11px] text-muted-foreground">
            <li className="flex justify-between">
              <span>
                Αντικείμενα ({suggestion.matchedCount} matched
                {suggestion.unmatchedCount > 0 &&
                  ` · ${suggestion.unmatchedCount} χωρίς τιμή`}
                )
              </span>
              <span className="font-semibold text-foreground">
                {Math.round(suggestion.itemsTotalCents / 100)}€
              </span>
            </li>
            {suggestion.trip && (
              <>
                <li className="flex justify-between">
                  <span>
                    <Truck className="mr-1 inline size-3" />
                    Διαδρομή {suggestion.trip.distanceKm.toFixed(1)} km
                    {suggestion.trip.source === "haversine" && " (approx)"}
                  </span>
                  <span className="font-semibold text-foreground">
                    {Math.round(suggestion.trip.totalCents / 100)}€
                  </span>
                </li>
                {suggestion.trip.minApplied && (
                  <li className="text-[10px] italic">
                    Εφαρμόστηκε το ελάχιστο fare του οχήματος.
                  </li>
                )}
              </>
            )}
            {suggestion.unmatchedCount > 0 && (
              <li className="mt-1 rounded bg-amber-50 px-1.5 py-1 text-[10px] text-amber-900">
                ⚠ {suggestion.unmatchedCount} αντικείμεν
                {suggestion.unmatchedCount === 1 ? "ο" : "α"} χωρίς τιμή στο
                τιμολόγιο. Πρόσθεσε χειροκίνητα το αντίστοιχο κόστος.
              </li>
            )}
          </ul>
        </div>
      )}

      <Field label="Τιμή (€)">
        <div className="relative">
          <Euro className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="number"
            inputMode="decimal"
            min={1}
            step={1}
            value={priceEur}
            onChange={(e) => setPriceEur(e.target.value)}
            placeholder="350"
            className="h-10 w-full rounded-lg border border-border bg-background pl-8 pr-3 text-base font-bold outline-none focus:border-[var(--color-brand-blue)]"
          />
        </div>
        {estimateMin != null && estimateMax != null && (
          <span className="text-[10px] text-muted-foreground">
            Εύρος πελάτη: {Math.round(estimateMin / 100)}€ –{" "}
            {Math.round(estimateMax / 100)}€
          </span>
        )}
      </Field>

      <Field label="Ημέρες παράδοσης (προαιρετικό)">
        <input
          type="number"
          min={1}
          max={30}
          value={estimatedDays}
          onChange={(e) => setEstimatedDays(e.target.value)}
          placeholder="1"
          className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-[var(--color-brand-blue)]"
        />
      </Field>

      <Field label="Σημειώσεις (ορατές στον πελάτη)">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="Τι περιλαμβάνει η τιμή, διαθεσιμότητα, ειδικές συνθήκες…"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[var(--color-brand-blue)]"
        />
      </Field>

      <Field label="Διαθέσιμα slots για τον πελάτη">
        {slots.length === 0 ? (
          <p className="text-[10px] text-muted-foreground">
            Δεν έχεις προτείνει slots. Πρόσθεσε από κάτω.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {slots.map((s, i) => (
              <li key={`${s.date}-${s.period}-${i}`}>
                <button
                  type="button"
                  onClick={() => setSlots(slots.filter((_, idx) => idx !== i))}
                  className="group inline-flex items-center gap-1.5 rounded-md border border-[var(--color-brand-blue)]/30 bg-[var(--color-brand-blue-light)] px-2 py-1 text-[11px] font-semibold text-[var(--color-brand-blue-deep)] hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700"
                >
                  {PeriodIcon(s.period)}
                  {formatSlotShort(s.date)} · {periodLabel(s.period)}
                  <X className="size-3 opacity-50 group-hover:opacity-100" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-2 flex gap-1.5">
          <input
            type="date"
            value={newSlotDate}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setNewSlotDate(e.target.value)}
            className="h-8 flex-1 rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-[var(--color-brand-blue)]"
          />
          <select
            value={newSlotPeriod}
            onChange={(e) => setNewSlotPeriod(e.target.value as Period)}
            className="h-8 rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-[var(--color-brand-blue)]"
          >
            <option value="MORNING">Πρωί</option>
            <option value="AFTERNOON">Μεσημέρι</option>
            <option value="EVENING">Απόγευμα</option>
          </select>
          <button
            type="button"
            disabled={!newSlotDate}
            onClick={() => {
              if (!newSlotDate) return;
              if (
                slots.some(
                  (s) => s.date === newSlotDate && s.period === newSlotPeriod,
                )
              )
                return;
              setSlots([
                ...slots,
                { date: newSlotDate, period: newSlotPeriod },
              ]);
              setNewSlotDate("");
            }}
            className="inline-flex h-8 items-center gap-1 rounded-md bg-foreground px-2.5 text-[11px] font-bold text-background disabled:opacity-50"
          >
            <Plus className="size-3.5" />
            Add
          </button>
        </div>
      </Field>

      <Field label="Ισχύς προσφοράς">
        <div className="flex gap-1.5">
          {[3, 7, 14].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setValidDays(String(n))}
              className={cn(
                "flex-1 rounded-md border px-2 py-1.5 text-xs font-semibold transition-colors",
                validDays === String(n)
                  ? "border-[var(--color-brand-blue)] bg-[var(--color-brand-blue-light)] text-[var(--color-brand-blue-deep)]"
                  : "border-border bg-background text-muted-foreground hover:text-foreground",
              )}
            >
              {n} ημ
            </button>
          ))}
        </div>
      </Field>

      {feedback && (
        <p
          className={cn(
            "rounded-lg px-3 py-2 text-xs",
            feedback.ok
              ? "bg-emerald-50 text-emerald-800"
              : "bg-rose-50 text-rose-800",
          )}
        >
          {feedback.msg}
        </p>
      )}

      <button
        type="button"
        disabled={pending || !priceEur || Number(priceEur) <= 0}
        onClick={submit}
        className="mt-1 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[var(--color-brand-blue)] to-[#3B82F6] px-5 text-sm font-bold text-white shadow-[0_6px_20px_rgba(37,99,235,0.25)] hover:from-[var(--color-brand-blue-deep)] hover:to-[var(--color-brand-blue)] disabled:opacity-50"
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Check className="size-4" />
        )}
        {existing ? "Ενημέρωση προσφοράς" : "Υποβολή προσφοράς"}
      </button>

      {existing && existing.status === "OPEN" && (
        <button
          type="button"
          disabled={pending}
          onClick={remove}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
        >
          <Trash2 className="size-3.5" />
          Απόσυρση προσφοράς
        </button>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("el-GR", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  }).format(d);
}

function formatSlotShort(date: string): string {
  const d = new Date(date);
  return new Intl.DateTimeFormat("el-GR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(d);
}

function periodLabel(p: Period): string {
  switch (p) {
    case "MORNING":
      return "Πρωί";
    case "AFTERNOON":
      return "Μεσ.";
    case "EVENING":
      return "Απόγ.";
  }
}

function PeriodIcon(p: Period) {
  switch (p) {
    case "MORNING":
      return <Sunrise className="size-3" />;
    case "AFTERNOON":
      return <Sun className="size-3" />;
    case "EVENING":
      return <Sunset className="size-3" />;
  }
}
