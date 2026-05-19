import Link from "next/link";
import { ArrowDown, ArrowRight, Leaf, Sparkles, TrendingDown } from "lucide-react";

import { Badge } from "@/components/ui/badge";

const EXAMPLES = [
  {
    route: "Αθήνα → Θεσσαλονίκη",
    sub: "Μετακόμιση 3άρι · ~22 m³",
    market: 1450,
    smartmove: 980,
    sharedLoad: 720,
    savePct: 50,
    co2: "1.8 τόνους",
    icon: Leaf,
  },
  {
    route: "Αθήνα → Πάτρα",
    sub: "Μεταφορά επίπλων · ~8 m³",
    market: 480,
    smartmove: 340,
    sharedLoad: 260,
    savePct: 45,
    co2: "640 kg",
    icon: Leaf,
  },
  {
    route: "Εντός Αττικής",
    sub: "Express δέμα · 3 αντικείμενα",
    market: 70,
    smartmove: 48,
    sharedLoad: 35,
    savePct: 50,
    co2: "—",
    icon: Sparkles,
  },
] as const;

export function SavingsExamples() {
  return (
    <section className="border-b border-border bg-card py-20 sm:py-24">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <Badge variant="default" className="gap-1.5">
            <TrendingDown className="size-3.5" />
            Πραγματικές εξοικονομήσεις
          </Badge>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Εξοικονόμησε{" "}
            <span className="text-[var(--color-brand-blue)]">έως 50%</span> σε
            κάθε μεταφορά
          </h2>
          <p className="mt-3 text-base text-muted-foreground">
            Με τον αλγόριθμό μας Shared&nbsp;Load μοιραζόμαστε τη διαδρομή με
            άλλες μεταφορές — μειώνοντας κόστος και περιβαλλοντικό αποτύπωμα.
          </p>
        </div>

        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          {EXAMPLES.map((ex, i) => (
            <article
              key={ex.route}
              className="relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-border bg-background p-6 shadow-[var(--shadow-card)]"
            >
              {i === 0 && (
                <span className="absolute right-4 top-4 rounded-full bg-[var(--color-brand-red)] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                  Best deal
                </span>
              )}
              <div>
                <h3 className="font-display text-lg font-bold text-foreground">
                  {ex.route}
                </h3>
                <p className="text-sm text-muted-foreground">{ex.sub}</p>
              </div>

              <div className="space-y-2.5">
                <PriceRow
                  label="Μέση τιμή αγοράς"
                  value={ex.market}
                  muted
                />
                <PriceRow
                  label="Μέσω SmartMove"
                  value={ex.smartmove}
                  highlight="blue"
                />
                <div className="relative">
                  <ArrowDown className="absolute -top-1.5 left-2 size-3 text-emerald-600" />
                  <PriceRow
                    label="Με Shared Load"
                    value={ex.sharedLoad}
                    highlight="green"
                    save={`-${ex.savePct}%`}
                  />
                </div>
              </div>

              <div className="mt-auto flex items-center justify-between border-t border-border pt-4">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <ex.icon className="size-3.5 text-emerald-600" />
                  Λιγότερα {ex.co2} CO₂
                </span>
                <Link
                  href="/scan"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-brand-blue)] hover:text-[var(--color-brand-blue-deep)]"
                >
                  Πάρε τιμή
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function PriceRow({
  label,
  value,
  muted,
  highlight,
  save,
}: {
  label: string;
  value: number;
  muted?: boolean;
  highlight?: "blue" | "green";
  save?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2.5">
      <span
        className={
          muted
            ? "text-sm text-muted-foreground line-through decoration-muted-foreground/40"
            : "text-sm font-medium text-foreground"
        }
      >
        {label}
      </span>
      <span className="flex items-center gap-2">
        {save && (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
            {save}
          </span>
        )}
        <span
          className={
            highlight === "green"
              ? "font-display text-lg font-bold text-emerald-700"
              : highlight === "blue"
                ? "font-display text-lg font-bold text-[var(--color-brand-blue-deep)]"
                : muted
                  ? "font-display text-base font-semibold text-muted-foreground line-through"
                  : "font-display text-base font-semibold text-foreground"
          }
        >
          {value}€
        </span>
      </span>
    </div>
  );
}
