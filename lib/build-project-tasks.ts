import type { Prisma, ServiceType, StopType } from "@prisma/client";

import { db } from "@/lib/db";

interface BuildInput {
  tenantId: string;
  moveRequestId: string;
  offerId: string;
  createdByUserId: string;
  scheduledStart: Date;
  totalPriceCents: number;
}

interface BuildResult {
  projectId: string;
  projectCode: string;
  stopsCreated: number;
  servicesCreated: number;
  tasksCreated: number;
  skipped: boolean;
}

/**
 * Create a CarrierProject (with ProjectStops and per-stop ProjectStopServices)
 * for an accepted MoveRequest, and generate the default JobTask plan attached
 * to those services. Dual-writes JobTask.moveRequestId AND
 * JobTask.projectStopServiceId during the expand→backfill→contract migration.
 *
 * Idempotent: if a CarrierProject already exists for the move, returns early.
 */
export async function buildProjectAndTasksForMove(
  input: BuildInput,
): Promise<BuildResult> {
  const existing = await db.carrierProject.findUnique({
    where: { moveRequestId: input.moveRequestId },
    select: { id: true, code: true },
  });
  if (existing) {
    return {
      projectId: existing.id,
      projectCode: existing.code,
      stopsCreated: 0,
      servicesCreated: 0,
      tasksCreated: 0,
      skipped: true,
    };
  }

  const move = await db.moveRequest.findUnique({
    where: { id: input.moveRequestId },
    include: {
      stops: { orderBy: { sequence: "asc" } },
    },
  });
  if (!move) {
    throw new Error(`MoveRequest ${input.moveRequestId} not found`);
  }

  const volume = move.totalVolumeM3 ?? 0;
  const packingRequired = move.packing;

  // Normalize the trip into an ordered list of "logical stops" with crane flag.
  const logical = normalizeStops(move);
  if (logical.length === 0) {
    throw new Error(
      `MoveRequest ${move.id} has no usable pickup/delivery information`,
    );
  }

  const projectCode = await generateProjectCode(input.tenantId);

  // Create project + stops + services in one transaction so we never end up
  // with a half-built tree if something fails.
  const project = await db.$transaction(async (tx) => {
    const created = await tx.carrierProject.create({
      // Project's scheduledStart defaults to 2 days before the actual move
      // slot — gives the carrier a 2-day prep window visible on calendars.
      // Tasks themselves are still scheduled from the real move time below.
      data: {
        tenantId: input.tenantId,
        moveRequestId: input.moveRequestId,
        offerId: input.offerId,
        code: projectCode,
        status: "PLANNED",
        scheduledStart: subtractDays(input.scheduledStart, 2),
        scheduledEnd: input.scheduledStart,
        totalPriceCents: input.totalPriceCents,
      },
    });

    for (const ls of logical) {
      const stop = await tx.projectStop.create({
        data: {
          projectId: created.id,
          moveStopId: ls.moveStopId,
          sequence: ls.sequence,
          type: ls.type,
          label: ls.label,
          address: ls.address,
          lat: ls.lat,
          lng: ls.lng,
        },
      });

      for (const svc of plannedServicesForStop(ls, {
        packingRequired,
        isFirstPickup: ls.isFirstPickup,
        isLastDelivery: ls.isLastDelivery,
      })) {
        await tx.projectStopService.create({
          data: {
            projectStopId: stop.id,
            serviceType: svc.serviceType,
            label: svc.label,
            quantity: 1,
          },
        });
      }
    }

    return created;
  });

  // Build the JobTask plan (same heuristics as the legacy generator, but
  // each task is now also linked to the right ProjectStopService).
  const services = await db.projectStopService.findMany({
    where: { projectStop: { projectId: project.id } },
    include: { projectStop: true },
    orderBy: [
      { projectStop: { sequence: "asc" } },
      { serviceType: "asc" },
    ],
  });

  // Index services by (sequence, serviceType) for quick lookup while we lay
  // tasks out on the timeline.
  const svcByStopType = new Map<string, string>();
  for (const s of services) {
    svcByStopType.set(`${s.projectStop.sequence}:${s.serviceType}`, s.id);
  }

  const tasks: Prisma.JobTaskCreateManyInput[] = [];
  let sortOrder = 0;
  let cursor = new Date(input.scheduledStart);

  const distanceKm = haversineKm(
    move.fromLat,
    move.fromLng,
    move.toLat,
    move.toLng,
  );

  const loadingMin = clamp(Math.round(volume * 15), 60, 240);
  const unloadingMin = clamp(Math.round(volume * 15), 60, 240);
  // Intercity buffer: +60min όταν η συνολική μεταφορά είναι σε άλλη πόλη (distance > 50 km).
  const isIntercity = distanceKm > 50;
  const transitMin = clamp(
    (distanceKm > 0 ? Math.round((distanceKm / 60) * 60) : 60) + (isIntercity ? 60 : 0),
    45,
    720,
  );

  const pushTask = (args: {
    sequence: number;
    serviceType: ServiceType;
    title: string;
    category: Prisma.JobTaskCreateManyInput["category"];
    startAt: Date;
    durationMinutes: number;
    description?: string;
  }) => {
    const serviceId = svcByStopType.get(`${args.sequence}:${args.serviceType}`);
    if (!serviceId) return;
    tasks.push({
      tenantId: input.tenantId,
      moveRequestId: input.moveRequestId,
      projectStopServiceId: serviceId,
      createdByUserId: input.createdByUserId,
      title: args.title,
      description: args.description ?? null,
      category: args.category,
      startAt: args.startAt,
      durationMinutes: args.durationMinutes,
      status: "PLANNED",
      assigneeKind: "UNASSIGNED",
      sortOrder: sortOrder++,
    });
  };

  // Day-before packing — anchored to the first pickup, not to a stop sequence,
  // so we only emit it once even on multi-stop moves.
  const firstPickup = logical.find((s) => s.type === "PICKUP");
  if (packingRequired && firstPickup) {
    const prepStart = new Date(input.scheduledStart);
    prepStart.setDate(prepStart.getDate() - 1);
    prepStart.setHours(17, 0, 0, 0);
    pushTask({
      sequence: firstPickup.sequence,
      serviceType: "PACKING",
      title: "Πακετάρισμα & αμπαλάζ (προηγούμενη ημέρα)",
      category: "PREP",
      startAt: prepStart,
      durationMinutes: 120,
      description:
        "Συσκευασία ευαίσθητων αντικειμένων, ξεμοντάρισμα μεγάλων επίπλων.",
    });
  }

  for (let i = 0; i < logical.length; i++) {
    const ls = logical[i];

    if (ls.craneRequired) {
      pushTask({
        sequence: ls.sequence,
        serviceType: "CRANE",
        title:
          ls.type === "PICKUP" ? "Γερανός — παραλαβή" : "Γερανός — παράδοση",
        category: "CRANE",
        startAt: new Date(cursor),
        durationMinutes: 60,
        description: `Ανύψωση/κατέβασμα στο σημείο ${ls.address}.`,
      });
    }

    if (ls.type === "PICKUP") {
      pushTask({
        sequence: ls.sequence,
        serviceType: "LOADING",
        title: i === 0 ? "Φόρτωση" : `Φόρτωση (στάση ${i + 1})`,
        category: "LOADING",
        startAt: new Date(cursor),
        durationMinutes: loadingMin,
        description: `Φόρτωση αντικειμένων στο ${ls.address}.`,
      });
      cursor = addMinutes(cursor, loadingMin);
    } else {
      pushTask({
        sequence: ls.sequence,
        serviceType: "UNLOADING",
        title:
          i === logical.length - 1
            ? "Ξεφόρτωμα"
            : `Ξεφόρτωμα (στάση ${i + 1})`,
        category: "UNLOADING",
        startAt: new Date(cursor),
        durationMinutes: unloadingMin,
        description: `Ξεφόρτωμα και τοποθέτηση στο ${ls.address}.`,
      });
      cursor = addMinutes(cursor, unloadingMin);
    }

    // Insert TRANSIT to the next stop, only once we have one.
    const next = logical[i + 1];
    if (next) {
      const segmentKm = haversineKm(ls.lat, ls.lng, next.lat, next.lng);
      const segmentIntercity = segmentKm > 50;
      const segmentMin = clamp(
        (segmentKm > 0 ? Math.round((segmentKm / 60) * 60) : transitMin) + (segmentIntercity ? 60 : 0),
        30,
        720,
      );
      pushTask({
        sequence: ls.sequence,
        serviceType: "TRANSIT",
        title:
          segmentKm > 0
            ? `Διαδρομή (${segmentKm.toFixed(0)} km)`
            : "Διαδρομή προς επόμενη στάση",
        category: "TRANSIT",
        startAt: new Date(cursor),
        durationMinutes: segmentMin,
      });
      cursor = addMinutes(cursor, segmentMin);
    }
  }

  // ASSEMBLY at the last delivery if packing was requested.
  const lastDelivery = [...logical].reverse().find((s) => s.type === "DELIVERY");
  if (packingRequired && lastDelivery) {
    pushTask({
      sequence: lastDelivery.sequence,
      serviceType: "ASSEMBLY",
      title: "Συναρμολόγηση επίπλων",
      category: "ASSEMBLY",
      startAt: new Date(cursor),
      durationMinutes: 90,
      description:
        "Επανασυναρμολόγηση κρεβατιών, ντουλαπών και μεγάλων επίπλων.",
    });
  }

  let tasksCreated = 0;
  if (tasks.length > 0) {
    const result = await db.jobTask.createMany({ data: tasks });
    tasksCreated = result.count;
  }

  return {
    projectId: project.id,
    projectCode,
    stopsCreated: logical.length,
    servicesCreated: services.length,
    tasksCreated,
    skipped: false,
  };
}

