import Link from "next/link";
import {
  ArrowUpRight,
  Building2,
  CreditCard,
  Layers,
  PauseCircle,
  Receipt,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Truck,
  Users,
} from "lucide-react";

import { auth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { db } from "@/lib/db";
import { AdminPageHero } from "@/components/admin/page-hero";
import { MetricCard } from "@/components/admin/metric-card";

export const metadata = { title: "Admin · Επισκόπηση" };
export const dynamic = "force-dynamic";

export default async function AdminOverview() {
  const session = await auth();
  const adminName = (session?.user?.name ?? session?.user?.email ?? "").split(/[\s@]/)[0];

  const [
    tenantsTotal,
    tenantsActive,
    activeSubs,
    trialSubs,
    plansActive,
    vehiclesTotal,
    usersTotal,
    customersTotal,
    employeesCount,
    pendingScanFees,
    mrrAgg,
    recentTenants,
    recentRequests,
    recentScanFees,
  ] = await Promise.all([
    db.tenant.count({ where: { deletedAt: null } }),
    db.tenant.count({ where: { deletedAt: null, status: "ACTIVE" } }),
    db.subscription.count({ where: { status: "ACTIVE" } }),
    db.subscription.count({ where: { status: "TRIAL" } }),
    db.subscriptionPlan.count({ where: { isActive: true } }),
    db.vehicle.count({ where: { deletedAt: null } }),
    db.user.count({ where: { deletedAt: null } }),
    db.user.count({ where: { deletedAt: null, role: "CUSTOMER" } }),
    db.user.count({
      where: { deletedAt: null, role: { in: ["EMPLOYEE", "SUPERADMIN"] } },
    }),
    db.scanFee.count({ where: { status: "PENDING" } }),
    db.subscription.aggregate({
      where: { status: "ACTIVE", billingCycle: "MONTHLY" },
      _sum: { pricePerCycle: true },
    }),
    db.tenant.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        subscriptions: {
          take: 1,
          orderBy: { createdAt: "desc" },
          include: { plan: true },
        },
        _count: {
          select: {
            branches: { where: { deletedAt: null } },
            vehicles: { where: { deletedAt: null } },
          },
        },
      },
    }),
    db.moveRequest.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { user: { select: { name: true, email: true } } },
    }),
    db.scanFee.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { user: { select: { name: true, email: true } } },
    }),
  ]);

  const mrrEur = (mrrAgg._sum.pricePerCycle ?? 0) / 100;

  return (
    <>
      <AdminPageHero
        eyebrow="Admin Console"
        title={`Καλώς ήρθες${adminName ? `, ${adminName}` : ""}`}
        description="Συνολική εικόνα πλατφόρμας — πελάτες, συνδρομές, έσοδα και πρόσφατη δραστηριότητα σε πραγματικό χρόνο."
        action={
          <Link
            href="/admin/tenants/new"
            className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-gradient-to-r from-[var(--color-brand-blue)] to-[#3B82F6] px-5 text-sm font-bold text-white shadow-[0_6px_20px_rgba(37,99,235,0.25)] hover:from-[var(--color-brand-blue-deep)] hover:to-[var(--color-brand-blue)]"
          >
            <Sparkles className="size-4" />
            Νέος πελάτης
          </Link>
        }
        kpis={[
          { label: "MRR ενεργών συνδρομών", value: `${mrrEur.toFixed(0)}€`, delta: "+0%", deltaTone: "neutral" },
          { label: "Πελάτες", value: tenantsTotal, delta: `${tenantsActive} ενεργοί`, deltaTone: "positive" },
          { label: "Trials", value: trialSubs, delta: `${activeSubs} active`, deltaTone: "neutral" },
          { label: "Χρήστες", value: usersTotal, delta: `${customersTotal} customers`, deltaTone: "neutral" },
        ]}
      />

      <div className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
        {/* Metric cards */}
        <section>
          <header className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold text-foreground">
                Στατιστικά πλατφόρμας
              </h2>
              <p className="text-xs text-muted-foreground">
                Live από τη βάση δεδομένων · ανανεώνεται σε κάθε φόρτωση.
              </p>
            </div>
          </header>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              icon={Building2}
              label="Πελάτες (tenants)"
              value={tenantsTotal}
              hint={`${tenantsActive} ενεργοί`}
              href="/admin/tenants"
              accent="blue"
              sparkline={[1, 2, 2, 3, 3, 4, Math.max(1, tenantsTotal)]}
            />
            <MetricCard
              icon={Receipt}
              label="Ενεργές συνδρομές"
              value={activeSubs}
              hint={`+ ${trialSubs} trials`}
              href="/admin/subscriptions"
              accent="emerald"
            />
            <MetricCard
              icon={TrendingUp}
              label="MRR"
              value={`${mrrEur.toFixed(0)}€`}
              hint="μηνιαία περιοδική έσοδα"
              accent="violet"
              deltaPct={0}
            />
            <MetricCard
              icon={Users}
              label="Πελάτες χρήστες"
              value={customersTotal}
              hint={`${usersTotal} accounts συνολικά`}
              href="/admin/users"
              accent="red"
            />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              icon={Layers}
              label="Ενεργά πακέτα"
              value={plansActive}
              href="/admin/plans"
              accent="blue"
            />
            <MetricCard
              icon={Truck}
              label="Οχήματα στόλου"
              value={vehiclesTotal}
              hint="συνολικά"
              href="/admin/vehicles"
              accent="emerald"
            />
            <MetricCard
              icon={ShieldCheck}
              label="Υπάλληλοι"
              value={employeesCount}
              hint="EMPLOYEE + SUPERADMIN"
              href="/admin/employees"
              accent="amber"
            />
            <MetricCard
              icon={CreditCard}
              label="Εκκρεμείς scan fees"
              value={pendingScanFees}
              hint="προς πληρωμή / waive"
              href="/admin/payments"
              accent="red"
            />
          </div>
        </section>

        {/* 2-col activity */}
        <section className="mt-10 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          {/* Recent tenants */}
          <div>
            <header className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-bold text-foreground">
                  Νέοι πελάτες
                </h2>
                <p className="text-xs text-muted-foreground">
                  Πρόσφατα ενταγμένες μεταφορικές.
                </p>
              </div>
              <Link
                href="/admin/tenants"
                className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--color-brand-blue)] hover:text-[var(--color-brand-blue-deep)]"
              >
                Όλοι
                <ArrowUpRight className="size-4" />
              </Link>
            </header>

            {recentTenants.length === 0 ? (
              <EmptyTenantsCard />
            ) : (
              <ul className="flex flex-col gap-2">
                {recentTenants.map((t) => (
                  <li key={t.id}>
                    <Link
                      href={`/admin/tenants/${t.id}`}
                      className="group grid items-center gap-3 rounded-2xl border border-border bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-0.5 hover:border-[var(--color-brand-blue)]/30 hover:shadow-[0_10px_30px_rgba(15,23,42,0.08)] sm:grid-cols-[auto_1fr_auto_auto]"
                    >
                      {t.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={t.logoUrl}
                          alt={t.legalName}
                          className="size-12 rounded-xl border border-border bg-white object-contain p-1"
                        />
                      ) : (
                        <span className="grid size-12 place-items-center rounded-xl bg-gradient-to-br from-[var(--color-brand-blue-light)] to-white text-[var(--color-brand-blue-deep)] ring-1 ring-border">
                          <Building2 className="size-5" />
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-display text-sm font-bold text-foreground">
                          {t.commercialName ?? t.legalName}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          ΑΦΜ {t.vat} · {t._count.branches} branches ·{" "}
                          {t._count.vehicles} οχήματα
                        </p>
                      </div>
                      {t.subscriptions[0] ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200">
                          {t.subscriptions[0].plan.name}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-[10px] font-bold text-muted-foreground ring-1 ring-border">
                          <PauseCircle className="size-3" />
                          Χωρίς πλάνο
                        </span>
                      )}
                      <ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Activity feed */}
          <div>
            <header className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-bold text-foreground">
                  Δραστηριότητα
                </h2>
                <p className="text-xs text-muted-foreground">
                  Τελευταία αιτήματα + scan χρεώσεις.
                </p>
              </div>
            </header>

            <ul className="flex flex-col gap-2">
              {recentRequests.length === 0 && recentScanFees.length === 0 && (
                <li className="rounded-2xl border border-dashed border-border bg-white p-6 text-center text-xs text-muted-foreground">
                  Καμία πρόσφατη δραστηριότητα.
                </li>
              )}
              {recentRequests.slice(0, 4).map((r) => (
                <li
                  key={`r-${r.id}`}
                  className="flex items-start gap-3 rounded-xl border border-border bg-white p-3"
                >
                  <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-[var(--color-brand-blue-light)] text-[var(--color-brand-blue-deep)]">
                    <Truck className="size-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-foreground">
                      Νέο αίτημα από{" "}
                      <span className="font-normal text-muted-foreground">
                        {r.user.name ?? r.user.email}
                      </span>
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {r.fromAddress} → {r.toAddress}
                    </p>
                  </div>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {timeAgo(r.createdAt)}
                  </span>
                </li>
              ))}
              {recentScanFees.slice(0, 3).map((f) => (
                <li
                  key={`f-${f.id}`}
                  className="flex items-start gap-3 rounded-xl border border-border bg-white p-3"
                >
                  <span
                    className={cn(
                      "mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg",
                      f.status === "PAID"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-amber-50 text-amber-700",
                    )}
                  >
                    <CreditCard className="size-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-foreground">
                      Scan fee {(f.amountCents / 100).toFixed(2)}€{" "}
                      <span className="font-normal text-muted-foreground">
                        — {f.user.name ?? f.user.email}
                      </span>
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {f.status}
                      {f.documentType && ` · ${f.documentType === "INVOICE" ? "Τιμολόγιο" : "Απόδειξη"}`}
                    </p>
                  </div>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {timeAgo(f.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </>
  );
}

function EmptyTenantsCard() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-white p-10 text-center">
      <div className="mx-auto grid size-12 place-items-center rounded-xl bg-[var(--color-brand-blue-light)] text-[var(--color-brand-blue-deep)]">
        <Building2 className="size-6" />
      </div>
      <p className="mt-3 text-sm font-semibold text-foreground">
        Κανένας πελάτης ακόμα
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Πρόσθεσε τον πρώτο σου πελάτη με αυτόματη συμπλήρωση από ΑΑΔΕ.
      </p>
      <Link
        href="/admin/tenants/new"
        className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-lg bg-[var(--color-brand-blue)] px-5 text-sm font-bold text-white shadow-[var(--shadow-cta)] hover:bg-[var(--color-brand-blue-deep)]"
      >
        Νέος πελάτης →
      </Link>
    </div>
  );
}

function timeAgo(d: Date): string {
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "τώρα";
  if (mins < 60) return `${mins}λ`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}ω`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}ημ`;
  return new Intl.DateTimeFormat("el-GR", { day: "2-digit", month: "short" }).format(d);
}
