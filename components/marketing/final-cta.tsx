import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export function FinalCta() {
  return (
    <section className="bg-background py-20 sm:py-24">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-10 text-center shadow-[var(--shadow-pop)] sm:p-14">
          <div
            className="absolute inset-0 -z-10 opacity-50"
            style={{
              backgroundImage:
                "radial-gradient(ellipse at 50% 0%, rgba(37,99,235,0.10), transparent 60%)",
            }}
            aria-hidden
          />
          <h2 className="mx-auto max-w-2xl font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Ξεκίνα τη μεταφορά σου σήμερα
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-base text-muted-foreground">
            Σε λιγότερο από 5 λεπτά, έχεις δημοσιεύσει το αίτημά σου και βλέπεις
            τις πρώτες προσφορές να φτάνουν.
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/scan"
              className={cn(
                buttonVariants({ variant: "default" }),
                "h-12 px-6 text-base shadow-[var(--shadow-cta)]",
              )}
            >
              Δημιουργία αιτήματος μεταφοράς
              <ArrowRight className="ml-1 size-4" />
            </Link>
            <Link
              href="/#how-it-works"
              className={cn(
                buttonVariants({ variant: "ghost" }),
                "h-12 px-6 text-base",
              )}
            >
              Πώς λειτουργεί
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
