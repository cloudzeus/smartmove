"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSystemSettings } from "./settings.action";

export type RetentionResult =
  | { ok: true; extendsUntil: Date }
  | { ok: false; error: string };

/**
 * Free consent: user agrees to keep their data without paying. Records
 * `retentionConsentAt` but DOES NOT extend retention beyond the free window
 * unless the admin chose to be lenient (out of scope: settings flag).
 */
export async function recordRetentionConsent(): Promise<RetentionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Δεν είσαι συνδεδεμένος" };

  try {
    const u = await db.user.update({
      where: { id: session.user.id },
      data: { retentionConsentAt: new Date() },
      select: { dataRetentionUntil: true, retentionExtendedUntil: true },
    });
    revalidatePath("/dashboard");
    return {
      ok: true,
      extendsUntil: u.retentionExtendedUntil ?? u.dataRetentionUntil ?? new Date(),
    };
  } catch (e) {
    console.error("[recordRetentionConsent]", e);
    return { ok: false, error: "Αποθήκευση συναίνεσης απέτυχε." };
  }
}

/**
 * Mock-paid retention extension. Creates a RetentionPayment row marked as PAID
 * (Viva integration TBD) and pushes `retentionExtendedUntil` forward by the
 * chosen number of months.
 */
const extendSchema = z.object({
  months: z.coerce.number().int().min(1).max(60),
});

export async function extendRetention(input: unknown): Promise<RetentionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Δεν είσαι συνδεδεμένος" };

  const parsed = extendSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Άκυρη επιλογή διάρκειας" };
  }
  const months = parsed.data.months;

  const settings = await getSystemSettings();
  const monthlyCents = settings.retentionExtensionMonthlyCents;
  const yearlyCents = settings.retentionExtensionYearlyCents;
  const amountCents =
    months >= 12
      ? Math.round((months / 12) * yearlyCents)
      : months * monthlyCents;

  try {
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { dataRetentionUntil: true, retentionExtendedUntil: true },
    });
    if (!user) return { ok: false, error: "Δεν βρέθηκε ο χρήστης" };

    const base =
      user.retentionExtendedUntil ?? user.dataRetentionUntil ?? new Date();
    const start = base.getTime() > Date.now() ? base : new Date();
    const newEnd = new Date(start);
    newEnd.setMonth(newEnd.getMonth() + months);

    await db.$transaction([
      db.retentionPayment.create({
        data: {
          userId: session.user.id,
          amountCents,
          monthsAdded: months,
          extendsUntil: newEnd,
          status: "PAID", // TODO: actual Viva flow
          paymentProvider: "mock",
          paidAt: new Date(),
        },
      }),
      db.user.update({
        where: { id: session.user.id },
        data: {
          retentionExtendedUntil: newEnd,
          retentionConsentAt: new Date(),
        },
      }),
    ]);

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/payments");
    revalidatePath("/dashboard/settings");
    return { ok: true, extendsUntil: newEnd };
  } catch (e) {
    console.error("[extendRetention]", e);
    return { ok: false, error: "Παράταση απέτυχε." };
  }
}

/**
 * Helper used by RSC pages: ensures the User has a `dataRetentionUntil` set
 * based on current SystemSettings. Run on first dashboard hit per user.
 */
export async function ensureRetentionInitialized(userId: string): Promise<void> {
  const u = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, createdAt: true, dataRetentionUntil: true },
  });
  if (!u || u.dataRetentionUntil) return;
  const settings = await getSystemSettings();
  const until = new Date(u.createdAt);
  until.setMonth(until.getMonth() + settings.retentionFreeMonths);
  await db.user.update({
    where: { id: u.id },
    data: { dataRetentionUntil: until },
  });
}
