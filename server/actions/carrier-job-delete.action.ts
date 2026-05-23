"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Hard-delete a MoveRequest from the carrier's "Μεταφορές" page.
 *
 * Scope: testing/admin convenience. Only allowed for TENANTADMIN/SUPERADMIN
 * who have an accepted offer on this move request, OR for SUPERADMIN regardless.
 *
 * Cascades through Prisma: offers, payments, jobTasks, stops, partner quote
 * requests, carrier projects, etc.
 */
export async function deleteCarrierMoveRequest(
  moveRequestId: string,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Δεν είσαι συνδεδεμένος." };

  const role = session.user.role;
  const isPrivileged = role === "SUPERADMIN" || role === "TENANTADMIN";
  if (!isPrivileged) {
    return { ok: false, error: "Δεν έχεις δικαίωμα διαγραφής μεταφοράς." };
  }

  // For tenant admins, ensure they have a (carrier) tie to this move request
  // via an accepted offer. Superadmin can delete anything.
  if (role !== "SUPERADMIN") {
    const offer = await db.offer.findFirst({
      where: {
        moveRequestId,
        carrierUserId: session.user.id,
        status: "ACCEPTED",
      },
      select: { id: true },
    });
    if (!offer) {
      return {
        ok: false,
        error: "Δεν βρέθηκε ανατεθειμένη μεταφορά για διαγραφή.",
      };
    }
  }

  const move = await db.moveRequest.findUnique({
    where: { id: moveRequestId },
    select: { id: true },
  });
  if (!move) return { ok: false, error: "Δεν βρέθηκε η μεταφορά." };

  try {
    await db.moveRequest.delete({ where: { id: moveRequestId } });
    revalidatePath("/carrier/jobs");
    revalidatePath("/carrier");
    revalidatePath("/carrier/tasks");
    return { ok: true };
  } catch (e) {
    console.error("[deleteCarrierMoveRequest]", e);
    return { ok: false, error: "Η διαγραφή απέτυχε." };
  }
}
