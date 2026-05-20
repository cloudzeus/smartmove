import { Camera, FileText, Inbox, Truck } from "lucide-react";

import { Badge } from "@/components/ui/badge";

const STEPS = [
  {
    icon: FileText,
    title: "Δημιουργείς ανάρτηση",
    desc: "Συμπλήρωσε σε λίγα βήματα: από πού, προς πού, τι μεταφέρεις, πότε.",
    gradient: "from-blue-500 to-blue-700",
    ring: "ring-blue-200",
  },
  {
    icon: Camera,
    title: "Σκανάρεις τον χώρο",
    desc: "Με AI εκτιμούμε όγκο και αντικείμενα από φωτογραφίες — σε δευτερόλεπτα.",
    gradient: "from-fuchsia-500 to-violet-600",
    ring: "ring-fuchsia-200",
  },
  {
    icon: Inbox,
    title: "Λαμβάνεις προσφορές",
    desc: "Επιβεβαιωμένοι μεταφορείς απαντούν με τιμές, χρόνους και αξιολογήσεις.",
    gradient: "from-amber-400 to-orange-500",
    ring: "ring-amber-200",
  },
  {
    icon: Truck,
    title: "Η μεταφορά γίνεται",
    desc: "Επίλεξε αυτόν που σου ταιριάζει, πλήρωσε με ασφάλεια, ολοκλήρωσε με QR.",
    gradient: "from-red-500 to-rose-600",
    ring: "ring-red-200",
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
              className="group relative flex h-full flex-col gap-4 rounded-2xl border border-border bg-background p-6 shadow-[var(--shadow-card)] transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-pop)]"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`grid size-11 place-items-center rounded-xl bg-gradient-to-br ${step.gradient} text-white shadow-md ring-4 ${step.ring} transition-transform group-hover:scale-110`}
                >
                  <step.icon className="size-5" />
                </span>
                <span className="font-mono text-xs font-semibold tracking-wider text-foreground/70">
                  ΒΗΜΑ {String(i + 1).padStart(2, "0")}
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
