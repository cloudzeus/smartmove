"use server";

import { revalidatePath } from "next/cache";
import { VehicleStatus, VehicleType } from "@prisma/client";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { geocode } from "@/lib/geocoding";

const vehicleTypeSchema = z.enum([
  "VAN_SMALL",
  "VAN_LARGE",
  "TRUCK_3_5T",
  "TRUCK_5T",
  "TRUCK_7_5T",
  "TRUCK_12T",
  "TRAILER",
  "OTHER",
]);

const upsertSchema = z.object({
  id: z.string().optional(),
  tenantId: z.string(),
  branchId: z.string().optional().nullable(),
  plate: z.string().min(3, "Συμπλήρωσε πινακίδα"),
  brand: z.string().optional(),
  model: z.string().optional(),
  year: z.coerce.number().int().min(1900).max(2100).optional(),
  vehicleType: vehicleTypeSchema.default("VAN_LARGE"),
  capacityKg: z.coerce.number().min(0).optional(),
  capacityM3: z.coerce.number().min(0).optional(),
  fuelType: z.string().optional(),
  color: z.string().optional(),
  baseAddress: z.string().optional(),
  baseLat: z.coerce.number().min(-90).max(90).optional(),
  baseLng: z.coerce.number().min(-180).max(180).optional(),
  costPerKmCents: z.coerce.number().int().min(0).max(100000).optional(),
  minTripCents: z.coerce.number().int().min(0).max(100000000).optional(),
  callOutCents: z.coerce.number().int().min(0).max(100000000).optional(),
  insuranceExpiresAt: z.string().optional(),
  ktoExpiresAt: z.string().optional(),
  registrationDocUrl: z.string().optional().nullable(),
  photoUrl: z.string().optional().nullable(),
  notes: z.string().max(2000).optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "MAINTENANCE"]).default("ACTIVE"),
});

export type VehicleResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

function isStaff(role?: string) {
  return role === "SUPERADMIN" || role === "EMPLOYEE";
}

async function assertCanManageVehicle(
  userId: string,
  role: string | undefined,
  tenantId: string,
): Promise<void> {
  if (isStaff(role)) return;
  if (role !== "TENANTADMIN") throw new Error("Δεν έχεις δικαίωμα.");
  // Tenant admin must belong to this tenant.
  const m = await db.tenantMembership.findFirst({
    where: { userId, tenantId, role: { in: ["OWNER", "ADMIN"] } },
    select: { id: true },
  });
  if (!m) throw new Error("Δεν είσαι διαχειριστής αυτής της εταιρείας.");
}

export async function upsertVehicle(input: unknown): Promise<VehicleResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Δεν είσαι συνδεδεμένος." };
  }
  const parsed = upsertSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Σφάλμα" };
  }
  const d = parsed.data;
  try {
    await assertCanManageVehicle(session.user.id, session.user.role, d.tenantId);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  // Geocode base address if provided and coords not already supplied.
  let baseLat = d.baseLat ?? null;
  let baseLng = d.baseLng ?? null;
  if (d.baseAddress && (baseLat == null || baseLng == null)) {
    try {
      const r = await geocode(d.baseAddress);
      if (r) {
        baseLat = r.lat;
        baseLng = r.lng;
      }
    } catch (e) {
      console.warn("[upsertVehicle] base geocode failed:", e);
    }
  }

  try {
    const saved = await db.vehicle.upsert({
      where: { id: d.id ?? "__none__" },
      update: {
        branchId: d.branchId || null,
        plate: d.plate.trim().toUpperCase(),
        brand: d.brand?.trim() || null,
        model: d.model?.trim() || null,
        year: d.year ?? null,
        vehicleType: d.vehicleType as VehicleType,
        capacityKg: d.capacityKg ?? null,
        capacityM3: d.capacityM3 ?? null,
        fuelType: d.fuelType?.trim() || null,
        color: d.color?.trim() || null,
        baseAddress: d.baseAddress?.trim() || null,
        baseLat,
        baseLng,
        costPerKmCents: d.costPerKmCents ?? 0,
        minTripCents: d.minTripCents ?? 0,
        callOutCents: d.callOutCents ?? 0,
        insuranceExpiresAt: d.insuranceExpiresAt ? new Date(d.insuranceExpiresAt) : null,
        ktoExpiresAt: d.ktoExpiresAt ? new Date(d.ktoExpiresAt) : null,
        registrationDocUrl: d.registrationDocUrl || null,
        photoUrl: d.photoUrl || null,
        notes: d.notes?.trim() || null,
        status: d.status as VehicleStatus,
      },
      create: {
        tenantId: d.tenantId,
        branchId: d.branchId || null,
        plate: d.plate.trim().toUpperCase(),
        brand: d.brand?.trim() || null,
        model: d.model?.trim() || null,
        year: d.year ?? null,
        vehicleType: d.vehicleType as VehicleType,
        capacityKg: d.capacityKg ?? null,
        capacityM3: d.capacityM3 ?? null,
        fuelType: d.fuelType?.trim() || null,
        color: d.color?.trim() || null,
        baseAddress: d.baseAddress?.trim() || null,
        baseLat,
        baseLng,
        costPerKmCents: d.costPerKmCents ?? 0,
        minTripCents: d.minTripCents ?? 0,
        callOutCents: d.callOutCents ?? 0,
        insuranceExpiresAt: d.insuranceExpiresAt ? new Date(d.insuranceExpiresAt) : null,
        ktoExpiresAt: d.ktoExpiresAt ? new Date(d.ktoExpiresAt) : null,
        registrationDocUrl: d.registrationDocUrl || null,
        photoUrl: d.photoUrl || null,
        notes: d.notes?.trim() || null,
        status: d.status as VehicleStatus,
      },
    });
    revalidatePath(`/admin/tenants/${d.tenantId}`);
    revalidatePath(`/carrier/fleet`);
    return { ok: true, id: saved.id };
  } catch (e) {
    console.error("[upsertVehicle]", e);
    if ((e as { code?: string }).code === "P2002") {
      return { ok: false, error: "Υπάρχει ήδη όχημα με αυτή την πινακίδα." };
    }
    return { ok: false, error: "Αποθήκευση οχήματος απέτυχε." };
  }
}

export async function deleteVehicle(id: string): Promise<VehicleResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Δεν είσαι συνδεδεμένος." };
  try {
    const v = await db.vehicle.findUnique({ where: { id } });
    if (!v) return { ok: false, error: "Δεν βρέθηκε" };
    await assertCanManageVehicle(session.user.id, session.user.role, v.tenantId);
    await db.vehicle.update({
      where: { id },
      data: { deletedAt: new Date(), status: "INACTIVE" },
    });
    revalidatePath(`/admin/tenants/${v.tenantId}`);
    revalidatePath(`/carrier/fleet`);
    return { ok: true, id };
  } catch {
    return { ok: false, error: "Διαγραφή απέτυχε." };
  }
}