// ---------------- helpers ----------------

interface LogicalStop {
  moveStopId: string | null;
  sequence: number;
  type: StopType;
  label: string | null;
  address: string;
  lat: number | null;
  lng: number | null;
  craneRequired: boolean;
  isFirstPickup: boolean;
  isLastDelivery: boolean;
}

function normalizeStops(
  move: Prisma.MoveRequestGetPayload<{ include: { stops: true } }>,
): LogicalStop[] {
  const out: LogicalStop[] = [];

  if (move.multiStop && move.stops.length > 0) {
    move.stops.forEach((s, i) => {
      out.push({
        moveStopId: s.id,
        sequence: i,
        type: s.type,
        label: s.label,
        address: s.address,
        lat: s.lat,
        lng: s.lng,
        craneRequired: s.crane !== "NONE",
        isFirstPickup: false,
        isLastDelivery: false,
      });
    });
  } else {
    // Single-stop: synthesize pickup + delivery from the MoveRequest fields.
    const craneRequired =
      move.crane != null && move.crane !== "NONE";
    out.push({
      moveStopId: null,
      sequence: 0,
      type: "PICKUP",
      label: null,
      address: move.fromAddress,
      lat: move.fromLat,
      lng: move.fromLng,
      craneRequired,
      isFirstPickup: true,
      isLastDelivery: false,
    });
    out.push({
      moveStopId: null,
      sequence: 1,
      type: "DELIVERY",
      label: null,
      address: move.toAddress,
      lat: move.toLat,
      lng: move.toLng,
      craneRequired,
      isFirstPickup: false,
      isLastDelivery: true,
    });
  }

  // Flag first PICKUP and last DELIVERY for ASSEMBLY/PACKING placement.
  const firstPickupIdx = out.findIndex((s) => s.type === "PICKUP");
  if (firstPickupIdx >= 0) out[firstPickupIdx].isFirstPickup = true;
  for (let i = out.length - 1; i >= 0; i--) {
    if (out[i].type === "DELIVERY") {
      out[i].isLastDelivery = true;
      break;
    }
  }
  return out;
}

