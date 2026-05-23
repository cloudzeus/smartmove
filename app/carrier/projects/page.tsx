import Link from "next/link";
import { ArrowRight, CalendarDays, FolderKanban, MapPin, FolderOpen } from "lucide-react";

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

const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  DRAFT: { label: "Προσχέδιο", tone: "bg-slate-100 text-slate-700" },
  PLANNED: { label: "Προγραμματισμένο", tone: "bg-sky-100 text-sky-800" },
  IN_PROGRESS: { label: "Σε εξέλιξη", tone: "bg-amber-100 text-amber-800" },
  COMPLETED: { label: "Ολοκληρώθηκε", tone: "bg-emerald-100 text-emerald-800" },
  CANCELLED: { label: "Ακυρώθηκε", tone: "bg-rose-100 text-rose-800" },
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
          {
            label: "Έσοδα",
            value: `${(totalRevenue / 100).toLocaleString("el-GR")}€`,
          },
        ]}
      />

      <div className="mt-6 flex gap-2 border-b border-border">
        <TabLink href="/carrier/projects?tab=active" active={tab === "active"}>
          Ενεργά ({buckets.active.length})
        </TabLink>
        <TabLink
          href="/carrier/projects?tab=completed"
          active={tab === "completed"}
        >
          Ολοκληρωμένα ({buckets.completed.length})
        </TabLink>
        <TabLink href="/carrier/projects?tab=all" active={tab === "all"}>
          Όλα ({projects.length})
        </TabLink>
      </div>

      {visible.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={FolderKanban}
            title="Δεν υπάρχουν projects"
            description="Όταν αποδεχτεί ο πελάτης μια προσφορά σου, θα δημιουργηθεί αυτόματα project."
          />
        </div>
      ) : (
        <div className="mt-6 grid gap-3">
          {visible.map((p) => {
            const status = STATUS_LABEL[p.status] ?? STATUS_LABEL.PLANNED;
            return (
              <Link
                key={p.id}
                href={`/carrier/projects/${p.id}`}
                className="group grid gap-2 rounded-2xl border border-border bg-card p-4 transition hover:border-[var(--color-brand-blue)] hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <FolderKanban className="size-4 text-muted-foreground" />
                    <span className="font-mono text-sm font-bold text-foreground">
                      {p.code}
                    </span>
                    <span
                      className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${status.tone}`}
                    >
                      {status.label}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-emerald-700">
                    {(p.totalPriceCents / 100).toLocaleString("el-GR")}€
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <MapPin className="size-3.5" />
                  <span className="truncate">
                    {p.moveRequest.fromAddress} → {p.moveRequest.toAddress}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <CalendarDays className="size-3.5" />
                    {p.scheduledStart.toLocaleString("el-GR", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span>{p._count.stops} στάσεις</span>
                  <span>{taskCountByProject.get(p.id) ?? 0} εργασίες</span>
                  <span className="truncate">
                    {p.moveRequest.user.name ?? p.moveRequest.user.email}
                  </span>
                  <span className="ml-auto inline-flex items-center gap-1 text-[var(--color-brand-blue)] opacity-0 transition group-hover:opacity-100">
                    Άνοιγμα <ArrowRight className="size-3.5" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}

function TabLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex h-9 items-center border-b-2 px-3 text-sm font-semibold transition ${
        active
          ? "border-[var(--color-brand-blue)] text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </Link>
  );
}
