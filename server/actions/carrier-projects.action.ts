"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const SERVICE_TYPES = [
  "CRANE",
  "PACKING",
  "LOADING",
  "UNLOADING",
  "ASSEMBLY",
  "DISASSEMBLY",
  "STORAGE",
  "TRANSIT",
  "CLEANUP",
  "OTHER",
] as const;

const PROJECT_STATUSES = [
  "DRAFT",
  "PLANNED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const;

export type ActionResult<T = unknown> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

async function getCtx() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Δεν είσαι συνδεδεμένος.");
  const role = session.user.role;
  if (role !== "TENANTADMIN" && role !== "TENANTEMPLOYEE") {
    throw new Error("Μόνο μέλη εταιρείας μεταφορέα έχουν πρόσβαση.");
  }
  const membership = await db.tenantMembership.findFirst({
    where: { userId: session.user.id },
    select: { tenantId: true },
    orderBy: { createdAt: "asc" },
  });
  if (!membership) throw new Error("Δεν είσαι μέλος εταιρείας.");
  return { userId: session.user.id, tenantId: membership.tenantId };
}

async function ensureServiceInTenant(
  serviceId: string,
  tenantId: string,
): Promise<{ projectId: string } | null> {
  const svc = await db.projectStopService.findFirst({
    where: {
      id: serviceId,
      projectStop: { project: { tenantId } },
    },
    select: { projectStop: { select: { projectId: true } } },
  });
  return svc ? { projectId: svc.projectStop.projectId } : null;
}

// ───────────────────────────── ADD SERVICE ─────────────────────────────

const addServiceSchema = z.object({
  projectStopId: z.string().min(1),
  serviceType: z.enum(SERVICE_TYPES),
  label: z.string().trim().max(120).optional().or(z.literal("")),
  quantity: z.coerce.number().int().min(1).max(999).default(1),
  unitPriceCents: z.coerce.number().int().min(0).optional(),
  partnerId: z.string().optional().or(z.literal("")),
});

