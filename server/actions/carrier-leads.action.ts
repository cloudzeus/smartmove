"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { OfferStatus, Prisma } from "@prisma/client";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { suggestOfferPrice, type OfferPricingBreakdown } from "@/lib/offer-pricing";

export interface LeadSummary {
  id: string;
  status: string;
  type: string;
  preferredDate: Date | null;
  flexDays: number;
  shared: boolean;
  multiStop: boolean;
  fromLocality: string;
  toLocality: string;
  fromLat: number | null;
  fromLng: number | null;
  toLat: number | null;
  toLng: number | null;
  itemsCount: number;
  totalVolumeM3: number;
  fromFloor: number;
  toFloor: number;
  fromElevator: string;
  toElevator: string;
  crane: string;
  packing: boolean;
  truckAccess: string;
  estimatedPriceMinCents: number | null;
  estimatedPriceMaxCents: number | null;
  publishedAt: Date;
  offersCount: number;
  myOffer: {
    id: string;
    priceCents: number;
    estimatedDays: number | null;
    notes: string | null;
    status: string;
    validUntil: Date;
    createdAt: Date;
    proposedSlots: Array<{
      date: string;
      hour: number;
    }>;
    acceptedSlotAt: Date | null;
    contractPdfUrl: string | null;
    contractDocxUrl: string | null;
    contractRef: string | null;
  } | null;
}

type ProposedSlot = { date: string; hour: number };

const SLOT_HOUR_MIN = 7;
const SLOT_HOUR_MAX = 20; // 20:00 is the last selectable hour (covers 20-21)

// Back-compat: old slots stored period MORNING/AFTERNOON/EVENING.
const LEGACY_PERIOD_HOUR: Record<string, number> = {
  MORNING: 9,
  AFTERNOON: 13,
  EVENING: 18,
};

function parseSlots(json: unknown): ProposedSlot[] {
  if (!Array.isArray(json)) return [];
  const out: ProposedSlot[] = [];
  for (const raw of json) {
    if (!raw || typeof raw !== "object") continue;
    const s = raw as { date?: unknown; hour?: unknown; period?: unknown };
    if (typeof s.date !== "string") continue;
    let hour: number | null = null;
    if (typeof s.hour === "number" && Number.isFinite(s.hour)) {
      hour = Math.round(s.hour);
    } else if (typeof s.period === "string" && s.period in LEGACY_PERIOD_HOUR) {
      hour = LEGACY_PERIOD_HOUR[s.period];
    }
    if (hour == null) continue;
    if (hour < SLOT_HOUR_MIN || hour > SLOT_HOUR_MAX) continue;
    out.push({ date: s.date, hour });
  }
  return out;
}

/**
 * Hide the house number but keep the street name and city. The carrier needs
 * enough info to evaluate routing/distance; only personal-info (exact number,
 * floor, owner name) stays hidden. Country suffix is dropped.
 *
 * "Ιπποκράτους 80, Αθήνα, Ελλάδα" → "Ιπποκράτους · Αθήνα"
 */
function anonymizeAddress(addr: string): string {
  const parts = addr
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return "—";

  // First part: street + number → strip trailing digits.
  const streetNoNumber = parts[0]
    .replace(/\s+\d+[a-zA-Z]?$/u, "") // "Ιπποκράτους 80" → "Ιπποκράτους"
    .trim();

  // Drop common country suffixes
  const cleaned = parts.filter(
    (p, i) =>
      i === 0 ||
      !/^(ελλάδα|greece|gr|hellas)$/i.test(p),
  );

  if (cleaned.length === 1) return streetNoNumber || cleaned[0];

  // Replace first segment with the street-without-number, join with the city.
  cleaned[0] = streetNoNumber;
  return cleaned.slice(0, 2).join(" · ");
}

async function assertCarrierUser() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Δεν είσαι συνδεδεμένος.");
  }
  const role = session.user.role;
  if (
    role !== "TENANTADMIN" &&
    role !== "TENANTEMPLOYEE" &&
    role !== "SUPERADMIN" &&
    role !== "EMPLOYEE"
  ) {
    throw new Error("Δεν έχεις δικαίωμα πρόσβασης ως μεταφορέας.");
  }
  return session.user.id;
}

