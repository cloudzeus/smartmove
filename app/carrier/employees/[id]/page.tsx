import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CalendarClock, Mail, Phone, User } from "lucide-react";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { EmployeeScheduleClient } from "@/components/carrier/employee-schedule-client";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ day?: string }>;
}

export default async function EmployeeSchedulePage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const session = await auth();
  const membership = await db.tenantMembership.findFirst({
    where: { userId: session!.user.id },
    select: { tenantId: true },
    orderBy: { createdAt: "asc" },
  });
  if (!membership) notFound();

  const employee = await db.carrierEmployee.findFirst({
    where: { id, tenantId: membership.tenantId },
    select: {
      id: true, name: true, role: true, phone: true, email: true,
    },
  });
  if (!employee) notFound();

  // Default to today, override via ?day=YYYY-MM-DD.
  const anchor = sp.day ? new Date(sp.day) : new Date();
  anchor.setHours(0, 0, 0, 0);
  const windowStart = new Date(anchor);
  windowStart.setDate(anchor.getDate() - 3);
  const windowEnd = new Date(anchor);
  windowEnd.setDate(anchor.getDate() + 4);

  // All tasks of this employee in a +/- window. Primary OR co-assignee.
  const tasks = await db.jobTask.findMany({
    where: {
      tenantId: membership.tenantId,
      startAt: { gte: windowStart, lt: windowEnd },
      OR: [
        { assigneeEmployeeId: id },
        { assignments: { some: { employeeId: id } } },
      ],
      status: { notIn: ["CANCELLED"] },
    },
    orderBy: { startAt: "asc" },
    select: {
      id: true,
      title: true,
      startAt: true,
      durationMinutes: true,
      status: true,
      assigneeConfirmationStatus: true,
      projectStopService: {
        select: {
          serviceType: true,
          projectStop: {
            select: {
              address: true,
              project: { select: { id: true, code: true } },
            },
          },
        },
      },
    },
  });

  // Other projects for the reassign-to dropdown.
  const otherProjects = await db.carrierProject.findMany({
    where: {
      tenantId: membership.tenantId,
      status: { in: ["DRAFT", "PLANNED", "IN_PROGRESS"] },
    },
    orderBy: { scheduledStart: "desc" },
    take: 30,
    select: {
      id: true, code: true,
      moveRequest: { select: { fromAddress: true, toAddress: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/carrier/employees"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Όλοι οι υπάλληλοι
        </Link>
      </div>

      <header className="rounded-2xl border border-border bg-gradient-to-br from-[var(--color-brand-blue-light)] to-white p-6">
        <div className="flex items-center gap-4">
          <div className="grid size-14 place-items-center rounded-full bg-gradient-to-br from-[var(--color-brand-blue)] to-[var(--color-brand-blue-deep)] text-lg font-extrabold text-white shadow-md">
            {employee.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--color-brand-blue)]">
              Πρόγραμμα υπαλλήλου
            </p>
            <h1 className="font-display text-2xl font-bold text-foreground">
              {employee.name}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="rounded bg-secondary px-2 py-0.5 font-bold uppercase">{employee.role}</span>
              {employee.email && (
                <span className="flex items-center gap-1">
                  <Mail className="size-3" /> {employee.email}
                </span>
              )}
              {employee.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="size-3" /> {employee.phone}
                </span>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-extrabold tabular-nums text-foreground">{tasks.length}</div>
            <div className="text-xs text-muted-foreground">εργασίες αυτή την εβδομάδα</div>
          </div>
        </div>
      </header>

      <EmployeeScheduleClient
        employeeId={employee.id}
        employeeName={employee.name}
        initialAnchor={anchor.toISOString()}
        tasks={tasks.map((t) => ({
          id: t.id,
          title: t.title,
          startAt: t.startAt.toISOString(),
          durationMinutes: t.durationMinutes,
          status: t.status,
          confirmStatus: t.assigneeConfirmationStatus,
          serviceType: t.projectStopService?.serviceType ?? "OTHER",
          address: t.projectStopService?.projectStop.address ?? "",
          projectId: t.projectStopService?.projectStop.project.id ?? null,
          projectCode: t.projectStopService?.projectStop.project.code ?? null,
        }))}
        otherProjects={otherProjects.map((p) => ({
          id: p.id,
          code: p.code,
          route: `${p.moveRequest.fromAddress} → ${p.moveRequest.toAddress}`,
        }))}
      />
    </div>
  );
}
