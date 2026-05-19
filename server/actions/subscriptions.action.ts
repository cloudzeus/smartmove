"use server";

import { revalidatePath } from "next/cache";
import { BillingCycle, SubscriptionStatus } from "@prisma/client";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const planSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2),
  slug: z
    .string()
    .min(2)
    .regex(/^[a-z0-9-]+$/, "Λατινικοί χαρακτήρες, αριθμοί ή παύλες"),
  description: z.string().max(2000).optional(),
  maxBranches: z.coerce.number().int().min(0).default(1),
  maxEmployees: z.coerce.number().int().min(0).default(5),
  maxVehicles: z.coerce.number().int().min(0).default(3),
  maxMonthlyJobs: z.coerce.number().int().min(0).default(50),
  crmEnabled: z.boolean().default(false),
  privateScanEnabled: z.boolean().default(false),
  apiAccessEnabled: z.boolean().default(false),
  prioritySupport: z.boolean().default(false),
  pricePerMonthEur: z.coerce.number().min(0).default(0),
  pricePerYearEur: z.coerce.number().min(0).optional(),
  commissionPct: z.coerce.number().min(0).max(100).default(5),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0),
});

export type PlanResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

function assertAdmin(role?: string) {
  if (role !== "SUPERADMIN" && role !== "EMPLOYEE") {
    throw new Error("Δεν έχεις δικαίωμα");
  }
}

export async function upsertPlan(input: unknown): Promise<PlanResult> {
  const session = await auth();
  try {
    assertAdmin(session?.user?.role);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const parsed = planSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Σφάλμα" };
  }
  const d = parsed.data;
  try {
    const saved = await db.subscriptionPlan.upsert({
      where: { id: d.id ?? "__none__" },
      update: {
        name: d.name.trim(),
        slug: d.slug.trim().toLowerCase(),
        description: d.description?.trim() || null,
        maxBranches: d.maxBranches,
        maxEmployees: d.maxEmployees,
        maxVehicles: d.maxVehicles,
        maxMonthlyJobs: d.maxMonthlyJobs,
        crmEnabled: d.crmEnabled,
        privateScanEnabled: d.privateScanEnabled,
        apiAccessEnabled: d.apiAccessEnabled,
        prioritySupport: d.prioritySupport,
        pricePerMonthCents: Math.round(d.pricePerMonthEur * 100),
        pricePerYearCents: d.pricePerYearEur
          ? Math.round(d.pricePerYearEur * 100)
          : null,
        commissionPct: d.commissionPct,
        isActive: d.isActive,
        sortOrder: d.sortOrder,
      },
      create: {
        name: d.name.trim(),
        slug: d.slug.trim().toLowerCase(),
        description: d.description?.trim() || null,
        maxBranches: d.maxBranches,
        maxEmployees: d.maxEmployees,
        maxVehicles: d.maxVehicles,
        maxMonthlyJobs: d.maxMonthlyJobs,
        crmEnabled: d.crmEnabled,
        privateScanEnabled: d.privateScanEnabled,
        apiAccessEnabled: d.apiAccessEnabled,
        prioritySupport: d.prioritySupport,
        pricePerMonthCents: Math.round(d.pricePerMonthEur * 100),
        pricePerYearCents: d.pricePerYearEur
          ? Math.round(d.pricePerYearEur * 100)
          : null,
        commissionPct: d.commissionPct,
        isActive: d.isActive,
        sortOrder: d.sortOrder,
      },
    });
    revalidatePath("/admin/plans");
    return { ok: true, id: saved.id };
  } catch (e) {
    console.error("[upsertPlan]", e);
    if ((e as { code?: string }).code === "P2002") {
      return { ok: false, error: "Υπάρχει ήδη πλάνο με αυτό το slug." };
    }
    return { ok: false, error: "Αποθήκευση πακέτου απέτυχε." };
  }
}

