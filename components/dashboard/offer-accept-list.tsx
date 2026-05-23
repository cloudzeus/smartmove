"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Sparkles,
  Truck,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { acceptOffer } from "@/server/actions/accept-offer.action";

interface Slot {
  date: string; // YYYY-MM-DD
  hour: number;
}

export interface CustomerOfferRow {
  id: string;
  priceCents: number;
  estimatedDays: number | null;
  notes: string | null;
  status: string;
  validUntil: string;
  carrierName: string;
  carrierBadge: string | null; // commercialName if exists
  proposedSlots: Slot[];
  acceptedSlotAt: string | null;
  contractPdfUrl: string | null;
  contractDocxUrl: string | null;
  contractRef: string | null;
}

interface Props {
  moveRequestId: string;
  moveStatus: string;
  offers: CustomerOfferRow[];
}

export function OfferAcceptList({ moveRequestId, moveStatus, offers }: Props) {
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  if (offers.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-4 text-center">
        <Clock className="mx-auto mb-2 size-6 text-muted-foreground/60" />
        <p className="text-xs text-muted-foreground">
          Οι μεταφορείς ενημερώθηκαν. Οι πρώτες προσφορές φτάνουν συνήθως σε
          30–60 λεπτά.
        </p>
      </div>
    );
  }

  const accepted = offers.find((o) => o.status === "ACCEPTED");
  const sorted = [...offers].sort((a, b) => {
    // Accepted first, then OPEN by price ascending, then others
    const rank = (o: CustomerOfferRow) =>
      o.status === "ACCEPTED" ? 0 : o.status === "OPEN" ? 1 : 2;
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    return a.priceCents - b.priceCents;
  });

  return (
    <>
      <ul className="flex flex-col gap-2.5">
        {sorted.map((o, idx) => (
          <li key={o.id}>
            <OfferCard
              offer={o}
              isBestPrice={
                !accepted &&
                o.status === "OPEN" &&
                o.priceCents ===
                  Math.min(
                    ...offers
                      .filter((x) => x.status === "OPEN")
                      .map((x) => x.priceCents),
                  )
              }
              canAccept={moveStatus === "PUBLISHED" && !accepted}
              onAccept={() => setAcceptingId(o.id)}
            />
          </li>
        ))}
      </ul>

      {acceptingId && (
        <AcceptDialog
          offer={offers.find((o) => o.id === acceptingId)!}
          moveRequestId={moveRequestId}
          onClose={() => setAcceptingId(null)}
        />
      )}
    </>
  );
}

