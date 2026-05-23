"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { sendMail } from "@/lib/mailgun";
import {
  buildAndStoreContract,
  buildContractBuffers,
  type ContractData,
} from "@/lib/contract";
import { buildProjectAndTasksForMove } from "@/lib/build-project-tasks";
import { emitNotification } from "@/lib/events";

export type AcceptResult =
  | { ok: true; offerId: string; contractPdfUrl: string; contractDocxUrl: string }
  | { ok: false; error: string };

const schema = z.object({
  offerId: z.string().min(1),
  /** ISO datetime when the customer wants the move to start. Picked from the
   *  carrier's proposedSlots or freely entered if no slots were proposed. */
  slotAt: z.string().min(1),
});

const TYPE_LABEL: Record<string, string> = {
  HOUSE: "Κατοικίας",
  FURNITURE: "Επίπλων",
  BUSINESS: "Επαγγελματική",
  HEAVY: "Βαρέα αντικείμενα",
};

export async function acceptOffer(input: unknown): Promise<AcceptResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Δεν είσαι συνδεδεμένος." };
  }
  const customerId = session.user.id;

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Λάθος δεδομένα",
    };
  }
  const { offerId, slotAt } = parsed.data;
  const slotDate = new Date(slotAt);
  if (Number.isNaN(slotDate.getTime())) {
    return { ok: false, error: "Άκυρη ημερομηνία." };
  }

  // Load with everything we need to build the contract
  const offer = await db.offer.findUnique({
    where: { id: offerId },
    include: {
      moveRequest: {
        select: {
          id: true,
          userId: true,
          status: true,
          fromAddress: true,
          toAddress: true,
          itemsCount: true,
          totalVolumeM3: true,
          type: true,
          itemsJson: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              billingProfile: {
                select: { vat: true, address: true, postalArea: true },
              },
            },
          },
        },
      },
      carrier: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          tenantMemberships: {
            select: {
              tenant: {
                select: {
                  legalName: true,
                  commercialName: true,
                  vat: true,
                  doyName: true,
                  address: true,
                  addressNo: true,
                  postalZip: true,
                  postalArea: true,
                  email: true,
                  phone: true,
                },
              },
            },
            orderBy: { createdAt: "asc" },
            take: 1,
          },
        },
      },
    },
  });
  if (!offer) return { ok: false, error: "Δεν βρέθηκε προσφορά." };
  if (offer.moveRequest.userId !== customerId) {
    return { ok: false, error: "Δεν είσαι ο ιδιοκτήτης του αιτήματος." };
  }
  if (offer.status !== "OPEN") {
    return { ok: false, error: "Η προσφορά δεν είναι πλέον ενεργή." };
  }
  if (offer.moveRequest.status !== "PUBLISHED") {
    return { ok: false, error: "Το αίτημα δεν δέχεται αποδοχές." };
  }
  if (offer.validUntil < new Date()) {
    return { ok: false, error: "Η προσφορά έχει λήξει." };
  }

  // If the carrier proposed slots, the chosen one must match exactly. Without
  // this guard a malicious client could bypass the UI and pick any time.
  const proposed = parseProposedSlots(offer.proposedSlotsJson);
  if (proposed.length > 0) {
    const picked = {
      date: toIsoDay(slotDate),
      hour: slotDate.getHours(),
    };
    const valid = proposed.some(
      (s) => s.date === picked.date && s.hour === picked.hour,
    );
    if (!valid) {
      return {
        ok: false,
        error: "Πρέπει να επιλέξεις ένα από τα προτεινόμενα slots.",
      };
    }
  }

  const tenant = offer.carrier.tenantMemberships[0]?.tenant ?? null;
  const ref = `SM-${new Date().getFullYear()}-${offer.id.slice(-6).toUpperCase()}`;

  const carrierAddress = tenant
    ? [
        [tenant.address, tenant.addressNo].filter(Boolean).join(" "),
        [tenant.postalZip, tenant.postalArea].filter(Boolean).join(" "),
      ]
        .filter(Boolean)
        .join(", ")
    : null;

  const contractData: ContractData = {
    ref,
    generatedAt: new Date(),
    customer: {
      name: offer.moveRequest.user.name ?? offer.moveRequest.user.email ?? "—",
      email: offer.moveRequest.user.email,
      phone: offer.moveRequest.user.phone,
      afm: offer.moveRequest.user.billingProfile?.vat ?? null,
      address: offer.moveRequest.user.billingProfile?.address ?? null,
    },
    carrier: {
      legalName: tenant?.legalName ?? offer.carrier.name ?? "—",
      commercialName: tenant?.commercialName ?? null,
      afm: tenant?.vat ?? "—",
      doy: tenant?.doyName ?? null,
      address: carrierAddress,
      email: tenant?.email ?? offer.carrier.email ?? null,
      phone: tenant?.phone ?? offer.carrier.phone ?? null,
    },
    request: {
      id: offer.moveRequest.id,
      fromAddress: offer.moveRequest.fromAddress,
      toAddress: offer.moveRequest.toAddress,
      itemsCount: offer.moveRequest.itemsCount,
      volumeM3: offer.moveRequest.totalVolumeM3,
      typeLabel: TYPE_LABEL[offer.moveRequest.type] ?? offer.moveRequest.type,
    },
    offer: {
      priceCents: offer.priceCents,
      estimatedDays: offer.estimatedDays,
      notes: offer.notes,
    },
    acceptedSlot: slotDate,
    items: parseItems(offer.moveRequest.itemsJson),
  };

  // 1. Generate both files + store under /public/contracts
  const { docxUrl, pdfUrl } = await buildAndStoreContract(contractData);

  // 2. Transactional DB transition — accept this offer, reject siblings, award request
  try {
    await db.$transaction([
      db.offer.update({
        where: { id: offer.id },
        data: {
          status: "ACCEPTED",
          acceptedAt: new Date(),
          acceptedSlotAt: slotDate,
          contractPdfUrl: pdfUrl,
          contractDocxUrl: docxUrl,
          contractRef: ref,
        },
      }),
      db.offer.updateMany({
        where: {
          moveRequestId: offer.moveRequestId,
          id: { not: offer.id },
          status: "OPEN",
        },
        data: { status: "REJECTED" },
      }),
      db.moveRequest.update({
        where: { id: offer.moveRequestId },
        data: { status: "AWARDED" },
      }),
    ]);
  } catch (e) {
    console.error("[acceptOffer] transition failed:", e);
    return { ok: false, error: "Η αποδοχή απέτυχε. Δοκίμασε ξανά." };
  }

  // 2b. Auto-build the project's task plan for the carrier's Gantt.
  // Resolve the carrier's tenant to scope tasks correctly.
  try {
    const carrierMembership = await db.tenantMembership.findFirst({
      where: { userId: offer.carrierUserId },
      select: { tenantId: true },
      orderBy: { createdAt: "asc" },
    });
    if (carrierMembership) {
      const result = await buildProjectAndTasksForMove({
        tenantId: carrierMembership.tenantId,
        moveRequestId: offer.moveRequestId,
        offerId: offer.id,
        createdByUserId: offer.carrierUserId,
        scheduledStart: slotDate,
        totalPriceCents: offer.priceCents,
      });
      try {
        await emitNotification({
          tenantId: carrierMembership.tenantId,
          type: "OFFER_ACCEPTED",
          severity: "SUCCESS",
          title: `🎉 Η προσφορά σου έγινε δεκτή! Project ${result.projectCode}`,
          body: `${offer.moveRequest.fromAddress} → ${offer.moveRequest.toAddress} · ${(offer.priceCents / 100).toLocaleString("el-GR")}€`,
          href: `/carrier/projects/${result.projectId}`,
          payload: {
            offerId: offer.id,
            projectId: result.projectId,
            projectCode: result.projectCode,
            priceCents: offer.priceCents,
          },
          revalidate: [`/carrier/projects/${result.projectId}`, "/carrier"],
        });
      } catch (e) {
        console.warn("[acceptOffer] emit failed:", e);
      }
    }
  } catch (e) {
    // Task generation failure shouldn't break the acceptance flow.
    console.error("[acceptOffer] task generation failed:", e);
  }

  // 3. Email both parties with the contract attached
  try {
    const buffers = await buildContractBuffers(contractData);
    const subject = `SmartMove · Σύμφωνημα μεταφοράς ${ref}`;
    const html = renderConfirmationEmail({
      ref,
      customerName: contractData.customer.name,
      carrierName: contractData.carrier.commercialName ?? contractData.carrier.legalName,
      route: `${contractData.request.fromAddress} → ${contractData.request.toAddress}`,
      slotAt: slotDate,
      priceCents: contractData.offer.priceCents,
      appUrl: env.appUrl(),
    });
    const text = `SmartMove — Σύμφωνημα μεταφοράς ${ref}.
Διαδρομή: ${contractData.request.fromAddress} → ${contractData.request.toAddress}
Ημερομηνία: ${slotDate.toLocaleString("el-GR")}
Τίμημα: ${(contractData.offer.priceCents / 100).toFixed(2)}€

Επισυνάπτεται το σύμφωνημα σε PDF και Word.`;

    const recipients = [
      contractData.customer.email,
      contractData.carrier.email,
    ].filter(Boolean) as string[];

    if (recipients.length > 0) {
      const mail = await sendMail({
        to: recipients,
        subject,
        html,
        text,
        attachments: [
          {
            filename: `contract-${ref}.pdf`,
            content: buffers.pdf,
            contentType: "application/pdf",
          },
          {
            filename: `contract-${ref}.docx`,
            content: buffers.docx,
            contentType:
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          },
        ],
        tags: ["contract", "offer-accepted"],
      });
      if (!mail.ok) {
        console.warn("[acceptOffer] mail failed:", mail.error);
      }
    }
  } catch (e) {
    // Email failure should NOT roll back the acceptance — log and continue.
    console.error("[acceptOffer] email failed:", e);
  }

  revalidatePath("/dashboard/offers");
  revalidatePath(`/dashboard/requests/${offer.moveRequestId}`);
  revalidatePath("/carrier/offers");
  revalidatePath(`/carrier/leads/${offer.moveRequestId}`);
  revalidatePath("/carrier/jobs");
  revalidatePath("/carrier/tasks");
  revalidatePath("/carrier/calendar");
  revalidatePath("/carrier/projects");

  return {
    ok: true,
    offerId: offer.id,
    contractPdfUrl: pdfUrl,
    contractDocxUrl: docxUrl,
  };
}

