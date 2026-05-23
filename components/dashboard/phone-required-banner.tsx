"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Phone, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { setUserPhone } from "@/server/actions/user.action";

export function PhoneRequiredBanner({
  initialPhone,
}: {
  initialPhone?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<"visible" | "fading" | "hidden">(
    "visible",
  );

  // Auto-hide when the action succeeded
  useEffect(() => {
    if (state === "fading") {
      const t = setTimeout(() => setState("hidden"), 500);
      return () => clearTimeout(t);
    }
  }, [state]);

  if (state === "hidden") return null;

  return (
    <>
      <div
        className={cn(
          "flex items-start gap-3 rounded-2xl border border-amber-300/60 bg-amber-50 p-4 shadow-[var(--shadow-card)] transition-all duration-500 sm:p-5",
          state === "fading" && "scale-95 opacity-0",
        )}
      >
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
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-amber-600 px-4 text-sm font-bold text-white shadow-sm transition-colors hover:bg-amber-700"
          >
            Συμπλήρωση τώρα
          </button>
        </div>
      </div>

      {open && (
        <PhoneDialog
          initialPhone={initialPhone ?? ""}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            setState("fading");
          }}
        />
      )}
    </>
  );
}

function PhoneDialog({
  initialPhone,
  onClose,
  onSaved,
}: {
  initialPhone: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const router = useRouter();
  const [phone, setPhone] = useState(initialPhone);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await setUserPhone(phone);
      if (res.ok) {
        router.refresh();
        onSaved();
      } else setError(res.error);
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-amber-600">
              Επικοινωνία
            </p>
            <h3 className="font-display text-lg font-extrabold text-foreground">
              Τηλέφωνο επικοινωνίας
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Θα το βλέπουν μόνο οι μεταφορείς που σου στέλνουν προσφορά.
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

        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Αριθμός τηλεφώνου
          </span>
          <div className="mt-1 flex items-center rounded-xl border-2 border-border bg-white focus-within:border-[var(--color-brand-blue)] focus-within:ring-2 focus-within:ring-[var(--color-brand-blue)]/20">
            <span className="grid h-12 w-12 place-items-center border-r border-border bg-secondary/60">
              <Phone className="size-4 text-foreground" />
            </span>
            <input
              type="tel"
              autoFocus
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="69xxxxxxxx"
              inputMode="tel"
              className="h-12 w-full rounded-r-xl bg-transparent px-3 text-base font-bold tabular-nums text-foreground outline-none placeholder:font-normal placeholder:text-muted-foreground/50"
            />
          </div>
        </label>

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
            disabled={pending || !phone}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-amber-600 px-5 text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CheckCircle2 className="size-4" />
            )}
            Αποθήκευση
          </button>
        </div>
      </form>
    </div>
  );
}
