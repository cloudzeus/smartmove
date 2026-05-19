/**
 * Vehicle trip cost estimation.
 *
 * Formula:
 *   cost = callOut + Σ(legKm) × costPerKm
 *   cost = max(cost, minTrip)
 *
 * Legs (round trip): base → pickup → dropoff → base
 *
 * Distance is computed via OSRM (driving). Falls back to haversine straight-
 * line × 1.3 when OSRM is unavailable. Returns null if the vehicle has no
 * base coordinates or no rate set.
 */

import "server-only";

export interface Coord {
  lat: number;
  lng: number;
}

export interface VehicleCostInput {
  base: Coord | null;
  costPerKmCents: number;
  minTripCents: number;
  callOutCents: number;
}

export interface TripCostBreakdown {
  totalCents: number;
  distanceKm: number;
  legs: Array<{ from: Coord; to: Coord; km: number }>;
  source: "osrm" | "haversine";
  minApplied: boolean;
  callOutCents: number;
  variableCents: number;
}

const OSRM = "https://router.project-osrm.org/route/v1/driving";
const EARTH_RADIUS_KM = 6371;

function haversineKm(a: Coord, b: Coord): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

async function osrmRouteKm(legs: Array<[Coord, Coord]>): Promise<number | null> {
  // Build a single multi-waypoint request to minimise HTTP overhead.
  // Coordinates: base → pickup → dropoff → base
  if (legs.length === 0) return 0;
  const pts: string[] = [];
  pts.push(`${legs[0][0].lng},${legs[0][0].lat}`);
  for (const [, to] of legs) pts.push(`${to.lng},${to.lat}`);
  try {
    const res = await fetch(`${OSRM}/${pts.join(";")}?overview=false`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      routes?: Array<{ distance: number }>;
    };
    const dist = data.routes?.[0]?.distance;
    return typeof dist === "number" ? dist / 1000 : null;
  } catch {
    return null;
  }
}

/**
 * @param vehicle vehicle pricing inputs (base + rates)
 * @param pickup move-request pickup point
 * @param dropoff move-request dropoff point
 */
export async function estimateTripCost(
  vehicle: VehicleCostInput,
  pickup: Coord,
  dropoff: Coord,
): Promise<TripCostBreakdown | null> {
  if (!vehicle.base) return null;
  if (vehicle.costPerKmCents <= 0 && vehicle.callOutCents <= 0) return null;

  const legs = [
    [vehicle.base, pickup] as [Coord, Coord],
    [pickup, dropoff] as [Coord, Coord],
    [dropoff, vehicle.base] as [Coord, Coord],
  ];

  let source: "osrm" | "haversine" = "osrm";
  let totalKm = await osrmRouteKm(legs);
  if (totalKm == null) {
    source = "haversine";
    totalKm = legs.reduce((s, [a, b]) => s + haversineKm(a, b) * 1.3, 0);
  }

  // Build per-leg breakdown (haversine for display only).
  const perLeg = legs.map(([from, to]) => ({
    from,
    to,
    km: haversineKm(from, to),
  }));

  const variableCents = Math.round(totalKm * vehicle.costPerKmCents);
  const subtotal = vehicle.callOutCents + variableCents;
  const minApplied = subtotal < vehicle.minTripCents;
  const totalCents = minApplied ? vehicle.minTripCents : subtotal;

  return {
    totalCents,
    distanceKm: totalKm,
    legs: perLeg,
    source,
    minApplied,
    callOutCents: vehicle.callOutCents,
    variableCents,
  };
}
