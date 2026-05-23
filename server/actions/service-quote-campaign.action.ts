"use server";

import { randomBytes } from "node:crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { sendMail } from "@/lib/mailgun";
import { renderPartnerQuoteRequestEmail } from "@/lib/emails/partner-quote-request";

// Map our internal ServiceType to the PartnerQuoteService enum used by the
// existing public quote form. Anything not directly representable falls back
// to OTHER so the carrier can still send the request.
const SERVICE_TYPE_TO_QUOTE_SERVICE = {
  CRANE: "CRANE",
  PACKING: "PACKING",
  STORAGE: "STORAGE",
  ASSEMBLY: "HANDYMAN",
  DISASSEMBLY: "HANDYMAN",
  CLEANUP: "OTHER",
  LOADING: "OTHER",
  UNLOADING: "OTHER",
  TRANSIT: "OTHER",
  OTHER: "OTHER",
} as const;

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
  return {
    userId: session.user.id,
    userName: session.user.name ?? session.user.email ?? "",
    tenantId: membership.tenantId,
  };
}

// ─────────────────────── SEND CAMPAIGN ───────────────────────

const sendSchema = z.object({
  projectStopServiceId: z.string().min(1),
  partnerIds: z.array(z.string().min(1)).optional().default([]),
  companyIds: z.array(z.string().min(1)).optional().default([]),
  scheduledStartAt: z.string().min(1),
  estimatedMinutes: z.coerce.number().int().min(15).max(60 * 24 * 14),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  validHours: z.coerce.number().int().min(1).max(720).default(72),
}).refine(
  (d) => d.partnerIds.length + d.companyIds.length > 0,
  { message: "Επέλεξε τουλάχιστον έναν συνεργάτη ή εταιρία" },
);