interface ServicePlanInput {
  packingRequired: boolean;
  isFirstPickup: boolean;
  isLastDelivery: boolean;
}

function plannedServicesForStop(
  stop: LogicalStop,
  ctx: ServicePlanInput,
): Array<{ serviceType: ServiceType; label: string | null }> {
  const out: Array<{ serviceType: ServiceType; label: string | null }> = [];

  if (ctx.packingRequired && ctx.isFirstPickup) {
    out.push({ serviceType: "PACKING", label: "Πακετάρισμα & αμπαλάζ" });
  }
  if (stop.craneRequired) {
    out.push({ serviceType: "CRANE", label: "Γερανός" });
  }
  if (stop.type === "PICKUP") {
    out.push({ serviceType: "LOADING", label: "Φόρτωση" });
  } else {
    out.push({ serviceType: "UNLOADING", label: "Ξεφόρτωμα" });
  }
  // TRANSIT service attaches to the stop you depart from (added unconditionally
  // for all stops except the very last — the builder decides whether to emit a
  // task against it).
  out.push({ serviceType: "TRANSIT", label: "Διαδρομή" });
  if (ctx.packingRequired && ctx.isLastDelivery) {
    out.push({ serviceType: "ASSEMBLY", label: "Συναρμολόγηση επίπλων" });
  }
  return out;
}

async function generateProjectCode(tenantId: string): Promise<string> {
  const year = new Date().getFullYear();
  // Count existing projects for this tenant in the current year to derive a
  // sequence number. Collisions are extremely unlikely; the unique index on
  // `code` will reject any that slip through and the caller can retry.
  const yearStart = new Date(year, 0, 1);
  const count = await db.carrierProject.count({
    where: { tenantId, createdAt: { gte: yearStart } },
  });
  const seq = String(count + 1).padStart(5, "0");
  return `PRJ-${year}-${seq}`;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function addMinutes(d: Date, minutes: number): Date {
  return new Date(d.getTime() + minutes * 60_000);
}

function subtractDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() - days);
  return out;
}

function haversineKm(
  lat1: number | null,
  lng1: number | null,
  lat2: number | null,
  lng2: number | null,
): number {
  if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) return 0;
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
