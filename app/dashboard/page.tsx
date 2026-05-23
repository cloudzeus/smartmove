import Link from "next/link";
import {
  ArrowRight,
  CreditCard,
  MapPin,
  PackageOpen,
  Receipt,
  Sparkles,
  Star,
  Truck,
} from "lucide-react";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHero } from "@/components/shared/page-hero";
import { MetricCard } from "@/components/shared/metric-card";
import { PhoneRequiredBanner } from "@/components/dashboard/phone-required-banner";
import { EmptyState } from "@/components/dashboard/empty-state";
import { RetentionBanner } from "@/components/dashboard/retention-banner";
import { ensureRetentionInitialized } from "@/server/actions/retention.action";
import { getSystemSettings } from "@/server/actions/settings.action";

export const metadata = { title: "Επισκόπηση" };
export const dynamic = "force-dynamic";

const RETENTION_WARN_DAYS = 30;

export default async function DashboardOverview() {
  const session = await auth();
  const userId = session!.user.id;
  await ensureRetentionInitialized(userId);

  const [
    requestsCount,
    openRequests,
    locationsCount,
    itemsCount,
    totalVolumeAgg,
    recentRequests,
    userMeta,
    settings,
  ] = await Promise.all([
      db.moveRequest.count({ where: { userId } }),
      db.moveRequest.count({
        where: { userId, status: { in: ["PUBLISHED", "AWARDED"] } },
      }),
      db.savedLocation.count({ where: { userId, deletedAt: null } }),
      db.savedItem.count({ where: { userId, deletedAt: null } }),
      db.savedItem.aggregate({
        where: { userId, deletedAt: null },
        _sum: { volume_m3: true, quantity: true },
      }),
      db.moveRequest.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 4,
        select: {
          id: true,
          fromAddress: true,
          toAddress: true,
          status: true,
          totalVolumeM3: true,
          itemsCount: true,
          createdAt: true,
          _count: { select: { offers: { where: { status: "OPEN" } } } },
        },
      }),
      db.user.findUnique({
        where: { id: userId },
        select: {
          dataRetentionUntil: true,
          retentionExtendedUntil: true,
          phone: true,
        },
      }),
      getSystemSettings(),
    ]);

  const effectiveRetention =
    userMeta?.retentionExtendedUntil ?? userMeta?.dataRetentionUntil ?? null;
  const retentionDaysLeft = effectiveRetention
    ? Math.ceil((effectiveRetention.getTime() - Date.now()) / 86_400_000)
    : settings.retentionFreeMonths * 30;
  const showRetentionBanner = retentionDaysLeft <= RETENTION_WARN_DAYS;
  // Count only digits — strings like "+30 6900000000" should not be flagged
  // as missing just because of formatting/whitespace.
  const phoneDigits = (userMeta?.phone ?? "").replace(/\D+/g, "");
  const phoneMissing = phoneDigits.length < 8;

  const totalSavedVolume = totalVolumeAgg._sum.volume_m3 ?? 0;
  const firstName = (session!.user.name ?? session!.user.email ?? "").split(/[\s@]/)[0];

  return (
    <>
      <PageHero
        eyebrow="My Dashboard"
        title={`Καλώς ήρθες${firstName ? `, ${firstName}` : ""}`}
        description="Όλη η εικόνα του λογαριασμού σου με μια ματιά — αιτήματα μεταφοράς, έπιπλά σου, διευθύνσεις και πρόσφατη δραστηριότητα."
        action={
          <Link
            href="/scan"
            className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-gradient-to-r from-[var(--color-brand-blue)] to-[#3B82F6] px-5 text-sm font-bold text-white shadow-[0_6px_20px_rgba(37,99,235,0.25)] hover:from-[var(--color-brand-blue-deep)] hover:to-[var(--color-brand-blue)]"
          >
            <Sparkles className="size-4" />
            Νέο αίτημα
          </Link>
        }
        kpis={[
          { label: "Αιτήματα", value: requestsCount, delta: openRequests > 0 ? `${openRequests} ανοιχτά` : "—", deltaTone: "positive" },
          { label: "Όγκος (m³)", value: totalSavedVolume.toFixed(1) },
          { label: "Διευθύνσεις", value: locationsCount },
          { label: "Έπιπλα", value: itemsCount },
        ]}
      />

      <div className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
        {phoneMissing && (
          <div className="mb-4">
            <PhoneRequiredBanner initialPhone={userMeta?.phone ?? ""} />
          </div>
        )}
        {showRetentionBanner && (
          <div className="mb-6">
            <RetentionBanner
              daysLeft={retentionDaysLeft}
              expiresAt={effectiveRetention}
              monthlyPriceEur={settings.retentionExtensionMonthlyCents / 100}
              yearlyPriceEur={settings.retentionExtensionYearlyCents / 100}
            />
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <MetricCard
            icon={Truck}
            label="Αιτήματα μεταφοράς"
            value={requestsCount}
            hint={`${openRequests} σε εκκρεμότητα`}
            href="/dashboard/requests"
            accent="blue"
            sparkline={[0, 1, 1, 2, 2, 3, Math.max(1, requestsCount)]}
          />
          <MetricCard
            icon={PackageOpen}
            label="Έπιπλα στη λίστα"
            value={itemsCount}
            hint={`${totalSavedVolume.toFixed(2)} m³ συνολικά`}
            href="/dashboard/inventory"
            accent="emerald"
          />
          <MetricCard
            icon={MapPin}
            label="Διευθύνσεις"
            value={locationsCount}
            hint="Σπίτι, γραφείο, αποθήκη"
            href="/dashboard/locations"
            accent="amber"
          />
          <MetricCard
            icon={Receipt}
            label="Προσφορές"
            value={0}
            hint="Περιμένουμε τις πρώτες"
            href="/dashboard/offers"
            accent="red"
          />
        </div>

        {/* Recent requests + quick actions */}
        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between gap-3 pb-3">
              <h2 className="font-display text-lg font-bold text-foreground">
                Πρόσφατα αιτήματα
              </h2>
              <Link
                href="/dashboard/requests"
                className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--color-brand-blue)] hover:text-[var(--color-brand-blue-deep)]"
              >
                Όλα
                <ArrowRight className="size-4" />
              </Link>
            </div>

            {recentRequests.length === 0 ? (
              <EmptyState
                icon={Truck}
                title="Δεν έχεις δημιουργήσει αίτημα ακόμα"
                description="Φτιάξε το πρώτο σου αίτημα μεταφοράς δωρεάν και λάβε προσφορές μέσα σε 1 ώρα."
                cta={{ label: "Νέο αίτημα μεταφοράς", href: "/scan" }}
              />
            ) : (
              <ul className="flex flex-col gap-2">
                {recentRequests.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/dashboard/requests/${r.id}`}
                      className="group flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-[var(--color-brand-blue)]/30 hover:shadow-[var(--shadow-pop)]"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--color-brand-blue-light)] text-[var(--color-brand-blue-deep)]">
                          <Truck className="size-5" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {r.fromAddress} → {r.toAddress}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {r.itemsCount} αντικείμενα · {r.totalVolumeM3.toFixed(2)} m³ ·{" "}
                            {formatDate(r.createdAt)}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {r._count.offers > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-brand-blue-light)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--color-brand-blue-deep)]">
                            {r._count.offers}{" "}
                            {r._count.offers === 1 ? "προσφορά" : "προσφορές"}
                          </span>
                        )}
                        <StatusBadge
                          status={r.status}
                          offersCount={r._count.offers}
                        />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <aside className="flex flex-col gap-3">
            <h2 className="font-display text-lg font-bold text-foreground">
              Γρήγορες ενέργειες
            </h2>
            <QuickAction
              icon={MapPin}
              title="Πρόσθεσε διεύθυνση"
              desc="Σπίτι, γραφείο, εξοχικό"
              href="/dashboard/locations"
            />
            <QuickAction
              icon={PackageOpen}
              title="Πρόσθεσε έπιπλα"
              desc="Κράτησε λίστα από έπιπλα"
              href="/dashboard/inventory"
            />
            <QuickAction
              icon={Star}
              title="Αξιολόγηση μεταφορών"
              desc="Όταν ολοκληρωθούν"
              href="/dashboard/reviews"
            />
            <QuickAction
              icon={CreditCard}
              title="Ιστορικό πληρωμών"
              desc="Όλες οι συναλλαγές"
              href="/dashboard/payments"
            />
          </aside>
        </div>
      </div>
    </>
  );
}

function QuickAction({
  icon: Icon,
  title,
  desc,
  href,
}: {
  icon: typeof Truck;
  title: string;
  desc: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-xl border border-border bg-card p-3.5 transition-all hover:-translate-y-0.5 hover:border-[var(--color-brand-blue)]/30 hover:shadow-[var(--shadow-card)]"
    >
      <span className="grid size-9 place-items-center rounded-lg bg-secondary text-[var(--color-brand-blue)]">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function StatusBadge({
  status,
  offersCount = 0,
}: {
  status: string;
  offersCount?: number;
}) {
  const map: Record<string, { label: string; cls: string }> = {
    DRAFT: { label: "Πρόχειρο", cls: "bg-secondary text-muted-foreground" },
    PUBLISHED:
      offersCount > 0
        ? {
            label: "Έχει προσφορές",
            cls: "bg-emerald-50 text-emerald-700",
          }
        : {
            label: "Σε αναμονή προσφορών",
            cls: "bg-[var(--color-brand-blue-light)] text-[var(--color-brand-blue-deep)]",
          },
    AWARDED: { label: "Ανατέθηκε", cls: "bg-amber-50 text-amber-700" },
    COMPLETED: { label: "Ολοκληρώθηκε", cls: "bg-emerald-50 text-emerald-700" },
    CANCELLED: { label: "Ακυρώθηκε", cls: "bg-red-50 text-red-700" },
  };
  const entry = map[status] ?? { label: status, cls: "bg-secondary text-foreground" };
  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${entry.cls}`}
    >
      {entry.label}
    </span>
  );
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("el-GR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}
