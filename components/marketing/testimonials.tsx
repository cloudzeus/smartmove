import { Star } from "lucide-react";

import { Badge } from "@/components/ui/badge";

const TESTIMONIALS = [
  {
    name: "Μαρία Κ.",
    role: "Μετακόμιση 3άρι, Αθήνα → Πάτρα",
    date: "Απρ 2026",
    rating: 5,
    quote:
      "Σε 2 ώρες είχα 6 προσφορές. Διάλεξα τον μεταφορέα με τις καλύτερες κριτικές και πλήρωσα 320€ λιγότερα από τις τηλεφωνικές προσφορές.",
    saved: 320,
  },
  {
    name: "Γιώργος Π.",
    role: "Μεταφορά πιάνου εντός Αθήνας",
    date: "Μαρ 2026",
    rating: 5,
    quote:
      "Είχα ξεχάσει πόσο δύσκολο είναι να βρεις σοβαρό μεταφορέα για πιάνο. Στο SmartMove όλοι ήταν επαληθευμένοι και ασφαλισμένοι.",
    saved: 180,
  },
  {
    name: "Ελένη Σ.",
    role: "Express δέμα Αθήνα → Θεσσαλονίκη",
    date: "Φεβ 2026",
    rating: 5,
    quote:
      "Στις 09:00 δημοσίευσα, στις 11:00 το δέμα ήταν στο φορτηγό. Διαφάνεια σε όλη τη διαδικασία και QR επιβεβαίωση παράδοσης.",
    saved: 25,
  },
  {
    name: "Νίκος Α.",
    role: "Μετακόμιση γραφείου · Πειραιάς",
    date: "Ιαν 2026",
    rating: 5,
    quote:
      "Πέντε μεταφορείς ήρθαν να δουν τον χώρο online μέσω βίντεο. Η διαδικασία ήταν επαγγελματική, χωρίς εκπλήξεις στην τιμή.",
    saved: 540,
  },
] as const;

export function Testimonials() {
  return (
    <section className="border-b border-border bg-background py-20 sm:py-24">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div className="max-w-xl">
            <Badge variant="default">Πραγματικές κριτικές</Badge>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Πελάτες που εξοικονόμησαν με το SmartMove
            </h2>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-[var(--shadow-card)]">
            <div className="flex">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className="size-4 fill-amber-400 stroke-amber-400"
                />
              ))}
            </div>
            <div className="flex flex-col text-xs leading-tight text-muted-foreground">
              <span className="font-bold text-foreground">
                4.8 / 5 · 12.500+ κριτικές
              </span>
              <span>επιβεβαιωμένες από Google Reviews</span>
            </div>
          </div>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TESTIMONIALS.map((t) => (
            <figure
              key={t.name + t.date}
              className="flex h-full flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]"
            >
              <div className="flex items-center justify-between">
                <div className="flex">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star
                      key={i}
                      className="size-4 fill-amber-400 stroke-amber-400"
                    />
                  ))}
                </div>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                  −{t.saved}€
                </span>
              </div>

              <blockquote className="flex-1 text-sm leading-relaxed text-foreground">
                «{t.quote}»
              </blockquote>

              <figcaption className="flex items-center gap-3 border-t border-border pt-4">
                <span
                  aria-hidden
                  className="grid size-10 place-items-center rounded-full bg-[var(--color-brand-blue-light)] font-display text-sm font-bold text-[var(--color-brand-blue-deep)]"
                >
                  {t.name
                    .split(" ")
                    .map((p) => p[0])
                    .join("")}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-semibold text-foreground">
                    {t.name}
                  </span>
                  <span className="truncate text-[11px] text-muted-foreground">
                    {t.role} · {t.date}
                  </span>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