const subscriptionSchema = z.object({
  id: z.string().optional(),
  tenantId: z.string(),
  planId: z.string(),
  status: z.enum(["TRIAL", "ACTIVE", "PAUSED", "CANCELLED", "EXPIRED"]).default("ACTIVE"),
  billingCycle: z.enum(["MONTHLY", "YEARLY", "CUSTOM"]).default("MONTHLY"),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  trialEndsAt: z.string().optional(),
  // Overrides — undefined = inherit from plan
  maxBranches: z.coerce.number().int().optional(),
  maxEmployees: z.coerce.number().int().optional(),
  maxVehicles: z.coerce.number().int().optional(),
  maxMonthlyJobs: z.coerce.number().int().optional(),
  crmEnabled: z.boolean().optional(),
  privateScanEnabled: z.boolean().optional(),
  apiAccessEnabled: z.boolean().optional(),
  prioritySupport: z.boolean().optional(),
  commissionPct: z.coerce.number().min(0).max(100).optional(),
  pricePerCycleEur: z.coerce.number().min(0).optional(),
  notes: z.string().max(2000).optional(),
});

export async function upsertSubscription(input: unknown): Promise<PlanResult> {
  const session = await auth();
  try {
    assertAdmin(session?.user?.role);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Σφάλμα" };
  }
  const d = parsed.data;
  try {
    const saved = await db.subscription.upsert({
      where: { id: d.id ?? "__none__" },
      update: {
        planId: d.planId,
        status: d.status as SubscriptionStatus,
        billingCycle: d.billingCycle as BillingCycle,
        startsAt: d.startsAt ? new Date(d.startsAt) : new Date(),
        endsAt: d.endsAt ? new Date(d.endsAt) : null,
        trialEndsAt: d.trialEndsAt ? new Date(d.trialEndsAt) : null,
        maxBranches: d.maxBranches ?? null,
        maxEmployees: d.maxEmployees ?? null,
        maxVehicles: d.maxVehicles ?? null,
        maxMonthlyJobs: d.maxMonthlyJobs ?? null,
        crmEnabled: d.crmEnabled ?? null,
        privateScanEnabled: d.privateScanEnabled ?? null,
        apiAccessEnabled: d.apiAccessEnabled ?? null,
        prioritySupport: d.prioritySupport ?? null,
        commissionPct: d.commissionPct ?? null,
        pricePerCycle: d.pricePerCycleEur
          ? Math.round(d.pricePerCycleEur * 100)
          : null,
        notes: d.notes?.trim() || null,
      },
      create: {
        tenantId: d.tenantId,
        planId: d.planId,
        status: d.status as SubscriptionStatus,
        billingCycle: d.billingCycle as BillingCycle,
        startsAt: d.startsAt ? new Date(d.startsAt) : new Date(),
        endsAt: d.endsAt ? new Date(d.endsAt) : null,
        trialEndsAt: d.trialEndsAt ? new Date(d.trialEndsAt) : null,
        maxBranches: d.maxBranches ?? null,
        maxEmployees: d.maxEmployees ?? null,
        maxVehicles: d.maxVehicles ?? null,
        maxMonthlyJobs: d.maxMonthlyJobs ?? null,
        crmEnabled: d.crmEnabled ?? null,
        privateScanEnabled: d.privateScanEnabled ?? null,
        apiAccessEnabled: d.apiAccessEnabled ?? null,
        prioritySupport: d.prioritySupport ?? null,
        commissionPct: d.commissionPct ?? null,
        pricePerCycle: d.pricePerCycleEur
          ? Math.round(d.pricePerCycleEur * 100)
          : null,
        notes: d.notes?.trim() || null,
      },
    });
    revalidatePath("/admin/subscriptions");
    revalidatePath(`/admin/tenants/${d.tenantId}`);
    return { ok: true, id: saved.id };
  } catch (e) {
    console.error("[upsertSubscription]", e);
    return { ok: false, error: "Αποθήκευση συνδρομής απέτυχε." };
  }
}

export async function cancelSubscription(id: string): Promise<PlanResult> {
  const session = await auth();
  try {
    assertAdmin(session?.user?.role);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  try {
    const sub = await db.subscription.findUnique({ where: { id } });
    if (!sub) return { ok: false, error: "Δεν βρέθηκε" };
    await db.subscription.update({
      where: { id },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });
    revalidatePath("/admin/subscriptions");
    revalidatePath(`/admin/tenants/${sub.tenantId}`);
    return { ok: true, id };
  } catch {
    return { ok: false, error: "Ακύρωση απέτυχε." };
  }
}
