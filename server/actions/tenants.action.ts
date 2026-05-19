"use server";

import { revalidatePath } from "next/cache";
import { TenantStatus } from "@prisma/client";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const upsertSchema = z.object({
  id: z.string().optional(),
  vat: z
    .string()
    .min(9, "Ο ΑΦΜ πρέπει να έχει 9 ψηφία")
    .max(9, "Ο ΑΦΜ πρέπει να έχει 9 ψηφία")
    .regex(/^\d{9}$/, "Μόνο ψηφία"),
  legalName: z.string().min(2, "Συμπλήρωσε επωνυμία"),
  commercialName: z.string().optional(),
  doyCode: z.string().optional(),
  doyName: z.string().optional(),
  legalStatus: z.string().optional(),
  legalStatusKind: z.string().optional(),
  vatSystemFlag: z.string().optional(),
  registeredAt: z.string().optional(),
  address: z.string().optional(),
  addressNo: z.string().optional(),
  postalZip: z.string().optional(),
  postalArea: z.string().optional(),
  email: z.string().email("Μη έγκυρο email").optional().or(z.literal("")),
  phone: z.string().optional(),
  website: z.string().optional(),
  status: z.enum(["ACTIVE", "PAUSED", "SUSPENDED"]).default("ACTIVE"),
  logoUrl: z.string().optional().nullable(),
  notes: z.string().max(2000).optional(),
});

export type TenantResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

function assertAdmin(role?: string) {
  if (role !== "SUPERADMIN" && role !== "EMPLOYEE") {
    throw new Error("Δεν έχεις δικαίωμα");
  }
}

export async function upsertTenant(input: unknown): Promise<TenantResult> {
  const session = await auth();
  try {
    assertAdmin(session?.user?.role);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const parsed = upsertSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path?.length ? issue.path.join(".") : "field";
    console.error("[upsertTenant] zod failed:", parsed.error.issues);
    return { ok: false, error: `${path}: ${issue?.message ?? "Σφάλμα"}` };
  }
  const d = parsed.data;
  try {
    if (!d.id) {
      const exists = await db.tenant.findUnique({ where: { vat: d.vat } });
      if (exists && !exists.deletedAt) {
        return { ok: false, error: "Υπάρχει ήδη πελάτης με αυτό το ΑΦΜ." };
      }
    }
    const saved = await db.tenant.upsert({
      where: { id: d.id ?? "__none__" },
      update: {
        vat: d.vat,
        legalName: d.legalName.trim(),
        commercialName: d.commercialName?.trim() || null,
        doyCode: d.doyCode?.trim() || null,
        doyName: d.doyName?.trim() || null,
        legalStatus: d.legalStatus?.trim() || null,
        legalStatusKind: d.legalStatusKind?.trim() || null,
        vatSystemFlag: d.vatSystemFlag?.trim() || null,
        registeredAt: d.registeredAt ? new Date(d.registeredAt) : null,
        address: d.address?.trim() || null,
        addressNo: d.addressNo?.trim() || null,
        postalZip: d.postalZip?.trim() || null,
        postalArea: d.postalArea?.trim() || null,
        email: d.email?.trim() || null,
        phone: d.phone?.trim() || null,
        website: d.website?.trim() || null,
        status: d.status as TenantStatus,
        logoUrl: d.logoUrl || null,
        notes: d.notes?.trim() || null,
      },
      create: {
        vat: d.vat,
        legalName: d.legalName.trim(),
        commercialName: d.commercialName?.trim() || null,
        doyCode: d.doyCode?.trim() || null,
        doyName: d.doyName?.trim() || null,
        legalStatus: d.legalStatus?.trim() || null,
        legalStatusKind: d.legalStatusKind?.trim() || null,
        vatSystemFlag: d.vatSystemFlag?.trim() || null,
        registeredAt: d.registeredAt ? new Date(d.registeredAt) : null,
        address: d.address?.trim() || null,
        addressNo: d.addressNo?.trim() || null,
        postalZip: d.postalZip?.trim() || null,
        postalArea: d.postalArea?.trim() || null,
        email: d.email?.trim() || null,
        phone: d.phone?.trim() || null,
        website: d.website?.trim() || null,
        status: d.status as TenantStatus,
        logoUrl: d.logoUrl || null,
        notes: d.notes?.trim() || null,
      },
    });
    revalidatePath("/admin");
    revalidatePath("/admin/tenants");
    revalidatePath(`/admin/tenants/${saved.id}`);
    return { ok: true, id: saved.id };
  } catch (e) {
    console.error("[upsertTenant]", e);
    return { ok: false, error: "Αποθήκευση απέτυχε." };
  }
}

