import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  MapPin,
  Package,
  Receipt,
  Trophy,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { PageHero } from "@/components/shared/page-hero";
import { StatusPill } from "@/components/carrier/status-pill";
import { listMyOffers } from "@/server/actions/carrier-leads.action";

export const metadata = { title: "Οι προσφορές μου" };
export const dynamic = "force-dynamic";

export default async function CarrierOffersPage() {
  const offers = await listMyOffers();
  const open = offers.filter((o) => o.status === "OPEN").length;
  const accepted = offers.filter((o) => o.status === "ACCEPTED").length;
  const rejected = offers.filter(
    (o) => o.status === "REJECTED" || o.status === "EXPIRED",
  ).length;

  // Pipeline buckets for grouping
  const winning = offers.filter(
    (o) => o.status === "OPEN" && o.competition?.iAmLowest,
  );
  const losing = offers.filter(
    (o) => o.status === "OPEN" && o.competition && !o.competition.iAmLowest,
  );
  const noComp = offers.filter(
    (o) => o.status === "OPEN" && !o.competition,
  );
  const resolved = offers.filter((o) => o.status !== "OPEN");

  return (
    <>
      <PageHero
        eyebrow="My pipeline"
        title="Οι προσφορές μου"
        description="Όλες οι προσφορές σου, με ζωντανή σύγκριση τιμής έναντι του ανταγωνισμού στο ίδιο αίτημα."
        crumbs={[
          { href: "/carrier", label: "Επισκόπηση" },
          { label: "Προσφορές" },
        ]}
        kpis={[
          { label: "Σύνολο", value: offers.length },
          { label: "Ανοιχτές", value: open },
          {
            label: "Πρώτη θέση",
            value: winning.length,
            deltaTone: "positive",
          },
          {
            label: "Πίσω από ανταγωνισμό",
            value: losing.length,
            deltaTone: losing.length > 0 ? "negative" : "positive",
          },
        ]}
      />

      <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {offers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
            <Receipt className="mx-auto size-10 text-muted-foreground" />
            <p className="mt-3 text-sm font-semibold text-foreground">
              Δεν έχεις υποβάλει ακόμα προσφορές
            </p>
            <Link
              href="/carrier/leads"
              className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg bg-foreground px-4 text-xs font-bold text-background"
            >
              Δες τα νέα αιτήματα
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <PipelineSection
              title="Πίσω από ανταγωνισμό"
              hint="Κάποιος έχει χαμηλότερη τιμή — μπορείς να τη ματσάρεις."
              tone="danger"
              offers={losing}
            />
            <PipelineSection
              title="Στην πρώτη θέση"
              hint="Έχεις τη χαμηλότερη τιμή — κράτα τα μάτια ανοιχτά."
              tone="success"
              offers={winning}
            />
            <PipelineSection
              title="Χωρίς ανταγωνισμό ακόμη"
              hint="Είσαι ο μόνος που έχει προσφέρει — πρώτος στη λίστα του πελάτη."
              tone="info"
              offers={noComp}
            />
            <PipelineSection
              title="Ολοκληρωμένες"
              hint="Αποδεκτές, απορριφθείσες ή που έληξαν."
              tone="neutral"
              offers={resolved}
            />
          </div>
        )}
      </div>
    </>
  );
}