export async function sendServiceQuoteCampaign(
  input: unknown,
): Promise<ActionResult<{ sent: number; failed: number; projectId: string }>> {
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
  const d = parsed.data;

  const service = await db.projectStopService.findFirst({
    where: {
      id: d.projectStopServiceId,
      projectStop: { project: { tenantId: ctx.tenantId } },
    },
    include: {
      projectStop: {
        include: {
          project: {
            select: {
              id: true, code: true,
              moveRequest: {
                select: {
                  id: true, fromAddress: true, toAddress: true,
                  itemsCount: true, totalVolumeM3: true, type: true,
                  preferredDate: true,
                },
              },
              stops: {
                orderBy: { sequence: "asc" },
                select: { id: true, sequence: true },
              },
            },
          },
        },
      },
    },
  });
  if (!service) return { ok: false, error: "Δεν βρέθηκε υπηρεσία." };

  const partners = d.partnerIds.length > 0
    ? await db.carrierPartner.findMany({
        where: {
          id: { in: d.partnerIds },
          tenantId: ctx.tenantId,
          deletedAt: null,
        },
        select: { id: true, name: true, email: true },
      })
    : [];
  const companies = d.companyIds.length > 0
    ? await db.partnerCompany.findMany({
        where: {
          id: { in: d.companyIds },
          tenantId: ctx.tenantId,
          deletedAt: null,
        },
        select: { id: true, legalName: true, commercialName: true, email: true },
      })
    : [];

  if (partners.length + companies.length === 0) {
    return { ok: false, error: "Δεν βρέθηκαν έγκυροι αποδέκτες." };
  }
  const missingEmail = [
    ...partners.filter((p) => !p.email).map((p) => p.name),
    ...companies.filter((c) => !c.email).map((c) => c.commercialName ?? c.legalName),
  ];
  if (missingEmail.length > 0) {
    return {
      ok: false,
      error: `Δεν υπάρχει email: ${missingEmail.join(", ")}`,
    };
  }

  const tenant = await db.tenant.findUnique({
    where: { id: ctx.tenantId },
    select: { commercialName: true, legalName: true },
  });
  const carrierName =
    tenant?.commercialName ?? tenant?.legalName ?? ctx.userName ?? "SmartMove";

  const scheduledStart = new Date(d.scheduledStartAt);
  const expiresAt = new Date(Date.now() + d.validHours * 3600 * 1000);
  const move = service.projectStop.project.moveRequest;
  const project = service.projectStop.project;
  const quoteService =
    SERVICE_TYPE_TO_QUOTE_SERVICE[
      service.serviceType as keyof typeof SERVICE_TYPE_TO_QUOTE_SERVICE
    ] ?? "OTHER";

  // Specific stop where the partner's work is needed. We pre-load the project's
  // stops above so we can render "X από Y" context for multi-stop moves.
  const stops = project.stops;
  const stopIdx = stops.findIndex((s) => s.id === service.projectStop.id);
  const stopRow = await db.projectStop.findUnique({
    where: { id: service.projectStop.id },
    select: { address: true, type: true, label: true },
  });
  const workLocation = stopRow
    ? {
        address: stopRow.address,
        stopType: stopRow.type as "PICKUP" | "DELIVERY" | "INTERMEDIATE" | null,
        label: stopRow.label,
        sequenceLabel:
          stops.length > 1 && stopIdx >= 0
            ? `${stopIdx + 1} από ${stops.length}`
            : null,
      }
    : null;

  let sent = 0;
  let failed = 0;

  // Normalize recipients into a single iteration list.
  type Recipient = {
    kind: "partner" | "company";
    id: string;
    name: string;
    email: string;
  };
  const recipients: Recipient[] = [
    ...partners.map((p) => ({
      kind: "partner" as const, id: p.id, name: p.name, email: p.email!,
    })),
    ...companies.map((c) => ({
      kind: "company" as const,
      id: c.id,
      name: c.commercialName ?? c.legalName,
      email: c.email!,
    })),
  ];

  for (const r of recipients) {
    const token = randomBytes(24).toString("base64url");
    try {
      await db.partnerQuoteRequest.create({
        data: {
          tenantId: ctx.tenantId,
          requestedByUserId: ctx.userId,
          moveRequestId: move.id,
          projectStopServiceId: service.id,
          partnerId: r.kind === "partner" ? r.id : null,
          partnerCompanyId: r.kind === "company" ? r.id : null,
          recipientEmail: r.email.toLowerCase(),
          recipientName: r.name,
          service: quoteService,
          notes: d.notes || null,
          token,
          expiresAt,
          scheduledStartAt: scheduledStart,
          estimatedMinutes: d.estimatedMinutes,
          moveSnapshotJson: {
            fromAddress: move.fromAddress,
            toAddress: move.toAddress,
            stopAddress: service.projectStop.address,
            projectCode: project.code,
            itemsCount: move.itemsCount,
            totalVolumeM3: move.totalVolumeM3,
            scheduledStartAt: scheduledStart.toISOString(),
            estimatedMinutes: d.estimatedMinutes,
          },
        },
      });

      const quoteUrl = `${env.appUrl()}/quote/${token}`;
      const email = renderPartnerQuoteRequestEmail({
        partnerName: r.name,
        carrierName,
        service: quoteService,
        notes: d.notes ?? null,
        moveSummary: {
          fromAddress: move.fromAddress,
          toAddress: move.toAddress,
          preferredDate: new Intl.DateTimeFormat("el-GR", {
            weekday: "long", day: "2-digit", month: "long", year: "numeric",
            hour: "2-digit", minute: "2-digit",
          }).format(scheduledStart),
          itemsCount: move.itemsCount,
          volumeM3: move.totalVolumeM3,
          estimatedMinutes: d.estimatedMinutes,
        },
        workLocation: workLocation,
        quoteUrl,
        expiresAt,
      });
      const mail = await sendMail({
        to: r.email,
        subject: email.subject,
        html: email.html,
        text: email.text,
        tags: ["partner-quote-request", "service-campaign"],
      });
      if (mail.ok) sent++;
      else failed++;
    } catch (e) {
      console.error("[sendServiceQuoteCampaign]", r.kind, r.id, e);
      failed++;
    }
  }

  revalidatePath(`/carrier/projects/${project.id}`);
  return { ok: true, data: { sent, failed, projectId: project.id } };
}

// ─────────────────────── ACCEPT QUOTE (pick winner) ───────────────────────

const acceptSchema = z.object({
  quoteRequestId: z.string().min(1),
  cancelOthers: z.boolean().default(true),
  sendCourtesyEmail: z.boolean().default(true),
});

