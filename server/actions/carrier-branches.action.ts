"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

const upsertSchema = z.object({
  id: z.string().optional(),
  legalName: z.string().trim().min(2, "Όνομα υποχρεωτικό").max(120),
  commercialName: z.string().trim().max(120).optional().or(z.literal("")),
  address: z.string().trim().max(200).optional().or(z.literal("")),
  addressNo: z.string().trim().max(20).optional().or(z.literal("")),
  postalZip: z.string().trim().max(20).optional().or(z.literal("")),
  postalArea: z.string().trim().max(80).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  email: z.string().trim().email("Μη έγκυρο email").optional().or(z.literal("")),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  serviceRadiusKm: z.coerce.number().int().min(1).max(2000).default(50),
  isPrimary: z.boolean().default(false),
});

async function carrierAdminCtx() {
  const session = await auth();
  if (!session?.user) throw new Error("Δεν είσαι συνδεδεμένος.");
  const role = session.user.role;
  if (role !== "TENANTADMIN" && role !== "SUPERADMIN") {
    throw new Error("Δικαίωμα μόνο σε admin εταιρείας.");
  }
  const membership = await db.tenantMembership.findFirst({
    where: { userId: session.user.id },
    select: { tenantId: true },
    orderBy: { createdAt: "asc" },
  });
  if (!membership) throw new Error("Δεν είσαι σε εταιρεία.");
  return { tenantId: membership.tenantId, userId: session.user.id };
}

/**
 * Upsert a branch from the carrier side (TENANTADMIN). Same constraints as
 * the admin tenants action but scoped to the user's own tenant — never lets
 * a carrier edit branches of a different tenant.
 */
export async function upsertCarrierBranch(input: unknown): Promise<ActionResult> {
  let ctx;
  try { ctx = await carrierAdminCtx(); } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const parsed = upsertSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Λάθος δεδομένα" };
  }
  const d = parsed.data;

  // If editing, verify ownership
  if (d.id) {
    const exists = await db.branch.findFirst({
      where: { id: d.id, tenantId: ctx.tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!exists) return { ok: false, error: "Δεν βρέθηκε υποκατάστημα." };
  }

  try {
    if (d.isPrimary) {
      await db.branch.updateMany({
        where: { tenantId: ctx.tenantId, isPrimary: true, ...(d.id ? { id: { not: d.id } } : {}) },
        data: { isPrimary: false },
      });
    }

    const data = {
      legalName: d.legalName,
      commercialName: d.commercialName || null,
      address: d.address || null,
      addressNo: d.addressNo || null,
      postalZip: d.postalZip || null,
      postalArea: d.postalArea || null,
      phone: d.phone || null,
      email: d.email ? d.email.toLowerCase() : null,
      lat: d.lat ?? null,
      lng: d.lng ?? null,
      serviceRadiusKm: d.serviceRadiusKm,
      isPrimary: d.isPrimary,
    };

    const saved = d.id
      ? await db.branch.update({ where: { id: d.id }, data })
      : await db.branch.create({ data: { ...data, tenantId: ctx.tenantId } });

    revalidatePath("/carrier/branches");
    revalidatePath("/carrier");
    return { ok: true, id: saved.id };
  } catch (e) {
    console.error("[upsertCarrierBranch]", e);
    return { ok: false, error: "Αποθήκευση απέτυχε." };
  }
}

export async function deleteCarrierBranch(id: string): Promise<ActionResult> {
  let ctx;
  try { ctx = await carrierAdminCtx(); } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const branch = await db.branch.findFirst({
    where: { id, tenantId: ctx.tenantId, deletedAt: null },
    select: { id: true },
  });
  if (!branch) return { ok: false, error: "Δεν βρέθηκε υποκατάστημα." };
  try {
    await db.branch.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    revalidatePath("/carrier/branches");
    return { ok: true };
  } catch (e) {
    console.error("[deleteCarrierBranch]", e);
    return { ok: false, error: "Διαγραφή απέτυχε." };
  }
}
