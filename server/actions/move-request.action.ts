"use server";

import { z } from "zod";
import {
  CraneRequirement,
  ElevatorSize,
  MoveType,
  type Prisma,
  TruckAccess,
} from "@prisma/client";

import { randomUUID } from "node:crypto";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { putObject, publicUrl } from "@/lib/bunny-storage";
import { flags } from "@/lib/env";
import { geocode } from "@/lib/geocoding";
import { renderMoveRequestPublishedEmail } from "@/lib/emails/move-request-published";
import { sendMail } from "@/lib/mailgun";
import { createScanFee } from "./scan-fee.action";
import { ensureRetentionInitialized } from "./retention.action";
import type { JobItem } from "@/components/scan/wizard-types";

const jobItemSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  quantity: z.number().int().positive(),
  length_cm: z.number().nonnegative(),
  width_cm: z.number().nonnegative(),
  height_cm: z.number().nonnegative(),
  volume_m3: z.number().nonnegative(),
  category: z.string().optional(),
  source: z.enum(["ai", "manual"]),
  photoDataUrl: z.string().optional(),
});

const elevatorSchema = z.enum(["none", "small", "medium", "large"]);
const craneSchema = z.enum(["none", "some", "all"]);
const truckSchema = z.enum(["easy", "limited", "narrow"]);
const typeSchema = z.enum(["house", "furniture", "business", "heavy"]);

const stopSchema = z.object({
  type: z.enum(["PICKUP", "DELIVERY"]),
  sequence: z.number().int().default(0),
  label: z.string().optional(),
  address: z.string().min(1),
  floor: z.number().int().min(-2).max(30).default(0),
  elevator: elevatorSchema,
  notes: z.string().optional(),
  itemIds: z.array(z.string()).default([]),
});

const inputSchema = z.object({
  route: z.object({
    from: z.string().min(1, "Συμπλήρωσε το από"),
    to: z.string().min(1, "Συμπλήρωσε το προς"),
    when: z.string().optional(),
    flex: z.number().int().min(0).max(30).default(0),
    shared: z.boolean().default(false),
    type: typeSchema.default("house"),
  }),
  multiStop: z.boolean().default(false),
  stops: z.array(stopSchema).optional(),
  items: z.array(jobItemSchema).min(1, "Πρόσθεσε τουλάχιστον ένα αντικείμενο"),
  property: z.object({
    fromFloor: z.number().int(),
    toFloor: z.number().int(),
    fromElevator: elevatorSchema,
    toElevator: elevatorSchema,
    crane: craneSchema,
    packing: z.boolean(),
    truckAccess: truckSchema,
    notes: z.string().max(2000).optional().default(""),
  }),
  estimate: z
    .object({
      minEUR: z.number().int().nonnegative(),
      maxEUR: z.number().int().nonnegative(),
    })
    .optional(),
});

export type CreateMoveRequestInput = z.infer<typeof inputSchema>;

export type CreateMoveRequestResult =
  | {
      ok: true;
      id: string;
      ref: string;
      emailSent: boolean;
      scanFeeId?: string;
      scanFeeCents?: number;
    }
  | { ok: false; error: string };

const TYPE_MAP: Record<string, MoveType> = {
  house: MoveType.HOUSE,
  furniture: MoveType.FURNITURE,
  business: MoveType.BUSINESS,
  heavy: MoveType.HEAVY,
};

const ELEVATOR_MAP: Record<string, ElevatorSize> = {
  none: ElevatorSize.NONE,
  small: ElevatorSize.SMALL,
  medium: ElevatorSize.MEDIUM,
  large: ElevatorSize.LARGE,
};

const CRANE_MAP: Record<string, CraneRequirement> = {
  none: CraneRequirement.NONE,
  some: CraneRequirement.SOME,
  all: CraneRequirement.ALL,
};

const TRUCK_MAP: Record<string, TruckAccess> = {
  easy: TruckAccess.EASY,
  limited: TruckAccess.LIMITED,
  narrow: TruckAccess.NARROW,
};