function renderConfirmationEmail(args: {
  ref: string;
  customerName: string;
  carrierName: string;
  route: string;
  slotAt: Date;
  priceCents: number;
  appUrl: string;
}): string {
  const dt = new Intl.DateTimeFormat("el-GR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(args.slotAt);
  const price = new Intl.NumberFormat("el-GR", {
    style: "currency",
    currency: "EUR",
  }).format(args.priceCents / 100);
  return `
<!DOCTYPE html>
<html lang="el">
<head><meta charset="utf-8" /></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f7f9fc;margin:0;padding:24px;color:#0f172a;">
  <div style="background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:28px;max-width:560px;margin:0 auto;box-shadow:0 1px 3px rgba(15,23,42,0.08);">
    <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.12em;color:#2563eb;margin-bottom:8px;">SmartMove · Σύμφωνημα μεταφοράς</div>
    <h1 style="font-size:22px;margin:0 0 12px;">Η μεταφορά κλείδωσε ✅</h1>
    <p style="font-size:14px;line-height:1.5;color:#0f172a;">
      <strong>${escapeHtml(args.customerName)}</strong> και <strong>${escapeHtml(args.carrierName)}</strong> συμφώνησαν στους όρους μεταφοράς.
    </p>
    <div style="margin:20px 0;padding:16px;background:#f8fafc;border-radius:12px;">
      <p style="margin:0 0 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;">Σύμφωνημα</p>
      <table style="width:100%;font-size:14px;border-collapse:collapse;">
        <tr><td style="color:#64748b;padding:4px 0;">Κωδικός</td><td style="text-align:right;font-weight:700;">${escapeHtml(args.ref)}</td></tr>
        <tr><td style="color:#64748b;padding:4px 0;">Διαδρομή</td><td style="text-align:right;font-weight:600;">${escapeHtml(args.route)}</td></tr>
        <tr><td style="color:#64748b;padding:4px 0;">Ημερομηνία</td><td style="text-align:right;font-weight:600;">${escapeHtml(dt)}</td></tr>
        <tr><td style="color:#64748b;padding:4px 0;">Τίμημα</td><td style="text-align:right;font-weight:700;color:#059669;">${escapeHtml(price)}</td></tr>
      </table>
    </div>
    <p style="font-size:13px;color:#475569;">Επισυνάπτεται το σύμφωνημα σε <strong>PDF</strong> και <strong>Word</strong>. Φυλάξτε το για τα αρχεία σας.</p>
    <a href="${args.appUrl}/dashboard" style="display:inline-block;margin-top:12px;padding:12px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:10px;font-weight:700;font-size:14px;">Άνοιγμα SmartMove</a>
    <p style="color:#94a3b8;font-size:11px;margin-top:24px;text-align:center;">SmartMove — Ψηφιακή πλατφόρμα μεταφορών</p>
  </div>
</body></html>`.trim();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ---------------- Local helpers ----------------

const LEGACY_PERIOD_HOUR: Record<string, number> = {
  MORNING: 9,
  AFTERNOON: 13,
  EVENING: 18,
};

function parseProposedSlots(
  json: unknown,
): Array<{ date: string; hour: number }> {
  if (!Array.isArray(json)) return [];
  const out: Array<{ date: string; hour: number }> = [];
  for (const raw of json) {
    if (!raw || typeof raw !== "object") continue;
    const s = raw as { date?: unknown; hour?: unknown; period?: unknown };
    if (typeof s.date !== "string") continue;
    let hour: number | null = null;
    if (typeof s.hour === "number" && Number.isFinite(s.hour)) {
      hour = Math.round(s.hour);
    } else if (typeof s.period === "string" && s.period in LEGACY_PERIOD_HOUR) {
      hour = LEGACY_PERIOD_HOUR[s.period];
    }
    if (hour == null || hour < 0 || hour > 23) continue;
    out.push({ date: s.date, hour });
  }
  return out;
}

function toIsoDay(d: Date): string {
  // Use local components so it matches the date string in proposed slots
  // (which were also recorded in the user's local TZ as YYYY-MM-DD).
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseItems(json: unknown): import("@/lib/contract").ContractItem[] {
  if (!Array.isArray(json)) return [];
  return json
    .filter(
      (it): it is {
        name?: string;
        quantity?: number;
        length_cm?: number;
        width_cm?: number;
        height_cm?: number;
        volume_m3?: number;
        photoUrl?: string;
      } => !!it && typeof it === "object",
    )
    .map((it) => ({
      name: String(it.name ?? "—"),
      quantity: Number(it.quantity ?? 1),
      length_cm: Number(it.length_cm ?? 0),
      width_cm: Number(it.width_cm ?? 0),
      height_cm: Number(it.height_cm ?? 0),
      volume_m3: Number(it.volume_m3 ?? 0),
      photoUrl: typeof it.photoUrl === "string" ? it.photoUrl : null,
    }));
}
