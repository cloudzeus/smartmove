import Link from "next/link";
import {
  CalendarClock,
  CheckCircle2,
  Clock,
  MapPin,
  Package,
  Receipt,
  XCircle,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { PageHero } from "@/components/shared/page-hero";
import { listMyOffers } from "@/server/actions/carrier-leads.action";

export const metadata = { title: "Οι προσφορές μου" };
export const dynamic = "force-dynamic";

const OFFER_STATUS: Record<string, { label: string; cls: string; icon: typeof Clock }> =
  {
    OPEN: {
      label: "Σε εξέλιξη",
      cls: "bg-sky-100 text-sky-800",
      icon: Clock,
    },
    ACCEPTED: {
      label: "Αποδεκτή",
      cls: "bg-emerald-100 text-emerald-800",
      icon: CheckCircle2,
    },
    REJECTED: {
      label: "Απορρίφθηκε",
      cls: "bg-rose-100 text-rose-800",
      icon: XCircle,
    },
    EXPIRED: {
      label: "Έληξε",
      cls: "bg-slate-100 text-slate-700",
      icon: XCircle,
    },
  };

export default async function CarrierOffersPage() {
  const offers = await listMyOffers();
  const open = offers.filter((o) => o.status === "OPEN").length;
  const accepted = offers.filter((o) => o.status === "ACCEPTED").length;
  const rejected = offers.filter(
    (o) => o.status === "REJECTED" || o.status === "EXPIRED",
  ).length;

  return (
    <>
      <PageHero
        eyebrow="My pipeline"
        title="Οι προσφορές μου"
        description="Όλες οι προσφορές που έχεις υποβάλει σε αιτήματα μεταφοράς."
        crumbs={[
          { href: "/carrier", label: "Επισκόπηση" },
          { label: "Προσφορές" },
        ]}
        kpis={[
          { label: "Σύνολο", value: offers.length },
          { label: "Ανοιχτές", value: open, deltaTone: "positive" },
          { label: "Αποδεκτές", value: accepted, deltaTone: "positive" },
          { label: "Έληξαν / Απορρίφθηκαν", value: rejected, deltaTone: "neutral" },
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
          <ul className="grid gap-3">
            {offers.map((o) => {
              const cfg = OFFER_STATUS[o.status] ?? OFFER_STATUS.OPEN;
              const Icon = cfg.icon;
              const ref = o.moveRequestId.slice(-8).toUpperCase();
              const expiring =
                o.status === "OPEN" &&
                o.validUntil.getTime() - Date.now() < 48 * 60 * 60 * 1000;
              return (
                <li key={o.id}>
                  <Link
                    href={`/carrier/leads/${o.moveRequestId}`}
                    className="grid items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:border-[var(--color-brand-blue)]/40 hover:shadow-lg sm:grid-cols-[1.5fr_1fr_auto_auto]"
                  >
                    <div className="min-w-0">
                      <div className="mb-1 flex items-center gap-2">
                        <span className="font-mono text-[11px] font-bold text-muted-foreground">
                          #{ref}
                        </span>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                            cfg.cls,
                          )}
                        >
                          <Icon className="size-3" />
                          {cfg.label}
                        </span>
                        {expiring && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                            Λήγει σύντομα
                          </span>
                        )}
                      </div>
                      <p className="flex items-center gap-1.5 text-sm font-semibold">
                        <MapPin className="size-3.5 text-sky-600" />
                        {o.request.fromLocality}
                      </p>
                      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <MapPin className="size-3.5 text-rose-600" />
                        {o.request.toLocality}
                      </p>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <p className="flex items-center gap-1.5">
                        <CalendarClock className="size-3" />
                        {o.request.preferredDate
                          ? formatDate(o.request.preferredDate)
                          : "Ευέλικτη"}
                      </p>
                      <p className="flex items-center gap-1.5">
                        <Package className="size-3" />
                        {o.request.itemsCount} τεμ ·{" "}
                        {o.request.totalVolumeM3.toFixed(1)} m³
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-display text-xl font-bold text-[var(--color-brand-blue-deep)]">
                        {Math.round(o.priceCents / 100)}€
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Λήγει {formatDate(o.validUntil)}
                      </p>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {formatDate(o.createdAt)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("el-GR", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  }).format(d);
}
