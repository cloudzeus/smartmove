import Link from "next/link";
import { FolderOpen } from "lucide-react";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHero } from "@/components/shared/page-hero";
import { EmptyState } from "@/components/dashboard/empty-state";

export const metadata = { title: "Projects" };
export const dynamic = "force-dynamic";

type Tab = "active" | "completed" | "all";

interface PageProps {
  searchParams: Promise<{ tab?: string }>;
}

const STATUS_DOT: Record<string, { dot: string; label: string; tint: string }> = {
  DRAFT:       { dot: "bg-muted-foreground/60", label: "Προσχέδιο",      tint: "bg-muted/50" },
  PLANNED:     { dot: "bg-sky-500",             label: "Προγραμματισμένο", tint: "bg-sky-50/40" },
  IN_PROGRESS: { dot: "bg-amber-500",           label: "Σε εξέλιξη",      tint: "bg-amber-50/40" },
  COMPLETED:   { dot: "bg-emerald-500",         label: "Ολοκληρώθηκε",    tint: "bg-emerald-50/40" },
  CANCELLED:   { dot: "bg-rose-500",            label: "Ακυρώθηκε",       tint: "bg-rose-50/40" },
};

export default async function CarrierProjectsPage({ searchParams }: PageProps) {
  const session = await auth();
  const userId = session!.user.id;
  const params = await searchParams;
  const tab: Tab = (params.tab as Tab) ?? "active";

  const membership = await db.tenantMembership.findFirst({
    where: { userId },
    select: { tenantId: true },
    orderBy: { createdAt: "asc" },
  });
  if (!membership) {
    return (
      <EmptyState
        icon={FolderOpen}
        title="Δεν είσαι μέλος εταιρείας."
        description=""
      />
    );
  }

  const projects = await db.carrierProject.findMany({
    where: { tenantId: membership.tenantId },
    orderBy: [{ scheduledStart: "desc" }],
    include: {
      moveRequest: {
        select: {
          fromAddress: true,
          toAddress: true,
          user: { select: { name: true, email: true } },
        },
      },
      stops: { select: { id: true } },
      _count: { select: { stops: true } },
    },
  });

  const tasksByProject = await db.jobTask.groupBy({
    by: ["projectStopServiceId"],
    where: {
      tenantId: membership.tenantId,
      projectStopServiceId: { not: null },
    },
    _count: true,
  });
  // We grouped by service; collapse to project counts via a second lookup.
  const serviceToProject = new Map<string, string>();
  const allServices = await db.projectStopService.findMany({
    where: { projectStop: { project: { tenantId: membership.tenantId } } },
    select: { id: true, projectStop: { select: { projectId: true } } },
  });
  for (const s of allServices) {
    serviceToProject.set(s.id, s.projectStop.projectId);
  }
  const taskCountByProject = new Map<string, number>();
  for (const row of tasksByProject) {
    if (!row.projectStopServiceId) continue;
    const pid = serviceToProject.get(row.projectStopServiceId);
    if (!pid) continue;
    taskCountByProject.set(pid, (taskCountByProject.get(pid) ?? 0) + row._count);
  }

  const buckets = {
    active: projects.filter(
      (p) => p.status === "PLANNED" || p.status === "IN_PROGRESS",
    ),
    completed: projects.filter((p) => p.status === "COMPLETED"),
  };
  const visible =
    tab === "all"
      ? projects
      : (buckets[tab as keyof typeof buckets] ?? projects);

  const totalRevenue = projects
    .filter((p) => p.status !== "CANCELLED")
    .reduce((s, p) => s + p.totalPriceCents, 0);

  return (
    <>
      <PageHero
        eyebrow="Operations"
        title="Projects"
        description="Κάθε αποδεκτή μεταφορά γίνεται project. Διαχείριση υπηρεσιών ανά στάση, αναθέσεις και reporting."
        crumbs={[{ href: "/carrier", label: "Επισκόπηση" }, { label: "Projects" }]}
        tone="blue"
        kpis={[
          { label: "Σύνολο", value: String(projects.length) },
          { label: "Ενεργά", value: String(buckets.active.length) },
          { label: "Ολοκληρωμένα", value: String(buckets.completed.length) },
          {
            label: "Έσοδα",
            value: `${(totalRevenue / 100).toLocaleString("el-GR")}€`,
          },
        ]}
      />

      <div className="mx-auto w-full max-w-[1440px] px-4 py-3 sm:px-5">
        {/* Filter chips */}
        <div className="cx-card mb-2.5 flex flex-wrap items-center gap-1 p-2">
          <TabLink href="/carrier/projects?tab=active" active={tab === "active"}>
            Ενεργά · {buckets.active.length}
          </TabLink>
          <TabLink href="/carrier/projects?tab=completed" active={tab === "completed"}>
            Ολοκληρωμένα · {buckets.completed.length}
          </TabLink>
          <TabLink href="/carrier/projects?tab=all" active={tab === "all"}>
            Όλα · {projects.length}
          </TabLink>
        </div>

        {visible.length === 0 ? (
          <div className="cx-card border-dashed bg-muted/30 px-4 py-8 text-center">
            <p className="text-[12px] font-semibold text-foreground">Δεν υπάρχουν projects</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Όταν αποδεχτεί ο πελάτης μια προσφορά σου, θα δημιουργηθεί αυτόματα project.
            </p>
          </div>
        ) : (
          <ul className="cx-card divide-y divide-[var(--cx-divider)] overflow-hidden">
            {visible.map((p) => {
              const status = STATUS_DOT[p.status] ?? STATUS_DOT.PLANNED;
              const taskCount = taskCountByProject.get(p.id) ?? 0;
              return (
                <li key={p.id}>
                  <Link
                    href={`/carrier/projects/${p.id}`}
                    className={`relative grid items-center gap-3 overflow-hidden px-3 py-2 cx-transition hover:bg-[var(--cx-hover)] active:bg-[var(--cx-accent-soft)] sm:grid-cols-[auto_140px_1fr_auto_auto_auto] sm:gap-4 ${status.tint}`}
                  >
                    <span aria-hidden className={`absolute left-0 top-0 h-full w-0.5 ${status.dot}`} />

                    {/* Status dot + code */}
                    <div className="flex items-center gap-2">
                      <span aria-hidden className={`cx-dot ${status.dot}`} />
                      <span className="font-mono text-[12px] font-semibold tabular-nums text-foreground">
                        {p.code}
                      </span>
                    </div>

                    {/* Customer */}
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-semibold">
                        {p.moveRequest.user.name ?? p.moveRequest.user.email}
                      </p>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        {status.label}
                      </p>
                    </div>

                    {/* Route */}
                    <div className="min-w-0">
                      <p className="truncate text-[11px] text-foreground">
                        {p.moveRequest.fromAddress} → {p.moveRequest.toAddress}
                      </p>
                      <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                        {p.scheduledStart.toLocaleString("el-GR", {
                          weekday: "short", day: "2-digit", month: "short",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </p>
                    </div>

                    {/* Stops · tasks */}
                    <div className="hidden text-right text-[10px] text-muted-foreground sm:block">
                      <p>στάσεις · εργασίες</p>
                      <p className="text-[11px] font-semibold tabular-nums text-foreground">
                        {p._count.stops} · {taskCount}
                      </p>
                    </div>

                    {/* Price */}
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Αξία
                      </p>
                      <p className="font-mono text-[12px] font-semibold tabular-nums text-emerald-700">
                        {(p.totalPriceCents / 100).toLocaleString("el-GR")}€
                      </p>
                    </div>

                    {/* Arrow */}
                    <span className="hidden shrink-0 text-[11px] font-medium text-muted-foreground cx-transition group-hover:text-foreground sm:inline">
                      →
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

function TabLink({
  href, active, children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[11px] font-semibold cx-transition cx-press ${
        active
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:bg-[var(--cx-hover)] hover:text-foreground active:bg-[var(--cx-accent-soft)]"
      }`}
    >
      {children}
    </Link>
  );
}