export async function deleteTenant(id: string): Promise<TenantResult> {
  const session = await auth();
  try {
    assertAdmin(session?.user?.role);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  try {
    await db.tenant.update({
      where: { id },
      data: { deletedAt: new Date(), status: "SUSPENDED" },
    });
    revalidatePath("/admin/tenants");
    return { ok: true, id };
  } catch {
    return { ok: false, error: "Διαγραφή απέτυχε." };
  }
}

const branchSchema = z.object({
  id: z.string().optional(),
  tenantId: z.string(),
  vat: z.string().optional().nullable(),
  legalName: z.string().min(2),
  commercialName: z.string().optional(),
  doyCode: z.string().optional(),
  doyName: z.string().optional(),
  address: z.string().optional(),
  addressNo: z.string().optional(),
  postalZip: z.string().optional(),
  postalArea: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  isPrimary: z.boolean().default(false),
});

export async function upsertBranch(input: unknown): Promise<TenantResult> {
  const session = await auth();
  try {
    assertAdmin(session?.user?.role);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const parsed = branchSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path?.length ? issue.path.join(".") : "field";
    console.error("[upsertBranch] zod failed:", parsed.error.issues);
    return { ok: false, error: `${path}: ${issue?.message ?? "Σφάλμα"}` };
  }
  const d = parsed.data;
  try {
    if (d.isPrimary) {
      await db.branch.updateMany({
        where: { tenantId: d.tenantId, isPrimary: true },
        data: { isPrimary: false },
      });
    }
    const saved = await db.branch.upsert({
      where: { id: d.id ?? "__none__" },
      update: {
        vat: d.vat?.trim() || null,
        legalName: d.legalName.trim(),
        commercialName: d.commercialName?.trim() || null,
        doyCode: d.doyCode?.trim() || null,
        doyName: d.doyName?.trim() || null,
        address: d.address?.trim() || null,
        addressNo: d.addressNo?.trim() || null,
        postalZip: d.postalZip?.trim() || null,
        postalArea: d.postalArea?.trim() || null,
        email: d.email?.trim() || null,
        phone: d.phone?.trim() || null,
        isPrimary: d.isPrimary,
      },
      create: {
        tenantId: d.tenantId,
        vat: d.vat?.trim() || null,
        legalName: d.legalName.trim(),
        commercialName: d.commercialName?.trim() || null,
        doyCode: d.doyCode?.trim() || null,
        doyName: d.doyName?.trim() || null,
        address: d.address?.trim() || null,
        addressNo: d.addressNo?.trim() || null,
        postalZip: d.postalZip?.trim() || null,
        postalArea: d.postalArea?.trim() || null,
        email: d.email?.trim() || null,
        phone: d.phone?.trim() || null,
        isPrimary: d.isPrimary,
      },
    });
    revalidatePath(`/admin/tenants/${d.tenantId}`);
    return { ok: true, id: saved.id };
  } catch (e) {
    console.error("[upsertBranch]", e);
    return { ok: false, error: "Αποθήκευση υποκαταστήματος απέτυχε." };
  }
}

export async function deleteBranch(id: string): Promise<TenantResult> {
  const session = await auth();
  try {
    assertAdmin(session?.user?.role);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  try {
    const b = await db.branch.findUnique({ where: { id } });
    if (!b) return { ok: false, error: "Δεν βρέθηκε" };
    await db.branch.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    revalidatePath(`/admin/tenants/${b.tenantId}`);
    return { ok: true, id };
  } catch {
    return { ok: false, error: "Διαγραφή απέτυχε." };
  }
}
