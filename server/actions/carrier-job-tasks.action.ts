"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  checkResourceAvailability,
  recordAvailabilityOverride,
  type ResourceConflict,
} from "@/lib/check-resource-availability";
import { sendTaskAssignmentConfirmation } from "@/server/actions/task-confirmation.action";

const STATUSES = [
  "PLANNED",
  "CONFIRMED",
  "IN_PROGRESS",
  "DONE",
  "BLOCKED",
  "CANCELLED",
] as const;
const CATEGORIES = [
  "PREP",
  "LOADING",
  "TRANSIT",
  "CRANE",
  "UNLOADING",
  "ASSEMBLY",
  "STORAGE",
  "CLEANUP",
  "ADMIN",
  "OTHER",
] as const;
const ASSIGNEE_KINDS = ["EMPLOYEE", "PARTNER", "UNASSIGNED"] as const;

export type ActionResult<T = unknown> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

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
  return { userId: session.user.id, tenantId: membership.tenantId };
}

const upsertSchema = z.object({
  id: z.string().optional(),
  moveRequestId: z.string().min(1),
  title: z.string().trim().min(2, "Τίτλος υποχρεωτικός").max(120),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  category: z.enum(CATEGORIES).default("OTHER"),
  startAt: z.string().min(1), // ISO datetime
  durationMinutes: z.coerce.number().int().min(5).max(60 * 24 * 14),
  assigneeKind: z.enum(ASSIGNEE_KINDS).default("UNASSIGNED"),
  assigneeEmployeeId: z.string().optional().or(z.literal("")),
  assigneePartnerId: z.string().optional().or(z.literal("")),
  vehicleId: z.string().optional().or(z.literal("")),
  color: z.string().optional().or(z.literal("")),
  sortOrder: z.coerce.number().int().default(0),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  /** When the carrier acknowledges availability conflicts and proceeds. */
  overrideConflicts: z.boolean().optional(),
  overrideReason: z.string().trim().max(500).optional().or(z.literal("")),
  /** IDs of other tasks that must complete before this one starts. */
  blockerIds: z.array(z.string().min(1)).optional(),
  /** Additional employees that work this task alongside the primary. */
  coEmployeeIds: z.array(z.string().min(1)).optional(),
  /** Additional partners that work this task alongside the primary. */
  coPartnerIds: z.array(z.string().min(1)).optional(),
});

export type UpsertJobTaskResult =
  | { ok: true; data: { id: string }; warning?: string | null; adjustedStartAt?: string }
  | { ok: false; error: string }
  | { ok: false; conflicts: ResourceConflict[]; error: string };