export async function listLeads(): Promise<LeadSummary[]> {
  const userId = await assertCarrierUser();
  const rows = await db.moveRequest.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    include: {
      _count: { select: { offers: true } },
      offers: {
        where: { carrierUserId: userId },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    type: r.type,
    preferredDate: r.preferredDate,
    flexDays: r.flexDays,
    shared: r.shared,
    multiStop: r.multiStop,
    fromLocality: anonymizeAddress(r.fromAddress),
    toLocality: anonymizeAddress(r.toAddress),
    fromLat: r.fromLat,
    fromLng: r.fromLng,
    toLat: r.toLat,
    toLng: r.toLng,
    itemsCount: r.itemsCount,
    totalVolumeM3: r.totalVolumeM3,
    fromFloor: r.fromFloor,
    toFloor: r.toFloor,
    fromElevator: r.fromElevator,
    toElevator: r.toElevator,
    crane: r.crane,
    packing: r.packing,
    truckAccess: r.truckAccess,
    estimatedPriceMinCents: r.estimatedPriceMinCents,
    estimatedPriceMaxCents: r.estimatedPriceMaxCents,
    publishedAt: r.publishedAt,
    offersCount: r._count.offers,
    myOffer: r.offers[0]
      ? {
          id: r.offers[0].id,
          priceCents: r.offers[0].priceCents,
          estimatedDays: r.offers[0].estimatedDays,
          notes: r.offers[0].notes,
          status: r.offers[0].status,
          validUntil: r.offers[0].validUntil,
          createdAt: r.offers[0].createdAt,
          proposedSlots: parseSlots(r.offers[0].proposedSlotsJson),
          acceptedSlotAt: r.offers[0].acceptedSlotAt ?? null,
          contractPdfUrl: r.offers[0].contractPdfUrl ?? null,
          contractDocxUrl: r.offers[0].contractDocxUrl ?? null,
          contractRef: r.offers[0].contractRef ?? null,
        }
      : null,
  }));
}

export interface LeadDetail extends LeadSummary {
  items: Array<{
    name: string;
    quantity: number;
    length_cm: number;
    width_cm: number;
    height_cm: number;
    volume_m3: number;
    photoUrl?: string;
  }>;
  stops: Array<{
    sequence: number;
    type: string;
    locality: string;
    lat: number | null;
    lng: number | null;
    floor: number;
    elevator: string;
  }>;
}

