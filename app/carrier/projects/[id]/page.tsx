import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CalendarDays, FolderKanban, MapPin } from "lucide-react";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ProjectDetailClient } from "@/components/carrier/project-detail-client";
import { loadProjectHistory } from "@/lib/project-history";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  DRAFT: { label: "Προσχέδιο", tone: "bg-slate-100 text-slate-700" },
  PLANNED: { label: "Προγραμματισμένο", tone: "bg-sky-100 text-sky-800" },
  IN_PROGRESS: { label: "Σε εξέλιξη", tone: "bg-amber-100 text-amber-800" },
  COMPLETED: { label: "Ολοκληρώθηκε", tone: "bg-emerald-100 text-emerald-800" },
  CANCELLED: { label: "Ακυρώθηκε", tone: "bg-rose-100 text-rose-800" },
};

export default async function ProjectDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await auth();
  const userId = session!.user.id;

  const membership = await db.tenantMembership.findFirst({
    where: { userId },
    select: { tenantId: true },
    orderBy: { createdAt: "asc" },
  });
  if (!membership) notFound();

  const project = await db.carrierProject.findFirst({
    where: { id, tenantId: membership.tenantId },
    include: {
      moveRequest: {
        select: {
          id: true,
          fromAddress: true,
          toAddress: true,
          user: { select: { name: true, email: true, phone: true } },
        },
      },
      offer: { select: { id: true, priceCents: true, contractRef: true } },
      stops: {
        orderBy: { sequence: "asc" },
        include: {
          services: {
            orderBy: { serviceType: "asc" },
            include: {
              partner: { select: { id: true, name: true } },
              tasks: {
                orderBy: { startAt: "asc" },
                include: {
                  assigneeEmployee: { select: { id: true, name: true } },
                  assigneePartner: { select: { id: true, name: true } },
                  vehicle: {
                    select: { id: true, plate: true, brand: true, model: true },
                  },
                  blockedBy: {
                    select: {
                      blockerId: true,
                      blocker: { select: { id: true, title: true, status: true } },
                    },
                  },
                  assignments: {
                    select: {
                      id: true, isPrimary: true, role: true,
                      employee: { select: { id: true, name: true } },
                      partner: { select: { id: true, name: true } },
                    },
                  },
                },
              },
              quoteRequests: {
                orderBy: { createdAt: "asc" },
                select: {
                  id: true,
                  status: true,
                  recipientName: true,
                  recipientEmail: true,
                  scheduledStartAt: true,
                  estimatedMinutes: true,
                  quotedPriceCents: true,
                  quotedNotes: true,
                  quotedAt: true,
                  createdAt: true,
                  partner: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!project) notFound();

  const history = await loadProjectHistory(project.id, membership.tenantId);

  const [employees, partners, companies, vehicles] = await Promise.all([
    db.carrierEmployee.findMany({
      where: { tenantId: membership.tenantId, deletedAt: null, active: true },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    }),
    db.carrierPartner.findMany({
      where: { tenantId: membership.tenantId, deletedAt: null },
      select: { id: true, name: true, kind: true },
      orderBy: { name: "asc" },
    }),
    db.partnerCompany.findMany({
      where: { tenantId: membership.tenantId, deletedAt: null },
      select: { id: true, legalName: true, commercialName: true, email: true },
      orderBy: { legalName: "asc" },
    }),
    db.vehicle.findMany({
      where: { tenantId: membership.tenantId, deletedAt: null },
      select: { id: true, plate: true, brand: true, model: true },
      orderBy: { plate: "asc" },
    }),
  ]);

  const status = STATUS_LABEL[project.status] ?? STATUS_LABEL.PLANNED;
  const totalTasks = project.stops.reduce(
    (s, st) => s + st.services.reduce((s2, sv) => s2 + sv.tasks.length, 0),
    0,
  );

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/carrier/projects"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Όλα τα projects
        </Link>
      </div>

      <header className="rounded-2xl border border-border bg-gradient-to-br from-indigo-50 to-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <FolderKanban className="size-4 text-indigo-600" />
              <span className="font-mono text-base font-bold text-foreground">
                {project.code}
              </span>
              <span
                className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${status.tone}`}
              >
                {status.label}
              </span>
            </div>
            <h1 className="mt-2 text-xl font-bold text-foreground">
              {project.moveRequest.user.name ?? project.moveRequest.user.email}
            </h1>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="size-3.5" />
              {project.moveRequest.fromAddress} → {project.moveRequest.toAddress}
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <CalendarDays className="size-3.5" />
              {project.scheduledStart.toLocaleString("el-GR", {
                day: "2-digit",
                month: "long",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-extrabold text-emerald-700">
              {(project.totalPriceCents / 100).toLocaleString("el-GR")}€
            </div>
            <div className="text-xs text-muted-foreground">
              {project.stops.length} στάσεις · {totalTasks} εργασίες
            </div>
            {project.offer.contractRef && (
              <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                {project.offer.contractRef}
              </div>
            )}
          </div>
        </div>
      </header>

      <ProjectDetailClient
        project={{
          id: project.id,
          status: project.status,
          moveRequestId: project.moveRequest.id,
          stops: project.stops.map((s) => ({
            id: s.id,
            sequence: s.sequence,
            type: s.type,
            label: s.label,
            address: s.address,
            services: s.services.map((sv) => ({
              id: sv.id,
              serviceType: sv.serviceType,
              label: sv.label,
              quantity: sv.quantity,
              unitPriceCents: sv.unitPriceCents,
              totalPriceCents: sv.totalPriceCents,
              partner: sv.partner
                ? { id: sv.partner.id, name: sv.partner.name }
                : null,
              quoteRequests: sv.quoteRequests.map((q) => ({
                id: q.id,
                status: q.status,
                recipientName: q.recipientName,
                recipientEmail: q.recipientEmail,
                scheduledStartAt: q.scheduledStartAt?.toISOString() ?? null,
                estimatedMinutes: q.estimatedMinutes,
                quotedPriceCents: q.quotedPriceCents,
                quotedNotes: q.quotedNotes,
                quotedAt: q.quotedAt?.toISOString() ?? null,
                createdAt: q.createdAt.toISOString(),
                partner: q.partner ? { id: q.partner.id, name: q.partner.name } : null,
              })),
              tasks: sv.tasks.map((t) => ({
                id: t.id,
                title: t.title,
                status: t.status,
                startAt: t.startAt.toISOString(),
                durationMinutes: t.durationMinutes,
                assigneeKind: t.assigneeKind,
                assigneeEmployee: t.assigneeEmployee,
                assigneePartner: t.assigneePartner,
                vehicle: t.vehicle,
                assigneeConfirmationStatus: t.assigneeConfirmationStatus,
                assigneeConfirmedAt: t.assigneeConfirmedAt?.toISOString() ?? null,
                assigneeConfirmationSentAt:
                  t.assigneeConfirmationSentAt?.toISOString() ?? null,
                blockerIds: t.blockedBy.map((b) => b.blockerId),
                blockers: t.blockedBy.map((b) => ({
                  id: b.blocker.id,
                  title: b.blocker.title,
                  status: b.blocker.status,
                })),
                assignments: t.assignments.map((a) => ({
                  id: a.id,
                  isPrimary: a.isPrimary,
                  role: a.role,
                  employee: a.employee,
                  partner: a.partner,
                })),
              })),
            })),
          })),
        }}
        employees={employees}
        partners={partners}
        companies={companies.map((c) => ({
          id: c.id,
          name: c.commercialName ?? c.legalName,
          hasEmail: !!c.email,
        }))}
        vehicles={vehicles}
        history={history}
      />
    </div>
  );
}
