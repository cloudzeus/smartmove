"use server";

import { randomBytes } from "node:crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { sendMail } from "@/lib/mailgun";
import { renderPartnerQuoteRequestEmail } from "@/lib/emails/partner-quote-request";
import { emitNotification } from "@/lib/events";

const SERVICES = [
  "PACKING",
  "CRANE",
  "STORAGE",
  "HANDYMAN",
  "ELECTRICIAN",
  "CARPENTER",
  "OTHER",
] as const;

export type ActionResult<T = unknown> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

async function getCarrierContext() {
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

const createSchema = z.object({
  moveRequestId: z.string().min(1),
  partnerId: z.string().optional().or(z.literal("")),
  partnerCompanyId: z.string().optional().or(z.literal("")),
  partnerContactId: z.string().optional().or(z.literal("")),
  recipientEmail: z.string().email("Μη έγκυρο email"),
  recipientName: z.string().trim().min(1, "Όνομα παραλήπτη"),
  service: z.enum(SERVICES),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  validHours: z.coerce.number().int().min(1).max(720).default(72),
  scheduledStartAt: z.string().datetime().optional().or(z.literal("")),
  estimatedMinutes: z.coerce.number().int().min(15).max(60 * 24 * 14).optional(),
});

export async function requestPartnerQuote(
  input: unknown,
): Promise<ActionResult<{ id: string; sentTo: string }>> {
  let ctx;
  try {
    ctx = await getCarrierContext();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Λάθος δεδομένα",
    };
  }
  const d = parsed.data;

  const move = await db.moveRequest.findUnique({
    where: { id: d.moveRequestId },
    select: {
      id: true,
      fromAddress: true,
      toAddress: true,
      preferredDate: true,
      itemsCount: true,
      totalVolumeM3: true,
      type: true,
    },
  });
  if (!move) return { ok: false, error: "Δεν βρέθηκε αίτημα." };

  // Tenant ownership check on partner / company refs
  if (d.partnerId) {
    const p = await db.carrierPartner.findFirst({
      where: { id: d.partnerId, tenantId: ctx.tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!p) return { ok: false, error: "Άκυρος συνεργάτης." };
  }
  if (d.partnerCompanyId) {
    const c = await db.partnerCompany.findFirst({
      where: { id: d.partnerCompanyId, tenantId: ctx.tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!c) return { ok: false, error: "Άκυρη εταιρεία συνεργάτη." };
  }
  if (d.partnerContactId) {
    const c = await db.partnerContact.findFirst({
      where: {
        id: d.partnerContactId,
        deletedAt: null,
        company: { tenantId: ctx.tenantId, deletedAt: null },
      },
      select: { id: true },
    });
    if (!c) return { ok: false, error: "Άκυρη επαφή συνεργάτη." };
  }

  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + d.validHours * 3600 * 1000);

  const tenant = await db.tenant.findUnique({
    where: { id: ctx.tenantId },
    select: { commercialName: true, legalName: true },
  });
  const carrierName =
    tenant?.commercialName ?? tenant?.legalName ?? ctx.userName ?? "SmartMove";

  try {
    const scheduledStart = d.scheduledStartAt
      ? new Date(d.scheduledStartAt)
      : null;

    const row = await db.partnerQuoteRequest.create({
      data: {
        tenantId: ctx.tenantId,
        requestedByUserId: ctx.userId,
        moveRequestId: move.id,
        partnerId: d.partnerId || null,
        partnerCompanyId: d.partnerCompanyId || null,
        partnerContactId: d.partnerContactId || null,
        recipientEmail: d.recipientEmail.toLowerCase(),
        recipientName: d.recipientName,
        service: d.service,
        notes: d.notes || null,
        token,
        expiresAt,
        scheduledStartAt: scheduledStart,
        estimatedMinutes: d.estimatedMinutes ?? null,
        moveSnapshotJson: {
          fromAddress: move.fromAddress,
          toAddress: move.toAddress,
          preferredDate: move.preferredDate?.toISOString() ?? null,
          itemsCount: move.itemsCount,
          totalVolumeM3: move.totalVolumeM3,
          type: move.type,
          scheduledStartAt: scheduledStart?.toISOString() ?? null,
          estimatedMinutes: d.estimatedMinutes ?? null,
        },
      },
    });

    const quoteUrl = `${env.appUrl()}/quote/${token}`;
    // Prefer the carrier-supplied scheduledStart over the customer's original
    // preferredDate (which may be flexible). The scheduledStart is the
    // confirmed time after the customer accepted the offer.
    const displaySlot = scheduledStart ?? move.preferredDate;
    const email = renderPartnerQuoteRequestEmail({
      partnerName: d.recipientName,
      carrierName,
      service: d.service,
      notes: d.notes ?? null,
      moveSummary: {
        fromAddress: move.fromAddress,
        toAddress: move.toAddress,
        preferredDate: displaySlot
          ? new Intl.DateTimeFormat("el-GR", {
              weekday: "long",
              day: "2-digit",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            }).format(displaySlot)
          : null,
        itemsCount: move.itemsCount,
        volumeM3: move.totalVolumeM3,
        estimatedMinutes: d.estimatedMinutes ?? null,
      },
      quoteUrl,
      expiresAt,
    });
    const mail = await sendMail({
      to: d.recipientEmail,
      subject: email.subject,
      html: email.html,
      text: email.text,
      tags: ["partner-quote-request"],
    });
    if (!mail.ok) {
      console.warn("[requestPartnerQuote] email failed:", mail.error);
      return {
        ok: false,
        error: "Το αίτημα αποθηκεύτηκε αλλά το email απέτυχε.",
      };
    }

    revalidatePath(`/carrier/leads/${move.id}`);
    return { ok: true, data: { id: row.id, sentTo: d.recipientEmail } };
  } catch (e) {
    console.error("[requestPartnerQuote]", e);
    return { ok: false, error: "Αποστολή αιτήματος απέτυχε." };
  }
}

export async function cancelPartnerQuoteRequest(
  id: string,
): Promise<ActionResult> {
  let ctx;
  try {
    ctx = await getCarrierContext();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  try {
    const row = await db.partnerQuoteRequest.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: { id: true, moveRequestId: true },
    });
    if (!row) return { ok: false, error: "Δεν βρέθηκε αίτημα." };
    await db.partnerQuoteRequest.update({
      where: { id },
      data: { status: "CANCELLED" },
    });
    if (row.moveRequestId) {
      revalidatePath(`/carrier/leads/${row.moveRequestId}`);
    }
    return { ok: true };
  } catch (e) {
    console.error("[cancelPartnerQuoteRequest]", e);
    return { ok: false, error: "Ακύρωση απέτυχε." };
  }
}

// ---------------- Public quote submission (no auth, magic-link only) ----------------

const submitSchema = z.object({
  token: z.string().min(10),
  priceEur: z.coerce.number().positive("Τιμή > 0"),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  /** Required when the recipient is a PartnerCompany — the contact person
   *  who will be responsible for this project. */
  contactName: z.string().trim().max(120).optional().or(z.literal("")),
  contactEmail: z.string().trim().max(200).optional().or(z.literal("")),
  contactPhone: z.string().trim().max(60).optional().or(z.literal("")),
});

export async function submitPartnerQuote(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = submitSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Λάθος δεδομένα",
    };
  }
  const { token, priceEur, notes, contactName, contactEmail, contactPhone } = parsed.data;

  const row = await db.partnerQuoteRequest.findUnique({
    where: { token },
    select: {
      id: true,
      status: true,
      expiresAt: true,
      moveRequestId: true,
      partnerCompanyId: true,
      tenantId: true,
      recipientName: true,
      projectStopService: {
        select: {
          serviceType: true,
          projectStop: {
            select: { project: { select: { id: true, code: true } } },
          },
        },
      },
    },
  });
  if (!row) return { ok: false, error: "Άκυρος σύνδεσμος." };
  if (row.status === "CANCELLED")
    return { ok: false, error: "Το αίτημα ακυρώθηκε." };
  if (row.status === "EXPIRED")
    return { ok: false, error: "Το αίτημα έληξε." };
  if (row.expiresAt && row.expiresAt < new Date()) {
    await db.partnerQuoteRequest.update({
      where: { id: row.id },
      data: { status: "EXPIRED" },
    });
    return { ok: false, error: "Το αίτημα έληξε." };
  }

  // When responding on behalf of a PartnerCompany, the contact fields are
  // mandatory so the carrier knows who to talk to about this specific project.
  if (row.partnerCompanyId) {
    if (!contactName || !contactEmail || !contactPhone) {
      return {
        ok: false,
        error: "Συμπλήρωσε όνομα, email και τηλέφωνο υπευθύνου για το project.",
      };
    }
  }

  try {
    await db.partnerQuoteRequest.update({
      where: { id: row.id },
      data: {
        status: "QUOTED",
        quotedPriceCents: Math.round(priceEur * 100),
        quotedNotes: notes || null,
        quotedAt: new Date(),
        respondingContactName:  contactName  || null,
        respondingContactEmail: contactEmail || null,
        respondingContactPhone: contactPhone || null,
      },
    });
    if (row.moveRequestId) {
      revalidatePath(`/carrier/leads/${row.moveRequestId}`);
    }
    try {
      const project = row.projectStopService?.projectStop.project ?? null;
      const href = project
        ? `/carrier/projects/${project.id}`
        : `/carrier/leads/${row.moveRequestId}`;
      await emitNotification({
        tenantId: row.tenantId,
        type: "QUOTE_RECEIVED",
        severity: "INFO",
        title: `💬 Νέα προσφορά: ${row.recipientName ?? "Συνεργάτης"} · ${priceEur}€`,
        body: notes || null,
        href,
        payload: {
          quoteRequestId: row.id,
          projectId: project?.id ?? null,
          projectCode: project?.code ?? null,
          priceEur,
        },
        revalidate: project
          ? [`/carrier/projects/${project.id}`, "/carrier"]
          : ["/carrier"],
      });
    } catch (e) {
      console.warn("[submitPartnerQuote] emit failed:", e);
    }
    return { ok: true, data: { id: row.id } };
  } catch (e) {
    console.error("[submitPartnerQuote]", e);
    return { ok: false, error: "Υποβολή απέτυχε." };
  }
}

export async function declinePartnerQuote(
  token: string,
): Promise<ActionResult> {
  const row = await db.partnerQuoteRequest.findUnique({
    where: { token },
    select: { id: true, status: true, moveRequestId: true },
  });
  if (!row) return { ok: false, error: "Άκυρος σύνδεσμος." };
  if (row.status !== "PENDING")
    return { ok: false, error: "Δεν επιτρέπεται η ενέργεια." };
  try {
    await db.partnerQuoteRequest.update({
      where: { id: row.id },
      data: { status: "DECLINED" },
    });
    if (row.moveRequestId) {
      revalidatePath(`/carrier/leads/${row.moveRequestId}`);
    }
    return { ok: true };
  } catch (e) {
    console.error("[declinePartnerQuote]", e);
    return { ok: false, error: "Απόρριψη απέτυχε." };
  }
}
