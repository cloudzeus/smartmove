"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

import { respondToTaskConfirmation } from "@/server/actions/task-confirmation.action";

export function TaskConfirmClient({ token }: { token: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showDecline, setShowDecline] = useState(false);
  const [reason, setReason] = useState("");
  const [done, setDone] = useState<"CONFIRMED" | "DECLINED" | null>(null);

  const submit = (decision: "CONFIRM" | "DECLINE") => {
    start(async () => {
      setError(null);
      const res = await respondToTaskConfirmation({
        token, decision,
        reason: decision === "DECLINE" ? reason : undefined,
      });
      if (res.ok) {
        setDone(res.data!.status);
      } else {
        setError(res.error);
      }
    });
  };

  if (done === "CONFIRMED") {
    return (
      <div className="mt-5 rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-4">
        <CheckCircle2 className="size-6 text-emerald-700" />
        <h2 className="mt-2 text-base font-bold text-emerald-900">
          ✓ Ευχαριστούμε! Επιβεβαιώθηκε η εργασία.
        </h2>
        <p className="mt-1 text-xs text-emerald-800">
          Ο διαχειριστής ενημερώθηκε.
        </p>
      </div>
    );
  }
  if (done === "DECLINED") {
    return (
      <div className="mt-5 rounded-2xl border-2 border-rose-300 bg-rose-50 p-4">
        <XCircle className="size-6 text-rose-700" />
        <h2 className="mt-2 text-base font-bold text-rose-900">
          Ευχαριστούμε για την απάντηση.
        </h2>
        <p className="mt-1 text-xs text-rose-800">
          Ο διαχειριστής θα αναζητήσει εναλλακτική.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-5">
      {error && (
        <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800">
          {error}
        </p>
      )}

      {showDecline ? (
        <div className="space-y-3">
          <label className="block text-xs font-semibold text-foreground">
            Λόγος (προαιρετικό)
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="π.χ. ασθένεια, συγκρουόμενη υποχρέωση"
              className="mt-1 w-full rounded-lg border border-border bg-white p-2 text-sm"
            />
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => setShowDecline(false)}
              className="flex-1 rounded-lg border border-border bg-white px-3 py-2.5 text-sm font-semibold"
            >
              Πίσω
            </button>
            <button
              onClick={() => submit("DECLINE")}
              disabled={pending}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {pending && <Loader2 className="size-4 animate-spin" />}
              Επιβεβαίωση άρνησης
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-2">
          <button
            onClick={() => submit("CONFIRM")}
            disabled={pending}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 text-base font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
          >
            {pending && <Loader2 className="size-5 animate-spin" />}
            <CheckCircle2 className="size-5" />
            Ναι, την αναλαμβάνω
          </button>
          <button
            onClick={() => setShowDecline(true)}
            disabled={pending}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border-2 border-rose-300 bg-white px-4 text-sm font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
          >
            <XCircle className="size-5" />
            Δεν μπορώ
          </button>
        </div>
      )}
    </div>
  );
}
