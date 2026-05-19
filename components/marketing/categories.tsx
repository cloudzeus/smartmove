import Link from "next/link";
import {
  ArrowRight,
  Armchair,
  Building2,
  Home,
  Map as MapIcon,
  PackageOpen,
  Wrench,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";

const CATEGORIES = [
  {
    icon: Home,
    title: "Μετακόμιση κατοικίας",
    desc: "Διαμέρισμα, μονοκατοικία ή φοιτητική.",
    priceFrom: 180,
    badge: "Δημοφιλές",
    slug: "house",
  },
  {
    icon: Armchair,
    title: "Μεταφορά επίπλων",
    desc: "Από καναπέ μέχρι ολόκληρη επίπλωση.",
    priceFrom: 60,
    slug: "furniture",
  },
  {
    icon: Wrench,
    title: "Επαγγελματικός εξοπλισμός",
    desc: "Γραφεία, καταστήματα, εργαλεία.",
    priceFrom: 220,
    slug: "business",
  },
  {
    icon: PackageOpen,
    title: "Βαρέα & ογκώδη",
    desc: "Πιάνα, χρηματοκιβώτια, μηχανήματα.",
    priceFrom: 250,
    slug: "heavy",
  },
  {
    icon: Building2,
    title: "Εντός πόλης",
    desc: "Γρήγορες αστικές μεταφορές, ίδια μέρα.",
    priceFrom: 45,
    slug: "city",
  },
  {
    icon: MapIcon,
    title: "Πανελλαδικά",
    desc: "Από νησί σε ηπειρωτική και αντίστροφα.",
    priceFrom: 320,
    slug: "national",
  },
] as const;

export function Categories() {
  return (
    <section
      id="categories"
      className="border-b border-border bg-background py-20 sm:py-24"
    >
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div className="max-w-xl">
            <Badge variant="default">Κατηγορίες μεταφοράς</Badge>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Όλες οι μεταφορές, μία πλατφόρμα
            </h2>
            <p className="mt-3 text-base text-muted-foreground">
              Από ένα δέμα μέχρι ολόκληρη μετακόμιση — βρίσκεις τον σωστό
              μεταφορέα για κάθε περίπτωση, με ενδεικτικές τιμές αγοράς.
            </p>
          </div>
          <Link
            href="/scan"
            className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--color-brand-blue)] hover:text-[var(--color-brand-blue-deep)]"
          >
            Ξεκίνα τη μεταφορά σου
            <ArrowRight className="size-4" />
          </Link>
        </div>

        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.title}
              href={`/scan?type=${cat.slug}`}
              className="group relative flex h-full flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:border-[var(--color-brand-blue)]/40 hover:shadow-[var(--shadow-pop)]"
            >
              {"badge" in cat && cat.badge && (
                <span className="absolute right-3 top-3 rounded-full bg-[var(--color-brand-red-light)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--color-brand-red-deep)]">
                  {cat.badge}
                </span>
              )}
              <span className="grid size-11 place-items-center rounded-xl bg-[var(--color-brand-blue-light)] text-[var(--color-brand-blue-deep)] transition-colors group-hover:bg-[var(--color-brand-blue)] group-hover:text-white">
                <cat.icon className="size-5" />
              </span>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-foreground">
                  {cat.title}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">{cat.desc}</p>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-3">
                <span className="text-xs text-muted-foreground">από</span>
                <span className="font-display text-lg font-bold text-foreground">
                  {cat.priceFrom}€
                </span>
              </div>
            </Link>
          ))}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          *Ενδεικτικές τιμές βάσει 12.500+ ολοκληρωμένων μεταφορών. Η τελική
          τιμή διαμορφώνεται από τις προσφορές των μεταφορέων.
        </p>
      </div>
    </section>
  );
}
