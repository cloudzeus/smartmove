import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";

interface BuildInput {
  tenantId: string;
  moveRequestId: string;
  createdByUserId: string;
  scheduledStart: Date; // when the move is scheduled to begin (accepted slot)
}

/**
 * Generate the default JobTask plan for a MoveRequest, derived from the move
 * details (volume, distance, crane, packing, multi-stop). Each created task is
 * UNASSIGNED — the carrier picks employees/partners afterwards on the Gantt.
 *
 * Heuristics:
 *  • PACKING       (PREP)      — 1h, day-before evening if `packing` requested
 *  • LOADING                    — max(60min, volume × 15min)
 *  • CRANE PICKUP  (CRANE)     — 60min, overlapping start of LOADING, if crane required
 *  • TRANSIT                    — max(45min, distance_km / 60 × 60min), +60min intercity buffer when distance > 50 km
 *  • CRANE DROP    (CRANE)     — 60min, overlapping start of UNLOADING, if crane required
 *  • UNLOADING                  — max(60min, volume × 15min)
 *  • ASSEMBLY                   — 90min after unloading if packing requested (disassembled)
 *
 * Idempotent: skips creation if any JobTask already exists for this move.
 */
export async function buildJobTasksForMove(
  input: BuildInput,
): Promise<{ created: number; skipped: boolean }> {
  // Skip if tasks already exist (e.g. carrier manually built a plan)
  const existing = await db.jobTask.count({
    where: { moveRequestId: input.moveRequestId },
  });
  if (existing > 0) return { created: 0, skipped: true };

  const move = await db.moveRequest.findUnique({
    where: { id: input.moveRequestId },
    select: {
      id: true,
      itemsCount: true,
      totalVolumeM3: true,
      fromLat: true,
      fromLng: true,
      toLat: true,
      toLng: true,
      crane: true,
      packing: true,
      multiStop: true,
    },
  });
  if (!move) return { created: 0, skipped: true };

  const volume = move.totalVolumeM3 ?? 0;
  const distanceKm = haversineKm(
    move.fromLat,
    move.fromLng,
    move.toLat,
    move.toLng,
  );

  const loadingMin = clamp(Math.round(volume * 15), 60, 240);
  // Intercity buffer: +60min όταν η μεταφορά είναι σε άλλη πόλη (heuristic: distance > 50 km).
  const isIntercity = distanceKm > 50;
  const transitBase = distanceKm > 0 ? Math.round((distanceKm / 60) * 60) : 60;
  const transitMin = clamp(transitBase + (isIntercity ? 60 : 0), 45, 720);
  const unloadingMin = clamp(Math.round(volume * 15), 60, 240);

  const craneRequired = move.crane && move.crane !== "NONE";
  const packingRequired = move.packing;

  let sortOrder = 0;
  let cursor = new Date(input.scheduledStart);

  const tasks: Prisma.JobTaskCreateManyInput[] = [];

  const add = (
    title: string,
    category: Prisma.JobTaskCreateManyInput["category"],
    startAt: Date,
    durationMinutes: number,
    description?: string,
  ) => {
    tasks.push({
      tenantId: input.tenantId,
      moveRequestId: input.moveRequestId,
      createdByUserId: input.createdByUserId,
      title,
      description: description ?? null,
      category,
      startAt,
      durationMinutes,
      status: "PLANNED",
      assigneeKind: "UNASSIGNED",
      sortOrder: sortOrder++,
    });
  };

  // PREP — packing the day before
  if (packingRequired) {
    const prepStart = new Date(input.scheduledStart);
    prepStart.setDate(prepStart.getDate() - 1);
    prepStart.setHours(17, 0, 0, 0);
    add(
      "Πακετάρισμα & αμπαλάζ (προηγούμενη ημέρα)",
      "PREP",
      prepStart,
      120,
      "Συσκευασία ευαίσθητων αντικειμένων, ξεμοντάρισμα μεγάλων επίπλων.",
    );
  }

  // CRANE pickup — overlaps with loading start
  if (craneRequired) {
    const craneStart = new Date(cursor);
    add(
      "Γερανός — παραλαβή",
      "CRANE",
      craneStart,
      60,
      `Ανύψωση/κατέβασμα από ${humanCrane(move.crane)} στο σημείο παραλαβής.`,
    );
  }

  // LOADING
  add(
    "Φόρτωση",
    "LOADING",
    new Date(cursor),
    loadingMin,
    `Φόρτωση ${move.itemsCount} αντικειμένων (${volume.toFixed(1)} m³).`,
  );
  cursor = addMinutes(cursor, loadingMin);

  // TRANSIT
  add(
    distanceKm > 0
      ? `Διαδρομή (${distanceKm.toFixed(0)} km)`
      : "Διαδρομή προς προορισμό",
    "TRANSIT",
    new Date(cursor),
    transitMin,
    distanceKm > 0
      ? `Εκτιμώμενη απόσταση ${distanceKm.toFixed(0)} km · ~${(distanceKm / 60).toFixed(1)}h${isIntercity ? " + 60′ intercity buffer" : ""}.`
      : undefined,
  );
  cursor = addMinutes(cursor, transitMin);

  // CRANE drop
  if (craneRequired) {
    const craneStart = new Date(cursor);
    add(
      "Γερανός — παράδοση",
      "CRANE",
      craneStart,
      60,
      "Ανύψωση/κατέβασμα στο σημείο παράδοσης.",
    );
  }

  // UNLOADING
  add(
    "Ξεφόρτωμα",
    "UNLOADING",
    new Date(cursor),
    unloadingMin,
    `Ξεφόρτωμα και τοποθέτηση ${move.itemsCount} αντικειμένων.`,
  );
  cursor = addMinutes(cursor, unloadingMin);

  // ASSEMBLY (if packing was requested, things were disassembled)
  if (packingRequired) {
    add(
      "Συναρμολόγηση επίπλων",
      "ASSEMBLY",
      new Date(cursor),
      90,
      "Επανασυναρμολόγηση κρεβατιών, ντουλαπών και μεγάλων επίπλων.",
    );
  }

  if (tasks.length === 0) return { created: 0, skipped: false };
  const result = await db.jobTask.createMany({ data: tasks });
  return { created: result.count, skipped: false };
}

// ---------------- helpers ----------------

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function addMinutes(d: Date, minutes: number): Date {
  return new Date(d.getTime() + minutes * 60_000);
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

function humanCrane(c: string): string {
  switch (c) {
    case "SOME":
      return "ορισμένα αντικείμενα";
    case "ALL":
      return "όλα τα αντικείμενα";
    default:
      return "ψηλό σημείο";
  }
}
