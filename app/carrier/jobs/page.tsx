import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  MapPin,
  PackageOpen,
  Truck,
} from "lucide-react";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";
import { PageHero } from "@/components/shared/page-hero";
import { EmptyState } from "@/components/dashboard/empty-state";
import { StatusPill } from "@/components/carrier/status-pill";
import { JobDeleteButton } from "@/components/carrier/job-delete-button";
import { TestCleanupButton } from "@/components/carrier/test-cleanup-button";

export const metadata = { title: "Μεταφορές" };
export const dynamic = "force-dynamic";

type Tab = "upcoming" | "in_progress" | "completed" | "all";

interface PageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function CarrierJobsPage({ searchParams }: PageProps) {
  const session = await auth();
  const userId = session!.user.id;
  const params = await searchParams;
  const tab: Tab = (params.tab as Tab) ?? "upcoming";

  const jobs = await db.moveRequest.findMany({
    where: {
      status: { in: ["AWARDED", "COMPLETED"] },
      offers: { some: { carrierUserId: userId, status: "ACCEPTED" } },
    },
    orderBy: [{ preferredDate: "asc" }, { createdAt: "desc" }],
    include: {
      offers: {
        where: { carrierUserId: userId, status: "ACCEPTED" },
        select: { priceCents: true },
        take: 1,
      },
      user: { select: { name: true, email: true, phone: true } },
    },
  });

  const now = new Date();
  const buckets = {
    upcoming: jobs.filter(
      (j) =>
        j.status === "AWARDED" &&
        (!j.preferredDate || j.preferredDate >= now),
    ),
    in_progress: jobs.filter(
      (j) =>
        j.status === "AWARDED" && j.preferredDate && j.preferredDate < now,
    ),
    completed: jobs.filter((j) => j.status === "COMPLETED"),
  };

  const visible =
    tab === "all" ? jobs : (buckets[tab as keyof typeof buckets] ?? jobs);

  const totalRevenueCents = jobs.reduce(
    (s, j) => s + (j.offers[0]?.priceCents ?? 0),
    0,
  );

