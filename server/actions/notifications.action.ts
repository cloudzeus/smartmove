"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

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

export async function markNotificationRead(id: string): Promise<ActionResult> {
  let ctx;
  try { ctx = await getCtx(); } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const row = await db.notification.findFirst({
    where: { id, tenantId: ctx.tenantId },
    select: { id: true },
  });
  if (!row) return { ok: false, error: "Δεν βρέθηκε." };
  await db.notification.update({
    where: { id },
    data: { status: "READ", readAt: new Date() },
  });
  revalidatePath("/carrier");
  return { ok: true };
}

export async function markAllNotificationsRead(): Promise<ActionResult> {
  let ctx;
  try { ctx = await getCtx(); } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  await db.notification.updateMany({
    where: { tenantId: ctx.tenantId, status: "UNREAD" },
    data: { status: "READ", readAt: new Date() },
  });
  revalidatePath("/carrier");
  return { ok: true };
}

export async function archiveNotification(id: string): Promise<ActionResult> {
  let ctx;
  try { ctx = await getCtx(); } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const row = await db.notification.findFirst({
    where: { id, tenantId: ctx.tenantId },
    select: { id: true },
  });
  if (!row) return { ok: false, error: "Δεν βρέθηκε." };
  await db.notification.update({
    where: { id },
    data: { status: "ARCHIVED" },
  });
  revalidatePath("/carrier");
  return { ok: true };
}
