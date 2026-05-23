"use client";

import { useState, useTransition } from "react";
import { Check, KeyRound, Loader2, RefreshCw, X } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  setTenantOwnerPasswordByAdmin,
  setUserPasswordByAdmin,
  type SetPasswordResult,
} from "@/server/actions/carrier-otp.action";

interface Props {
  /** Provide either tenantId (acts on tenant OWNER/ADMIN) OR userId. */
  tenantId?: string;
  userId?: string;
  label?: string;
  size?: "sm" | "md";
  variant?: "ghost" | "solid";
}

function suggestPassword(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789abcdefghjkmnpqrstuvwxyz";
  let out = "";
  for (let i = 0; i < 10; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export function SetPasswordButton({
  tenantId,
  userId,
  label = "Ορισμός κωδικού",
  size = "sm",
  variant = "ghost",
}: Props) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [pwd, setPwd] = useState("");
  const [notify, setNotify] = useState(true);
  const [feedback, setFeedback] = useState<SetPasswordResult | null>(null);

  const onOpen = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setPwd(suggestPassword());
    setFeedback(null);
    setOpen(true);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pwd.length < 8) {
      setFeedback({
        ok: false,
        error: "Ο κωδικός πρέπει να είναι τουλάχιστον 8 χαρακτήρες.",
      });
      return;
    }
    start(async () => {
      const res = tenantId
        ? await setTenantOwnerPasswordByAdmin(tenantId, pwd, notify)
        : userId
          ? await setUserPasswordByAdmin({
              userId,
              newPassword: pwd,
              notifyByEmail: notify,
            })
          : ({ ok: false, error: "Missing target" } as SetPasswordResult);
      setFeedback(res);
      if (res.ok) {
        setTimeout(() => setOpen(false), 2500);
      }
    });
  };

  const base = size === "sm" ? "h-7 px-2 text-[11px]" : "h-9 px-3 text-xs";
  const styles =
    variant === "solid"
      ? "bg-foreground text-background hover:bg-foreground/90"
      : "border border-border bg-card text-foreground hover:bg-secondary";

  return (
    <>
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md font-semibold transition-colors",
          base,
          styles,
        )}
        title="Όρισε νέο κωδικό για τον μεταφορέα"
      >
        <KeyRound className="size-3.5" />
        {label}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <form
            onSubmit={onSubmit}
            className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-xl"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-base font-bold text-foreground">
                  Νέος κωδικός μεταφορέα
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Όρισε έναν συγκεκριμένο κωδικό για τον λογαριασμό. Ο παλιός
                  παύει να ισχύει αμέσως.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-secondary"
              >
                <X className="size-4" />
              </button>
            </div>

            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Κωδικός (≥ 8 χαρακτήρες)
            </label>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="text"
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
                autoFocus
                className="h-10 flex-1 rounded-lg border border-border bg-background px-3 font-mono text-sm tracking-wider text-foreground focus:border-[var(--color-brand-blue)] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setPwd(suggestPassword())}
                title="Πρόταση τυχαίου κωδικού"
                className="grid size-10 place-items-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-secondary"
              >
                <RefreshCw className="size-4" />
              </button>
            </div>

            <label className="mt-4 flex items-center gap-2 text-xs text-foreground">
              <input
                type="checkbox"
                checked={notify}
                onChange={(e) => setNotify(e.target.checked)}
                className="size-4 accent-[var(--color-brand-blue)]"
              />
              Ενημέρωση χρήστη με email
            </label>

            {feedback && (
              <div
                className={cn(
                  "mt-4 flex items-start gap-2 rounded-lg border p-2.5 text-xs",
                  feedback.ok
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-rose-200 bg-rose-50 text-rose-800",
                )}
              >
                {feedback.ok ? (
                  <Check className="mt-0.5 size-3.5 shrink-0" />
                ) : (
                  <X className="mt-0.5 size-3.5 shrink-0" />
                )}
                <div>
                  {feedback.ok ? (
                    <>
                      <p className="font-semibold">Ο κωδικός ενημερώθηκε.</p>
                      {feedback.sentTo && (
                        <p className="mt-0.5 opacity-80">
                          Email στάλθηκε στο {feedback.sentTo}
                        </p>
                      )}
                    </>
                  ) : (
                    <p>{feedback.error}</p>
                  )}
                </div>
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-9 items-center rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground hover:bg-secondary"
              >
                Άκυρο
              </button>
              <button
                type="submit"
                disabled={pending}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-foreground px-4 text-sm font-bold text-background hover:bg-foreground/90 disabled:opacity-50"
              >
                {pending && <Loader2 className="size-4 animate-spin" />}
                Αποθήκευση
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
