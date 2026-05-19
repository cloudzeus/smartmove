"use server";

import { revalidatePath } from "next/cache";
import { LocationType, ElevatorSize } from "@prisma/client";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const locationTypeSchema = z.enum([
  "HOME",
  "OFFICE",
  "STORAGE",
  "COUNTRY_HOUSE",
  "OTHER",
]);
const elevatorSchema = z.enum(["NONE", "SMALL", "MEDIUM", "LARGE"]);

const upsertSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, "Συμπλήρωσε όνομα τοποθεσίας"),
  type: locationTypeSchema.default("HOME"),
  address: z.string().min(3, "Συμπλήρωσε διεύθυνση"),
  postal: z.string().optional(),
  city: z.string().optional(),
  floor: z.coerce.number().int().min(-2).max(30).default(0),
  elevator: elevatorSchema.default("NONE"),
  notes: z.string().max(2000).optional(),
  isPrimary: z.boolean().default(false),
});

export type LocationFormResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function upsertLocation(
  input: unknown,
): Promise<LocationFormResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Δεν είσαι συνδεδεμένος" };
  const parsed = upsertSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Σφάλμα" };
  }
  const d = parsed.data;
  try {
    if (d.isPrimary) {
      await db.savedLocation.updateMany({
        where: { userId: session.user.id, isPrimary: true },
        data: { isPrimary: false },
      });
    }
    const saved = await db.savedLocation.upsert({
      where: { id: d.id ?? "__none__" },
      update: {
        name: d.name.trim(),
        type: d.type as LocationType,
        address: d.address.trim(),
        postal: d.postal?.trim() || null,
        city: d.city?.trim() || null,
        floor: d.floor,
        elevator: d.elevator as ElevatorSize,
        notes: d.notes?.trim() || null,
        isPrimary: d.isPrimary,
      },
      create: {
        userId: session.user.id,
        name: d.name.trim(),
        type: d.type as LocationType,
        address: d.address.trim(),
        postal: d.postal?.trim() || null,
        city: d.city?.trim() || null,
        floor: d.floor,
        elevator: d.elevator as ElevatorSize,
        notes: d.notes?.trim() || null,
        isPrimary: d.isPrimary,
      },
    });
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/locations");
    revalidatePath("/dashboard/inventory");
    return { ok: true, id: saved.id };
  } catch (e) {
    console.error("[upsertLocation]", e);
    return { ok: false, error: "Δεν μπόρεσα να αποθηκεύσω τη διεύθυνση." };
  }
}

export interface HistoryAddress {
  address: string;
  city?: string | null;
  postalZip?: string | null;
  usedCount: number;
  lastUsedAt: Date;
}

/**
 * Aggregate distinct addresses the user typed in past MoveRequests (and
 * multi-stop stops). Used by the "Import from history" dialog so the user
 * can quickly turn one of them into a SavedLocation with just a name + type.
 */
export async function getAddressesFromHistory(): Promise<HistoryAddress[]> {
  const session = await auth();
  if (!session?.user?.id) return [];
  const userId = session.user.id;

  const [requests, stops, existing] = await Promise.all([
    db.moveRequest.findMany({
      where: { userId },
      select: { fromAddress: true, toAddress: true, createdAt: true },
    }),
    db.moveRequestStop.findMany({
      where: { moveRequest: { userId } },
      select: { address: true, postal: true, city: true, createdAt: true },
    }),
    db.savedLocation.findMany({
      where: { userId, deletedAt: null },
      select: { address: true },
    }),
  ]);

  const existingSet = new Set(existing.map((l) => normalizeAddress(l.address)));
  const map = new Map<string, HistoryAddress>();

  function add(
    address: string | null,
    when: Date,
    city?: string | null,
    postal?: string | null,
  ) {
    if (!address) return;
    const trimmed = address.trim();
    if (trimmed.length < 3) return;
    const key = normalizeAddress(trimmed);
    if (existingSet.has(key)) return;
    const cur = map.get(key);
    if (cur) {
      cur.usedCount += 1;
      if (when > cur.lastUsedAt) cur.lastUsedAt = when;
      if (!cur.city && city) cur.city = city;
      if (!cur.postalZip && postal) cur.postalZip = postal;
    } else {
      map.set(key, {
        address: trimmed,
        usedCount: 1,
        lastUsedAt: when,
        city: city ?? null,
        postalZip: postal ?? null,
      });
    }
  }

  for (const r of requests) {
    add(r.fromAddress, r.createdAt);
    add(r.toAddress, r.createdAt);
  }
  for (const s of stops) {
    add(s.address, s.createdAt, s.city, s.postal);
  }

  return Array.from(map.values()).sort(
    (a, b) => b.lastUsedAt.getTime() - a.lastUsedAt.getTime(),
  );
}

function normalizeAddress(a: string): string {
  return a
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

const importSchema = z.object({
  address: z.string().min(3, "Διεύθυνση πολύ μικρή"),
  name: z.string().min(2, "Δώσε ένα όνομα τοποθεσίας"),
  type: locationTypeSchema.default("HOME"),
  postal: z.string().optional(),
  city: z.string().optional(),
});

export async function importLocationFromAddress(
  input: unknown,
): Promise<LocationFormResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Δεν είσαι συνδεδεμένος" };
  const parsed = importSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Σφάλμα" };
  }
  const d = parsed.data;
  try {
    const saved = await db.savedLocation.create({
      data: {
        userId: session.user.id,
        name: d.name.trim(),
        type: d.type as LocationType,
        address: d.address.trim(),
        postal: d.postal?.trim() || null,
        city: d.city?.trim() || null,
      },
    });
    revalidatePath("/dashboard/locations");
    revalidatePath("/dashboard");
    return { ok: true, id: saved.id };
  } catch (e) {
    console.error("[importLocationFromAddress]", e);
    return { ok: false, error: "Εισαγωγή απέτυχε." };
  }
}

export async function deleteLocation(
  id: string,
): Promise<LocationFormResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Δεν είσαι συνδεδεμένος" };
  try {
    const loc = await db.savedLocation.findUnique({ where: { id } });
    if (!loc || loc.userId !== session.user.id) {
      return { ok: false, error: "Δεν επιτρέπεται" };
    }
    await db.savedLocation.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/locations");
    return { ok: true, id };
  } catch (e) {
    console.error("[deleteLocation]", e);
    return { ok: false, error: "Δεν μπόρεσα να διαγράψω." };
  }
}
