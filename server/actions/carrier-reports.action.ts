"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export type ReportRange = "month" | "quarter" | "ytd";

const SERVICE_TYPES = [
  "CRANE",
  "PACKING",
  "LOADING",
  "UNLOADING",
  "ASSEMBLY",
  "DISASSEMBLY",
  "STORAGE",
  "TRANSIT",
  "CLEANUP",
  "OTHER",
] as const;

type ServiceType = (typeof SERVICE_TYPES)[number];

async function getCtx() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Δεν είσαι συνδεδεμένος.");
  const role = session.user.role;
  if (role !== "TENANTADMIN" && role !== "TENANTEMPLOYEE") {
    throw new Error("Μόνο μέλη εταιρείας μεταφορέα έχουν πρόσβαση.");
  }
  const membership = await db.tenantMembership.findFirst({
    where: { userId: session.user.id },
    select: { tenantId: true },
    orderBy: { createdAt: "asc" },
  });
  if (!membership) throw new Error("Δεν είσαι μέλος εταιρείας.");
  return { tenantId: membership.tenantId };
}

function rangeBounds(range: ReportRange): { from: Date; to: Date; label: string } {
  const now = new Date();
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (range === "month") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from, to, label: "Τρέχων μήνας" };
  }
  if (range === "quarter") {
    const qStart = Math.floor(now.getMonth() / 3) * 3;
    const from = new Date(now.getFullYear(), qStart, 1);
    return { from, to, label: "Τρέχον τρίμηνο" };
  }
  const from = new Date(now.getFullYear(), 0, 1);
  return { from, to, label: "Από αρχή έτους" };
}

export interface RevenueByServiceRow {
  serviceType: ServiceType;
  totalCents: number;
  count: number;
}

export interface EmployeeUtilizationRow {
  employeeId: string;
  name: string;
  assignedMinutes: number;
  taskCount: number;
}

export interface TopServiceRow {
  serviceType: ServiceType;
  count: number;
  totalCents: number;
}

export interface CarrierReportsData {
  range: ReportRange;
  rangeLabel: string;
  from: string;
  to: string;
  totals: {
    revenueCents: number;
    projectCount: number;
    serviceCount: number;
    assignedMinutes: number;
  };
  revenueByService: RevenueByServiceRow[];
  employeeUtilization: EmployeeUtilizationRow[];
  topServices: TopServiceRow[];
}

/**
 * All three reports in a single round-trip so the client can switch tabs
 * without re-querying. Scoped by tenant. Revenue includes any project that
 * is not CANCELLED (PLANNED / IN_PROGRESS / COMPLETED) — once an offer is
 * accepted the money is on the books for the carrier.
 */
export async function getCarrierReports(range: ReportRange = "month"): Promise<CarrierReportsData> {
  const { tenantId } = await getCtx();
  const { from, to, label } = rangeBounds(range);

  const projectScope = {
    projectStop: {
      project: {
        tenantId,
        status: { not: "CANCELLED" as const },
        scheduledStart: { gte: from, lt: to },
      },
    },
  };

  const services = await db.projectStopService.findMany({
    where: projectScope,
    select: {
      serviceType: true,
      quantity: true,
      unitPriceCents: true,
      totalPriceCents: true,
      projectStop: { select: { projectId: true } },
    },
  });

  const revenueMap = new Map<ServiceType, { totalCents: number; count: number }>();
  const projectIds = new Set<string>();
  for (const svc of services) {
    const total =
      svc.totalPriceCents ?? (svc.unitPriceCents != null ? svc.unitPriceCents * svc.quantity : 0);
    const entry = revenueMap.get(svc.serviceType) ?? { totalCents: 0, count: 0 };
    entry.totalCents += total;
    entry.count += 1;
    revenueMap.set(svc.serviceType, entry);
    projectIds.add(svc.projectStop.projectId);
  }

  const revenueByService: RevenueByServiceRow[] = SERVICE_TYPES.map((st) => ({
    serviceType: st,
    totalCents: revenueMap.get(st)?.totalCents ?? 0,
    count: revenueMap.get(st)?.count ?? 0,
  })).sort((a, b) => b.totalCents - a.totalCents);

  const tasks = await db.jobTask.findMany({
    where: {
      tenantId,
      status: { not: "CANCELLED" },
      startAt: { gte: from, lt: to },
      assigneeEmployeeId: { not: null },
    },
    select: {
      durationMinutes: true,
      assigneeEmployeeId: true,
      assigneeEmployee: { select: { id: true, name: true } },
    },
  });

  const utilMap = new Map<string, EmployeeUtilizationRow>();
  let totalMinutes = 0;
  for (const t of tasks) {
    if (!t.assigneeEmployee) continue;
    const row = utilMap.get(t.assigneeEmployee.id) ?? {
      employeeId: t.assigneeEmployee.id,
      name: t.assigneeEmployee.name ?? "—",
      assignedMinutes: 0,
      taskCount: 0,
    };
    row.assignedMinutes += t.durationMinutes;
    row.taskCount += 1;
    totalMinutes += t.durationMinutes;
    utilMap.set(t.assigneeEmployee.id, row);
  }
  const employeeUtilization = Array.from(utilMap.values()).sort(
    (a, b) => b.assignedMinutes - a.assignedMinutes,
  );

  const topServices: TopServiceRow[] = revenueByService
    .filter((r) => r.count > 0)
    .slice(0, 5)
    .map((r) => ({ serviceType: r.serviceType, count: r.count, totalCents: r.totalCents }));

  const revenueCents = revenueByService.reduce((a, r) => a + r.totalCents, 0);

  return {
    range,
    rangeLabel: label,
    from: from.toISOString(),
    to: to.toISOString(),
    totals: {
      revenueCents,
      projectCount: projectIds.size,
      serviceCount: services.length,
      assignedMinutes: totalMinutes,
    },
    revenueByService,
    employeeUtilization,
    topServices,
  };
}
