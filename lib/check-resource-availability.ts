import { db } from "@/lib/db";

export interface ResourceConflict {
  taskId: string;
  resourceKind: "EMPLOYEE" | "VEHICLE";
  resourceId: string;
  resourceName: string;
  otherStart: Date;
  otherEnd: Date;
  projectCode: string | null;
  projectId: string | null;
  taskTitle: string;
}

interface CheckInput {
  tenantId: string;
  /** UTC start of the proposed task window. */
  startAt: Date;
  /** Duration in minutes. End = startAt + durationMinutes. */
  durationMinutes: number;
  /** Optional employee assignment to check. */
  employeeId?: string | null;
  /** Optional vehicle assignment to check. */
  vehicleId?: string | null;
  /** When updating an existing task, exclude it from the conflict set. */
  excludeTaskId?: string | null;
}

/**
 * Find any non-cancelled, non-done JobTasks in the same tenant that overlap
 * the proposed [startAt, startAt+durationMinutes) window and share the same
 * employee or vehicle. Returns one entry per conflicting task.
 *
 * Two windows [a,b) and [c,d) overlap iff a < d AND c < b. Tasks store
 * `startAt` + `durationMinutes` so we can't filter end-time at the DB layer
 * without raw SQL — we narrow with a coarse `startAt < end` filter, then
 * confirm overlap in JS.
 */
export async function checkResourceAvailability(
  input: CheckInput,
): Promise<ResourceConflict[]> {
  const employeeId = input.employeeId ?? null;
  const vehicleId = input.vehicleId ?? null;
  if (!employeeId && !vehicleId) return [];

  const newStart = input.startAt;
  const newEnd = new Date(
    newStart.getTime() + input.durationMinutes * 60_000,
  );

  // Coarse filter: any task that *starts* before our window ends. We then
  // filter by computed end > newStart in memory. Tasks are short-lived so the
  // candidate set is tiny in practice.
  const orFilter: Array<Record<string, string>> = [];
  if (employeeId) orFilter.push({ assigneeEmployeeId: employeeId });
  if (vehicleId) orFilter.push({ vehicleId });

  const candidates = await db.jobTask.findMany({
    where: {
      tenantId: input.tenantId,
      status: { notIn: ["CANCELLED", "DONE"] },
      id: input.excludeTaskId ? { not: input.excludeTaskId } : undefined,
      OR: orFilter,
      startAt: { lt: newEnd },
    },
    select: {
      id: true,
      title: true,
      startAt: true,
      durationMinutes: true,
      assigneeEmployeeId: true,
      vehicleId: true,
      assigneeEmployee: { select: { id: true, name: true } },
      vehicle: { select: { id: true, plate: true, brand: true, model: true } },
      projectStopService: {
        select: { projectStop: { select: { project: { select: { id: true, code: true } } } } },
      },
    },
  });

  const conflicts: ResourceConflict[] = [];
  for (const t of candidates) {
    const otherEnd = new Date(
      t.startAt.getTime() + t.durationMinutes * 60_000,
    );
    if (otherEnd <= newStart) continue; // ends at or before new window starts

    const project = t.projectStopService?.projectStop?.project ?? null;

    if (employeeId && t.assigneeEmployeeId === employeeId && t.assigneeEmployee) {
      conflicts.push({
        taskId: t.id,
        resourceKind: "EMPLOYEE",
        resourceId: t.assigneeEmployee.id,
        resourceName: t.assigneeEmployee.name || "Υπάλληλος",
        otherStart: t.startAt,
        otherEnd,
        projectCode: project?.code ?? null,
        projectId: project?.id ?? null,
        taskTitle: t.title,
      });
    }
    if (vehicleId && t.vehicleId === vehicleId && t.vehicle) {
      conflicts.push({
        taskId: t.id,
        resourceKind: "VEHICLE",
        resourceId: t.vehicle.id,
        resourceName:
          [t.vehicle.brand, t.vehicle.model].filter(Boolean).join(" ") ||
          t.vehicle.plate ||
          "Όχημα",
        otherStart: t.startAt,
        otherEnd,
        projectCode: project?.code ?? null,
        projectId: project?.id ?? null,
        taskTitle: t.title,
      });
    }
  }

  return conflicts;
}

/**
 * Persist an override audit row. Call this from the task save action when the
 * carrier has acknowledged conflicts and chosen to proceed anyway.
 */
export async function recordAvailabilityOverride(args: {
  taskId: string;
  overriddenByUserId: string;
  reason: string | null;
  conflicts: ResourceConflict[];
}): Promise<void> {
  await db.availabilityOverride.create({
    data: {
      taskId: args.taskId,
      overriddenByUserId: args.overriddenByUserId,
      reason: args.reason,
      conflictsJson: args.conflicts as unknown as object,
    },
  });
}
