"use client";

import { useTransition } from "react";
import { Loader2 } from "lucide-react";

import { signInWithMicrosoft } from "@/server/actions/auth-providers.action";
import { cn } from "@/lib/utils";

export function MicrosoftButton({
  callbackUrl,
  label = "Σύνδεση με Microsoft",
}: {
  callbackUrl?: string;
  label?: string;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      onClick={() => start(async () => signInWithMicrosoft(callbackUrl))}
      disabled={pending}
      className={cn(
        "inline-flex h-11 w-full items-center justify-center gap-2.5 rounded-lg border border-border bg-card px-4 text-sm font-semibold text-foreground shadow-sm transition-colors",
        "hover:border-[var(--color-brand-blue)]/40 hover:bg-secondary",
        "disabled:cursor-not-allowed disabled:opacity-60",
      )}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <MicrosoftLogo className="size-4" />
      )}
      {label}
    </button>
  );
}

function MicrosoftLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 21 21" aria-hidden>
      <rect x="0" y="0" width="10" height="10" fill="#F25022" />
      <rect x="11" y="0" width="10" height="10" fill="#7FBA00" />
      <rect x="0" y="11" width="10" height="10" fill="#00A4EF" />
      <rect x="11" y="11" width="10" height="10" fill="#FFB900" />
    </svg>
  );
}
