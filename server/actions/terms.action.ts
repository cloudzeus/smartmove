"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getActiveTerms } from "@/lib/terms";

export type AcceptTermsResult =
  | { ok: true }
  | { ok: false; error: string };

const acceptSchema = z.object({
  version: z.string().min(1),
});

export async function acceptTerms(
  input: unknown,
): Promise<AcceptTermsResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Δεν είσαι συνδεδεμένος." };
  }
  const parsed = acceptSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Λάθος δεδομένα." };
  }
  const active = await getActiveTerms();
  if (!active) {
    return { ok: false, error: "Δεν υπάρχει ενεργή έκδοση όρων." };
  }
  if (active.version !== parsed.data.version) {
    return {
      ok: false,
      error: "Οι όροι έχουν αλλάξει. Διάβασε ξανά και αποδέξου την τρέχουσα έκδοση.",
    };
  }
  try {
    await db.user.update({
      where: { id: session.user.id },
      data: {
        termsAcceptedVersion: active.version,
        termsAcceptedAt: new Date(),
      },
    });
    return { ok: true };
  } catch (e) {
    console.error("[acceptTerms]", e);
    return { ok: false, error: "Αποθήκευση απέτυχε." };
  }
}

// ---------------------------------------------------------------------
// Admin actions for managing terms versions
// ---------------------------------------------------------------------

function assertAdmin(role?: string) {
  if (role !== "SUPERADMIN" && role !== "EMPLOYEE") {
    throw new Error("Δεν έχεις δικαίωμα.");
  }
}

const upsertSchema = z.object({
  id: z.string().optional(),
  version: z
    .string()
    .min(1)
    .regex(/^\d+\.\d+\.\d+$/, "Χρησιμοποίησε semver (π.χ. 1.0.0)"),
  summary: z.string().max(500).optional(),
  bodyEl: z.string().min(50, "Πολύ σύντομο κείμενο"),
  bodyEn: z.string().min(50, "Πολύ σύντομο κείμενο"),
});

export type UpsertTermsResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function upsertTermsVersion(
  input: unknown,
): Promise<UpsertTermsResult> {
  const session = await auth();
  try {
    assertAdmin(session?.user?.role);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const parsed = upsertSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Λάθος δεδομένα",
    };
  }
  const d = parsed.data;
  try {
    const saved = await db.termsVersion.upsert({
      where: { id: d.id ?? "__none__" },
      update: {
        version: d.version,
        summary: d.summary?.trim() || null,
        bodyEl: d.bodyEl,
        bodyEn: d.bodyEn,
      },
      create: {
        version: d.version,
        summary: d.summary?.trim() || null,
        bodyEl: d.bodyEl,
        bodyEn: d.bodyEn,
        isActive: false,
      },
    });
    revalidatePath("/admin/terms");
    return { ok: true, id: saved.id };
  } catch (e) {
    console.error("[upsertTermsVersion]", e);
    if (
      e instanceof Error &&
      e.message.includes("Unique constraint")
    ) {
      return { ok: false, error: "Υπάρχει ήδη έκδοση με αυτό το version." };
    }
    return { ok: false, error: "Αποθήκευση απέτυχε." };
  }
}

/**
 * Activates a version. Deactivates all others atomically. After activation,
 * all non-staff users will be forced to re-accept on next request.
 */
export async function activateTermsVersion(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  try {
    assertAdmin(session?.user?.role);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  try {
    await db.$transaction([
      db.termsVersion.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      }),
      db.termsVersion.update({
        where: { id },
        data: { isActive: true, publishedAt: new Date() },
      }),
    ]);
    revalidatePath("/admin/terms");
    return { ok: true };
  } catch (e) {
    console.error("[activateTermsVersion]", e);
    return { ok: false, error: "Ενεργοποίηση απέτυχε." };
  }
}
