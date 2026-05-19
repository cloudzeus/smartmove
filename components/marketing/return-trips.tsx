import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  Leaf,
  MapPin,
  Package,
  Repeat,
  Truck,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";

interface ReturnTrip {
  id: string;
  from: string;
  to: string;
  date: string;
  time: string;
  carrier: string;
  carrierInitials: string;
  capacityM3: number;
  discountPct: number;
  badge?: "ASAP" | "Σήμερα" | "Αύριο";
  co2SavedKg: number;
}

const TRIPS: ReturnTrip[] = [
  {
    id: "1",
    from: "Θεσσαλονίκη",
    to: "Αθήνα",
    date: "Παρ 23/05",
    time: "17:00 – 22:00",
    carrier: "Northern Star Logistics",
    carrierInitials: "NS",
    capacityM3: 12,
    discountPct: 42,
    badge: "Αύριο",
    co2SavedKg: 980,
  },
  {
    id: "2",
    from: "Πάτρα",
    to: "Αθήνα",
    date: "Σαβ 24/05",
    time: "09:00 – 13:00",
    carrier: "Olympia Logistics",
    carrierInitials: "OL",
    capacityM3: 8,
    discountPct: 38,
    co2SavedKg: 540,
  },
  {
    id: "3",
    from: "Ηράκλειο",
    to: "Αθήνα",
    date: "Δευ 26/05",
    time: "06:00 – 11:00",
    carrier: "Aegean Movers",
    carrierInitials: "AM",
    capacityM3: 18,
    discountPct: 50,
    co2SavedKg: 1320,
  },
  {
    id: "4",
    from: "Ιωάννινα",
    to: "Αθήνα",
    date: "Τετ 28/05",
    time: "14:00 – 18:00",
    carrier: "Hellas Transport",
    carrierInitials: "HT",
    capacityM3: 10,
    discountPct: 35,
    co2SavedKg: 760,
  },
];

export function ReturnTrips() {
  return (
    <section
      id="shared-load"
      className="border-b border-border bg-background py-20 sm:py-24"
    >
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div className="max-w-2xl">
            <Badge variant="default" className="gap-1.5">
              <Repeat className="size-3.5" />
              Shared Load · Επιστροφές μεταφορέων
            </Badge>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Συνδύασε τη μεταφορά σου με{" "}
              <span className="text-[var(--color-brand-blue)]">
                ήδη προγραμματισμένο δρομολόγιο
              </span>{" "}
              & πλήρωσε έως −50%
            </h2>
            <p className="mt-3 text-base text-muted-foreground">
              Δεκάδες μεταφορείς γυρίζουν με άδειο φορτηγό. Εσύ γεμίζεις τον
              κενό τους χώρο. Όλοι κερδίζουν — και το περιβάλλον γλιτώνει
              εκπομπές CO₂.
            </p>
          </div>
          <Link
            href="/scan?shared=1"
            className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--color-brand-blue)] hover:text-[var(--color-brand-blue-deep)]"
          >
            Δες όλες τις επιστροφές
            <ArrowRight className="size-4" />
          </Link>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {TRIPS.map((trip) => (
            <ReturnTripCard key={trip.id} trip={trip} />
          ))}
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5 text-sm shadow-[var(--shadow-card)] sm:flex-row">
          <p className="flex items-center gap-2 text-muted-foreground">
            <Truck className="size-4 text-[var(--color-brand-blue)]" />
            <span>
              <span className="font-semibold text-foreground">
                +47 διαθέσιμα δρομολόγια
              </span>{" "}
              αυτή την εβδομάδα · ανανεώνονται κάθε ώρα
            </span>
          </p>
          <Link
            href="/scan?shared=1"
            className="inline-flex items-center gap-1 rounded-xl bg-[var(--color-brand-blue-light)] px-4 py-2 text-sm font-semibold text-[var(--color-brand-blue-deep)] transition-colors hover:bg-[var(--color-brand-blue)] hover:text-white"
          >
            Βρες ταίριασμα με τη διαδρομή μου
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function ReturnTripCard({ trip }: { trip: ReturnTrip }) {
  return (
    <article className="group relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:border-[var(--color-brand-blue)]/40 hover:shadow-[var(--shadow-pop)]">
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="grid size-9 place-items-center rounded-lg bg-[var(--color-brand-blue-light)] font-display text-xs font-bold text-[var(--color-brand-blue-deep)]"
          >
            {trip.carrierInitials}
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-foreground">
              {trip.carrier}
            </p>
            <p className="text-[11px] text-muted-foreground">Επαληθευμένος</p>
          </div>
        </div>
        {trip.badge && (
          <span className="rounded-full bg-[var(--color-brand-red)] px-2 py-0.5 text-[10px] font-bold uppercase text-white">
            {trip.badge}
          </span>
        )}
      </header>

      {/* Route */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <MapPin className="size-3.5 text-[var(--color-brand-blue)]" />
          <span className="font-semibold text-foreground">{trip.from}</span>
        </div>
        <div className="ml-1.5 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="h-3 w-px bg-border" />
          <span>—</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <MapPin className="size-3.5 text-[var(--color-brand-red)]" />
          <span className="font-semibold text-foreground">{trip.to}</span>
        </div>
      </div>

      <div className="rounded-xl bg-secondary/50 p-3">
        <div className="flex items-center gap-2 text-xs font-medium text-foreground">
          <CalendarClock className="size-3.5 text-[var(--color-brand-blue)]" />
          {trip.date} · {trip.time}
        </div>
        <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
          <Package className="size-3.5" />
          {trip.capacityM3} m³ διαθέσιμα
        </div>
      </div>

      <footer className="mt-auto flex items-end justify-between gap-3 border-t border-border pt-3">
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Εξοικονόμηση
          </span>
          <span className="font-display text-2xl font-bold text-emerald-700">
            −{trip.discountPct}%
          </span>
          <span className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
            <Leaf className="size-3 text-emerald-600" />
            −{trip.co2SavedKg} kg CO₂
          </span>
        </div>
        <Link
          href={`/scan?shared=1&trip=${trip.id}`}
          className="inline-flex h-9 items-center gap-1 rounded-lg bg-[var(--color-brand-blue)] px-3 text-xs font-semibold text-white transition-colors hover:bg-[var(--color-brand-blue-deep)]"
        >
          Συνδύασε
          <ArrowRight className="size-3.5" />
        </Link>
      </footer>
    </article>
  );
}
