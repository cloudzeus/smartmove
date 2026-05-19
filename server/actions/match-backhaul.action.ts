"use server";

/**
 * Geospatial LTL backhaul matcher.
 *
 * Given a vehicle currently executing Trip A (origin → destination) with
 * some load already on board, find published MoveRequests whose pickup is
 * within `radiusInMeters` of Trip A's origin AND whose dropoff is within
 * the same radius of Trip A's destination, AND whose volume fits in the
 * remaining capacity (with a 5pp safety buffer).
 *
 * Implementation notes:
 *   - Runs server-side only (`'use server'`).
 *   - Uses Prisma's `$queryRaw`, which delegates to the shared `pg` Pool
 *     managed by `@prisma/adapter-pg`. We do NOT open a second connection
 *     pool — that would double our PG connection count and complicate
 *     transaction semantics.
 *   - Casts `pickupGeom`/`dropoffGeom` (already `geography(Point,4326)`)
 *     against the input points so `ST_DWithin` returns metres directly
 *     and the GIST indexes are used.
 *   - Sorts by total detour (pickup + dropoff distance) ascending so the
 *     caller can take the top N efficient consolidations.
 */
import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";

export interface BackhaulMatchInput {
  /** Trip A start latitude */
  originLat: number;
  /** Trip A start longitude */
  originLon: number;
  /** Trip A end latitude */
  destinationLat: number;
  /** Trip A end longitude */
  destinationLon: number;
  /** 0–100. e.g. 70 means truck is 70 % full */
  currentVehicleLoad: number;
  /** Search radius in metres around BOTH endpoints. e.g. 20000 = 20 km */
  radiusInMeters: number;
  /** Optional cap on returned rows. Defaults to 50 */
  limit?: number;
  /** Optional: include only requests for/after this date */
  earliestDate?: Date;
}

export interface BackhaulMatch {
  id: string;
  /** Percent of vehicle capacity this request needs (0–100) */
  loadPercentage: number;
  pickupAddress: string;
  dropoffAddress: string;
  preferredDate: Date | null;
  /** Metres from Trip A's origin to this request's pickup */
  pickupDistanceM: number;
  /** Metres from Trip A's destination to this request's dropoff */
  dropoffDistanceM: number;
  /** Sum of the two — primary sort key */
  totalDetourM: number;
}

/**
 * Convert raw request volume (m³) into a "% of vehicle capacity".
 * We don't store volume-as-percent on MoveRequest, so we compute it
 * inline against the matching vehicle's `capacityM3` if known. For
 * vehicles without `capacityM3`, we fall back to a sane default of
 * 20 m³ (typical 3.5 t van) — overridable via env later if needed.
 */
const DEFAULT_VEHICLE_CAPACITY_M3 = 20;
/** Safety buffer the spec calls out: never fill to 100 % */
const CAPACITY_SAFETY_BUFFER_PCT = 5;

export async function findBackhaulMatches(
  input: BackhaulMatchInput,
  /** Optional: the vehicle being routed, to use its real capacity */
  vehicleCapacityM3: number = DEFAULT_VEHICLE_CAPACITY_M3,
): Promise<BackhaulMatch[]> {
  const {
    originLat,
    originLon,
    destinationLat,
    destinationLon,
    currentVehicleLoad,
    radiusInMeters,
    limit = 50,
    earliestDate,
  } = input;

  // Maximum % of the truck this candidate request may consume.
  const maxLoadPct = Math.max(
    0,
    100 - currentVehicleLoad - CAPACITY_SAFETY_BUFFER_PCT,
  );
  if (maxLoadPct <= 0) return [];

  // Capacity expressed as m³ so we can compare against MoveRequest.totalVolumeM3.
  const maxVolumeM3 = (maxLoadPct / 100) * vehicleCapacityM3;

  const dateFilter = earliestDate
    ? Prisma.sql`AND mr."preferredDate" >= ${earliestDate}`
    : Prisma.empty;

  // Build the geography literals once. We use ST_MakePoint(lng, lat) — note
  // the PostGIS convention is (X=lon, Y=lat).
  const rows = await db.$queryRaw<
    Array<{
      id: string;
      load_percentage: number;
      from_address: string;
      to_address: string;
      preferred_date: Date | null;
      pickup_distance_m: number;
      dropoff_distance_m: number;
      total_detour_m: number;
    }>
  >`
    WITH trip_a AS (
      SELECT
        ST_SetSRID(ST_MakePoint(${originLon}, ${originLat}), 4326)::geography      AS origin,
        ST_SetSRID(ST_MakePoint(${destinationLon}, ${destinationLat}), 4326)::geography AS destination
    )
    SELECT
      mr."id"            AS id,
      ROUND((mr."totalVolumeM3" / ${vehicleCapacityM3}::float * 100)::numeric, 2)::float
                          AS load_percentage,
      mr."fromAddress"   AS from_address,
      mr."toAddress"     AS to_address,
      mr."preferredDate" AS preferred_date,
      ST_Distance(mr."pickupGeom",  trip_a.origin)      AS pickup_distance_m,
      ST_Distance(mr."dropoffGeom", trip_a.destination) AS dropoff_distance_m,
      ST_Distance(mr."pickupGeom",  trip_a.origin)
        + ST_Distance(mr."dropoffGeom", trip_a.destination) AS total_detour_m
    FROM "MoveRequest" mr, trip_a
    WHERE mr."status" = 'PUBLISHED'
      AND mr."pickupGeom"  IS NOT NULL
      AND mr."dropoffGeom" IS NOT NULL
      AND ST_DWithin(mr."pickupGeom",  trip_a.origin,      ${radiusInMeters})
      AND ST_DWithin(mr."dropoffGeom", trip_a.destination, ${radiusInMeters})
      AND mr."totalVolumeM3" > 0
      AND mr."totalVolumeM3" <= ${maxVolumeM3}
      ${dateFilter}
    ORDER BY total_detour_m ASC
    LIMIT ${limit}
  `;

  return rows.map((r) => ({
    id: r.id,
    loadPercentage: r.load_percentage,
    pickupAddress: r.from_address,
    dropoffAddress: r.to_address,
    preferredDate: r.preferred_date,
    pickupDistanceM: r.pickup_distance_m,
    dropoffDistanceM: r.dropoff_distance_m,
    totalDetourM: r.total_detour_m,
  }));
}
