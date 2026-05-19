import {
  CheckCircle2,
  Clock,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { QuoteWidget } from "./quote-widget";

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border bg-background">
      <div className="absolute inset-0 -z-10 smartmove-hero-grid" aria-hidden />
      <div
        className="absolute inset-x-0 top-0 -z-10 h-[520px] opacity-70"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, rgba(37,99,235,0.12), transparent 70%)",
        }}
        aria-hidden
      />

      <div className="mx-auto max-w-[1280px] px-4 pt-12 pb-16 sm:px-6 lg:px-8 lg:pt-16 lg:pb-20">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <Badge variant="default" className="mb-5 gap-2">
            <Sparkles className="size-3.5" />
            ΝΕΟ · AI εκτίμηση όγκου σε 10 δευτερόλεπτα
          </Badge>

          <h1 className="font-display text-[2rem] font-extrabold leading-[1.1] tracking-tight text-foreground sm:text-5xl lg:text-[3.5rem]">
            Σύγκρινε προσφορές από{" "}
            <span className="text-[var(--color-brand-blue)]">
              1.200+ επαληθευμένους μεταφορείς
            </span>
            .{" "}
            <span className="relative inline-block">
              Δωρεάν
              <span
                className="absolute -bottom-1 left-0 right-0 h-2 -z-10 rounded-full bg-[var(--color-brand-red-light)]"
                aria-hidden
              />
            </span>
            .
          </h1>

          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Δημοσίευσε τη μεταφορά σου σε 2 λεπτά. Λάβε προσφορές μέσα σε 1 ώρα.
            Επίλεξε αυτόν που σου ταιριάζει, με διαφάνεια και ασφάλεια.
          </p>
        </div>

        <div className="mx-auto mt-10 max-w-4xl">
          <QuoteWidget />
        </div>

        <ul className="mx-auto mt-6 flex max-w-3xl flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <li className="flex items-center gap-1.5">
            <CheckCircle2 className="size-4 text-emerald-600" />
            Δωρεάν — χωρίς χρέωση μέχρι να επιλέξεις
          </li>
          <li className="flex items-center gap-1.5">
            <Clock className="size-4 text-[var(--color-brand-blue)]" />
            Πρώτες προσφορές σε ~60 λεπτά
          </li>
          <li className="flex items-center gap-1.5">
            <ShieldCheck className="size-4 text-[var(--color-brand-blue)]" />
            Ασφαλείς πληρωμές μέσω escrow
          </li>
        </ul>
      </div>
    </section>
  );
}