export async function addProjectService(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  let ctx;
  try {
    ctx = await getCtx();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const parsed = addServiceSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Λάθος δεδομένα",
    };
  }
  const d = parsed.data;

  const stop = await db.projectStop.findFirst({
    where: { id: d.projectStopId, project: { tenantId: ctx.tenantId } },
    select: { id: true, projectId: true },
  });
  if (!stop) return { ok: false, error: "Δεν βρέθηκε στάση." };

  let partnerId: string | null = null;
  if (d.partnerId) {
    const p = await db.carrierPartner.findFirst({
      where: { id: d.partnerId, tenantId: ctx.tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!p) return { ok: false, error: "Άκυρος συνεργάτης." };
    partnerId = p.id;
  }

  const totalPriceCents =
    d.unitPriceCents != null ? d.unitPriceCents * d.quantity : null;

  try {
    const row = await db.projectStopService.create({
      data: {
        projectStopId: stop.id,
        serviceType: d.serviceType,
        label: d.label || null,
        quantity: d.quantity,
        unitPriceCents: d.unitPriceCents ?? null,
        totalPriceCents,
        partnerId,
      },
    });
    revalidatePath(`/carrier/projects/${stop.projectId}`);
    return { ok: true, data: { id: row.id } };
  } catch (e) {
    console.error("[addProjectService]", e);
    return { ok: false, error: "Δημιουργία υπηρεσίας απέτυχε." };
  }
}

// ───────────────────────────── UPDATE SERVICE ─────────────────────────────

const updateServiceSchema = z.object({
  id: z.string().min(1),
  serviceType: z.enum(SERVICE_TYPES).optional(),
  label: z.string().trim().max(120).optional().or(z.literal("")),
  quantity: z.coerce.number().int().min(1).max(999).optional(),
  unitPriceCents: z.coerce.number().int().min(0).nullable().optional(),
  partnerId: z.string().nullable().optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export async function updateProjectService(
  input: unknown,
): Promise<ActionResult> {
  let ctx;
  try {
    ctx = await getCtx();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const parsed = updateServiceSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Λάθος δεδομένα",
    };
  const d = parsed.data;

  const owned = await ensureServiceInTenant(d.id, ctx.tenantId);
  if (!owned) return { ok: false, error: "Δεν βρέθηκε υπηρεσία." };

  let partnerId: string | null | undefined = undefined;
  if (d.partnerId !== undefined) {
    if (d.partnerId === null || d.partnerId === "") {
      partnerId = null;
    } else {
      const p = await db.carrierPartner.findFirst({
        where: { id: d.partnerId, tenantId: ctx.tenantId, deletedAt: null },
        select: { id: true },
      });
      if (!p) return { ok: false, error: "Άκυρος συνεργάτης." };
      partnerId = p.id;
    }
  }

  // Re-derive total when quantity or unit price changes.
  const current = await db.projectStopService.findUnique({
    where: { id: d.id },
    select: { quantity: true, unitPriceCents: true },
  });
  const nextQty = d.quantity ?? current?.quantity ?? 1;
  const nextUnit =
    d.unitPriceCents !== undefined ? d.unitPriceCents : current?.unitPriceCents ?? null;
  const totalPriceCents = nextUnit != null ? nextUnit * nextQty : null;

  try {
    await db.projectStopService.update({
      where: { id: d.id },
      data: {
        ...(d.serviceType ? { serviceType: d.serviceType } : {}),
        ...(d.label !== undefined ? { label: d.label || null } : {}),
        ...(d.quantity !== undefined ? { quantity: d.quantity } : {}),
        ...(d.unitPriceCents !== undefined
          ? { unitPriceCents: d.unitPriceCents }
          : {}),
        totalPriceCents,
        ...(partnerId !== undefined ? { partnerId } : {}),
        ...(d.notes !== undefined ? { notes: d.notes || null } : {}),
      },
    });
    revalidatePath(`/carrier/projects/${owned.projectId}`);
    return { ok: true };
  } catch (e) {
    console.error("[updateProjectService]", e);
    return { ok: false, error: "Ενημέρωση απέτυχε." };
  }
}

// ───────────────────────────── DELETE SERVICE ─────────────────────────────

export async function deleteProjectService(
  serviceId: string,
): Promise<ActionResult> {
  let ctx;
  try {
    ctx = await getCtx();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const owned = await ensureServiceInTenant(serviceId, ctx.tenantId);
  if (!owned) return { ok: false, error: "Δεν βρέθηκε υπηρεσία." };
  try {
    const taskCount = await db.jobTask.count({
      where: { projectStopServiceId: serviceId },
    });
    if (taskCount > 0) {
      return {
        ok: false,
        error: `Διέγραψε πρώτα τις ${taskCount} εργασίες της υπηρεσίας.`,
      };
    }
    await db.projectStopService.delete({ where: { id: serviceId } });
    revalidatePath(`/carrier/projects/${owned.projectId}`);
    return { ok: true };
  } catch (e) {
    console.error("[deleteProjectService]", e);
    return { ok: false, error: "Διαγραφή απέτυχε." };
  }
}

// ───────────────────────────── UPDATE PROJECT STATUS ─────────────────────────────

const projectStatusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(PROJECT_STATUSES),
});

export async function setProjectStatus(
  input: unknown,
): Promise<ActionResult> {
  let ctx;
  try {
    ctx = await getCtx();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const parsed = projectStatusSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Λάθος",
    };
  const { id, status } = parsed.data;
  const row = await db.carrierProject.findFirst({
    where: { id, tenantId: ctx.tenantId },
    select: { id: true },
  });
  if (!row) return { ok: false, error: "Δεν βρέθηκε project." };
  try {
    await db.carrierProject.update({
      where: { id },
      data: { status, ...(status === "COMPLETED" ? { scheduledEnd: new Date() } : {}) },
    });
    revalidatePath(`/carrier/projects/${id}`);
    revalidatePath("/carrier/projects");
    return { ok: true };
  } catch (e) {
    console.error("[setProjectStatus]", e);
    return { ok: false, error: "Ενημέρωση απέτυχε." };
  }
}
