"use server";

import { randomBytes } from "node:crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { sendMail } from "@/lib/mailgun";
import { emitNotification } from "@/lib/events";

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

// ─────────── Helper: send the confirmation email and set PENDING ───────────

export async function sendTaskAssignmentConfirmation(
  taskId: string,
  tenantId: string,
): Promise<{ ok: boolean; error?: string }> {
  const task = await db.jobTask.findFirst({
    where: { id: taskId, tenantId },
    include: {
      assigneeEmployee: { select: { id: true, name: true, email: true } },
      assigneePartner: { select: { id: true, name: true, email: true } },
      projectStopService: {
        select: {
          serviceType: true, label: true,
          projectStop: {
            select: {
              address: true,
              project: { select: { id: true, code: true } },
            },
          },
        },
      },
    },
  });
  if (!task) return { ok: false, error: "Task not found" };

  const recipient =
    task.assigneeKind === "EMPLOYEE"
      ? task.assigneeEmployee
      : task.assigneeKind === "PARTNER"
        ? task.assigneePartner
        : null;
  if (!recipient || !recipient.email) {
    return { ok: false, error: "Assignee has no email" };
  }

  const token = randomBytes(24).toString("base64url");
  await db.jobTask.update({
    where: { id: task.id },
    data: {
      assigneeConfirmationStatus: "PENDING",
      assigneeConfirmationToken: token,
      assigneeConfirmationSentAt: new Date(),
      assigneeConfirmedAt: null,
      assigneeDeclinedAt: null,
      assigneeDeclineReason: null,
      assigneeConfirmedByUserId: null,
    },
  });

  const project = task.projectStopService?.projectStop.project ?? null;
  const stopAddress = task.projectStopService?.projectStop.address ?? "";
  const startsAt = task.startAt.toLocaleString("el-GR", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
  const endsAt = new Date(
    task.startAt.getTime() + task.durationMinutes * 60_000,
  ).toLocaleString("el-GR", { hour: "2-digit", minute: "2-digit" });

  const confirmUrl = `${env.appUrl()}/task-confirm/${token}`;
  const subject = `SmartMove · Επιβεβαίωση εργασίας: ${task.title}`;
  const html = buildHtml({
    recipientName: recipient.name,
    taskTitle: task.title,
    startsAt, endsAt, address: stopAddress,
    projectCode: project?.code ?? null,
    confirmUrl,
  });
  const text = [
    `Γεια σου ${recipient.name},`,
    "",
    `Σου ανατέθηκε η εργασία: ${task.title}`,
    `Έναρξη: ${startsAt} – ${endsAt}`,
    stopAddress && `Διεύθυνση: ${stopAddress}`,
    project?.code && `Project: ${project.code}`,
    "",
    `Επιβεβαίωσε ή απάντησε: ${confirmUrl}`,
  ].filter(Boolean).join("\n");

  const mail = await sendMail({
    to: recipient.email, subject, html, text,
    tags: ["task-confirmation"],
  });
  if (!mail.ok) {
    return { ok: false, error: mail.error ?? "mail failed" };
  }
  return { ok: true };
}

// ─────────── Admin: manually confirm a task ───────────

export async function confirmTaskByAdmin(
  taskId: string,
): Promise<ActionResult> {
  let ctx;
  try { ctx = await getCtx(); } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const task = await db.jobTask.findFirst({
    where: { id: taskId, tenantId: ctx.tenantId },
    select: {
      id: true,
      projectStopService: { select: { projectStop: { select: { project: { select: { id: true } } } } } },
    },
  });
  if (!task) return { ok: false, error: "Δεν βρέθηκε εργασία." };
  await db.jobTask.update({
    where: { id: task.id },
    data: {
      assigneeConfirmationStatus: "CONFIRMED",
      assigneeConfirmedAt: new Date(),
      assigneeConfirmedByUserId: ctx.userId,
      assigneeDeclinedAt: null,
      assigneeDeclineReason: null,
    },
  });
  const projectId = task.projectStopService?.projectStop.project.id;
  if (projectId) revalidatePath(`/carrier/projects/${projectId}`);
  return { ok: true };
}

// ─────────── Admin: resend the confirmation email ───────────

export async function resendTaskConfirmation(
  taskId: string,
): Promise<ActionResult> {
  let ctx;
  try { ctx = await getCtx(); } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const res = await sendTaskAssignmentConfirmation(taskId, ctx.tenantId);
  if (!res.ok) return { ok: false, error: res.error ?? "Αποστολή απέτυχε." };
  return { ok: true };
}

// ─────────── Public (no-auth, magic-link) confirm/decline ───────────

const respondSchema = z.object({
  token: z.string().min(10),
  decision: z.enum(["CONFIRM", "DECLINE"]),
  reason: z.string().trim().max(500).optional().or(z.literal("")),
});

export async function respondToTaskConfirmation(
  input: unknown,
): Promise<ActionResult<{ status: "CONFIRMED" | "DECLINED" }>> {
  const parsed = respondSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Λάθος δεδομένα",
    };
  }
  const { token, decision, reason } = parsed.data;
  const task = await db.jobTask.findFirst({
    where: { assigneeConfirmationToken: token },
    select: {
      id: true, tenantId: true, title: true,
      assigneeConfirmationStatus: true,
      assigneeEmployee: { select: { name: true } },
      assigneePartner: { select: { name: true } },
      projectStopService: {
        select: { projectStop: { select: { project: { select: { id: true, code: true } } } } },
      },
    },
  });
  if (!task) return { ok: false, error: "Άκυρος σύνδεσμος." };
  if (task.assigneeConfirmationStatus === "CONFIRMED") {
    return { ok: true, data: { status: "CONFIRMED" } };
  }
  if (task.assigneeConfirmationStatus === "DECLINED") {
    return { ok: true, data: { status: "DECLINED" } };
  }
  const now = new Date();
  const project = task.projectStopService?.projectStop.project;
  const recipientName =
    task.assigneeEmployee?.name ?? task.assigneePartner?.name ?? "—";
  const href = project ? `/carrier/projects/${project.id}` : "/carrier/tasks";

  if (decision === "CONFIRM") {
    await db.jobTask.update({
      where: { id: task.id },
      data: {
        assigneeConfirmationStatus: "CONFIRMED",
        assigneeConfirmedAt: now,
        assigneeDeclinedAt: null,
        assigneeDeclineReason: null,
      },
    });
    try {
      await emitNotification({
        tenantId: task.tenantId,
        type: "TASK_CONFIRMED",
        severity: "SUCCESS",
        title: `✓ ${recipientName} επιβεβαίωσε την εργασία`,
        body: task.title,
        href,
        payload: {
          taskId: task.id,
          projectId: project?.id ?? null,
          projectCode: project?.code ?? null,
        },
        revalidate: project ? [`/carrier/projects/${project.id}`, "/carrier"] : ["/carrier"],
      });
    } catch (e) {
      console.warn("[respondToTaskConfirmation] emit failed:", e);
    }
    return { ok: true, data: { status: "CONFIRMED" } };
  }
  await db.jobTask.update({
    where: { id: task.id },
    data: {
      assigneeConfirmationStatus: "DECLINED",
      assigneeDeclinedAt: now,
      assigneeDeclineReason: reason || null,
      assigneeConfirmedAt: null,
    },
  });
  try {
    await emitNotification({
      tenantId: task.tenantId,
      type: "TASK_DECLINED",
      severity: "CRITICAL",
      title: `⚠ ${recipientName} δεν αναλαμβάνει την εργασία`,
      body: `${task.title}${reason ? ` — Λόγος: ${reason}` : ""}`,
      href,
      payload: {
        taskId: task.id,
        projectId: project?.id ?? null,
        projectCode: project?.code ?? null,
        reason: reason || null,
      },
      revalidate: project ? [`/carrier/projects/${project.id}`, "/carrier"] : ["/carrier"],
    });
  } catch (e) {
    console.warn("[respondToTaskConfirmation] emit failed:", e);
  }
  return { ok: true, data: { status: "DECLINED" } };
}

