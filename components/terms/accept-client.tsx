"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, ScrollText } from "lucide-react";

import { cn } from "@/lib/utils";
import { acceptTerms } from "@/server/actions/terms.action";

interface Props {
  version: string;
  summary: string | null;
  bodyEl: string;
  bodyEn: string;
  publishedAt: string;
}

export function AcceptTermsClient({
  version,
  summary,
  bodyEl,
  bodyEn,
  publishedAt,
}: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [lang, setLang] = useState<"el" | "en">("el");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    start(async () => {
      const r = await acceptTerms({ version });
      if (r.ok) {
        router.replace("/dashboard");
        router.refresh();
      } else {
        setError(r.error);
      }
    });
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-8">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-[var(--color-brand-blue-light)] px-2.5 py-0.5 text-[10px] font-bold uppercase text-[var(--color-brand-blue-deep)]">
            <ScrollText className="size-3" />
            Έκδοση {version}
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            Όροι Χρήσης SmartMove
          </h1>
          {summary && (
            <p className="mt-2 text-sm text-muted-foreground">{summary}</p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            Δημοσιεύτηκε: {new Date(publishedAt).toLocaleDateString("el-GR")}
          </p>
        </div>
        <div className="flex rounded-lg border border-border bg-background p-0.5">
          <LangBtn active={lang === "el"} onClick={() => setLang("el")}>
            ΕΛ
          </LangBtn>
          <LangBtn active={lang === "en"} onClick={() => setLang("en")}>
            EN
          </LangBtn>
        </div>
      </div>

      <div className="prose prose-sm max-h-[55vh] max-w-none overflow-y-auto rounded-xl border border-border bg-secondary/30 p-4 text-sm leading-relaxed text-foreground">
        <div className="whitespace-pre-wrap">
          {lang === "el" ? bodyEl : bodyEn}
        </div>
      </div>

      <label className="mt-5 flex items-start gap-2.5 rounded-xl border border-border bg-background p-3 text-sm">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 size-4 accent-[var(--color-brand-blue)]"
        />
        <span>
          {lang === "el"
            ? `Διάβασα και αποδέχομαι τους όρους χρήσης (έκδοση ${version}).`
            : `I have read and accept the Terms of Use (version ${version}).`}
        </span>
      </label>

      {error && (
        <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800">
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={!agreed || pending}
        onClick={submit}
        className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[var(--color-brand-blue)] to-[#3B82F6] px-5 text-sm font-bold text-white shadow-[0_6px_20px_rgba(37,99,235,0.25)] hover:from-[var(--color-brand-blue-deep)] hover:to-[var(--color-brand-blue)] disabled:opacity-50"
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Check className="size-4" />
        )}
        {lang === "el" ? "Αποδοχή & συνέχεια" : "Accept & continue"}
      </button>
    </div>
  );
}

function LangBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-8 rounded-md px-3 text-xs font-bold transition-colors",
        active
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
