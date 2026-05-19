import { Camera, FileText, Inbox, Truck } from "lucide-react";

import { Badge } from "@/components/ui/badge";

const STEPS = [
  {
    icon: FileText,
    title: "Δημιουργείς ανάρτηση",
    desc: "Συμπλήρωσε σε λίγα βήματα: από πού, προς πού, τι μεταφέρεις, πότε.",
  },
  {
    icon: Camera,
    title: "Σκανάρεις τον χώρο",
    desc: "Με AI εκτιμούμε όγκο και αντικείμενα από φωτογραφίες — σε δευτερόλεπτα.",
  },
  {
    icon: Inbox,
    title: "Λαμβάνεις προσφορές",
    desc: "Επιβεβαιωμένοι μεταφορείς απαντούν με τιμές, χρόνους και αξιολογήσεις.",
  },
  {
    icon: Truck,
    title: "Η μεταφορά γίνεται",
    desc: "Επίλεξε αυτόν που σου ταιριάζει, πλήρωσε με ασφάλεια, ολοκλήρωσε με QR.",
  },
] as const;

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="border-b border-border bg-card py-20 sm:py-24"
    >
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <Badge variant="secondary">Πώς λειτουργεί</Badge>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Από το αίτημα στην παράδοση — σε 4 βήματα
          </h2>
          <p className="mt-3 text-base text-muted-foreground">
            Καμία πολυπλοκότητα, καμία τηλεφωνική περιπέτεια. Μια απλή, διαφανής
            ροή που σχεδιάσαμε γύρω από τον δικό σου χρόνο.
          </p>
        </div>

        <ol className="relative mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <li
              key={step.title}
              className="relative flex h-full flex-col gap-4 rounded-2xl border border-border bg-background p-6 shadow-[var(--shadow-card)] transition-transform hover:-translate-y-0.5"
            >
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-[var(--color-brand-blue-light)] text-[var(--color-brand-blue-deep)]">
                  <step.icon className="size-5" />
                </span>
                <span className="font-mono text-xs font-medium text-muted-foreground">
                  Βήμα {i + 1}
                </span>
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">
                  {step.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {step.desc}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