  return (
    <>
      <PageHero
        eyebrow="Operations"
        title="Μεταφορές"
        description="Όλες οι ανατεθείσες μεταφορές σου — επερχόμενες, σε εξέλιξη και ολοκληρωμένες."
        crumbs={[{ href: "/carrier", label: "Επισκόπηση" }, { label: "Μεταφορές" }]}
        tone="emerald"
        kpis={[
          { label: "Σύνολο", value: jobs.length },
          { label: "Επερχόμενες", value: buckets.upcoming.length },
          { label: "Σε εξέλιξη", value: buckets.in_progress.length, deltaTone: buckets.in_progress.length > 0 ? "neutral" : "positive" },
          {
            label: "Έσοδα ανατεθειμένων",
            value: `${(totalRevenueCents / 100).toFixed(0)}€`,
          },
        ]}
      />

      <div className="mx-auto w-full max-w-[1440px] px-4 py-4 sm:px-5">
        <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
          <TestCleanupButton />
        </div>
        {/* Tabs */}
        <div className="relative mb-5">
          <div className="-mx-4 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:rounded-xl sm:border sm:border-border sm:bg-card sm:p-1 sm:px-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <TabLink current={tab} value="upcoming" count={buckets.upcoming.length}>
              Επερχόμενες
            </TabLink>
            <TabLink current={tab} value="in_progress" count={buckets.in_progress.length}>
              Σε εξέλιξη
            </TabLink>
            <TabLink current={tab} value="completed" count={buckets.completed.length}>
              Ολοκληρωμένες
            </TabLink>
            <TabLink current={tab} value="all" count={jobs.length}>
              Όλες
            </TabLink>
          </div>
        </div>

        {visible.length === 0 ? (
          <EmptyState
            icon={Truck}
            title={
              tab === "upcoming"
                ? "Καμία επερχόμενη μεταφορά"
                : tab === "in_progress"
                  ? "Καμία μεταφορά σε εξέλιξη"
                  : tab === "completed"
                    ? "Καμία ολοκληρωμένη μεταφορά ακόμη"
                    : "Καμία μεταφορά"
            }
            description="Όταν μια προσφορά γίνει αποδεκτή, η μεταφορά εμφανίζεται εδώ. Από εδώ μπορείς να αναθέσεις οδηγό και να παρακολουθήσεις την πορεία της."
            cta={{ label: "Δες αιτήματα", href: "/carrier/leads" }}
          />
        ) : (
          <ul className="grid gap-3">
            {visible.map((j) => (
              <li key={j.id}>
                <JobCard
                  job={{
                    id: j.id,
                    fromAddress: j.fromAddress,
                    toAddress: j.toAddress,
                    status: j.status,
                    preferredDate: j.preferredDate,
                    flexDays: j.flexDays,
                    itemsCount: j.itemsCount,
                    totalVolumeM3: j.totalVolumeM3,
                    priceCents: j.offers[0]?.priceCents ?? 0,
                    customer: {
                      name: j.user.name,
                      email: j.user.email,
                      phone: j.user.phone,
                    },
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function TabLink({
  current,
  value,
  count,
  children,
}: {
  current: string;
  value: string;
  count: number;
  children: React.ReactNode;
}) {
  const active = current === value;
  return (
    <Link
      href={`/carrier/jobs?tab=${value}`}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors sm:rounded-lg sm:border-0",
        active
          ? "border-transparent bg-[var(--color-brand-blue)] text-white shadow-sm"
          : "border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground",
      )}
    >
      {children}
      <span
        className={cn(
          "rounded-full px-1.5 text-[10px] font-bold tabular-nums",
          active ? "bg-white/20 text-white" : "bg-secondary text-muted-foreground",
        )}
      >
        {count}
      </span>
    </Link>
  );
}

interface Job {
  id: string;
  fromAddress: string;
  toAddress: string;
  status: string;
  preferredDate: Date | null;
  flexDays: number;
  itemsCount: number;
  totalVolumeM3: number;
  priceCents: number;
  customer: {
    name: string | null;
    email: string | null;
    phone: string | null;
  };
}

function JobCard({ job }: { job: Job }) {
  const now = new Date();
  const inProgress = !!(
    job.preferredDate && job.preferredDate < now && job.status === "AWARDED"
  );
  const stage = inProgress ? "IN_TRANSIT" : job.status;

  return (
    <div className="group relative">
      <div className="absolute right-3 top-3 z-10">
        <JobDeleteButton
          moveRequestId={job.id}
          routeLabel={`${job.fromAddress} → ${job.toAddress}`}
        />
      </div>
      <Link
        href={`/carrier/leads/${job.id}`}
        className="grid gap-3 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:border-[var(--color-brand-blue)]/30 hover:shadow-[var(--shadow-pop)] sm:grid-cols-[1.5fr_1fr_auto] sm:gap-4 sm:p-5"
      >
      {/* Route */}
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--color-brand-blue-light)] text-[var(--color-brand-blue-deep)]">
          <Truck className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-bold text-foreground">
            <MapPin className="size-3.5 text-[var(--color-brand-blue)]" />
            <span className="truncate">{job.fromAddress}</span>
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm font-bold text-foreground">
            <MapPin className="size-3.5 text-[var(--color-brand-red)]" />
            <span className="truncate">{job.toAddress}</span>
          </p>
          <p className="mt-1 font-mono text-[10px] uppercase text-muted-foreground">
            #{job.id.slice(-8)}
          </p>
        </div>
      </div>

      {/* Details */}
      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
        {job.preferredDate && (
          <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
            <CalendarDays className="size-3.5" />
            {formatDateLong(job.preferredDate)}
            {job.flexDays > 0 && ` (±${job.flexDays} ημ)`}
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <PackageOpen className="size-3.5" />
          {job.itemsCount} τεμ · {job.totalVolumeM3.toFixed(1)} m³
        </span>
        {job.customer.name && (
          <span className="truncate text-[11px]">
            Πελάτης: {job.customer.name}
          </span>
        )}
      </div>

      {/* Status + price */}
      <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end sm:justify-start sm:gap-2 sm:pr-10">
        <StatusPill status={stage} />
        <p className="font-display text-xl font-bold tabular-nums text-foreground">
          {(job.priceCents / 100).toFixed(0)}€
        </p>
      </div>
      </Link>
    </div>
  );
}

function formatDateLong(d: Date): string {
  return new Intl.DateTimeFormat("el-GR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "2-digit",
  }).format(d);
}
