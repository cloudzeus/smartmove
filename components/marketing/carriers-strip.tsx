import { BadgeCheck } from "lucide-react";

const CARRIERS = [
  "ΜεταφορΆθα",
  "ExpressMove",
  "Olympia Logistics",
  "AthensMove",
  "Hellas Transport",
  "PiraeusCargo",
  "MoveAndCare",
  "FastDelivery",
  "Aegean Movers",
  "Northern Star Logistics",
] as const;

export function CarriersStrip() {
  return (
    <section
      aria-label="Επαληθευμένοι μεταφορείς"
      className="border-b border-border bg-card py-14"
    >
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-brand-blue-light)] px-3 py-1 text-xs font-semibold text-[var(--color-brand-blue-deep)]">
            <BadgeCheck className="size-3.5" />
            1.200+ επαληθευμένοι μεταφορείς
          </span>
          <h2 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Συνεργαζόμαστε με τους κορυφαίους της αγοράς
          </h2>
        </div>

        <ul className="mt-8 flex flex-wrap items-center justify-center gap-2.5">
          {CARRIERS.map((name) => (
            <li
              key={name}
              className="flex items-center gap-2 rounded-full border border-border bg-background px-3.5 py-1.5 text-sm font-medium text-foreground shadow-sm"
            >
              <span
                aria-hidden
                className="grid size-6 place-items-center rounded-full bg-[var(--color-brand-blue-light)] text-[10px] font-bold text-[var(--color-brand-blue-deep)]"
              >
                {name.slice(0, 2).toUpperCase()}
              </span>
              {name}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