export async function getLead(id: string): Promise<LeadDetail | null> {
  const userId = await assertCarrierUser();
  const r = await db.moveRequest.findUnique({
    where: { id },
    include: {
      stops: { orderBy: { sequence: "asc" } },
      _count: { select: { offers: true } },
      offers: {
        where: { carrierUserId: userId },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
  // Allow access to PUBLISHED (open) and post-acceptance states (AWARDED/COMPLETED)
  // so the carrier can still view the project + download the contract.
  if (!r) return null;
  if (r.status !== "PUBLISHED" && r.status !== "AWARDED" && r.status !== "COMPLETED") {
    return null;
  }
  const items =
    (r.itemsJson as unknown as LeadDetail["items"] | null) ?? [];
  return {
    id: r.id,
    status: r.status,
    type: r.type,
    preferredDate: r.preferredDate,
    flexDays: r.flexDays,
    shared: r.shared,
    multiStop: r.multiStop,
    fromLocality: anonymizeAddress(r.fromAddress),
    toLocality: anonymizeAddress(r.toAddress),
    fromLat: r.fromLat,
    fromLng: r.fromLng,
    toLat: r.toLat,
    toLng: r.toLng,
    itemsCount: r.itemsCount,
    totalVolumeM3: r.totalVolumeM3,
    fromFloor: r.fromFloor,
    toFloor: r.toFloor,
    fromElevator: r.fromElevator,
    toElevator: r.toElevator,
    crane: r.crane,
    packing: r.packing,
    truckAccess: r.truckAccess,
    estimatedPriceMinCents: r.estimatedPriceMinCents,
    estimatedPriceMaxCents: r.estimatedPriceMaxCents,
    publishedAt: r.publishedAt,
    offersCount: r._count.offers,
    myOffer: r.offers[0]
      ? {
          id: r.offers[0].id,
          priceCents: r.offers[0].priceCents,
          estimatedDays: r.offers[0].estimatedDays,
          notes: r.offers[0].notes,
          status: r.offers[0].status,
          validUntil: r.offers[0].validUntil,
          createdAt: r.offers[0].createdAt,
          proposedSlots: parseSlots(r.offers[0].proposedSlotsJson),
          acceptedSlotAt: r.offers[0].acceptedSlotAt ?? null,
          contractPdfUrl: r.offers[0].contractPdfUrl ?? null,
          contractDocxUrl: r.offers[0].contractDocxUrl ?? null,
          contractRef: r.offers[0].contractRef ?? null,
        }
      : null,
    items: items.map((it) => ({
      name: it.name,
      quantity: it.quantity,
      length_cm: it.length_cm,
      width_cm: it.width_cm,
      height_cm: it.height_cm,
      volume_m3: it.volume_m3,
      photoUrl: (it as unknown as { photoUrl?: string }).photoUrl,
    })),
    stops: r.stops.map((s) => ({
      sequence: s.sequence,
      type: s.type,
      locality: anonymizeAddress(s.address),
      lat: s.lat,
      lng: s.lng,
      floor: s.floor,
      elevator: s.elevator,
    })),
  };
}

const slotSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD"),
  hour: z.coerce.number().int().min(SLOT_HOUR_MIN).max(SLOT_HOUR_MAX),
});

const offerSchema = z.object({
  moveRequestId: z.string().min(1),
  priceEur: z.coerce.number().positive("Τιμή > 0"),
  estimatedDays: z.coerce.number().int().positive().nullable().optional(),
  notes: z.string().max(2000).optional(),
  validDays: z.coerce.number().int().min(1).max(60).default(7),
  proposedSlots: z
    .array(slotSchema)
    .min(1, "Πρέπει να προτείνεις τουλάχιστον ένα slot.")
    .max(60),
});

export type SubmitOfferResult =
  | { ok: true; offerId: string }
  | { ok: false; error: string };

export async function submitOffer(
  input: unknown,
): Promise<SubmitOfferResult> {
  let userId: string;
  try {
    userId = await assertCarrierUser();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const parsed = offerSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Λάθος δεδομένα",
    };
  }
  const d = parsed.data;
  const target = await db.moveRequest.findUnique({
    where: { id: d.moveRequestId },
    select: { id: true, status: true },
  });
  if (!target || target.status !== "PUBLISHED") {
    return { ok: false, error: "Το αίτημα δεν δέχεται πια προσφορές." };
  }
  const validUntil = new Date(Date.now() + d.validDays * 24 * 60 * 60 * 1000);
  try {
    const existing = await db.offer.findFirst({
      where: { moveRequestId: d.moveRequestId, carrierUserId: userId },
    });
    let offer;
    if (existing) {
      offer = await db.offer.update({
        where: { id: existing.id },
        data: {
          priceCents: Math.round(d.priceEur * 100),
          estimatedDays: d.estimatedDays ?? null,
          notes: d.notes?.trim() || null,
          validUntil,
          status: OfferStatus.OPEN,
          proposedSlotsJson:
            d.proposedSlots && d.proposedSlots.length > 0
              ? (d.proposedSlots as unknown as Prisma.InputJsonValue)
              : Prisma.JsonNull,
        },
      });
    } else {
      offer = await db.offer.create({
        data: {
          moveRequestId: d.moveRequestId,
          carrierUserId: userId,
          priceCents: Math.round(d.priceEur * 100),
          estimatedDays: d.estimatedDays ?? null,
          notes: d.notes?.trim() || null,
          validUntil,
          status: OfferStatus.OPEN,
          proposedSlotsJson:
            d.proposedSlots && d.proposedSlots.length > 0
              ? (d.proposedSlots as unknown as Prisma.InputJsonValue)
              : Prisma.JsonNull,
        },
      });
    }
    revalidatePath("/carrier/leads");
    revalidatePath(`/carrier/leads/${d.moveRequestId}`);
    revalidatePath("/carrier/offers");
    return { ok: true, offerId: offer.id };
  } catch (e) {
    console.error("[submitOffer]", e);
    return { ok: false, error: "Αποθήκευση προσφοράς απέτυχε." };
  }
}

export async function withdrawOffer(
  offerId: string,
): Promise<{ ok: boolean; error?: string }> {
  let userId: string;
  try {
    userId = await assertCarrierUser();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const offer = await db.offer.findUnique({ where: { id: offerId } });
  if (!offer || offer.carrierUserId !== userId) {
    return { ok: false, error: "Δεν βρέθηκε προσφορά." };
  }
  if (offer.status !== "OPEN") {
    return { ok: false, error: "Η προσφορά δεν είναι ανοιχτή." };
  }
  try {
    await db.offer.delete({ where: { id: offerId } });
    revalidatePath("/carrier/leads");
    revalidatePath("/carrier/offers");
    return { ok: true };
  } catch (e) {
    console.error("[withdrawOffer]", e);
    return { ok: false, error: "Απόσυρση απέτυχε." };
  }
}

export interface MyOffer {
  id: string;
  moveRequestId: string;
  priceCents: number;
  estimatedDays: number | null;
  notes: string | null;
  status: string;
  validUntil: Date;
  createdAt: Date;
  /** Anonymized competitive intel — lowest OPEN offer on the same request from
   * a *different* carrier. Null if no competing offers exist. The carrier sees
   * the price but never the competitor's identity. */
  competition: {
    lowestCents: number;
    totalOpenCompetitors: number;
    /** True if my offer is the current lowest among OPEN offers */
    iAmLowest: boolean;
  } | null;
  request: {
    type: string;
    fromLocality: string;
    toLocality: string;
    preferredDate: Date | null;
    itemsCount: number;
    totalVolumeM3: number;
    status: string;
  };
}

export async function listMyOffers(): Promise<MyOffer[]> {
  const userId = await assertCarrierUser();
  const rows = await db.offer.findMany({
    where: { carrierUserId: userId },
    orderBy: { createdAt: "desc" },
    include: {
      moveRequest: {
        select: {
          type: true,
          fromAddress: true,
          toAddress: true,
          preferredDate: true,
          itemsCount: true,
          totalVolumeM3: true,
          status: true,
        },
      },
    },
  });

  // Fetch all OPEN offers from OTHER carriers on the same MoveRequests in one
  // round-trip, then group in memory.
  const requestIds = Array.from(new Set(rows.map((r) => r.moveRequestId)));
  const competing = await db.offer.findMany({
    where: {
      moveRequestId: { in: requestIds },
      carrierUserId: { not: userId },
      status: "OPEN",
    },
    select: { moveRequestId: true, priceCents: true },
  });
  const compByRequest = new Map<
    string,
    { lowest: number; count: number }
  >();
  for (const c of competing) {
    const cur = compByRequest.get(c.moveRequestId);
    if (!cur) {
      compByRequest.set(c.moveRequestId, {
        lowest: c.priceCents,
        count: 1,
      });
    } else {
      cur.lowest = Math.min(cur.lowest, c.priceCents);
      cur.count += 1;
    }
  }

  return rows.map((o) => {
    const comp = compByRequest.get(o.moveRequestId) ?? null;
    return {
      id: o.id,
      moveRequestId: o.moveRequestId,
      priceCents: o.priceCents,
      estimatedDays: o.estimatedDays,
      notes: o.notes,
      status: o.status,
      validUntil: o.validUntil,
      createdAt: o.createdAt,
      competition: comp
        ? {
            lowestCents: comp.lowest,
            totalOpenCompetitors: comp.count,
            iAmLowest: o.priceCents < comp.lowest,
          }
        : null,
      request: {
        type: o.moveRequest.type,
        fromLocality: anonymizeAddress(o.moveRequest.fromAddress),
        toLocality: anonymizeAddress(o.moveRequest.toAddress),
        preferredDate: o.moveRequest.preferredDate,
        itemsCount: o.moveRequest.itemsCount,
        totalVolumeM3: o.moveRequest.totalVolumeM3,
        status: o.moveRequest.status,
      },
    };
  });
}

export interface CarrierVehicleOption {
  id: string;
  plate: string;
  brand: string | null;
  model: string | null;
  capacityM3: number | null;
  costPerKmCents: number;
  hasBase: boolean;
}

export async function listMyVehicles(): Promise<CarrierVehicleOption[]> {
  const userId = await assertCarrierUser();
  const membership = await db.tenantMembership.findFirst({
    where: { userId },
    select: { tenantId: true },
    orderBy: { createdAt: "asc" },
  });
  if (!membership) return [];
  const vehicles = await db.vehicle.findMany({
    where: {
      tenantId: membership.tenantId,
      deletedAt: null,
      status: "ACTIVE",
    },
    orderBy: { plate: "asc" },
    select: {
      id: true,
      plate: true,
      brand: true,
      model: true,
      capacityM3: true,
      costPerKmCents: true,
      baseLat: true,
      baseLng: true,
      branch: { select: { lat: true, lng: true } },
    },
  });
  return vehicles.map((v) => ({
    id: v.id,
    plate: v.plate,
    brand: v.brand,
    model: v.model,
    capacityM3: v.capacityM3,
    costPerKmCents: v.costPerKmCents,
    hasBase:
      (v.baseLat != null && v.baseLng != null) ||
      (v.branch?.lat != null && v.branch?.lng != null),
  }));
}

/**
 * Compute a suggested offer breakdown for the given lead, optionally
 * factoring in a specific vehicle's trip cost. The carrier can use this as
 * a starting point and override the final price.
 */
export async function getOfferSuggestion(
  moveRequestId: string,
  vehicleId?: string | null,
): Promise<OfferPricingBreakdown | null> {
  const userId = await assertCarrierUser();
  return suggestOfferPrice({
    moveRequestId,
    carrierUserId: userId,
    vehicleId: vehicleId ?? null,
  });
}