export async function acceptServiceQuote(
  input: unknown,
): Promise<ActionResult<{ taskId: string; cancelledCount: number }>> {
  let ctx;
  try {
    ctx = await getCtx();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const parsed = acceptSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Λάθος δεδομένα",
    };
  }
  const d = parsed.data;

  const quote = await db.partnerQuoteRequest.findFirst({
    where: { id: d.quoteRequestId, tenantId: ctx.tenantId },
    include: {
      partner: { select: { id: true, name: true } },
      partnerCompany: { select: { id: true, legalName: true, commercialName: true } },
      projectStopService: {
        select: {
          id: true, serviceType: true, label: true,
          projectStop: {
            select: {
              id: true, address: true,
              project: { select: { id: true, code: true, moveRequest: { select: { id: true } } } },
            },
          },
        },
      },
    },
  });
  if (!quote) return { ok: false, error: "Δεν βρέθηκε quote." };
  if (!quote.projectStopServiceId || !quote.projectStopService) {
    return { ok: false, error: "Το quote δεν αφορά project service." };
  }
  if (!quote.partnerId && !quote.partnerCompanyId) {
    return { ok: false, error: "Το quote δεν έχει συνδεδεμένο partner ή εταιρία." };
  }
  if (quote.status === "ACCEPTED") {
    return { ok: false, error: "Έχει ήδη επιλεγεί." };
  }
  if (quote.status === "DECLINED" || quote.status === "EXPIRED" || quote.status === "CANCELLED") {
    return { ok: false, error: `Δεν μπορεί να επιλεγεί quote σε κατάσταση ${quote.status}.` };
  }

  // If the quote came from a PartnerCompany, materialize an individual
  // CarrierPartner using the responding contact info, so JobTask can still
  // point to a single assignee (we don't model company-as-assignee yet).
  let assigneePartnerId: string;
  let assigneePartnerName: string;
  if (quote.partnerId && quote.partner) {
    assigneePartnerId = quote.partnerId;
    assigneePartnerName = quote.partner.name;
  } else if (quote.partnerCompanyId && quote.partnerCompany) {
    if (!quote.respondingContactName) {
      return {
        ok: false,
        error: "Η εταιρία δεν συμπλήρωσε υπεύθυνο επικοινωνίας. Δεν μπορούμε να αναθέσουμε.",
      };
    }
    const companyName =
      quote.partnerCompany.commercialName ?? quote.partnerCompany.legalName;
    // Reuse if a CarrierPartner with the same companyId + name already exists.
    const existing = await db.carrierPartner.findFirst({
      where: {
        tenantId: ctx.tenantId,
        companyId: quote.partnerCompanyId,
        name: quote.respondingContactName,
        deletedAt: null,
      },
      select: { id: true, name: true },
    });
    if (existing) {
      assigneePartnerId = existing.id;
      assigneePartnerName = existing.name;
    } else {
      const created = await db.carrierPartner.create({
        data: {
          tenantId: ctx.tenantId,
          companyId: quote.partnerCompanyId,
          name: quote.respondingContactName,
          email: quote.respondingContactEmail || null,
          phone: quote.respondingContactPhone || null,
          notes: `Auto-created από quote ${quote.id} (εταιρία: ${companyName})`,
        },
        select: { id: true, name: true },
      });
      assigneePartnerId = created.id;
      assigneePartnerName = created.name;
    }
  } else {
    return { ok: false, error: "Το quote δεν έχει έγκυρο αποδέκτη." };
  }

  const startAt = quote.scheduledStartAt ?? new Date();
  const duration = quote.estimatedMinutes ?? 60;
  const svc = quote.projectStopService;
  const moveRequestId = svc.projectStop.project.moveRequest.id;

  let cancelledCount = 0;

  // Use a transaction so we never end up with an accepted-but-no-task state.
  const result = await db.$transaction(async (tx) => {
    const task = await tx.jobTask.create({
      data: {
        tenantId: ctx.tenantId,
        moveRequestId,
        projectStopServiceId: svc.id,
        fromQuoteRequestId: quote.id,
        createdByUserId: ctx.userId,
        title: `${svc.label ?? svc.serviceType} · ${assigneePartnerName}`,
        category: "OTHER",
        startAt,
        durationMinutes: duration,
        status: "CONFIRMED",
        assigneeKind: "PARTNER",
        assigneePartnerId,
      },
    });

    await tx.partnerQuoteRequest.update({
      where: { id: quote.id },
      data: { status: "ACCEPTED" },
    });

    if (d.cancelOthers) {
      const losers = await tx.partnerQuoteRequest.findMany({
        where: {
          projectStopServiceId: svc.id,
          id: { not: quote.id },
          status: { in: ["PENDING", "QUOTED"] },
        },
        select: {
          id: true, recipientEmail: true, recipientName: true,
        },
      });
      if (losers.length > 0) {
        await tx.partnerQuoteRequest.updateMany({
          where: { id: { in: losers.map((l) => l.id) } },
          data: { status: "LOST" },
        });
        cancelledCount = losers.length;
        // We capture losers for post-tx courtesy emails (out of the
        // transaction so a slow Mailgun call doesn't hold a DB lock).
        return { taskId: task.id, losers };
      }
    }
    return { taskId: task.id, losers: [] as Array<{ id: string; recipientEmail: string; recipientName: string | null }> };
  });

  // Courtesy emails (option A from the design discussion).
  if (d.sendCourtesyEmail && result.losers.length > 0) {
    const tenant = await db.tenant.findUnique({
      where: { id: ctx.tenantId },
      select: { commercialName: true, legalName: true },
    });
    const carrierName =
      tenant?.commercialName ?? tenant?.legalName ?? "SmartMove";

    const projectCode = svc.projectStop.project.code;
    for (const loser of result.losers) {
      try {
        await sendMail({
          to: loser.recipientEmail,
          subject: `SmartMove · Σχετικά με το αίτημα προσφοράς ${projectCode}`,
          html: courtesyHtml({
            recipientName: loser.recipientName ?? "Συνεργάτη",
            carrierName,
            projectCode,
            serviceLabel: svc.label ?? svc.serviceType,
          }),
          text: `Γεια σου ${loser.recipientName ?? ""},\n\nΣ' ευχαριστούμε για το χρόνο που αφιέρωσες στο αίτημα προσφοράς για ${svc.label ?? svc.serviceType} (project ${projectCode}). Αυτή τη φορά η εργασία ανατέθηκε αλλού.\n\nΘα έχουμε νέα ευκαιρία σύντομα.\n\n— ${carrierName}`,
          tags: ["partner-quote-courtesy"],
        });
      } catch (e) {
        console.warn("[acceptServiceQuote] courtesy email failed:", e);
      }
    }
  }

  revalidatePath(`/carrier/projects/${svc.projectStop.project.id}`);
  return {
    ok: true,
    data: { taskId: result.taskId, cancelledCount },
  };
}

