"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { AlertCircle, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { signUpAction } from "@/server/actions/auth.action";
import { MicrosoftButton } from "./microsoft-button";

export function SignUpForm({
  microsoftEnabled,
}: {
  microsoftEnabled: boolean;
}) {
  const t = useTranslations("auth.signUp");
  const tc = useTranslations("common");
  const router = useRouter();
  const params = useSearchParams();
  const explicitNext = params.get("next");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await signUpAction(fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.replace(explicitNext ?? res.redirectTo ?? "/dashboard");
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-8">
      <div className="mb-6 text-center">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
          {t("title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-foreground">
            {t("name")}
          </span>
          <Input
            type="text"
            name="name"
            autoComplete="name"
            required
            placeholder="π.χ. Γιώργος Παπαδόπουλος"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-foreground">
              {t("email")}
            </span>
            <Input
              type="email"
              name="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-foreground">
              {t("phone")}
            </span>
            <Input
              type="tel"
              name="phone"
              autoComplete="tel"
              placeholder="6912345678"
            />
          </label>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-foreground">
            {t("password")}
          </span>
          <Input
            type="password"
            name="password"
            autoComplete="new-password"
            required
            placeholder="••••••••"
          />
          <span className="text-[11px] text-muted-foreground">
            {t("passwordHint")}
          </span>
        </label>

        <label className="flex cursor-pointer items-start gap-2 rounded-lg bg-secondary/40 p-3 text-xs text-foreground">
          <input
            type="checkbox"
            name="consent"
            required
            className="mt-0.5 size-4 cursor-pointer rounded border-border accent-[var(--color-brand-blue)]"
          />
          <span>{t("consent")}</span>
        </label>
        <label className="flex cursor-pointer items-start gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            name="marketing"
            className="mt-0.5 size-4 cursor-pointer rounded border-border accent-[var(--color-brand-blue)]"
          />
          <span>{t("marketing")}</span>
        </label>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={pending}
          className={cn(
            "inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[var(--color-brand-blue)] text-sm font-bold text-white shadow-[var(--shadow-cta)] transition-colors",
            "hover:bg-[var(--color-brand-blue-deep)]",
            "disabled:cursor-not-allowed disabled:opacity-70",
          )}
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : t("submit")}
        </button>
      </form>

      {microsoftEnabled && (
        <>
          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            {tc("or")}
            <span className="h-px flex-1 bg-border" />
          </div>
          <MicrosoftButton
            callbackUrl={explicitNext ?? "/dashboard"}
            label={t("withMicrosoft")}
          />
        </>
      )}

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {t("hasAccount")}{" "}
        <Link
          href={`/sign-in${explicitNext ? `?next=${encodeURIComponent(explicitNext)}` : ""}`}
          className="font-semibold text-[var(--color-brand-blue)] hover:text-[var(--color-brand-blue-deep)]"
        >
          {t("signInLink")}
        </Link>
      </p>
    </div>
  );
}
