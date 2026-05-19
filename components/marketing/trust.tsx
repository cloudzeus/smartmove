import { BadgeCheck, Lock, MessagesSquare, Star } from "lucide-react";

import { Badge } from "@/components/ui/badge";

const TRUST_POINTS = [
  {
    icon: BadgeCheck,
    title: "Επιβεβαιωμένοι μεταφορείς",
    desc: "ΑΦΜ, ασφάλεια, στοιχεία οχημάτων και έγγραφα ελέγχονται πριν δημοσιευτεί προφίλ.",
  },
  {
    icon: Star,
    title: "Πραγματικές αξιολογήσεις",
    desc: "Μόνο πελάτες με ολοκληρωμένη μεταφορά αφήνουν κριτική. Χωρίς fake reviews.",
  },
  {
    icon: Lock,
    title: "Ασφαλείς πληρωμές",
    desc: "Η πληρωμή δεσμεύεται και αποδεσμεύεται μόνο όταν η μεταφορά ολοκληρωθεί.",
  },
  {
    icon: MessagesSquare,
    title: "Διαφανής επικοινωνία",
    desc: "Όλα τα μηνύματα ζουν μέσα στην πλατφόρμα — με ιστορικό και απόδειξη.",
  },
] as const;

export function Trust() {
  return (
    <section id="trust" className="border-b border-border bg-card py-20 sm:py-24">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <Badge variant="default">Εμπιστοσύνη & ασφάλεια</Badge>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Εμπιστεύεσαι την επόμενη μεταφορά σου σε επαγγελματίες
            </h2>
            <p className="mt-3 max-w-lg text-base text-muted-foreground">
              Επειδή μιλάμε για τα πράγματά σου — από τα έπιπλά σου μέχρι τον
              εξοπλισμό της επιχείρησής σου — έχουμε χτίσει μηχανισμούς ελέγχου,
              πληρωμής και επικοινωνίας που σε προστατεύουν σε κάθε βήμα.
            </p>

            <dl className="mt-8 grid grid-cols-3 gap-4 max-w-md">
              {[
                { k: "1.200+", v: "Μεταφορείς" },
                { k: "98%", v: "On-time" },
                { k: "4.8/5", v: "Μέση κριτική" },
              ].map((s) => (
                <div
                  key={s.k}
                  className="rounded-xl border border-border bg-background p-4 text-center"
                >
                  <dt className="text-2xl font-bold text-foreground">{s.k}</dt>
                  <dd className="mt-1 text-xs text-muted-foreground">{s.v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <ul className="grid gap-3 sm:grid-cols-2">
            {TRUST_POINTS.map((point) => (
              <li
                key={point.title}
                className="flex h-full flex-col gap-3 rounded-2xl border border-border bg-background p-5 shadow-[var(--shadow-card)]"
              >
                <span className="grid size-10 place-items-center rounded-xl bg-[var(--color-brand-blue-light)] text-[var(--color-brand-blue-deep)]">
                  <point.icon className="size-5" />
                </span>
                <div>
                  <h3 className="text-base font-semibold text-foreground">
                    {point.title}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {point.desc}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
