"use client";

import { useState, useTransition } from "react";
import { AlertCircle, CheckCircle2, KeyRound, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { changePassword } from "@/server/actions/user.action";

export function PasswordChangeForm() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    const fd = new FormData(e.currentTarget);
    const payload = {
      currentPassword: String(fd.get("currentPassword") ?? ""),
      newPassword: String(fd.get("newPassword") ?? ""),
      confirmPassword: String(fd.get("confirmPassword") ?? ""),
    };
    const form = e.currentTarget;
    start(async () => {
      const res = await changePassword(payload);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSuccess(true);
      form.reset();
    });
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <header className="mb-4 flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-[var(--color-brand-blue-light)] text-[var(--color-brand-blue-deep)]">
          <KeyRound className="size-5" />
        </span>
        <div>
          <h2 className="font-display text-lg font-bold text-foreground">
            Αλλαγή κωδικού
          </h2>
          <p className="text-xs text-muted-foreground">
            Τουλάχιστον 8 χαρακτήρες, ένα κεφαλαίο και έναν αριθμό.
          </p>
        </div>
      </header>

      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-foreground">
            Τρέχων κωδικός
          </span>
          <Input
            type="password"
            name="currentPassword"
            autoComplete="current-password"
            required
            placeholder="••••••••"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-foreground">
              Νέος κωδικός
            </span>
            <Input
              type="password"
              name="newPassword"
              autoComplete="new-password"
              required
              minLength={8}
              placeholder="••••••••"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-foreground">
              Επιβεβαίωση
            </span>
            <Input
              type="password"
              name="confirmPassword"
              autoComplete="new-password"
              required
              minLength={8}
              placeholder="••••••••"
            />
          </label>
        </div>

        <div className="flex items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2 text-sm">
            {error && (
              <span className="flex items-center gap-1.5 text-destructive">
                <AlertCircle className="size-4" />
                {error}
              </span>
            )}
            {success && (
              <span className="flex items-center gap-1.5 text-emerald-700">
                <CheckCircle2 className="size-4" />
                Ο κωδικός άλλαξε
              </span>
            )}
          </div>
          <Button
            type="submit"
            disabled={pending}
            className="h-10 px-5 shadow-[var(--shadow-cta)]"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              "Ενημέρωση κωδικού"
            )}
          </Button>
        </div>
      </form>
    </section>
  );
}
