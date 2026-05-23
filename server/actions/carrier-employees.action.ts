"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export type ActionResult<T = unknown> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

async function getCarrierContext() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Δεν είσαι συνδεδεμένος.");
  const role = session.user.role;
  if (role !== "TENANTADMIN" && role !== "TENANTEMPLOYEE") {
    throw new Error("Μόνο μέλη εταιρείας μεταφορέα έχουν πρόσβαση.");
  }
  const membership = await db.tenantMembership.findFirst({
    where: { userId: session.user.id },
    select: { tenantId: true, role: true },
    orderBy: { createdAt: "asc" },
  });
  if (!membership) throw new Error("Δεν είσαι μέλος εταιρείας.");
  return { userId: session.user.id, tenantId: membership.tenantId, role };
}

const employeeRoles = [
  "DRIVER",
  "ASSISTANT",
  "PACKER",
  "OPERATIONS",
  "ADMIN",
  "OTHER",
] as const;

const employeeSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Το όνομα είναι υποχρεωτικό"),
  role: z.enum(employeeRoles).default("DRIVER"),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  email: z
    .string()
    .trim()
    .email("Μη έγκυρο email")
    .optional()
    .or(z.literal("")),
  idNumber: z.string().trim().max(40).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  active: z.coerce.boolean().default(true),
});

export async function upsertEmployee(input: unknown): Promise<ActionResult<{ id: string }>> {
  let ctx;
  try {
    ctx = await getCarrierContext();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const parsed = employeeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Λάθος δεδομένα" };
  }
  const d = parsed.data;
  const data = {
    name: d.name,
    role: d.role,
    phone: d.phone || null,
    email: d.email ? d.email.toLowerCase() : null,
    idNumber: d.idNumber || null,
    notes: d.notes || null,
    active: d.active,
  };
  try {
    let row;
    if (d.id) {
      const exists = await db.carrierEmployee.findFirst({
        where: { id: d.id, tenantId: ctx.tenantId, deletedAt: null },
        select: { id: true },
      });
      if (!exists) return { ok: false, error: "Δεν βρέθηκε υπάλληλος." };
      row = await db.carrierEmployee.update({ where: { id: d.id }, data });
    } else {
      row = await db.carrierEmployee.create({
        data: { ...data, tenantId: ctx.tenantId },
      });
    }
    revalidatePath("/carrier/employees");
    return { ok: true, data: { id: row.id } };
  } catch (e) {
    console.error("[upsertEmployee]", e);
    return { ok: false, error: "Αποθήκευση απέτυχε." };
  }
}

export async function deleteEmployee(id: string): Promise<ActionResult> {
  let ctx;
  try {
    ctx = await getCarrierContext();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  try {
    const row = await db.carrierEmployee.findFirst({
      where: { id, tenantId: ctx.tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!row) return { ok: false, error: "Δεν βρέθηκε υπάλληλος." };
    await db.carrierEmployee.update({
      where: { id },
      data: { deletedAt: new Date(), active: false },
    });
    revalidatePath("/carrier/employees");
    return { ok: true };
  } catch (e) {
    console.error("[deleteEmployee]", e);
    return { ok: false, error: "Διαγραφή απέτυχε." };
  }
}
