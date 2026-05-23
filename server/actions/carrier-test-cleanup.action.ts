"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

type ActionResult =
  | { ok: true; report: CleanupReport }
  | { ok: false; error: string };

interface CleanupReport {
  jobTasksDeleted: number;
  ghostJobTasksWithMissingMove: number;
  ghostJobTasksWithMissingEmployee: number;
  ghostJobTasksWithMissingPartner: number;
  ghostJobTasksWithMissingProjectService: number;
  partnerQuoteRequestsDeleted: number;
  carrierProjectsDeleted: number;
}

/**
 * Testing helper for the carrier admin. Wipes JobTasks and related
 * project/quote rows for the tenant so the carrier can re-test staff
 * management from a clean slate. Also runs defensive sweeps for orphan rows
 * left by failed cascades.
 *
 * Restricted to TENANTADMIN/SUPERADMIN.
 */
export async function cleanupCarrierTestData(): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Δεν είσαι συνδεδεμένος." };

  const role = session.user.role;
  if (role !== "TENANTADMIN" && role !== "SUPERADMIN") {
    return { ok: false, error: "Δεν έχεις δικαίωμα." };
  }

  const membership = await db.tenantMembership.findFirst({
    where: { userId: session.user.id },
    select: { tenantId: true },
    orderBy: { createdAt: "asc" },
  });
  if (!membership) return { ok: false, error: "Δεν είσαι σε εταιρεία." };
  const tenantId = membership.tenantId;

  const report: CleanupReport = {
    jobTasksDeleted: 0,
    ghostJobTasksWithMissingMove: 0,
    ghostJobTasksWithMissingEmployee: 0,
    ghostJobTasksWithMissingPartner: 0,
    ghostJobTasksWithMissingProjectService: 0,
    partnerQuoteRequestsDeleted: 0,
    carrierProjectsDeleted: 0,
  };

  try {
    // 1) Hard-delete all JobTasks of this tenant — wipes staff assignments.
    const del = await db.jobTask.deleteMany({ where: { tenantId } });
    report.jobTasksDeleted = del.count;

    // 2) Defensive sweep via raw SQL — Prisma's where clauses can't express
    //    "FK is broken" for required relations. We hunt orphans directly.
    const orphanMoveRows = await db.$queryRaw<{ id: string }[]>`
      SELECT jt.id FROM "JobTask" jt
      LEFT JOIN "MoveRequest" mr ON mr.id = jt."moveRequestId"
      WHERE jt."tenantId" = ${tenantId} AND mr.id IS NULL
    `;
    if (orphanMoveRows.length > 0) {
      await db.jobTask.deleteMany({
        where: { id: { in: orphanMoveRows.map((r) => r.id) } },
      });
      report.ghostJobTasksWithMissingMove = orphanMoveRows.length;
    }

    const staleEmpRows = await db.$queryRaw<{ id: string }[]>`
      SELECT jt.id FROM "JobTask" jt
      LEFT JOIN "CarrierEmployee" e ON e.id = jt."assigneeEmployeeId"
      WHERE jt."tenantId" = ${tenantId}
        AND jt."assigneeEmployeeId" IS NOT NULL
        AND e.id IS NULL
    `;
    if (staleEmpRows.length > 0) {
      await db.jobTask.updateMany({
        where: { id: { in: staleEmpRows.map((r) => r.id) } },
        data: { assigneeKind: "UNASSIGNED", assigneeEmployeeId: null },
      });
      report.ghostJobTasksWithMissingEmployee = staleEmpRows.length;
    }

    const stalePartnerRows = await db.$queryRaw<{ id: string }[]>`
      SELECT jt.id FROM "JobTask" jt
      LEFT JOIN "CarrierPartner" p ON p.id = jt."assigneePartnerId"
      WHERE jt."tenantId" = ${tenantId}
        AND jt."assigneePartnerId" IS NOT NULL
        AND p.id IS NULL
    `;
    if (stalePartnerRows.length > 0) {
      await db.jobTask.updateMany({
        where: { id: { in: stalePartnerRows.map((r) => r.id) } },
        data: { assigneeKind: "UNASSIGNED", assigneePartnerId: null },
      });
      report.ghostJobTasksWithMissingPartner = stalePartnerRows.length;
    }

    const staleProjRows = await db.$queryRaw<{ id: string }[]>`
      SELECT jt.id FROM "JobTask" jt
      LEFT JOIN "ProjectStopService" pss ON pss.id = jt."projectStopServiceId"
      WHERE jt."tenantId" = ${tenantId}
        AND jt."projectStopServiceId" IS NOT NULL
        AND pss.id IS NULL
    `;
    if (staleProjRows.length > 0) {
      await db.jobTask.updateMany({
        where: { id: { in: staleProjRows.map((r) => r.id) } },
        data: { projectStopServiceId: null },
      });
      report.ghostJobTasksWithMissingProjectService = staleProjRows.length;
    }

    // 3) Partner quote requests of this tenant — wipe so quote modal starts fresh.
    const pqr = await db.partnerQuoteRequest.deleteMany({ where: { tenantId } });
    report.partnerQuoteRequestsDeleted = pqr.count;

    // 4) Carrier projects (the formal project records, not MoveRequests).
    const cp = await db.carrierProject.deleteMany({ where: { tenantId } });
    report.carrierProjectsDeleted = cp.count;

    revalidatePath("/carrier");
    revalidatePath("/carrier/jobs");
    revalidatePath("/carrier/tasks");
    revalidatePath("/carrier/leads");
    revalidatePath("/carrier/projects");
    revalidatePath("/carrier/partners");

    return { ok: true, report };
  } catch (e) {
    console.error("[cleanupCarrierTestData]", e);
    return { ok: false, error: (e as Error).message ?? "Αποτυχία καθαρισμού." };
  }
}
