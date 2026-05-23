/**
 * Backfill CarrierProject / ProjectStop / ProjectStopService rows for every
 * accepted Offer that doesn't already have a project, and link any existing
 * JobTasks to a default OTHER service per stop.
 *
 * Idempotent: re-running it after success makes zero changes.
 *
 * Usage:
 *   npx tsx scripts/backfill-carrier-projects.ts            # apply changes
 *   npx tsx scripts/backfill-carrier-projects.ts --dry      # summary only
 */
import "dotenv/config";
import { db } from "../lib/db";
import { buildProjectAndTasksForMove } from "../lib/build-project-tasks";

const DRY = process.argv.includes("--dry");

interface Stats {
  scanned: number;
  alreadyMigrated: number;
  noTenant: number;
  projectsCreated: number;
  tasksRelinked: number;
  errors: number;
}

async function main(): Promise<void> {
  const stats: Stats = {
    scanned: 0,
    alreadyMigrated: 0,
    noTenant: 0,
    projectsCreated: 0,
    tasksRelinked: 0,
    errors: 0,
  };

  // All accepted offers whose move doesn't yet have a CarrierProject.
  const offers = await db.offer.findMany({
    where: {
      status: "ACCEPTED",
      acceptedAt: { not: null },
      carrierProject: null,
    },
    select: {
      id: true,
      moveRequestId: true,
      carrierUserId: true,
      priceCents: true,
      acceptedSlotAt: true,
      acceptedAt: true,
    },
    orderBy: { acceptedAt: "asc" },
  });

  stats.scanned = offers.length;
  console.log(
    `${DRY ? "[DRY] " : ""}Found ${offers.length} accepted offer(s) without a project.`,
  );

  for (const offer of offers) {
    const slot = offer.acceptedSlotAt ?? offer.acceptedAt;
    if (!slot) {
      console.warn(`  ⚠ Offer ${offer.id} missing acceptedSlotAt — skipping.`);
      stats.errors++;
      continue;
    }

    const membership = await db.tenantMembership.findFirst({
      where: { userId: offer.carrierUserId },
      select: { tenantId: true },
      orderBy: { createdAt: "asc" },
    });
    if (!membership) {
      console.warn(`  ⚠ Offer ${offer.id} carrier has no tenant — skipping.`);
      stats.noTenant++;
      continue;
    }

    if (DRY) {
      console.log(
        `  → would create project for offer ${offer.id} (move ${offer.moveRequestId})`,
      );
      continue;
    }

    try {
      const res = await buildProjectAndTasksForMove({
        tenantId: membership.tenantId,
        moveRequestId: offer.moveRequestId,
        offerId: offer.id,
        createdByUserId: offer.carrierUserId,
        scheduledStart: slot,
        totalPriceCents: offer.priceCents,
      });
      if (res.skipped) {
        stats.alreadyMigrated++;
      } else {
        stats.projectsCreated++;
        // Relink any legacy JobTasks that existed BEFORE the project (created
        // by the old buildJobTasksForMove). They're still attached to
        // moveRequestId but have projectStopServiceId = null. Drop them and
        // let the new builder's tasks stand, OR keep them and attach to an
        // OTHER service. We choose the latter to avoid losing assignments
        // the carrier may have already made.
        const relinked = await relinkLegacyTasks(
          offer.moveRequestId,
          res.projectId,
        );
        stats.tasksRelinked += relinked;
      }
      console.log(
        `  ✓ ${res.projectCode} (move ${offer.moveRequestId}) — ${res.stopsCreated} stops, ${res.servicesCreated} services, ${res.tasksCreated} tasks`,
      );
    } catch (e) {
      stats.errors++;
      console.error(
        `  ✗ Offer ${offer.id} failed:`,
        e instanceof Error ? e.message : e,
      );
    }
  }

  // Verification counts — must reach zero after a successful run.
  const orphanAccepted = await db.offer.count({
    where: {
      status: "ACCEPTED",
      acceptedAt: { not: null },
      carrierProject: null,
    },
  });
  const orphanTasks = await db.jobTask.count({
    where: { projectStopServiceId: null },
  });

  console.log("");
  console.log("─── Summary ────────────────────────────────");
  console.log(`  Mode:              ${DRY ? "DRY RUN" : "APPLY"}`);
  console.log(`  Scanned:           ${stats.scanned}`);
  console.log(`  Created:           ${stats.projectsCreated}`);
  console.log(`  Already migrated:  ${stats.alreadyMigrated}`);
  console.log(`  No tenant:         ${stats.noTenant}`);
  console.log(`  Tasks relinked:    ${stats.tasksRelinked}`);
  console.log(`  Errors:            ${stats.errors}`);
  console.log("");
  console.log("─── Verification (post-run, must be 0) ─────");
  console.log(`  Accepted offers w/o project: ${orphanAccepted}`);
  console.log(`  JobTasks w/o service link:   ${orphanTasks}`);

  if (!DRY && (orphanAccepted > 0 || orphanTasks > 0)) {
    process.exitCode = 1;
  }
}

/**
 * Attach orphan JobTasks (moveRequestId set, projectStopServiceId null) to a
 * default OTHER service under the first stop of the project. The carrier can
 * re-classify them in the UI afterwards.
 */
async function relinkLegacyTasks(
  moveRequestId: string,
  projectId: string,
): Promise<number> {
  const orphans = await db.jobTask.findMany({
    where: { moveRequestId, projectStopServiceId: null },
    select: { id: true },
  });
  if (orphans.length === 0) return 0;

  const firstStop = await db.projectStop.findFirst({
    where: { projectId },
    orderBy: { sequence: "asc" },
    select: { id: true },
  });
  if (!firstStop) return 0;

  const fallback = await db.projectStopService.create({
    data: {
      projectStopId: firstStop.id,
      serviceType: "OTHER",
      label: "Από προηγούμενο πλάνο",
      quantity: 1,
    },
  });

  const res = await db.jobTask.updateMany({
    where: { id: { in: orphans.map((o) => o.id) } },
    data: { projectStopServiceId: fallback.id },
  });
  return res.count;
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
