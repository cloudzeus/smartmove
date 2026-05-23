"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendMail } from "@/lib/mailgun";
import { env } from "@/lib/env";

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

const sendSchema = z.object({
  taskId: z.string().min(1),
  customMessage: z.string().trim().max(500).optional().or(z.literal("")),
});

export async function sendTaskReminder(
  input: unknown,
): Promise<ActionResult<{ id: string; channel: "EMAIL" | "SMS" }>> {
  let ctx;
  try {
    ctx = await getCtx();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const parsed = sendSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Λάθος δεδομένα",
    };
  }
  const { taskId, customMessage } = parsed.data;

  const task = await db.jobTask.findFirst({
    where: { id: taskId, tenantId: ctx.tenantId },
    include: {
      assigneeEmployee: { select: { id: true, name: true, email: true, phone: true } },
      assigneePartner: { select: { id: true, name: true, email: true, phone: true } },
      projectStopService: {
        select: {
          projectStop: {
            select: {
              project: { select: { id: true, code: true } },
              address: true,
              type: true,
            },
          },
          serviceType: true,
        },
      },
    },
  });
  if (!task) return { ok: false, error: "Δεν βρέθηκε εργασία." };

  const recipient =
    task.assigneeKind === "EMPLOYEE"
      ? task.assigneeEmployee
      : task.assigneeKind === "PARTNER"
        ? task.assigneePartner
        : null;
  if (!recipient) {
    return { ok: false, error: "Η εργασία δεν έχει ανάθεση." };
  }
  if (!recipient.email) {
    return {
      ok: false,
      error: `Δεν υπάρχει email για ${recipient.name}. Συμπλήρωσέ το στην καρτέλα του.`,
    };
  }

  const project = task.projectStopService?.projectStop?.project ?? null;
  const stopAddress = task.projectStopService?.projectStop?.address ?? "";

  const startsAt = task.startAt.toLocaleString("el-GR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
  const endsAt = new Date(
    task.startAt.getTime() + task.durationMinutes * 60_000,
  ).toLocaleString("el-GR", { hour: "2-digit", minute: "2-digit" });

  const subject = `SmartMove · Υπενθύμιση: ${task.title}`;
  const html = buildEmail({
    recipientName: recipient.name,
    taskTitle: task.title,
    startsAt,
    endsAt,
    address: stopAddress,
    projectCode: project?.code ?? null,
    customMessage: customMessage || null,
    appUrl: env.appUrl(),
  });
  const text = [
    `Γεια σου ${recipient.name},`,
    "",
    `Σου θυμίζουμε την εργασία: ${task.title}`,
    `Έναρξη: ${startsAt} – ${endsAt}`,
    stopAddress && `Διεύθυνση: ${stopAddress}`,
    project?.code && `Project: ${project.code}`,
    customMessage && `\nΣημείωση: ${customMessage}`,
  ]
    .filter(Boolean)
    .join("\n");

  // Persist queued row first so the audit exists even if mail fails.
  const reminder = await db.taskReminder.create({
    data: {
      taskId: task.id,
      channel: "EMAIL",
      status: "QUEUED",
      recipientName: recipient.name,
      recipientEmail: recipient.email,
      recipientPhone: recipient.phone,
      message: customMessage || null,
      triggeredByUserId: ctx.userId,
    },
  });

  const mail = await sendMail({
    to: recipient.email,
    subject,
    html,
    text,
    tags: ["task-reminder"],
  });

  if (mail.ok) {
    await db.taskReminder.update({
      where: { id: reminder.id },
      data: { status: "SENT", sentAt: new Date() },
    });
  } else {
    await db.taskReminder.update({
      where: { id: reminder.id },
      data: { status: "FAILED", errorMessage: mail.error ?? "unknown" },
    });
    return {
      ok: false,
      error: mail.error
        ? `Αποστολή απέτυχε: ${mail.error}`
        : "Αποστολή απέτυχε.",
    };
  }

  if (project) {
    revalidatePath(`/carrier/projects/${project.id}`);
  }
  return { ok: true, data: { id: reminder.id, channel: "EMAIL" } };
}

function buildEmail(args: {
  recipientName: string;
  taskTitle: string;
  startsAt: string;
  endsAt: string;
  address: string;
  projectCode: string | null;
  customMessage: string | null;
  appUrl: string;
}): string {
  const escape = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  return `
<!DOCTYPE html>
<html lang="el">
<body style="margin:0;padding:24px;background:#f7f9fc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:28px;">
    <div style="font-size:11px;font-weight:800;letter-spacing:.12em;color:#2563eb;text-transform:uppercase;margin-bottom:6px;">SmartMove · Υπενθύμιση</div>
    <h1 style="font-size:20px;margin:0 0 12px;">Γεια σου ${escape(args.recipientName)} 👋</h1>
    <p style="font-size:14px;line-height:1.5;margin:0 0 18px;">Σου θυμίζουμε την παρακάτω εργασία:</p>
    <div style="background:#f1f5f9;border-radius:12px;padding:16px;margin-bottom:18px;">
      <div style="font-size:16px;font-weight:700;margin-bottom:8px;">${escape(args.taskTitle)}</div>
      ${args.projectCode ? `<div style="font-family:monospace;font-size:11px;color:#64748b;margin-bottom:8px;">${escape(args.projectCode)}</div>` : ""}
      <div style="font-size:13px;color:#0f172a;margin-bottom:4px;"><strong>⏰</strong> ${escape(args.startsAt)} – ${escape(args.endsAt)}</div>
      ${args.address ? `<div style="font-size:13px;color:#0f172a;"><strong>📍</strong> ${escape(args.address)}</div>` : ""}
    </div>
    ${args.customMessage ? `<div style="background:#fef3c7;border-radius:10px;padding:12px;font-size:13px;margin-bottom:18px;"><strong>Σημείωση:</strong> ${escape(args.customMessage)}</div>` : ""}
    <a href="${args.appUrl}" style="display:inline-block;padding:12px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:10px;font-weight:700;font-size:14px;">Άνοιγμα SmartMove</a>
    <p style="margin-top:24px;color:#94a3b8;font-size:11px;text-align:center;">Αυτή η υπενθύμιση στάλθηκε από τον διαχειριστή της εταιρείας.</p>
  </div>
</body>
</html>`.trim();
}
