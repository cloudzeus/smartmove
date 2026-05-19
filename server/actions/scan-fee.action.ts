"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSystemSettings } from "./settings.action";

export type ScanFeeResult =
  | { ok: true; feeId: string; amountCents: number }
  | { ok: false; error: string };

/**
 * Create a ScanFee row attached to a MoveRequest. Called from
 * createMoveRequest when `inventorySource === "ai"`. Status starts as PENDING
 * and is flipped to PAID by `payScanFee` (Viva mock for now).
 */
export async function createScanFee(opts: {
  moveRequestId: string;
}): Promise<ScanFeeResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Δεν είσαι συνδεδεμένος" };

  const settings = await getSystemSettings();
  if (settings.scanFeeCents <= 0) {
    // Fee disabled — nothing to charge.
    return { ok: true, feeId: "", amountCents: 0 };
  }

  // Pull the user's preferred document type
  const profile = await db.billingProfile.findUnique({
    where: { userId: session.user.id },
    select: { preferredDocument: true, type: true },
  });
  const documentType =
    profile?.preferredDocument ??
    (profile?.type === "COMPANY" ? "INVOICE" : "RECEIPT");

  try {
    const fee = await db.scanFee.upsert({
      where: { moveRequestId: opts.moveRequestId },
      update: {
        amountCents: settings.scanFeeCents,
        status: "PENDING",
        documentType,
      },
      create: {
        userId: session.user.id,
        moveRequestId: opts.moveRequestId,
        amountCents: settings.scanFeeCents,
        documentType,
      },
    });
    return { ok: true, feeId: fee.id, amountCents: fee.amountCents };
  } catch (e) {
    console.error("[createScanFee]", e);
    return { ok: false, error: "Δημιουργία χρέωσης απέτυχε." };
  }
}

/**
 * Mark a ScanFee as paid (Viva mock — real integration replaces this with
 * webhook-driven flow).
 */
export async function payScanFee(feeId: string): Promise<ScanFeeResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Δεν είσαι συνδεδεμένος" };
  try {
    const fee = await db.scanFee.findUnique({ where: { id: feeId } });
    if (!fee || fee.userId !== session.user.id) {
      return { ok: false, error: "Δεν επιτρέπεται." };
    }
    if (fee.status === "PAID") {
      return { ok: true, feeId: fee.id, amountCents: fee.amountCents };
    }
    const updated = await db.scanFee.update({
      where: { id: feeId },
      data: {
        status: "PAID",
        paidAt: new Date(),
        paymentProvider: "mock",
        paymentRef: `mock-${Date.now()}`,
      },
    });
    revalidatePath("/dashboard/payments");
    return { ok: true, feeId: updated.id, amountCents: updated.amountCents };
  } catch (e) {
    console.error("[payScanFee]", e);
    return { ok: false, error: "Πληρωμή απέτυχε." };
  }
}