function courtesyHtml(args: {
  recipientName: string;
  carrierName: string;
  projectCode: string;
  serviceLabel: string;
}): string {
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `
<!DOCTYPE html>
<html lang="el">
<body style="margin:0;padding:24px;background:#f7f9fc;font-family:-apple-system,sans-serif;color:#0f172a;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:28px;">
    <h1 style="font-size:18px;margin:0 0 12px;">Γεια σου ${escape(args.recipientName)},</h1>
    <p style="font-size:14px;line-height:1.5;">Σ' ευχαριστούμε για το χρόνο που αφιέρωσες στο αίτημα προσφοράς για <strong>${escape(args.serviceLabel)}</strong> (project ${escape(args.projectCode)}).</p>
    <p style="font-size:14px;line-height:1.5;">Αυτή τη φορά η εργασία ανατέθηκε αλλού, αλλά εκτιμούμε τη συνεργασία και θα έχουμε νέα ευκαιρία σύντομα.</p>
    <p style="margin-top:24px;font-size:13px;">— ${escape(args.carrierName)}</p>
  </div>
</body>
</html>`.trim();
}

// ─────────────────────── CANCEL SINGLE QUOTE ───────────────────────

export async function cancelServiceQuote(
  quoteRequestId: string,
): Promise<ActionResult> {
  let ctx;
  try {
    ctx = await getCtx();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const quote = await db.partnerQuoteRequest.findFirst({
    where: { id: quoteRequestId, tenantId: ctx.tenantId },
    select: {
      id: true, status: true,
      projectStopService: {
        select: { projectStop: { select: { project: { select: { id: true } } } } },
      },
    },
  });
  if (!quote) return { ok: false, error: "Δεν βρέθηκε quote." };
  if (quote.status === "ACCEPTED") {
    return {
      ok: false,
      error: "Δεν μπορείς να ακυρώσεις quote που έχει ήδη επιλεγεί.",
    };
  }
  await db.partnerQuoteRequest.update({
    where: { id: quote.id },
    data: { status: "CANCELLED" },
  });
  const projectId = quote.projectStopService?.projectStop.project.id;
  if (projectId) revalidatePath(`/carrier/projects/${projectId}`);
  return { ok: true };
}
