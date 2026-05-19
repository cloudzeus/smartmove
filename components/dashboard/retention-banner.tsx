"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Loader2, Shield } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  extendRetention,
  recordRetentionConsent,
} from "@/server/actions/retention.action";

interface Props {
  daysLeft: number;
  expiresAt: Date | null;
  monthlyPriceEur: number;
  yearlyPriceEur: number;
}

export function RetentionBanner({
  daysLeft,
  expiresAt,
  monthlyPriceEur,
  yearlyPriceEur,
}: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const urgent = daysLeft <= 14;
  const expired = daysLeft <= 0;

  function pick(months: number) {
    setError(null);
    setSuccess(null);
    start(async () => {
      const res = await extendRetention({ months });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const d = res.extendsUntil;
      setSuccess(
        `Παράταση καταχωρήθηκε. Νέα λήξη: ${formatDate(d)}.`,
      );
      router.refresh();
    });
  }

  function consent() {
    setError(null);
    setSuccess(null);
    start(async () => {
      const res = await recordRetentionConsent();
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSuccess("Συναίνεση καταχωρήθηκε.");
      router.refresh();
    });
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-2xl border p-5 shadow-[var(--shadow-card)] sm:flex-row sm:items-center sm:justify-between",
        expired
          ? "border-destructive/40 bg-destructive/5"
          : urgent
            ? "border-amber-300/60 bg-amber-50"
            : "border-[var(--color-brand-blue)]/30 bg-[var(--color-brand-blue-light)]/40",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-xl",
            expired
              ? "bg-destructive text-white"
              : urgent
                ? "bg-amber-500 text-white"
                : "bg-[var(--color-brand-blue)] text-white",
          )}
        >
          {expired ? (
            <AlertTriangle className="size-5" />
          ) : (
            <Shield className="size-5" />
          )}
        </span>
        <div>
          <p className="font-display text-sm font-bold text-foreground">
            {expired
              ? "Η περίοδος διατήρησης δεδομένων έχει λήξει"
              : urgent
                ? `Η διατήρηση δεδομένων λήγει σε ${daysLeft} ${daysLeft === 1 ? "ημέρα" : "ημέρες"}`
                : `Διατήρηση δεδομένων ενεργή για ${daysLeft} ημέρες ακόμα`}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {expiresAt && (
              <>
                Τρέχουσα λήξη: <strong>{formatDate(expiresAt)}</strong>
                {" · "}
              </>
            )}
            Με την παράταση τα αιτήματά σου, τα έπιπλά σου και οι διευθύνσεις
            παραμένουν διαθέσιμα.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button
          variant="outline"
          onClick={() => pick(6)}
          disabled={pending}
          className="h-10"
        >
          +6 μήνες ·{" "}
          {(monthlyPriceEur * 6).toFixed(2)}€
        </Button>
        <Button
          onClick={() => pick(12)}
          disabled={pending}
          className="h-10 shadow-[var(--shadow-cta)]"
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <>+1 έτος · {yearlyPriceEur.toFixed(2)}€</>
          )}
        </Button>
        {!expired && (
          <Button
            variant="ghost"
            onClick={consent}
            disabled={pending}
            className="h-10 text-xs"
            title="Καταχώρισε συναίνεση χωρίς πληρωμή (δεν παρατείνει αυτόματα)"
          >
            Συναίνεση μόνο
          </Button>
        )}
      </div>

      {(error || success) && (
        <div className="sm:basis-full">
          {error && (
            <p className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertTriangle className="size-3.5" />
              {error}
            </p>
          )}
          {success && (
            <p className="flex items-center gap-1.5 text-xs text-emerald-700">
              <CheckCircle2 className="size-3.5" />
              {success}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function formatDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("el-GR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}
