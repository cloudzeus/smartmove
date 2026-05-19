import Link from "next/link";
import {
  ArrowRight,
  Inbox,
  Receipt,
  Star,
  Truck,
  Wallet,
} from "lucide-react";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { EmptyState } from "@/components/dashboard/empty-state";

export const metadata = { title: "Πίνακας μεταφορέα" };
export const dynamic = "force-dynamic";

export default async function CarrierOverviewPage() {
  const session = await auth();
  const userId = session!.user.id;

  const membership = await db.tenantMembership.findFirst({
    where: { userId },
    select: { tenantId: true },
    orderBy: { createdAt: "asc" },
  });

  const [openLeads, myOffers, activeJobs, payments, reviews, recentLeads, recentOffers] =
    await Promise.all([
      db.moveRequest.count({ where: { status: "PUBLISHED" } }),
      db.offer.count({ where: { carrierUserId: userId, status: "OPEN" } }),
      db.moveRequest.count({
        where: {
          status: "AWARDED",
          offers: { some: { carrierUserId: userId, status: "ACCEPTED" } },
        },
      }),
      db.payment.aggregate({
        _sum: { amountCents: true },
        where: { status: "CAPTURED", offer: { carrierUserId: userId } },
      }),
      db.review.aggregate({
        _avg: { rating: true },
        _count: { _all: true },
        where: { carrierUserId: userId },
      }),
      db.moveRequest.findMany({
        where: { status: "PUBLISHED" },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: {
          id: true,
          fromAddress: true,
          toAddress: true,
          createdAt: true,
          type: true,
          itemsCount: true,
          totalVolumeM3: true,
        },
      }),
      db.offer.findMany({
        where: { carrierUserId: userId },
        orderBy: { createdAt: "desc" },
        take: 6,
        include: {
          moveRequest: {
            select: { fromAddress: true, toAddress: true },
          },
        },
      }),
    ]);

  const earningsEur = (payments._sum.amountCents ?? 0) / 100;
  const avgRating = reviews._avg.rating ?? 0;

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      {/* Header — compact, no big hero */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            Marketplace
          </p>
          <h1 className="font-display text-2xl font-bold text-foreground">
            Καλώς ήρθες
          </h1>
        </div>
        <Link
          href="/carrier/leads"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--color-brand-blue)] px-4 text-sm font-bold text-white shadow-[var(--shadow-cta)] hover:bg-[var(--color-brand-blue-deep)]"
        >
          <Inbox className="size-4" />
          Δες αιτήματα
        </Link>
      </div>

      {!membership && (
        <div className="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-bold text-amber-900">
            Δεν είσαι ακόμα συνδεδεμένος με εταιρεία
          </p>
          <p className="mt-0.5 text-xs text-amber-800">
            Ζήτησε από έναν admin να σε προσθέσει σε ένα tenant.
          </p>
        </div>
      )}

      {/* Compact KPI strip — 4 inline tiles, one row */}
      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile
          icon={Inbox}
          label="Νέα αιτήματα"
          value={openLeads}
          accent="blue"
          href="/carrier/leads"
        />
        <StatTile
          icon={Receipt}
          label="Ανοιχτές προσφορές"
          value={myOffers}
          accent="amber"
          href="/carrier/offers"
        />
        <StatTile
          icon={Truck}
          label="Σε εξέλιξη"
          value={activeJobs}
          accent="emerald"
          href="/carrier/jobs"
        />
        <StatTile
          icon={Wallet}
          label="Έσοδα"
          value={earningsEur > 0 ? `${earningsEur.toFixed(0)}€` : "—"}
          accent="violet"
          subline={
            reviews._count._all > 0
              ? `${avgRating.toFixed(1)} ★ · ${reviews._count._all} reviews`
              : undefined
          }
        />
      </div>

      {/* Two-column actionable lists */}
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-foreground">
              Φρέσκα αιτήματα
            </h2>
            <Link
              href="/carrier/leads"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-brand-blue)] hover:text-[var(--color-brand-blue-deep)]"
            >
              Όλα <ArrowRight className="size-3" />
            </Link>
          </div>
          {recentLeads.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Δεν υπάρχουν νέα αιτήματα.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {recentLeads.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/carrier/leads/${r.id}`}
                    className="flex items-center justify-between gap-3 py-2.5 hover:bg-secondary/40 -mx-2 px-2 rounded-md transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {r.fromAddress.split(",")[1]?.trim() || r.fromAddress}{" "}
                        → {r.toAddress.split(",")[1]?.trim() || r.toAddress}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {r.itemsCount} τεμ · {r.totalVolumeM3.toFixed(1)} m³ ·{" "}
                        {relativeTime(r.createdAt)}
                      </p>
                    </div>
                    <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-foreground">
              Πρόσφατες προσφορές μου
            </h2>
            <Link
              href="/carrier/offers"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-brand-blue)] hover:text-[var(--color-brand-blue-deep)]"
            >
              Όλες <ArrowRight className="size-3" />
            </Link>
          </div>
          {recentOffers.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="Καμία προσφορά ακόμα"
              description="Όταν στείλεις την πρώτη σου προσφορά, θα εμφανίζεται εδώ."
              cta={{ label: "Δες αιτήματα", href: "/carrier/leads" }}
            />
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {recentOffers.map((o) => (
                <li key={o.id}>
                  <Link
                    href={`/carrier/leads/${o.moveRequestId}`}
                    className="flex items-center justify-between gap-3 py-2.5 hover:bg-secondary/40 -mx-2 px-2 rounded-md transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {o.moveRequest.fromAddress.split(",")[1]?.trim() ||
                          o.moveRequest.fromAddress}{" "}
                        →{" "}
                        {o.moveRequest.toAddress.split(",")[1]?.trim() ||
                          o.moveRequest.toAddress}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {statusLabel(o.status)} · {relativeTime(o.createdAt)}
                      </p>
                    </div>
                    <span className="font-display text-base font-bold tabular-nums text-[var(--color-brand-blue-deep)]">
                      {(o.priceCents / 100).toFixed(0)}€
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  accent,
  href,
  subline,
}: {
  icon: typeof Inbox;
  label: string;
  value: number | string;
  accent: "blue" | "amber" | "emerald" | "violet";
  href?: string;
  subline?: string;
}) {
  const accentMap = {
    blue: "text-[var(--color-brand-blue)] bg-[var(--color-brand-blue-light)]",
    amber: "text-amber-700 bg-amber-50",
    emerald: "text-emerald-700 bg-emerald-50",
    violet: "text-violet-700 bg-violet-50",
  };
  const body = (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:bg-secondary/30">
      <span
        className={`grid size-9 shrink-0 place-items-center rounded-lg ${accentMap[accent]}`}
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="font-display text-lg font-bold leading-tight tabular-nums text-foreground">
          {value}
        </p>
        {subline && (
          <p className="truncate text-[10px] text-muted-foreground">{subline}</p>
        )}
      </div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function relativeTime(d: Date): string {
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "μόλις τώρα";
  if (m < 60) return `${m}ʹ`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d`;
  return new Intl.DateTimeFormat("el-GR", { day: "2-digit", month: "short" }).format(
    d,
  );
}

function statusLabel(s: string): string {
  switch (s) {
    case "OPEN":
      return "Σε εξέλιξη";
    case "ACCEPTED":
      return "Αποδεκτή";
    case "REJECTED":
      return "Απορρίφθηκε";
    case "EXPIRED":
      return "Έληξε";
    default:
      return s;
  }
}