function buildHtml(args: {
  recipientName: string;
  taskTitle: string;
  startsAt: string;
  endsAt: string;
  address: string;
  projectCode: string | null;
  confirmUrl: string;
}): string {
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  return `
<!DOCTYPE html>
<html lang="el">
<body style="margin:0;padding:24px;background:#f7f9fc;font-family:-apple-system,sans-serif;color:#0f172a;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:28px;">
    <div style="font-size:11px;font-weight:800;letter-spacing:.12em;color:#2563eb;text-transform:uppercase;margin-bottom:6px;">SmartMove · Νέα εργασία</div>
    <h1 style="font-size:20px;margin:0 0 12px;">Γεια σου ${escape(args.recipientName)} 👋</h1>
    <p style="font-size:14px;line-height:1.5;margin:0 0 18px;">Σου ανατέθηκε η παρακάτω εργασία. Παρακαλώ <strong>επιβεβαίωσε</strong> ή <strong>απάντησε αρνητικά</strong> για να ξέρει ο διαχειριστής.</p>
    <div style="background:#f1f5f9;border-radius:12px;padding:16px;margin-bottom:18px;">
      <div style="font-size:16px;font-weight:700;margin-bottom:8px;">${escape(args.taskTitle)}</div>
      ${args.projectCode ? `<div style="font-family:monospace;font-size:11px;color:#64748b;margin-bottom:8px;">${escape(args.projectCode)}</div>` : ""}
      <div style="font-size:13px;margin-bottom:4px;"><strong>⏰</strong> ${escape(args.startsAt)} – ${escape(args.endsAt)}</div>
      ${args.address ? `<div style="font-size:13px;"><strong>📍</strong> ${escape(args.address)}</div>` : ""}
    </div>
    <a href="${args.confirmUrl}" style="display:inline-block;padding:14px 24px;background:#10b981;color:#fff;text-decoration:none;border-radius:10px;font-weight:800;font-size:15px;">✓ Άνοιγμα & Επιβεβαίωση</a>
    <p style="margin-top:24px;color:#94a3b8;font-size:11px;text-align:center;">Ο σύνδεσμος είναι μοναδικός — μην τον προωθήσεις.</p>
  </div>
</body>
</html>`.trim();
}
