import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  MapPin,
  PackageOpen,
  Repeat,
  Truck,
} from "lucide-react";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";
import { PageHero } from "@/components/shared/page-hero";
import { EmptyState } from "@/components/dashboard/empty-state";

export const metadata = { title: "Τα αιτήματά μου" };
export const dynamic = "force-dynamic";

const STATUS_TABS = [
  { key: "all", label: "Όλα" },
  { key: "PUBLISHED", label: "Σε αναμονή" },
  { key: "AWARDED", label: "Ανατέθηκε" },
  { key: "COMPLETED", label: "Ολοκληρωμένα" },
  { key: "CANCELLED", label: "Ακυρωμένα" },
] as const;

interface PageProps {
  searchParams: Promise<{ status?: string }>;
}

export default async function RequestsPage({ searchParams }: PageProps) {
  const session = await auth();
  const userId = session!.user.id;
  const params = await searchParams;
  const filter = params.status ?? "all";

  const where =
    filter === "all"
      ? { userId }
      : { userId, status: filter as "PUBLISHED" | "AWARDED" | "COMPLETED" | "CANCELLED" | "DRAFT" };

  const requests = await db.moveRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { offers: { where: { status: "OPEN" } } } },
    },
  });

  const counts = await db.moveRequest.groupBy({
    by: ["status"],
    where: { userId },
    _count: { status: true },
  });
  const countByStatus = Object.fromEntries(
    counts.map((c) => [c.status, c._count.status]),
  ) as Record<string, number>;
  const totalAll = Object.values(countByStatus).reduce((a, b) => a + b, 0);

  return (
    <>
      <PageHero
        eyebrow="My Activity"
        title="Τα αιτήματά μου"
        description="Όλες οι μεταφορές που έχεις δημιουργήσει — από εκείνες σε αναμονή προσφορών μέχρι αυτές που ολοκληρώθηκαν."
        crumbs={[
          { href: "/dashboard", label: "Επισκόπηση" },
          { label: "Τα αιτήματά μου" },
        ]}
        kpis={[
          { label: "Σύνολο", value: totalAll },
          { label: "Σε αναμονή", value: countByStatus.PUBLISHED ?? 0, deltaTone: "neutral" },
          { label: "Ολοκληρωμένα", value: countByStatus.COMPLETED ?? 0, deltaTone: "positive" },
          { label: "Ακυρωμένα", value: countByStatus.CANCELLED ?? 0, deltaTone: "neutral" },
        ]}
        action={
          <Link
            href="/scan"
            className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-gradient-to-r from-[var(--color-brand-blue)] to-[#3B82F6] px-5 text-sm font-bold text-white shadow-[0_6px_20px_rgba(37,99,235,0.25)] hover:from-[var(--color-brand-blue-deep)] hover:to-[var(--color-brand-blue)]"
          >
            Νέο αίτημα
          </Link>
        }
      />

      <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {/* Status tabs */}
        <div className="relative mb-5">
          <div className="-mx-4 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:rounded-xl sm:border sm:border-border sm:bg-card sm:p-1 sm:px-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {STATUS_TABS.map((t) => {
              const active = filter === t.key;
              const count = t.key === "all" ? totalAll : countByStatus[t.key] ?? 0;
              return (
                <Link
                  key={t.key}
                  href={t.key === "all" ? "/dashboard/requests" : `/dashboard/requests?status=${t.key}`}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors sm:rounded-lg sm:border-0",
                    active
                      ? "border-transparent bg-[var(--color-brand-blue)] text-white shadow-sm"
                      : "border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground",
                  )}
                >
                  {t.label}
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-[10px] font-bold",
                      active
                        ? "bg-white/20 text-white"
                        : "bg-secondary text-muted-foreground",
                    )}
                  >
                    {count}
                  </span>
                </Link>
              );
            })}
          </div>
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent sm:hidden"
          />
        </div>

        {requests.length === 0 ? (
          <EmptyState
            icon={Truck}
            title={
              filter === "all"
                ? "Κανένα αίτημα ακόμα"
                : "Κανένα αίτημα σε αυτή την κατάσταση"
            }
            description="Δημιούργησε το πρώτο σου αίτημα μεταφοράς και λάβε προσφορές από επαληθευμένους μεταφορείς."
            cta={{ label: "Νέο αίτημα μεταφοράς", href: "/scan" }}
          />
        ) : (
          <ul className="grid gap-3">
            {requests.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/dashboard/requests/${r.id}`}
                  className="group grid items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:border-[var(--color-brand-blue)]/30 hover:shadow-[var(--shadow-pop)] sm:gap-4 sm:p-5 sm:grid-cols-[1.5fr_1fr_1fr_auto]"
                >
                  <div className="flex items-start gap-3">
                    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--color-brand-blue-light)] text-[var(--color-brand-blue-deep)]">
                      <Truck className="size-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-bold text-foreground">
                        <MapPin className="size-3.5 text-[var(--color-brand-blue)]" />
                        <span className="truncate">{r.fromAddress}</span>
                      </p>
                      <p className="mt-0.5 flex items-center gap-2 text-sm font-bold text-foreground">
                        <MapPin className="size-3.5 text-[var(--color-brand-red)]" />
                        <span className="truncate">{r.toAddress}</span>
                      </p>
                      <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="font-mono uppercase">#{r.id.slice(-8)}</span>
                        {r.multiStop && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                            <Repeat className="size-2.5" />
                            Πολλαπλά σημεία
                          </span>
                        )}
                        {r.shared && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                            Shared Load
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground sm:flex-col sm:items-start sm:gap-1">
                    <span className="inline-flex items-center gap-1.5">
                      <PackageOpen className="size-3.5" />
                      {r.itemsCount} αντικείμενα ·{" "}
                      <span className="font-semibold text-foreground">
                        {r.totalVolumeM3.toFixed(2)} m³
                      </span>
                    </span>
                    {r.preferredDate && (
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarClock className="size-3.5" />
                        {formatDate(r.preferredDate)}
                        {r.flexDays > 0 && ` (±${r.flexDays} ημ)`}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2 sm:block sm:text-xs">
                    {r._count.offers > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-brand-blue-light)] px-2.5 py-1 text-xs font-bold text-[var(--color-brand-blue-deep)]">
                        {r._count.offers} προσφορές
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Καμία προσφορά ακόμα
                      </span>
                    )}
                    <div className="flex items-center gap-2 sm:hidden">
                      <StatusBadge status={r.status} offersCount={r._count.offers} />
                      <ArrowRight className="size-4 text-muted-foreground" />
                    </div>
                  </div>
                  <div className="hidden items-center justify-end gap-3 sm:flex">
                    <StatusBadge status={r.status} offersCount={r._count.offers} />
                    <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
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
            label: "Σε αναμονή",
            cls: "bg-[var(--color-brand-blue-light)] text-[var(--color-brand-blue-deep)]",
          },
    AWARDED: { label: "Ανατέθηκε", cls: "bg-amber-50 text-amber-700" },
    COMPLETED: { label: "Ολοκληρώθηκε", cls: "bg-emerald-50 text-emerald-700" },
    CANCELLED: { label: "Ακυρώθηκε", cls: "bg-red-50 text-red-700" },
  };
  const entry = map[status] ?? { label: status, cls: "bg-secondary text-foreground" };
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide",
        entry.cls,
      )}
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
