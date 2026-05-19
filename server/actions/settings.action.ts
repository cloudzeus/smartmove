"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const settingsSchema = z.object({
  retentionFreeMonths: z.coerce.number().int().min(1).max(120),
  retentionExtensionMonthlyEur: z.coerce.number().min(0).max(10_000),
  retentionExtensionYearlyEur: z.coerce.number().min(0).max(100_000),
  freeGeminiCallsPerMonth: z.coerce.number().int().min(0).max(10_000),
  geminiOveragePriceEur: z.coerce.number().min(0).max(1_000),
  scanFeeEur: z.coerce.number().min(0).max(1_000),
  manualMoveFeeEur: z.coerce.number().min(0).max(1_000),
});

export type SettingsResult =
  | { ok: true }
  | { ok: false; error: string };

export async function updateSystemSettings(
  input: unknown,
): Promise<SettingsResult> {
  const session = await auth();
  if (session?.user?.role !== "SUPERADMIN") {
    return { ok: false, error: "Μόνο SUPERADMIN επιτρέπεται." };
  }
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Σφάλμα" };
  }
  const d = parsed.data;
  try {
    await db.systemSettings.upsert({
      where: { id: "default" },
      update: {
        retentionFreeMonths: d.retentionFreeMonths,
        retentionExtensionMonthlyCents: Math.round(
          d.retentionExtensionMonthlyEur * 100,
        ),
        retentionExtensionYearlyCents: Math.round(
          d.retentionExtensionYearlyEur * 100,
        ),
        freeGeminiCallsPerMonth: d.freeGeminiCallsPerMonth,
        geminiOveragePriceCents: Math.round(d.geminiOveragePriceEur * 100),
        scanFeeCents: Math.round(d.scanFeeEur * 100),
        manualMoveFeeCents: Math.round(d.manualMoveFeeEur * 100),
        updatedById: session.user.id,
      },
      create: {
        id: "default",
        retentionFreeMonths: d.retentionFreeMonths,
        retentionExtensionMonthlyCents: Math.round(
          d.retentionExtensionMonthlyEur * 100,
        ),
        retentionExtensionYearlyCents: Math.round(
          d.retentionExtensionYearlyEur * 100,
        ),
        freeGeminiCallsPerMonth: d.freeGeminiCallsPerMonth,
        geminiOveragePriceCents: Math.round(d.geminiOveragePriceEur * 100),
        scanFeeCents: Math.round(d.scanFeeEur * 100),
        manualMoveFeeCents: Math.round(d.manualMoveFeeEur * 100),
        updatedById: session.user.id,
      },
    });
    revalidatePath("/admin/settings");
    return { ok: true };
  } catch (e) {
    console.error("[updateSystemSettings]", e);
    return { ok: false, error: "Αποθήκευση απέτυχε." };
  }
}

/**
 * Convenience: always returns the singleton row (created on demand).
 * Server-only — call from RSC pages or other server actions.
 */
export async function getSystemSettings() {
  return db.systemSettings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });
}