function PipelineSection({
  title,
  hint,
  tone,
  offers,
}: {
  title: string;
  hint: string;
  tone: "danger" | "success" | "info" | "neutral";
  offers: Awaited<ReturnType<typeof listMyOffers>>;
}) {
  if (offers.length === 0) return null;
  const dotCls = {
    danger: "bg-rose-500",
    success: "bg-emerald-500",
    info: "bg-[var(--color-brand-blue)]",
    neutral: "bg-secondary",
  }[tone];
  return (
    <section>
      <header className="mb-2.5 flex items-baseline justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={cn("size-2 shrink-0 rounded-full", dotCls)} />
          <h2 className="font-display text-base font-bold text-foreground">
            {title}
          </h2>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold tabular-nums text-muted-foreground">
            {offers.length}
          </span>
        </div>
        <p className="hidden text-xs text-muted-foreground sm:block">{hint}</p>
      </header>
      <ul className="grid gap-2">
        {offers.map((o) => (
          <li key={o.id}>
            <OfferRow offer={o} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function OfferRow({ offer: o }: { offer: Awaited<ReturnType<typeof listMyOffers>>[number] }) {
  const ref = o.moveRequestId.slice(-8).toUpperCase();
  const myPriceEur = Math.round(o.priceCents / 100);
  const expiring =
    o.status === "OPEN" &&
    o.validUntil.getTime() - Date.now() < 48 * 60 * 60 * 1000;

  let competitionBlock: React.ReactNode = null;
  let priceDeltaPct: number | null = null;
  if (o.status === "OPEN" && o.competition) {
    const compEur = Math.round(o.competition.lowestCents / 100);
    if (o.competition.iAmLowest) {
      const diffPct =
        ((o.competition.lowestCents - o.priceCents) / o.competition.lowestCents) *
        100;
      competitionBlock = (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/60 px-2.5 py-1.5">
          <Trophy className="size-3.5 text-emerald-700" />
          <div className="text-[11px] leading-tight">
            <p className="font-bold text-emerald-800">
              Πρώτη θέση
            </p>
            <p className="text-[10px] text-emerald-700/80">
              Επόμενος ανταγωνιστής: <span className="font-semibold tabular-nums">{compEur}€</span>
              {diffPct > 0 && (
                <> · {diffPct.toFixed(0)}% πιο φθηνός</>
              )}
            </p>
          </div>
        </div>
      );
    } else {
      const diff = o.priceCents - o.competition.lowestCents;
      priceDeltaPct = (diff / o.competition.lowestCents) * 100;
      competitionBlock = (
        <Link
          href={`/carrier/leads/${o.moveRequestId}?matchPrice=${compEur}`}
          className="group inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50/60 px-2.5 py-1.5 transition-colors hover:bg-rose-100"
        >
          <AlertTriangle className="size-3.5 text-rose-700" />
          <div className="text-[11px] leading-tight">
            <p className="font-bold text-rose-800">
              Χαμηλότερη τιμή: <span className="tabular-nums">{compEur}€</span>
            </p>
            <p className="text-[10px] text-rose-700/80">
              Είσαι {Math.round(priceDeltaPct ?? 0)}% πιο πάνω · πάτα για match price
            </p>
          </div>
        </Link>
      );
    }
  }

  return (
    <Link
      href={`/carrier/leads/${o.moveRequestId}`}
      className="grid items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:border-[var(--color-brand-blue)]/40 hover:shadow-lg sm:grid-cols-[1.4fr_1fr_auto_auto]"
    >
      {/* Route + ref + status */}
      <div className="min-w-0">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] font-bold text-muted-foreground">
            #{ref}
          </span>
          <StatusPill status={o.status} size="xs" />
          {expiring && (
            <StatusPill status="PENDING" size="xs" />
          )}
        </div>
        <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <MapPin className="size-3.5 text-sky-600" />
          {o.request.fromLocality}
        </p>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="size-3.5 text-rose-600" />
          {o.request.toLocality}
        </p>
      </div>

      {/* Meta */}
      <div className="text-xs text-muted-foreground">
        <p className="flex items-center gap-1.5">
          <CalendarClock className="size-3" />
          {o.request.preferredDate
            ? formatDate(o.request.preferredDate)
            : "Ευέλικτη"}
        </p>
        <p className="flex items-center gap-1.5">
          <Package className="size-3" />
          {o.request.itemsCount} τεμ · {o.request.totalVolumeM3.toFixed(1)} m³
        </p>
      </div>

      {/* Competition */}
      <div className="hidden sm:block">{competitionBlock}</div>

      {/* My price + valid */}
      <div className="text-right">
        <p
          className={cn(
            "font-display text-xl font-bold tabular-nums",
            o.competition?.iAmLowest
              ? "text-emerald-700"
              : priceDeltaPct && priceDeltaPct > 0
                ? "text-rose-700"
                : "text-[var(--color-brand-blue-deep)]",
          )}
        >
          {myPriceEur}€
        </p>
        <p className="text-[10px] text-muted-foreground">
          ισχύει έως {formatDate(o.validUntil)}
        </p>
      </div>

      {/* Mobile competition row */}
      {competitionBlock && (
        <div className="sm:hidden col-span-full">{competitionBlock}</div>
      )}
    </Link>
  );
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("el-GR", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  }).format(d);
}