function OfferCard({
  offer,
  isBestPrice,
  canAccept,
  onAccept,
}: {
  offer: CustomerOfferRow;
  isBestPrice: boolean;
  canAccept: boolean;
  onAccept: () => void;
}) {
  const isAccepted = offer.status === "ACCEPTED";
  return (
    <div
      className={cn(
        "rounded-2xl border bg-card p-3.5 transition-all",
        isAccepted
          ? "border-emerald-300 bg-emerald-50/40 shadow-[var(--shadow-pop)]"
          : "border-border hover:border-[var(--color-brand-blue)]/30",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--color-brand-blue)] text-xs font-bold text-white">
              {initials(offer.carrierBadge ?? offer.carrierName)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-foreground">
                {offer.carrierBadge ?? offer.carrierName}
              </p>
              {offer.carrierBadge && (
                <p className="truncate text-[10px] text-muted-foreground">
                  {offer.carrierName}
                </p>
              )}
            </div>
            {isBestPrice && (
              <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                <Sparkles className="size-2.5" />
                Καλύτερη τιμή
              </span>
            )}
            {isAccepted && (
              <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">
                <CheckCircle2 className="size-2.5" />
                Αποδεκτή
              </span>
            )}
          </div>
          {offer.notes && (
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              {offer.notes}
            </p>
          )}
          {offer.proposedSlots.length > 0 && !isAccepted && (
            <p className="mt-1.5 text-[10px] text-muted-foreground">
              <Clock className="mr-1 inline size-2.5" />
              {offer.proposedSlots.length}{" "}
              {offer.proposedSlots.length === 1
                ? "προτεινόμενο slot"
                : "προτεινόμενα slots"}
            </p>
          )}
          {isAccepted && offer.acceptedSlotAt && (
            <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800">
              <Calendar className="size-3" />
              {formatDt(new Date(offer.acceptedSlotAt))}
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="font-display text-xl font-bold tabular-nums text-foreground">
            {(offer.priceCents / 100).toFixed(0)}€
          </p>
          {offer.estimatedDays && (
            <p className="text-[10px] text-muted-foreground">
              {offer.estimatedDays}{" "}
              {offer.estimatedDays === 1 ? "ημέρα" : "ημέρες"}
            </p>
          )}
        </div>
      </div>

      {/* Actions row */}
      {isAccepted ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-emerald-200 pt-3">
          {offer.contractPdfUrl && (
            <a
              href={offer.contractPdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-emerald-600 px-3 text-xs font-bold text-white hover:bg-emerald-700"
            >
              <FileText className="size-3.5" />
              Σύμφωνημα PDF
            </a>
          )}
          {offer.contractDocxUrl && (
            <a
              href={offer.contractDocxUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-emerald-300 bg-white px-3 text-xs font-semibold text-emerald-800 hover:bg-emerald-50"
            >
              <Download className="size-3.5" />
              .docx
            </a>
          )}
          {offer.contractRef && (
            <span className="ml-auto font-mono text-[10px] text-muted-foreground">
              {offer.contractRef}
            </span>
          )}
        </div>
      ) : canAccept ? (
        <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
          {offer.proposedSlots.length === 0 ? (
            <p className="text-[10px] text-amber-700">
              ⚠ Χωρίς προτεινόμενα slots
            </p>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onAccept}
            disabled={offer.proposedSlots.length === 0}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--color-brand-blue)] px-4 text-xs font-bold text-white shadow-sm hover:bg-[var(--color-brand-blue-deep)] disabled:cursor-not-allowed disabled:opacity-50"
            title={
              offer.proposedSlots.length === 0
                ? "Ο μεταφορέας δεν έχει προτείνει διαθέσιμες ώρες ακόμη."
                : undefined
            }
          >
            <CheckCircle2 className="size-3.5" />
            Αποδοχή προσφοράς
          </button>
        </div>
      ) : offer.status === "REJECTED" ? (
        <p className="mt-2 text-[10px] text-muted-foreground">
          (Επιλέχθηκε άλλη προσφορά)
        </p>
      ) : null}
    </div>
  );
}

function AcceptDialog({
  offer,
  moveRequestId,
  onClose,
}: {
  offer: CustomerOfferRow;
  moveRequestId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    pdfUrl: string;
    docxUrl: string;
  } | null>(null);
  const [pick, setPick] = useState<string | null>(() => {
    if (offer.proposedSlots.length > 0) {
      const first = offer.proposedSlots[0];
      return isoFromSlot(first);
    }
    return null;
  });
  const hasSlots = offer.proposedSlots.length > 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!pick) {
      setError("Επέλεξε ημερομηνία και ώρα.");
      return;
    }
    start(async () => {
      const res = await acceptOffer({
        offerId: offer.id,
        slotAt: new Date(pick).toISOString(),
      });
      if (res.ok) {
        setSuccess({ pdfUrl: res.contractPdfUrl, docxUrl: res.contractDocxUrl });
        router.refresh();
      } else setError(res.error);
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl">
        {!success ? (
          <form onSubmit={submit}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--color-brand-blue)]">
                  Αποδοχή προσφοράς
                </p>
                <h3 className="font-display text-xl font-extrabold text-foreground">
                  {offer.carrierBadge ?? offer.carrierName}
                </h3>
                <p className="mt-0.5 font-display text-2xl font-extrabold tabular-nums text-[var(--color-brand-blue-deep)]">
                  {(offer.priceCents / 100).toFixed(0)}€
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-secondary"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Slot picker — strict: only proposed slots are pickable */}
            {offer.proposedSlots.length > 0 ? (
              <>
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  Επέλεξε ένα από τα προτεινόμενα slots
                </p>
                <p className="mb-3 text-xs text-muted-foreground">
                  Ο μεταφορέας έχει διαθεσιμότητα μόνο στις παρακάτω ώρες.
                  Διάλεξε ποια σε βολεύει.
                </p>
                <SlotPicker
                  slots={offer.proposedSlots}
                  selected={pick}
                  onSelect={setPick}
                />
              </>
            ) : (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-center">
                <Clock className="mx-auto size-7 text-amber-600" />
                <p className="mt-2 text-sm font-bold text-amber-900">
                  Ο μεταφορέας δεν έχει προτείνει διαθέσιμα slots
                </p>
                <p className="mt-1 text-xs text-amber-800">
                  Δεν μπορείς να αποδεχθείς αυτή την προσφορά χωρίς συμφωνημένη
                  ημερομηνία και ώρα. Επικοινώνησε με τον μεταφορέα να ορίσει
                  διαθεσιμότητα.
                </p>
              </div>
            )}

            <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-900">
              <strong>Σημείωση:</strong> Με την αποδοχή, οι υπόλοιπες προσφορές
              απορρίπτονται αυτόματα. Παράγουμε ψηφιακό σύμφωνημα (PDF + Word)
              και το στέλνουμε με email και στα δύο μέρη. <strong>Καμία χρέωση
              τώρα.</strong>
            </div>

            {error && (
              <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800">
                {error}
              </p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-10 items-center rounded-lg border border-border bg-card px-4 text-sm font-medium hover:bg-secondary"
              >
                Άκυρο
              </button>
              <button
                type="submit"
                disabled={pending || !pick || !hasSlots}
                className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[var(--color-brand-blue)] px-5 text-sm font-bold text-white hover:bg-[var(--color-brand-blue-deep)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-4" />
                )}
                Επιβεβαίωση αποδοχής
              </button>
            </div>
          </form>
        ) : (
          <div className="py-4 text-center">
            <CheckCircle2 className="mx-auto size-14 text-emerald-500" />
            <h3 className="mt-3 font-display text-2xl font-extrabold text-foreground">
              Η μεταφορά κλείδωσε!
            </h3>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Στείλαμε το σύμφωνημα σε εσένα και τον μεταφορέα με email.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <a
                href={success.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-5 text-sm font-bold text-white hover:bg-emerald-700"
              >
                <FileText className="size-4" />
                Άνοιγμα PDF συμφωνήματος
                <ExternalLink className="size-3.5 opacity-70" />
              </a>
              <a
                href={success.docxUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-4 text-xs font-semibold text-foreground hover:bg-secondary"
              >
                <Download className="size-3.5" />
                Κατέβασμα .docx
              </a>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="mt-4 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              Κλείσιμο
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------- Slot picker ----------------

function SlotPicker({
  slots,
  selected,
  onSelect,
}: {
  slots: Slot[];
  selected: string | null;
  onSelect: (iso: string) => void;
}) {
  // Group by date
  const byDate = new Map<string, number[]>();
  for (const s of slots) {
    if (!byDate.has(s.date)) byDate.set(s.date, []);
    byDate.get(s.date)!.push(s.hour);
  }
  const dates = Array.from(byDate.keys()).sort();
  return (
    <div className="flex flex-col gap-3">
      {dates.map((d) => {
        const hours = (byDate.get(d) ?? []).sort((a, b) => a - b);
        return (
          <div key={d}>
            <p className="mb-1.5 text-[11px] font-bold capitalize text-foreground">
              {formatDateLong(d)}
            </p>
            <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-5">
              {hours.map((h) => {
                const iso = isoFromSlot({ date: d, hour: h });
                const active = selected === iso;
                return (
                  <button
                    key={`${d}-${h}`}
                    type="button"
                    onClick={() => onSelect(iso)}
                    className={cn(
                      "h-10 rounded-lg border-2 text-xs font-bold tabular-nums transition-colors",
                      active
                        ? "border-[var(--color-brand-blue)] bg-[var(--color-brand-blue)] text-white shadow-sm"
                        : "border-border bg-white text-foreground hover:border-[var(--color-brand-blue)]/40",
                    )}
                  >
                    {String(h).padStart(2, "0")}:00
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------- Helpers ----------------

function initials(s: string): string {
  return s
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

function isoFromSlot(s: Slot): string {
  // Local timezone, returned as datetime-local string
  return `${s.date}T${String(s.hour).padStart(2, "0")}:00`;
}

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDateLong(iso: string): string {
  return new Intl.DateTimeFormat("el-GR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(new Date(iso + "T00:00:00"));
}

function formatDt(d: Date): string {
  return new Intl.DateTimeFormat("el-GR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}
