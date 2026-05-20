import { Suspense } from "react";
import type { Metadata } from "next";

import { auth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { WizardShell } from "@/components/scan/wizard-shell";

export const metadata: Metadata = {
  title: "Δημιουργία αιτήματος μεταφοράς",
  description:
    "Δημιούργησε αίτημα μεταφοράς σε 3 βήματα. Επίλεξε AI σκανάρισμα ή λίστα αντικειμένων.",
};

export default async function ScanPage() {
  const session = await auth();
  const isAuthed = !!session?.user?.id;

  return (
    <>
      <section className="border-b border-border bg-card">
        <div className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
          <div className="max-w-2xl">
            <Badge variant="default" className="mb-3">
              Νέο αίτημα μεταφοράς
            </Badge>
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
              Δημιούργησε το αίτημά σου σε{" "}
              <span className="text-[var(--color-brand-blue)]">3 βήματα</span>
            </h1>
            <p className="mt-2 text-base text-muted-foreground">
              Επιλέγεις πώς θα ετοιμάσεις τη λίστα αντικειμένων, συμπληρώνεις
              στοιχεία χώρου και την υποβάλλεις. Δωρεάν και χωρίς υποχρέωση.
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <Suspense
          fallback={
            <div className="flex h-[40vh] items-center justify-center">
              <div className="size-10 animate-spin rounded-full border-2 border-border border-t-[var(--color-brand-blue)]" />
            </div>
          }
        >
          <WizardShell isAuthed={isAuthed} />
        </Suspense>
      </div>
    </>
  );
}