export async function createMoveRequest(
  input: unknown,
): Promise<CreateMoveRequestResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Πρέπει να συνδεθείς πρώτα." };
  }

  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Μη έγκυρα δεδομένα";
    return { ok: false, error: msg };
  }
  const data = parsed.data;

  const itemsCount = data.items.reduce((s, i) => s + i.quantity, 0);
  const totalVolumeM3 = data.items.reduce(
    (s, i) => s + i.volume_m3 * i.quantity,
    0,
  );
  const inventorySource =
    data.items.some((i) => i.source === "ai") ? "ai" : "manual";

  // Persist item photos to BunnyCDN. The wizard sends `photoDataUrl` as a
  // base64 data URL (the crop returned by the AI scan). We upload each one
  // and replace it with the public CDN URL. Items that already have an
  // http(s) URL or no photo pass through unchanged. Failures are non-fatal
  // (we just drop the photo for that item).
  const uploadItemPhoto = async (
    dataUrl: string,
  ): Promise<string | undefined> => {
    if (!dataUrl) return undefined;
    if (/^https?:\/\//i.test(dataUrl)) return dataUrl;
    const m = dataUrl.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i);
    if (!m) return undefined;
    if (!flags.hasBunnyStorage()) return undefined;
    try {
      const [, contentType, b64] = m;
      const buffer = Buffer.from(b64, "base64");
      const ext = contentType.split("/")[1]?.split("+")[0] ?? "jpg";
      const key = `items/scan/${session.user.id}/${randomUUID()}.${ext}`;
      await putObject({ key, body: buffer, contentType });
      return publicUrl(key);
    } catch (e) {
      console.warn("[createMoveRequest] item photo upload failed:", e);
      return undefined;
    }
  };

  const photoUrls = await Promise.all(
    data.items.map((i) =>
      i.photoDataUrl ? uploadItemPhoto(i.photoDataUrl) : Promise.resolve(undefined),
    ),
  );

  // Retention: item photos are tied to the request owner's dataRetentionUntil
  // window. A background job (TODO) will purge BunnyCDN objects past that date.
  const owner = await db.user.findUnique({
    where: { id: session.user.id },
    select: { dataRetentionUntil: true },
  });
  const photoUploadedAt = new Date().toISOString();
  const photoRetainUntil = owner?.dataRetentionUntil?.toISOString() ?? null;

  const itemsToStore = data.items.map((i, idx) => ({
    ...i,
    photoDataUrl: undefined,
    photoUrl: photoUrls[idx],
    photoUploadedAt: photoUrls[idx] ? photoUploadedAt : undefined,
    photoRetainUntil: photoUrls[idx] ? photoRetainUntil : undefined,
  }));

  // Geocode addresses in parallel (best-effort; null on failure).
  const safeGeocode = async (q: string) => {
    try {
      const r = await geocode(q);
      return r ? { lat: r.lat, lng: r.lng } : null;
    } catch (e) {
      console.warn("[createMoveRequest] geocode failed:", q, e);
      return null;
    }
  };
  const stopAddresses =
    data.multiStop && data.stops ? data.stops.map((s) => s.address) : [];
  const [fromGeo, toGeo, ...stopGeo] = await Promise.all([
    safeGeocode(data.route.from),
    safeGeocode(data.route.to),
    ...stopAddresses.map(safeGeocode),
  ]);

  let created;
  try {
    created = await db.moveRequest.create({
      data: {
        userId: session.user.id,
        fromAddress: data.route.from,
        toAddress: data.route.to,
        fromLat: fromGeo?.lat ?? null,
        fromLng: fromGeo?.lng ?? null,
        toLat: toGeo?.lat ?? null,
        toLng: toGeo?.lng ?? null,
        preferredDate: data.route.when ? new Date(data.route.when) : null,
        flexDays: data.route.flex,
        shared: data.route.shared,
        multiStop: data.multiStop && (data.stops?.length ?? 0) > 0,
        type: TYPE_MAP[data.route.type] ?? MoveType.HOUSE,
        itemsJson: itemsToStore as unknown as Prisma.InputJsonValue,
        itemsCount,
        totalVolumeM3,
        inventorySource,
        fromFloor: data.property.fromFloor,
        toFloor: data.property.toFloor,
        fromElevator: ELEVATOR_MAP[data.property.fromElevator] ?? ElevatorSize.NONE,
        toElevator: ELEVATOR_MAP[data.property.toElevator] ?? ElevatorSize.NONE,
        crane: CRANE_MAP[data.property.crane] ?? CraneRequirement.NONE,
        packing: data.property.packing,
        truckAccess: TRUCK_MAP[data.property.truckAccess] ?? TruckAccess.EASY,
        notes: data.property.notes || null,
        estimatedPriceMinCents: data.estimate
          ? data.estimate.minEUR * 100
          : null,
        estimatedPriceMaxCents: data.estimate
          ? data.estimate.maxEUR * 100
          : null,
        stops:
          data.multiStop && data.stops && data.stops.length > 0
            ? {
                create: data.stops.map((s, i) => {
                  const stopItems = data.items.filter((it) =>
                    s.itemIds.includes(it.id),
                  );
                  const g = stopGeo[i] ?? null;
                  return {
                    type: s.type,
                    sequence: s.sequence ?? i,
                    label: s.label?.trim() || null,
                    address: s.address.trim(),
                    lat: g?.lat ?? null,
                    lng: g?.lng ?? null,
                    floor: s.floor,
                    elevator: ELEVATOR_MAP[s.elevator] ?? ElevatorSize.NONE,
                    notes: s.notes?.trim() || null,
                    itemsJson: stopItems as unknown as Prisma.InputJsonValue,
                  };
                }),
              }
            : undefined,
      },
    });
  } catch (e) {
    console.error("[createMoveRequest] db.create failed:", e);
    return { ok: false, error: "Δεν μπορέσαμε να αποθηκεύσουμε το αίτημα." };
  }

  const ref = created.id.slice(-8).toUpperCase();

  // Ensure the user has a retention window set (idempotent)
  await ensureRetentionInitialized(session.user.id);

  // Create the per-request scan fee when AI was used.
  let scanFeeId: string | undefined;
  let scanFeeCents: number | undefined;
  if (inventorySource === "ai") {
    const feeRes = await createScanFee({ moveRequestId: created.id });
    if (feeRes.ok && feeRes.feeId) {
      scanFeeId = feeRes.feeId;
      scanFeeCents = feeRes.amountCents;
    }
  }

  // Fire-and-mostly-await email so we can report the status to the UI.
  let emailSent = false;
  if (session.user.email) {
    const { subject, html, text } = renderMoveRequestPublishedEmail({
      customerName: session.user.name ?? session.user.email,
      customerEmail: session.user.email,
      ref,
      fromAddress: data.route.from,
      toAddress: data.route.to,
      preferredDate: data.route.when
        ? formatGreekDate(data.route.when)
        : "Όποτε σε εξυπηρετεί",
      flexDays: data.route.flex,
      shared: data.route.shared,
      type: data.route.type,
      items: data.items as unknown as JobItem[],
      totalVolumeM3,
      itemsCount,
      fromFloor: data.property.fromFloor,
      toFloor: data.property.toFloor,
      fromElevator: data.property.fromElevator,
      toElevator: data.property.toElevator,
      crane: data.property.crane,
      packing: data.property.packing,
      truckAccess: data.property.truckAccess,
      notes: data.property.notes,
      estimatedPriceMin: data.estimate?.minEUR,
      estimatedPriceMax: data.estimate?.maxEUR,
    });
    const sendRes = await sendMail({
      to: session.user.email,
      subject,
      html,
      text,
      tags: ["move-request-published"],
    });
    emailSent = sendRes.ok;
    if (!sendRes.ok) {
      console.warn("[createMoveRequest] email not sent:", sendRes.error);
    }
  }

  return { ok: true, id: created.id, ref, emailSent, scanFeeId, scanFeeCents };
}

function formatGreekDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("el-GR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}
