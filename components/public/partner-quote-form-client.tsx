"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Euro, Loader2, Send, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  declinePartnerQuote,
  submitPartnerQuote,
} from "@/server/actions/partner-quote-requests.action";

type Submitted = {
  ok: true;
  kind: "quoted" | "declined";
  priceEur?: number;
};

export function PartnerQuoteFormClient({
  token,
  isCompany = false,
}: {
  token: string;
  isCompany?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [price, setPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<Submitted | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!price || Number(price) <= 0) {
      setError("Δώσε τιμή > 0");
      return;
    }
    if (isCompany && (!contactName || !contactEmail || !contactPhone)) {
      setError("Συμπλήρωσε όνομα, email και τηλέφωνο υπευθύνου για το project.");
      return;
    }
    start(async () => {
      const res = await submitPartnerQuote({
        token,
        priceEur: price,
        notes: notes || undefined,
        contactName: isCompany ? contactName : undefined,
        contactEmail: isCompany ? contactEmail : undefined,
        contactPhone: isCompany ? contactPhone : undefined,
      });
      if (res.ok) {
        setSubmitted({ ok: true, kind: "quoted", priceEur: Number(price) });
        router.refresh();
      } else setError(res.error);
    });
  };

  const decline = () => {
    if (!confirm("Δεν θες να στείλεις προσφορά;")) return;
    start(async () => {
      const res = await declinePartnerQuote(token);
      if (res.ok) {
        setSubmitted({ ok: true, kind: "declined" });
        router.refresh();
      } else setError(res.error);
    });
  };

  // ---------- Optimistic success view ----------
  // Don't wait for the server-rendered page to re-fetch — show success right
  // away so the partner knows the quote landed. The page below will also flip
  // to the ClosedNotice on the next render.
  if (submitted) {
    if (submitted.kind === "quoted") {
      return (
        <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
          <CheckCircle2 className="mx-auto size-12 text-emerald-600" />
          <h2 className="mt-2 font-display text-xl font-extrabold text-emerald-900">
            Η προσφορά σου στάλθηκε
          </h2>
          <p className="mt-1 text-sm text-emerald-800">
            Ο μεταφορέας τη βλέπει αμέσως στο dashboard του.
          </p>
          {submitted.priceEur != null && (
            <p className="mt-3 inline-block rounded-lg bg-white px-4 py-2 font-display text-2xl font-extrabold tabular-nums text-emerald-900 ring-1 ring-emerald-300">
              {submitted.priceEur.toFixed(0)}€
            </p>
          )}
          <p className="mt-4 text-[11px] text-emerald-700/80">
            Μπορείς να κλείσεις αυτή τη σελίδα.
          </p>
        </div>
      );
    }
    return (
      <div className="mt-6 rounded-2xl border border-border bg-secondary/30 p-5 text-center">
        <XCircle className="mx-auto size-10 text-muted-foreground" />
        <p className="mt-2 font-display text-base font-bold text-foreground">
          Ευχαριστούμε για την ενημέρωση
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Καταχωρήσαμε ότι δεν μπορείς να αναλάβεις αυτή τη μεταφορά.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-6">
      <h2 className="font-display text-base font-bold text-foreground">
        Η προσφορά σου
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Στείλε την τιμή σου σε ευρώ και τυχόν σημειώσεις. Ο μεταφορέας θα τη
        δει αυτόματα στο dashboard του.
      </p>

      <label className="mt-4 block">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Τιμή (€)
        </span>
        <div
          className={cn(
            "mt-1 flex items-center rounded-xl border-2 bg-white shadow-[inset_0_1px_0_rgba(15,23,42,0.03)] transition-colors",
            price ? "border-foreground/30" : "border-border",
            "focus-within:border-[var(--color-brand-blue)] focus-within:ring-2 focus-within:ring-[var(--color-brand-blue)]/20",
          )}
        >
          <span className="grid h-12 w-12 place-items-center border-r border-border bg-secondary/60 text-base font-bold text-foreground">
            <Euro className="size-5" />
          </span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step="1"
            required
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="350"
            className="h-12 w-full rounded-r-xl bg-transparent px-3 font-display text-xl font-extrabold tabular-nums text-foreground outline-none placeholder:font-normal placeholder:text-muted-foreground/50"
          />
        </div>
      </label>

      <label className="mt-4 block">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Σημειώσεις (προαιρετικό)
        </span>
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Τι περιλαμβάνει η τιμή σου, διαθεσιμότητα, ειδικές συνθήκες..."
          className="mt-1 w-full rounded-lg border-2 border-border bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-brand-blue)] focus:ring-2 focus:ring-[var(--color-brand-blue)]/20"
        />
      </label>

      {isCompany && (
        <div className="mt-5 rounded-2xl border-2 border-indigo-200 bg-indigo-50/40 p-4">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-indigo-600 text-white">
              👤
            </span>
            <div>
              <p className="text-sm font-bold text-indigo-900">
                Υπεύθυνος επικοινωνίας για το project
              </p>
              <p className="text-[11px] text-indigo-800">
                Ποιος θα έχει την ευθύνη συντονισμού από την εταιρία σας.
              </p>
            </div>
          </div>
          <div className="mt-3 grid gap-3">
            <label className="block">
              <span className="text-[11px] font-semibold uppercase text-indigo-900">
                Όνομα *
              </span>
              <input
                required
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="π.χ. Ιωάννης Παπαδόπουλος"
                className="mt-1 h-10 w-full rounded-lg border-2 border-indigo-200 bg-white px-3 text-sm"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-[11px] font-semibold uppercase text-indigo-900">
                  Email *
                </span>
                <input
                  required
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="ipapadopoulos@example.gr"
                  className="mt-1 h-10 w-full rounded-lg border-2 border-indigo-200 bg-white px-3 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold uppercase text-indigo-900">
                  Τηλέφωνο *
                </span>
                <input
                  required
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="694xxxxxxx"
                  className="mt-1 h-10 w-full rounded-lg border-2 border-indigo-200 bg-white px-3 text-sm"
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800">
          {error}
        </p>
      )}

      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <button
          type="button"
          onClick={decline}
          disabled={pending}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
        >
          <XCircle className="size-4" />
          Δεν μπορώ να αναλάβω
        </button>
        <button
          type="submit"
          disabled={pending || !price}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-[var(--color-brand-blue)] px-6 text-sm font-bold text-white shadow-[var(--shadow-cta)] hover:bg-[var(--color-brand-blue-deep)] disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
          Αποστολή προσφοράς
        </button>
      </div>
    </form>
  );
}
