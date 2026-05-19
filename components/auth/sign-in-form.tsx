"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { AlertCircle, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { signInAction } from "@/server/actions/auth.action";
import { MicrosoftButton } from "./microsoft-button";

export function SignInForm({
  microsoftEnabled,
}: {
  microsoftEnabled: boolean;
}) {
  const t = useTranslations("auth.signIn");
  const tc = useTranslations("common");
  const router = useRouter();
  const params = useSearchParams();
  // Use a query-string `next` only if explicitly provided; otherwise let the
  // server action decide the landing route based on user role.
  const explicitNext = params.get("next");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await signInAction(fd);
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
            {t("password")}
          </span>
          <Input
            type="password"
            name="password"
            autoComplete="current-password"
            required
            placeholder="••••••••"
          />
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
        {t("noAccount")}{" "}
        <Link
          href={`/sign-up${explicitNext ? `?next=${encodeURIComponent(explicitNext)}` : ""}`}
          className="font-semibold text-[var(--color-brand-blue)] hover:text-[var(--color-brand-blue-deep)]"
        >
          {t("createOne")}
        </Link>
      </p>
    </div>
  );
}
