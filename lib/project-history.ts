import { db } from "@/lib/db";

export interface HistoryEvent {
  id: string;
  /** Sortable ISO timestamp. */
  at: string;
  /** Stable internal category for icons/colors. */
  kind:
    | "PROJECT_CREATED"
    | "TASK_CREATED"
    | "TASK_CONFIRMED"
    | "TASK_DECLINED"
    | "TASK_STARTED"
    | "TASK_COMPLETED"
    | "REMINDER_SENT"
    | "QUOTE_REQUEST_SENT"
    | "QUOTE_RECEIVED"
    | "QUOTE_ACCEPTED"
    | "QUOTE_LOST"
    | "AVAILABILITY_OVERRIDE";
  title: string;
  detail?: string | null;
  /** Free-form structured info shown inline on hover/click. */
  meta?: Record<string, unknown>;
}

/**
 * Assemble a chronological event log for a single project by union-ing
 * multiple source tables. This is read-only and re-computed on each visit —
 * no separate audit table to keep in sync.
 */
export async function loadProjectHistory(
  projectId: string,
  tenantId: string,
): Promise<HistoryEvent[]> {
  const project = await db.carrierProject.findFirst({
    where: { id: projectId, tenantId },
    select: {
      id: true,
      code: true,
      createdAt: true,
      moveRequestId: true,
    },
  });
  if (!project) return [];

  const [tasks, reminders, quotes, overrides] = await Promise.all([
    db.jobTask.findMany({
      where: {
        tenantId,
        projectStopService: { projectStop: { projectId } },
      },
      select: {
        id: true,
        title: true,
        createdAt: true,
        status: true,
        startedAt: true,
        completedAt: true,
        assigneeConfirmedAt: true,
        assigneeDeclinedAt: true,
        assigneeDeclineReason: true,
        assigneeConfirmationSentAt: true,
        assigneeEmployee: { select: { name: true } },
        assigneePartner: { select: { name: true } },
      },
    }),
    db.taskReminder.findMany({
      where: {
        task: {
          tenantId,
          projectStopService: { projectStop: { projectId } },
        },
      },
      select: {
        id: true,
        sentAt: true,
        createdAt: true,
        status: true,
        recipientName: true,
        channel: true,
        task: { select: { id: true, title: true } },
      },
    }),
    db.partnerQuoteRequest.findMany({
      where: {
        tenantId,
        projectStopService: { projectStop: { projectId } },
      },
      select: {
        id: true,
        createdAt: true,
        quotedAt: true,
        status: true,
        recipientName: true,
        quotedPriceCents: true,
        partner: { select: { name: true } },
        partnerCompany: { select: { commercialName: true, legalName: true } },
        projectStopService: {
          select: { serviceType: true, projectStop: { select: { address: true } } },
        },
      },
    }),
    db.availabilityOverride.findMany({
      where: {
        task: {
          tenantId,
          projectStopService: { projectStop: { projectId } },
        },
      },
      select: {
        id: true,
        overriddenAt: true,
        reason: true,
        task: { select: { id: true, title: true } },
      },
    }),
  ]);

  const events: HistoryEvent[] = [];

  // Project creation.
  events.push({
    id: `project-${project.id}-created`,
    at: project.createdAt.toISOString(),
    kind: "PROJECT_CREATED",
    title: `Δημιουργήθηκε project ${project.code}`,
  });

  // Tasks.
  for (const t of tasks) {
    events.push({
      id: `task-${t.id}-created`,
      at: t.createdAt.toISOString(),
      kind: "TASK_CREATED",
      title: `Δημιουργήθηκε εργασία: ${t.title}`,
      meta: { taskId: t.id },
    });
    if (t.assigneeConfirmationSentAt) {
      events.push({
        id: `task-${t.id}-conf-sent`,
        at: t.assigneeConfirmationSentAt.toISOString(),
        kind: "REMINDER_SENT",
        title: `Αποστολή request επιβεβαίωσης`,
        detail: `${t.title} → ${assigneeName(t)}`,
        meta: { taskId: t.id },
      });
    }
    if (t.assigneeConfirmedAt) {
      events.push({
        id: `task-${t.id}-confirmed`,
        at: t.assigneeConfirmedAt.toISOString(),
        kind: "TASK_CONFIRMED",
        title: `${assigneeName(t)} επιβεβαίωσε`,
        detail: t.title,
        meta: { taskId: t.id },
      });
    }
    if (t.assigneeDeclinedAt) {
      events.push({
        id: `task-${t.id}-declined`,
        at: t.assigneeDeclinedAt.toISOString(),
        kind: "TASK_DECLINED",
        title: `${assigneeName(t)} αρνήθηκε`,
        detail: t.assigneeDeclineReason
          ? `${t.title} — Λόγος: ${t.assigneeDeclineReason}`
          : t.title,
        meta: { taskId: t.id },
      });
    }
    if (t.startedAt) {
      events.push({
        id: `task-${t.id}-started`,
        at: t.startedAt.toISOString(),
        kind: "TASK_STARTED",
        title: `Ξεκίνησε: ${t.title}`,
        meta: { taskId: t.id },
      });
    }
    if (t.completedAt) {
      events.push({
        id: `task-${t.id}-completed`,
        at: t.completedAt.toISOString(),
        kind: "TASK_COMPLETED",
        title: `Ολοκληρώθηκε: ${t.title}`,
        meta: { taskId: t.id },
      });
    }
  }

  // Reminders (separate from confirmation requests — manual sends).
  for (const r of reminders) {
    if (!r.sentAt) continue;
    events.push({
      id: `reminder-${r.id}`,
      at: r.sentAt.toISOString(),
      kind: "REMINDER_SENT",
      title: `Στάλθηκε ${r.channel === "SMS" ? "SMS" : "email"} υπενθύμιση`,
      detail: `${r.recipientName} — ${r.task.title}`,
      meta: { taskId: r.task.id },
    });
  }

  // Quote campaigns.
  for (const q of quotes) {
    const recipient =
      q.partner?.name ??
      q.partnerCompany?.commercialName ??
      q.partnerCompany?.legalName ??
      q.recipientName;
    events.push({
      id: `quote-${q.id}-sent`,
      at: q.createdAt.toISOString(),
      kind: "QUOTE_REQUEST_SENT",
      title: `Request προσφοράς → ${recipient}`,
      detail: `${q.projectStopService?.serviceType ?? "—"} · ${q.projectStopService?.projectStop.address ?? ""}`,
      meta: { quoteRequestId: q.id },
    });
    if (q.quotedAt && q.quotedPriceCents != null) {
      events.push({
        id: `quote-${q.id}-quoted`,
        at: q.quotedAt.toISOString(),
        kind: "QUOTE_RECEIVED",
        title: `${recipient} έδωσε προσφορά: ${(q.quotedPriceCents / 100).toLocaleString("el-GR")}€`,
        detail: q.projectStopService?.serviceType ?? "",
        meta: { quoteRequestId: q.id, priceCents: q.quotedPriceCents },
      });
    }
    if (q.status === "ACCEPTED") {
      events.push({
        // Use quotedAt + tiny offset so accepted sorts after the receipt.
        // We don't have an explicit acceptedAt timestamp; this is best-effort.
        id: `quote-${q.id}-accepted`,
        at: (q.quotedAt ?? q.createdAt).toISOString(),
        kind: "QUOTE_ACCEPTED",
        title: `✓ Επιλέχθηκε: ${recipient}`,
        detail: q.projectStopService?.serviceType ?? "",
        meta: { quoteRequestId: q.id },
      });
    } else if (q.status === "LOST") {
      events.push({
        id: `quote-${q.id}-lost`,
        at: (q.quotedAt ?? q.createdAt).toISOString(),
        kind: "QUOTE_LOST",
        title: `${recipient} — δεν επιλέχθηκε`,
        meta: { quoteRequestId: q.id },
      });
    }
  }

  // Availability overrides.
  for (const o of overrides) {
    events.push({
      id: `override-${o.id}`,
      at: o.overriddenAt.toISOString(),
      kind: "AVAILABILITY_OVERRIDE",
      title: `⚠ Override σύγκρουσης διαθεσιμότητας`,
      detail: o.reason ?? o.task.title,
      meta: { taskId: o.task.id },
    });
  }

  events.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  return events;
}

function assigneeName(t: {
  assigneeEmployee: { name: string } | null;
  assigneePartner: { name: string } | null;
}): string {
  return t.assigneeEmployee?.name ?? t.assigneePartner?.name ?? "—";
}
