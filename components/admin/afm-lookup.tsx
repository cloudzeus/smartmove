"use client";

import { useState, useTransition } from "react";
import { AlertCircle, CheckCircle2, Loader2, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { lookupAfmAction } from "@/server/actions/aade.action";
import type { AadeBasicRecord } from "@/lib/aade";

interface Props {
  defaultAfm?: string;
  onResult: (data: AadeBasicRecord) => void;
  /** Tighter layout for use inside a branch dialog. */
  compact?: boolean;
}

export function AfmLookup({ defaultAfm = "", onResult, compact }: Props) {
  const [afm, setAfm] = useState(defaultAfm);
  const [error, setError] = useState<string | null>(null);
  const [successText, setSuccessText] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    setError(null);
    setSuccessText(null);
    start(async () => {
      const res = await lookupAfmAction(afm);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (!res.data.isActive) {
        setError("Ο ΑΦΜ βρέθηκε αλλά είναι ΑΝΕΝΕΡΓΟΣ στην ΑΑΔΕ.");
        return;
      }
      onResult(res.data);
      setSuccessText(
        `Βρέθηκε: ${res.data.commercialName ?? res.data.legalName ?? ""}`,
      );
    });
  }

  return (
    <div className={cn("flex flex-col gap-2", compact && "gap-1.5")}>
      <span className="text-xs font-semibold text-foreground">
        ΑΦΜ (αναζήτηση από ΑΑΔΕ)
      </span>
      <div className="flex gap-2">
        <Input
          inputMode="numeric"
          maxLength={9}
          value={afm}
          onChange={(e) => {
            setAfm(e.target.value.replace(/\D/g, ""));
            setError(null);
            setSuccessText(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="9 ψηφία"
          className="font-mono tracking-wider"
        />
        <button
          type="button"
          onClick={submit}
          disabled={pending || afm.length !== 9}
          className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-lg bg-[var(--color-brand-blue)] px-4 text-sm font-bold text-white shadow-[var(--shadow-cta)] transition-colors hover:bg-[var(--color-brand-blue-deep)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Search className="size-4" />
          )}
          Αναζήτηση
        </button>
      </div>
      {error && (
        <p className="flex items-start gap-1.5 text-xs text-destructive">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
          {error}
        </p>
      )}
      {successText && (
        <p className="flex items-start gap-1.5 text-xs text-emerald-700">
          <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
          {successText}
        </p>
      )}
    </div>
  );
}
