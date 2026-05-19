import "server-only";

import { db } from "./db";
import { estimateTripCost, type TripCostBreakdown } from "./trip-cost";

export interface OfferLineItem {
  /** Item name from the request (may not match a catalog entry). */
  name: string;
  /** Normalized lookup key used to match into the catalog. */
  matchedKey: string | null;
  /** Catalog display name in EL when matched, else the raw name. */
  catalogName: string | null;
  quantity: number;
  /** Unit prices in cents from the carrier's catalog (0 when unmatched). */
  unitBaseCents: number;
  unitCraneCents: number;
  unitPackingCents: number;
  /** Computed for this line. */
  lineTotalCents: number;
}

export interface OfferPricingBreakdown {
  items: OfferLineItem[];
  itemsTotalCents: number;
  trip: TripCostBreakdown | null;
  /** items + trip */
  totalCents: number;
  /** Number of items that found a catalog price. */
  matchedCount: number;
  /** Number of items that couldn't be matched and contributed 0. */
  unmatchedCount: number;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .replace(/[^a-z0-9α-ω\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

interface RequestItem {
  name: string;
  quantity: number;
  catalogKey?: string;
}

/**
 * Suggest an offer price for (carrier, request, optional vehicle).
 *
 * - Items: looked up in the carrier's CarrierItemPrice catalog. Match priority:
 *     1. Exact `catalogKey` on the item (set by scan/wizard when available)
 *     2. Normalized name match against ItemCatalog.nameEl or .nameEn
 *   Adds crane/packing surcharges when the request has them enabled.
 * - Trip cost: computed for the supplied vehicle via OSRM (or haversine
 *   fallback) using vehicle.base → pickup → dropoff → base × costPerKm.
 *
 * Returns null when the request has no items.
 */
export async function suggestOfferPrice(opts: {
  moveRequestId: string;
  carrierUserId: string;
  vehicleId?: string | null;
}): Promise<OfferPricingBreakdown | null> {
  const moveRequest = await db.moveRequest.findUnique({
    where: { id: opts.moveRequestId },
    select: {
      id: true,
      fromLat: true,
      fromLng: true,
      toLat: true,
      toLng: true,
      itemsJson: true,
      crane: true,
      packing: true,
    },
  });
  if (!moveRequest) return null;

  const items = (moveRequest.itemsJson as unknown as RequestItem[] | null) ?? [];
  if (items.length === 0) return null;

  // Get the carrier's tenant.
  const membership = await db.tenantMembership.findFirst({
    where: { userId: opts.carrierUserId },
    select: { tenantId: true },
    orderBy: { createdAt: "asc" },
  });
  if (!membership) return null;

  const [prices, catalog] = await Promise.all([
    db.carrierItemPrice.findMany({
      where: { tenantId: membership.tenantId },
    }),
    db.itemCatalog.findMany({ where: { isActive: true } }),
  ]);

  // Build maps for catalog lookup.
  const priceByKey = new Map(prices.map((p) => [p.itemKey, p]));
  const catalogByNorm = new Map<
    string,
    { key: string; name: string }
  >();
  for (const c of catalog) {
    catalogByNorm.set(normalize(c.nameEl), { key: c.key, name: c.nameEl });
    catalogByNorm.set(normalize(c.nameEn), { key: c.key, name: c.nameEl });
  }

  const crane = moveRequest.crane !== "NONE";
  const packing = moveRequest.packing;

  let matchedCount = 0;
  let unmatchedCount = 0;
  let itemsTotalCents = 0;
  const lines: OfferLineItem[] = items.map((it) => {
    const qty = Math.max(0, Number(it.quantity) || 0);
    // Try catalogKey first, else name match.
    let key: string | null = it.catalogKey ?? null;
    let catalogName: string | null = null;
    if (key) {
      catalogName = catalog.find((c) => c.key === key)?.nameEl ?? null;
    } else {
      const hit = catalogByNorm.get(normalize(it.name));
      if (hit) {
        key = hit.key;
        catalogName = hit.name;
      }
    }

    let unitBase = 0;
    let unitCrane = 0;
    let unitPacking = 0;
    if (key) {
      const p = priceByKey.get(key);
      if (p) {
        unitBase = p.basePriceCents;
        unitCrane = crane ? p.craneSurchargeCents : 0;
        unitPacking = packing ? p.packingSurchargeCents : 0;
        matchedCount += 1;
      } else {
        // Matched a catalog key but the carrier hasn't priced this item yet.
        unmatchedCount += 1;
      }
    } else {
      unmatchedCount += 1;
    }

    const lineTotal = (unitBase + unitCrane + unitPacking) * qty;
    itemsTotalCents += lineTotal;

    return {
      name: it.name,
      matchedKey: key,
      catalogName,
      quantity: qty,
      unitBaseCents: unitBase,
      unitCraneCents: unitCrane,
      unitPackingCents: unitPacking,
      lineTotalCents: lineTotal,
    };
  });

  let trip: TripCostBreakdown | null = null;
  if (
    opts.vehicleId &&
    moveRequest.fromLat != null &&
    moveRequest.fromLng != null &&
    moveRequest.toLat != null &&
    moveRequest.toLng != null
  ) {
    const v = await db.vehicle.findFirst({
      where: { id: opts.vehicleId, tenantId: membership.tenantId },
      select: {
        baseLat: true,
        baseLng: true,
        costPerKmCents: true,
        minTripCents: true,
        callOutCents: true,
        branch: { select: { lat: true, lng: true } },
      },
    });
    if (v) {
      const base =
        v.baseLat != null && v.baseLng != null
          ? { lat: v.baseLat, lng: v.baseLng }
          : v.branch?.lat != null && v.branch?.lng != null
            ? { lat: v.branch.lat, lng: v.branch.lng }
            : null;
      if (base) {
        trip = await estimateTripCost(
          {
            base,
            costPerKmCents: v.costPerKmCents,
            minTripCents: v.minTripCents,
            callOutCents: v.callOutCents,
          },
          { lat: moveRequest.fromLat, lng: moveRequest.fromLng },
          { lat: moveRequest.toLat, lng: moveRequest.toLng },
        );
      }
    }
  }

  return {
    items: lines,
    itemsTotalCents,
    trip,
    totalCents: itemsTotalCents + (trip?.totalCents ?? 0),
    matchedCount,
    unmatchedCount,
  };
}