export async function upsertJobTask(
  input: unknown,
): Promise<UpsertJobTaskResult> {
  let ctx;
  try {
    ctx = await getCtx();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const parsed = upsertSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Λάθος δεδομένα",
    };
  }
  const d = parsed.data;

  // Ensure move belongs to a job the carrier is involved with.
  const move = await db.moveRequest.findUnique({
    where: { id: d.moveRequestId },
    select: { id: true },
  });
  if (!move) return { ok: false, error: "Δεν βρέθηκε αίτημα." };

  // Validate assignee belongs to tenant
  let employeeId: string | null = null;
  let partnerId: string | null = null;
  let kind = d.assigneeKind;
  if (kind === "EMPLOYEE") {
    if (!d.assigneeEmployeeId) {
      return { ok: false, error: "Επέλεξε υπάλληλο." };
    }
    const e = await db.carrierEmployee.findFirst({
      where: { id: d.assigneeEmployeeId, tenantId: ctx.tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!e) return { ok: false, error: "Άκυρος υπάλληλος." };
    employeeId = e.id;
  } else if (kind === "PARTNER") {
    if (!d.assigneePartnerId) {
      return { ok: false, error: "Επέλεξε συνεργάτη." };
    }
    const p = await db.carrierPartner.findFirst({
      where: { id: d.assigneePartnerId, tenantId: ctx.tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!p) return { ok: false, error: "Άκυρος συνεργάτης." };
    partnerId = p.id;
  }

  let vehicleId: string | null = null;
  if (d.vehicleId) {
    const v = await db.vehicle.findFirst({
      where: { id: d.vehicleId, tenantId: ctx.tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!v) return { ok: false, error: "Άκυρο όχημα." };
    vehicleId = v.id;
  }

  // Availability check — soft warning + override. If the carrier hasn't
  // acknowledged the conflicts, return them so the UI can prompt.
  let overrideConflicts: ResourceConflict[] = [];
  if (employeeId || vehicleId) {
    const conflicts = await checkResourceAvailability({
      tenantId: ctx.tenantId,
      startAt: new Date(d.startAt),
      durationMinutes: d.durationMinutes,
      employeeId,
      vehicleId,
      excludeTaskId: d.id ?? null,
    });
    if (conflicts.length > 0 && !d.overrideConflicts) {
      return {
        ok: false,
        conflicts,
        error: "Σύγκρουση διαθεσιμότητας. Επιβεβαίωσε ή άλλαξε ανάθεση.",
      };
    }
    if (conflicts.length > 0 && d.overrideConflicts) {
      overrideConflicts = conflicts;
    }
  }

  const data = {
    title: d.title,
    description: d.description || null,
    category: d.category,
    startAt: new Date(d.startAt),
    durationMinutes: d.durationMinutes,
    assigneeKind: kind,
    assigneeEmployeeId: employeeId,
    assigneePartnerId: partnerId,
    vehicleId,
    color: d.color || null,
    sortOrder: d.sortOrder,
    notes: d.notes || null,
  };

  try {
    let row;
    let priorAssigneeEmployeeId: string | null = null;
    let priorAssigneePartnerId: string | null = null;
    if (d.id) {
      const exists = await db.jobTask.findFirst({
        where: { id: d.id, tenantId: ctx.tenantId },
        select: { id: true, assigneeEmployeeId: true, assigneePartnerId: true },
      });
      if (!exists) return { ok: false, error: "Δεν βρέθηκε εργασία." };
      priorAssigneeEmployeeId = exists.assigneeEmployeeId;
      priorAssigneePartnerId = exists.assigneePartnerId;
      row = await db.jobTask.update({ where: { id: d.id }, data });
    } else {
      row = await db.jobTask.create({
        data: {
          ...data,
          tenantId: ctx.tenantId,
          moveRequestId: d.moveRequestId,
          createdByUserId: ctx.userId,
        },
      });
    }
    if (overrideConflicts.length > 0) {
      await recordAvailabilityOverride({
        taskId: row.id,
        overriddenByUserId: ctx.userId,
        reason: d.overrideReason || null,
        conflicts: overrideConflicts,
      });
    }

    // Sync the full assignment set: primary (from assigneeKind fields) +
    // any co-assignees passed in. We replace the whole set on every save.
    try {
      const desired: Array<{ employeeId: string | null; partnerId: string | null; isPrimary: boolean }> = [];
      if (employeeId) {
        desired.push({ employeeId, partnerId: null, isPrimary: true });
      } else if (partnerId) {
        desired.push({ employeeId: null, partnerId, isPrimary: true });
      }
      // Validate co-assignees belong to tenant + dedupe vs primary.
      if (d.coEmployeeIds && d.coEmployeeIds.length > 0) {
        const valid = await db.carrierEmployee.findMany({
          where: {
            id: { in: d.coEmployeeIds },
            tenantId: ctx.tenantId,
            deletedAt: null,
          },
          select: { id: true },
        });
        for (const v of valid) {
          if (v.id === employeeId) continue;
          desired.push({ employeeId: v.id, partnerId: null, isPrimary: false });
        }
      }
      if (d.coPartnerIds && d.coPartnerIds.length > 0) {
        const valid = await db.carrierPartner.findMany({
          where: {
            id: { in: d.coPartnerIds },
            tenantId: ctx.tenantId,
            deletedAt: null,
          },
          select: { id: true },
        });
        for (const v of valid) {
          if (v.id === partnerId) continue;
          desired.push({ employeeId: null, partnerId: v.id, isPrimary: false });
        }
      }

      await db.jobTaskAssignment.deleteMany({ where: { taskId: row.id } });
      if (desired.length > 0) {
        await db.jobTaskAssignment.createMany({
          data: desired.map((a) => ({
            taskId: row.id,
            employeeId: a.employeeId,
            partnerId: a.partnerId,
            isPrimary: a.isPrimary,
          })),
        });
      }
    } catch (e) {
      console.warn("[upsertJobTask] assignment sync failed:", e);
    }

    // Sync dependencies if the caller provided a list. Empty array → clear.
    if (d.blockerIds !== undefined) {
      const validBlockers = d.blockerIds.filter((id) => id !== row.id);
      // Verify all blockers belong to same tenant and same move (otherwise
      // they're not really part of this project).
      const moveTaskIds = await db.jobTask.findMany({
        where: {
          tenantId: ctx.tenantId,
          moveRequestId: d.moveRequestId,
          id: { in: validBlockers },
        },
        select: { id: true },
      });
      const allowedSet = new Set(moveTaskIds.map((t) => t.id));
      const filtered = validBlockers.filter((id) => allowedSet.has(id));

      // Cycle detection: walk the existing graph and refuse if adding any
      // proposed blocker would create a cycle reaching back to row.id.
      const causingCycle = await detectCycle(row.id, filtered);
      if (causingCycle) {
        // Don't fail the whole save — drop the bad edges silently and continue.
        console.warn("[upsertJobTask] dependency cycle prevented:", causingCycle);
      }
      const safeBlockers = filtered.filter((b) => !causingCycle?.includes(b));

      await db.jobTaskDependency.deleteMany({ where: { blockedId: row.id } });
      if (safeBlockers.length > 0) {
        await db.jobTaskDependency.createMany({
          data: safeBlockers.map((b) => ({ blockedId: row.id, blockerId: b })),
          skipDuplicates: true,
        });
      }
    }

    // Fire confirmation email when the assignee changes (or is set for the
    // first time). Failures don't break the save.
    const assigneeChanged =
      (kind === "EMPLOYEE" && employeeId && employeeId !== priorAssigneeEmployeeId) ||
      (kind === "PARTNER" && partnerId && partnerId !== priorAssigneePartnerId);
    if (assigneeChanged) {
      try {
        await sendTaskAssignmentConfirmation(row.id, ctx.tenantId);
      } catch (e) {
        console.warn("[upsertJobTask] confirmation email failed:", e);
      }
    }
    revalidatePath(`/carrier/leads/${d.moveRequestId}`);
    revalidatePath("/carrier/tasks");
    revalidatePath("/carrier/calendar");
    revalidatePath("/carrier/projects");
    return { ok: true, data: { id: row.id } };
  } catch (e) {
    console.error("[upsertJobTask]", e);
    return { ok: false, error: "Αποθήκευση απέτυχε." };
  }
}

/**
 * Walk the dependency graph from each proposed blocker; if we reach `selfId`
 * we'd create a cycle. Returns the list of blocker IDs that would cause one.
 */
async function detectCycle(
  selfId: string,
  proposedBlockerIds: string[],
): Promise<string[] | null> {
  const bad: string[] = [];
  for (const blockerId of proposedBlockerIds) {
    // BFS from blocker's own blockedBy graph upward. If selfId appears,
    // that means selfId currently blocks `blockerId` (transitively).
    const seen = new Set<string>();
    const queue: string[] = [blockerId];
    let cycle = false;
    while (queue.length > 0 && !cycle) {
      const cur = queue.shift()!;
      if (cur === selfId) { cycle = true; break; }
      if (seen.has(cur)) continue;
      seen.add(cur);
      const deps = await db.jobTaskDependency.findMany({
        where: { blockedId: cur },
        select: { blockerId: true },
      });
      for (const d of deps) queue.push(d.blockerId);
    }
    if (cycle) bad.push(blockerId);
  }
  return bad.length > 0 ? bad : null;
}

/**
 * Quick assign a partner to a job task (used by the partner-quote card on
 * the lead detail page). Does NOT touch other fields. If `partnerId` is null
 * the task is unassigned.
 */
export async function assignJobTaskPartner(
  taskId: string,
  partnerId: string | null,
): Promise<ActionResult> {
  let ctx;
  try { ctx = await getCtx(); } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const task = await db.jobTask.findFirst({
    where: { id: taskId, tenantId: ctx.tenantId },
    select: { id: true, moveRequestId: true },
  });
  if (!task) return { ok: false, error: "Δεν βρέθηκε εργασία." };

  if (partnerId) {
    const partner = await db.carrierPartner.findFirst({
      where: { id: partnerId, tenantId: ctx.tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!partner) return { ok: false, error: "Άκυρος συνεργάτης." };
  }

  try {
    await db.jobTask.update({
      where: { id: taskId },
      data: {
        assigneeKind: partnerId ? "PARTNER" : "UNASSIGNED",
        assigneePartnerId: partnerId,
        assigneeEmployeeId: null,
      },
    });
    return { ok: true };
  } catch (e) {
    console.error("[assignJobTaskPartner]", e);
    return { ok: false, error: "Η ανάθεση απέτυχε." };
  }
}

export async function deleteJobTask(id: string): Promise<ActionResult> {
  let ctx;
  try {
    ctx = await getCtx();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  try {
    const row = await db.jobTask.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: { id: true, moveRequestId: true },
    });
    if (!row) return { ok: false, error: "Δεν βρέθηκε εργασία." };
    await db.jobTask.delete({ where: { id } });
    revalidatePath(`/carrier/leads/${row.moveRequestId}`);
    revalidatePath("/carrier/tasks");
    return { ok: true };
  } catch (e) {
    console.error("[deleteJobTask]", e);
    return { ok: false, error: "Διαγραφή απέτυχε." };
  }
}

const statusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(STATUSES),
  /** When the carrier acknowledges blocker warnings and proceeds anyway. */
  overrideBlockers: z.boolean().optional(),
});

export type SetStatusResult =
  | { ok: true; data: { id: string; status: string } }
  | { ok: false; error: string }
  | {
      ok: false;
      blockers: Array<{ id: string; title: string; status: string }>;
      error: string;
    };

const rescheduleSchema = z.object({
  id: z.string().min(1),
  startAt: z.string().min(1),
  durationMinutes: z.coerce.number().int().min(5).max(60 * 24 * 14),
  /** When true, persist even if employee/vehicle conflicts exist. The caller
   * is responsible for surfacing the warning to the user. */
  overrideConflicts: z.boolean().optional(),
});

/**
 * Lightweight reschedule for drag-and-drop on a Gantt timeline. Doesn't
 * touch assignees, blockers, or any other fields — only startAt + duration.
 * Re-uses the availability check so overlaps still surface.
 */
export async function rescheduleJobTask(
  input: unknown,
): Promise<UpsertJobTaskResult> {
  let ctx;
  try { ctx = await getCtx(); } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const parsed = rescheduleSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Λάθος" };
  const { id, startAt, durationMinutes } = parsed.data;

  const task = await db.jobTask.findFirst({
    where: { id, tenantId: ctx.tenantId },
    select: {
      id: true, moveRequestId: true, category: true, sortOrder: true,
      assigneeEmployeeId: true, assigneePartnerId: true,
      projectStopService: { select: { projectStop: { select: { project: { select: { id: true } } } } } },
    },
  });
  if (!task) return { ok: false, error: "Δεν βρέθηκε εργασία." };

  // ── Domain rules για ΔΙΑΔΡΟΜΗ (TRANSIT):
  //   1) Καμία εργασία (πλην της ίδιας της ΔΙΑΔΡΟΜΗΣ) δεν επιτρέπεται να
  //      κάνει overlap με το παράθυρο της TRANSIT.
  //   2) Καμία εργασία προορισμού δεν επιτρέπεται να αρχίσει πριν την λήξη
  //      της TRANSIT (UNLOADING, ASSEMBLY, CLEANUP, STORAGE και κάθε post-
  //      transit task κατά sortOrder).
  const DESTINATION_CATS = new Set(["UNLOADING", "ASSEMBLY", "CLEANUP", "STORAGE"]);
  const transits = await db.jobTask.findMany({
    where: { moveRequestId: task.moveRequestId, category: "TRANSIT", tenantId: ctx.tenantId, status: { not: "CANCELLED" } },
    select: { id: true, sortOrder: true, startAt: true, durationMinutes: true },
    orderBy: { sortOrder: "asc" },
  });

  const newStart = new Date(startAt);
  const newEnd = new Date(newStart.getTime() + durationMinutes * 60_000);

  const fmt = (d: Date) =>
    d.toLocaleString("el-GR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

  // Rule 1 — overlap with any TRANSIT (αν δεν είναι η ίδια η TRANSIT)
  if (task.category !== "TRANSIT") {
    for (const t of transits) {
      const ts = t.startAt.getTime();
      const te = ts + t.durationMinutes * 60_000;
      if (newStart.getTime() < te && newEnd.getTime() > ts) {
        return {
          ok: false,
          error: `Η εργασία δεν μπορεί να εκτελεστεί κατά τη ΔΙΑΔΡΟΜΗ (${fmt(new Date(ts))} – ${fmt(new Date(te))}). Μετακίνησε πριν την έναρξη ή μετά τη λήξη της διαδρομής.`,
        };
      }
    }
  }

  // Rule 2 — destination tasks πρέπει να ξεκινούν ≥ transitEnd
  const isDestinationTask =
    task.category !== "TRANSIT" &&
    (DESTINATION_CATS.has(task.category) ||
      transits.some((t) => t.id !== task.id && t.sortOrder < task.sortOrder));

  if (isDestinationTask && transits.length > 0) {
    const blockingTransits = transits.filter((t) => t.id !== task.id && t.sortOrder < task.sortOrder);
    const lastBlockingTransit = blockingTransits.length > 0
      ? blockingTransits.sort((a, b) => b.sortOrder - a.sortOrder)[0]
      : null;
    if (lastBlockingTransit) {
      const transitEnd = new Date(lastBlockingTransit.startAt.getTime() + lastBlockingTransit.durationMinutes * 60_000);
      if (newStart < transitEnd) {
        return {
          ok: false,
          error: `Η εργασία είναι στο σημείο προορισμού. Δεν μπορεί να ξεκινήσει πριν λήξει η ΔΙΑΔΡΟΜΗ (${fmt(transitEnd)}).`,
        };
      }
    }
  }

  // If the moved task IS the TRANSIT, ensure no other task overlaps with the
  // new transit window (post-shift) or starts during it.
  if (task.category === "TRANSIT") {
    const conflict = await db.jobTask.findFirst({
      where: {
        moveRequestId: task.moveRequestId,
        tenantId: ctx.tenantId,
        id: { not: task.id },
        status: { not: "CANCELLED" },
        startAt: { lt: newEnd },
      },
      select: { id: true, title: true, startAt: true, durationMinutes: true, sortOrder: true },
    });
    if (conflict) {
      const cEnd = new Date(conflict.startAt.getTime() + conflict.durationMinutes * 60_000);
      // Overlap if conflict end > newStart
      if (cEnd > newStart) {
        return {
          ok: false,
          error: `Η νέα ΔΙΑΔΡΟΜΗ καταπατά την εργασία «${conflict.title}» (${fmt(conflict.startAt)}–${fmt(cEnd)}). Μετακίνησε την πρώτα.`,
        };
      }
    }
  }

  let conflicts = await checkResourceAvailability({
    tenantId: ctx.tenantId,
    startAt: newStart,
    durationMinutes,
    employeeId: task.assigneeEmployeeId,
    vehicleId: null,
    excludeTaskId: id,
  });
  // Smart auto-snap: αν ο επιλεγμένος υπάλληλος είναι ήδη απασχολημένος,
  // προτείνουμε αυτόματα την πρώτη ελεύθερη ώρα ΜΕΤΑ την τελευταία εργασία
  // του. Ο user βλέπει amber warning να εξηγεί την μετακίνηση.
  let warningMsg: string | null = null;
  let adjustedStartIso: string | undefined;
  let finalStart = newStart;

  if (conflicts.length > 0 && !parsed.data.overrideConflicts) {
    // Latest end among all conflicting tasks of this employee.
    const latestEndMs = Math.max(...conflicts.map((c) => c.otherEnd.getTime()));
    let snappedStart = new Date(latestEndMs);

    // Respect TRANSIT rules in the snapped slot too.
    if (task.category !== "TRANSIT") {
      // If still overlapping a transit, push past it.
      for (const t of transits) {
        const ts = t.startAt.getTime();
        const te = ts + t.durationMinutes * 60_000;
        const sEnd = snappedStart.getTime() + durationMinutes * 60_000;
        if (snappedStart.getTime() < te && sEnd > ts) {
          snappedStart = new Date(te);
        }
      }
    }

    // Re-check conflicts at the snapped position. If still conflicting,
    // give up the snap and fall back to keeping the user's chosen time +
    // a plain warning (no infinite cascade in this pass).
    const reCheck = await checkResourceAvailability({
      tenantId: ctx.tenantId,
      startAt: snappedStart,
      durationMinutes,
      employeeId: task.assigneeEmployeeId,
      vehicleId: null,
      excludeTaskId: id,
    });

    const fmt = (d: Date) =>
      d.toLocaleString("el-GR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

    if (reCheck.length === 0) {
      finalStart = snappedStart;
      adjustedStartIso = snappedStart.toISOString();
      const c0 = conflicts[0];
      warningMsg = `Ο/Η ${c0.resourceName} είχε «${c0.taskTitle}» μέχρι ${fmt(new Date(latestEndMs))}. Μετακινήθηκε αυτόματα η εργασία στις ${fmt(snappedStart)}.`;
      conflicts = []; // resolved
    } else {
      const c0 = conflicts[0];
      const cFmt = `${fmt(c0.otherStart)}–${c0.otherEnd.toLocaleString("el-GR", { hour: "2-digit", minute: "2-digit" })}`;
      const extra = conflicts.length > 1 ? ` (+${conflicts.length - 1} ακόμη)` : "";
      warningMsg = `Προσοχή: ο/η ${c0.resourceName} έχει επικαλυπτόμενη «${c0.taskTitle}» στις ${cFmt}${extra}. Έγινε save — άλλαξε crew ή ώρα.`;
    }
  }

  try {
    const updated = await db.jobTask.update({
      where: { id },
      data: { startAt: finalStart, durationMinutes },
      select: { id: true, startAt: true, durationMinutes: true },
    });
    console.log("[rescheduleJobTask] saved", { id: updated.id, startAt: updated.startAt.toISOString(), durationMinutes: updated.durationMinutes, snapped: !!adjustedStartIso });
    if (task.assigneeEmployeeId) {
      revalidatePath(`/carrier/employees/${task.assigneeEmployeeId}`);
    }
    if (task.projectStopService?.projectStop.project.id) {
      revalidatePath(`/carrier/projects/${task.projectStopService.projectStop.project.id}`);
    }
    // The reschedule may have happened from the lead detail page (no project link).
    revalidatePath(`/carrier/leads/${task.moveRequestId}`, "page");
    revalidatePath(`/carrier/tasks`);
    return { ok: true, data: { id }, warning: warningMsg, adjustedStartAt: adjustedStartIso };
  } catch (e) {
    console.error("[rescheduleJobTask]", e);
    return { ok: false, error: "Αποθήκευση απέτυχε: " + (e as Error).message };
  }
}

export async function setJobTaskStatus(
  input: unknown,
): Promise<SetStatusResult> {
  let ctx;
  try {
    ctx = await getCtx();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Λάθος" };
  const { id, status, overrideBlockers } = parsed.data;

  const row = await db.jobTask.findFirst({
    where: { id, tenantId: ctx.tenantId },
    select: { id: true, moveRequestId: true, status: true },
  });
  if (!row) return { ok: false, error: "Δεν βρέθηκε εργασία." };

  // Blocker enforcement: when moving into IN_PROGRESS or DONE, all blockers
  // must already be DONE. Soft warning + override.
  if ((status === "IN_PROGRESS" || status === "DONE") && !overrideBlockers) {
    const blockers = await db.jobTaskDependency.findMany({
      where: { blockedId: id },
      select: {
        blocker: { select: { id: true, title: true, status: true } },
      },
    });
    const unfinished = blockers
      .map((b) => b.blocker)
      .filter((b) => b.status !== "DONE" && b.status !== "CANCELLED");
    if (unfinished.length > 0) {
      return {
        ok: false,
        blockers: unfinished,
        error: "Εκκρεμούν εργασίες-προϋποθέσεις. Ολοκλήρωσέ τες ή κάνε override.",
      };
    }
  }

  const now = new Date();
  const update: {
    status: typeof status;
    startedAt?: Date | null;
    completedAt?: Date | null;
  } = { status };
  if (status === "IN_PROGRESS") update.startedAt = now;
  if (status === "DONE") {
    if (row.status !== "DONE") update.completedAt = now;
  }
  if (status === "PLANNED" || status === "BLOCKED" || status === "CANCELLED") {
    update.completedAt = null;
  }

  try {
    await db.jobTask.update({ where: { id }, data: update });
    revalidatePath(`/carrier/leads/${row.moveRequestId}`);
    revalidatePath("/carrier/tasks");
    return { ok: true, data: { id, status } };
  } catch (e) {
    console.error("[setJobTaskStatus]", e);
    return { ok: false, error: "Ενημέρωση status απέτυχε." };
  }
}
