"use server";

import { revalidatePath } from "next/cache";
import { ItemCondition } from "@prisma/client";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const conditionSchema = z
  .enum(["ASSEMBLED", "MODULAR", "FRAGILE", "EXTRA_CARE"])
  .optional();

const upsertSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, "Συμπλήρωσε όνομα"),
  category: z.string().optional(),
  locationId: z.string().optional().nullable(),
  length_cm: z.coerce.number().min(1).max(1000),
  width_cm: z.coerce.number().min(1).max(1000),
  height_cm: z.coerce.number().min(1).max(1000),
  weight_kg: z.coerce.number().min(0).max(2000).optional(),
  quantity: z.coerce.number().int().min(1).max(999).default(1),
  condition: conditionSchema,
  photoUrl: z.string().optional().nullable(),
  notes: z.string().max(2000).optional(),
});

export type ItemResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function upsertItem(input: unknown): Promise<ItemResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Δεν είσαι συνδεδεμένος" };
  const parsed = upsertSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Σφάλμα" };
  }
  const d = parsed.data;
  const volume_m3 = (d.length_cm * d.width_cm * d.height_cm) / 1_000_000;

  try {
    const saved = await db.savedItem.upsert({
      where: { id: d.id ?? "__none__" },
      update: {
        name: d.name.trim(),
        category: d.category?.trim() || null,
        locationId: d.locationId || null,
        length_cm: d.length_cm,
        width_cm: d.width_cm,
        height_cm: d.height_cm,
        volume_m3,
        weight_kg: d.weight_kg ?? null,
        quantity: d.quantity,
        condition: (d.condition as ItemCondition | undefined) ?? null,
        photoUrl: d.photoUrl || null,
        notes: d.notes?.trim() || null,
      },
      create: {
        userId: session.user.id,
        name: d.name.trim(),
        category: d.category?.trim() || null,
        locationId: d.locationId || null,
        length_cm: d.length_cm,
        width_cm: d.width_cm,
        height_cm: d.height_cm,
        volume_m3,
        weight_kg: d.weight_kg ?? null,
        quantity: d.quantity,
        condition: (d.condition as ItemCondition | undefined) ?? null,
        photoUrl: d.photoUrl || null,
        notes: d.notes?.trim() || null,
      },
    });
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/inventory");
    revalidatePath("/dashboard/locations");
    return { ok: true, id: saved.id };
  } catch (e) {
    console.error("[upsertItem]", e);
    return { ok: false, error: "Δεν μπόρεσα να αποθηκεύσω το αντικείμενο." };
  }
}

export async function deleteItem(id: string): Promise<ItemResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Δεν είσαι συνδεδεμένος" };
  try {
    const item = await db.savedItem.findUnique({ where: { id } });
    if (!item || item.userId !== session.user.id) {
      return { ok: false, error: "Δεν επιτρέπεται" };
    }
    await db.savedItem.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/inventory");
    return { ok: true, id };
  } catch (e) {
    console.error("[deleteItem]", e);
    return { ok: false, error: "Δεν μπόρεσα να διαγράψω." };
  }
}

export async function moveItem(
  id: string,
  locationId: string | null,
): Promise<ItemResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Δεν είσαι συνδεδεμένος" };
  try {
    const item = await db.savedItem.findUnique({ where: { id } });
    if (!item || item.userId !== session.user.id) {
      return { ok: false, error: "Δεν επιτρέπεται" };
    }
    await db.savedItem.update({
      where: { id },
      data: { locationId },
    });
    revalidatePath("/dashboard/inventory");
    return { ok: true, id };
  } catch (e) {
    console.error("[moveItem]", e);
    return { ok: false, error: "Δεν μπόρεσα να μετακινήσω." };
  }
}
