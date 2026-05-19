"use client";

import { useState, useTransition } from "react";
import { KeyRound, Loader2, Check, X } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  sendTenantOwnerOtp,
  sendOtpToUser,
  type CarrierOtpResult,
} from "@/server/actions/carrier-otp.action";

interface Props {
  /** Provide either tenantId (sends to owner) OR userId (sends to that user). */
  tenantId?: string;
  userId?: string;
  label?: string;
  size?: "sm" | "md";
  variant?: "ghost" | "solid";
}

export function SendOtpButton({
  tenantId,
  userId,
  label = "Αποστολή OTP",
  size = "sm",
  variant = "ghost",
}: Props) {
  const [pending, start] = useTransition();
  const [feedback, setFeedback] = useState<CarrierOtpResult | null>(null);

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Αποστολή νέου προσωρινού κωδικού στον χρήστη με email;"))
      return;
    start(async () => {
      const res = tenantId
        ? await sendTenantOwnerOtp(tenantId)
        : userId
          ? await sendOtpToUser(userId)
          : ({ ok: false, error: "Missing target" } as CarrierOtpResult);
      setFeedback(res);
      if (res.ok) {
        setTimeout(() => setFeedback(null), 6000);
      }
    });
  };

  const base =
    size === "sm" ? "h-7 px-2 text-[11px]" : "h-9 px-3 text-xs";
  const styles =
    variant === "solid"
      ? "bg-foreground text-background hover:bg-foreground/90"
      : "border border-border bg-card text-foreground hover:bg-secondary";

  return (
    <div className="relative inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md font-semibold transition-colors disabled:opacity-50",
          base,
          styles,
        )}
        title="Αποστολή νέου προσωρινού κωδικού"
      >
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <KeyRound className="size-3.5" />
        )}
        {label}
      </button>
      {feedback && (
        <div
          className={cn(
            "absolute top-full right-0 z-10 mt-1 w-64 rounded-md border p-2 text-[11px] shadow-lg",
            feedback.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800",
          )}
        >
          <div className="flex items-start gap-1.5">
            {feedback.ok ? (
              <Check className="mt-0.5 size-3.5 shrink-0" />
            ) : (
              <X className="mt-0.5 size-3.5 shrink-0" />
            )}
            <div>
              {feedback.ok ? (
                <>
                  <p className="font-semibold">Στάλθηκε στο {feedback.sentTo}</p>
                  <p className="mt-0.5 text-[10px] opacity-80">
                    Προσωρινός κωδικός:{" "}
                    <span className="font-mono font-bold">
                      {feedback.tempPassword}
                    </span>
                  </p>
                </>
              ) : (
                <p>{feedback.error}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
