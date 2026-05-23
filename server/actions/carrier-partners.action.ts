"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { lookupAfm } from "@/lib/aade";

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
  return { userId: session.user.id, tenantId: membership.tenantId };
}

const partnerKinds = [
  "TRANSPORTER",
  "CRANE",
  "STORAGE",
  "PACKER",
  "ELECTRICIAN",
  "CARPENTER",
  "HANDYMAN",
  "OTHER",
] as const;

// ---------- Partner (individual) ----------

const partnerSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Το όνομα είναι υποχρεωτικό"),
  kind: z.enum(partnerKinds).default("TRANSPORTER"),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  email: z
    .string()
    .trim()
    .email("Μη έγκυρο email")
    .optional()
    .or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  companyId: z.string().optional().or(z.literal("")),
});

export async function upsertPartner(input: unknown): Promise<ActionResult<{ id: string }>> {
  let ctx;
  try {
    ctx = await getCarrierContext();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const parsed = partnerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Λάθος δεδομένα" };
  }
  const d = parsed.data;

  // Validate company belongs to tenant if provided.
  let companyId: string | null = null;
  if (d.companyId) {
    const c = await db.partnerCompany.findFirst({
      where: { id: d.companyId, tenantId: ctx.tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!c) return { ok: false, error: "Άκυρη εταιρεία συνεργάτη." };
    companyId = c.id;
  }

  const data = {
    name: d.name,
    kind: d.kind,
    phone: d.phone || null,
    email: d.email ? d.email.toLowerCase() : null,
    notes: d.notes || null,
    companyId,
  };

  try {
    let row;
    if (d.id) {
      const exists = await db.carrierPartner.findFirst({
        where: { id: d.id, tenantId: ctx.tenantId, deletedAt: null },
        select: { id: true },
      });
      if (!exists) return { ok: false, error: "Δεν βρέθηκε συνεργάτης." };
      row = await db.carrierPartner.update({ where: { id: d.id }, data });
    } else {
      row = await db.carrierPartner.create({
        data: { ...data, tenantId: ctx.tenantId },
      });
    }
    revalidatePath("/carrier/partners");
    return { ok: true, data: { id: row.id } };
  } catch (e) {
    console.error("[upsertPartner]", e);
    return { ok: false, error: "Αποθήκευση απέτυχε." };
  }
}

export async function deletePartner(id: string): Promise<ActionResult> {
  let ctx;
  try {
    ctx = await getCarrierContext();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  try {
    const row = await db.carrierPartner.findFirst({
      where: { id, tenantId: ctx.tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!row) return { ok: false, error: "Δεν βρέθηκε συνεργάτης." };
    await db.carrierPartner.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    revalidatePath("/carrier/partners");
    return { ok: true };
  } catch (e) {
    console.error("[deletePartner]", e);
    return { ok: false, error: "Διαγραφή απέτυχε." };
  }
}

// ---------- Partner Company ----------

const companyManualSchema = z.object({
  id: z.string().optional(),
  vat: z.string().trim().min(5, "ΑΦΜ ≥ 5"),
  legalName: z.string().trim().min(2, "Επωνυμία υποχρεωτική"),
  commercialName: z.string().trim().optional().or(z.literal("")),
  doyName: z.string().trim().optional().or(z.literal("")),
  legalStatus: z.string().trim().optional().or(z.literal("")),
  address: z.string().trim().optional().or(z.literal("")),
  addressNo: z.string().trim().optional().or(z.literal("")),
  postalZip: z.string().trim().optional().or(z.literal("")),
  postalArea: z.string().trim().optional().or(z.literal("")),
  email: z.string().trim().email("Μη έγκυρο email").optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  website: z.string().trim().optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export async function upsertPartnerCompany(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  let ctx;
  try {
    ctx = await getCarrierContext();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const parsed = companyManualSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Λάθος δεδομένα",
    };
  }
  const d = parsed.data;

  const data = {
    vat: d.vat,
    legalName: d.legalName,
    commercialName: d.commercialName || null,
    doyName: d.doyName || null,
    legalStatus: d.legalStatus || null,
    address: d.address || null,
    addressNo: d.addressNo || null,
    postalZip: d.postalZip || null,
    postalArea: d.postalArea || null,
    email: d.email ? d.email.toLowerCase() : null,
    phone: d.phone || null,
    website: d.website || null,
    notes: d.notes || null,
  };

  try {
    let row;
    if (d.id) {
      const exists = await db.partnerCompany.findFirst({
        where: { id: d.id, tenantId: ctx.tenantId, deletedAt: null },
        select: { id: true },
      });
      if (!exists) return { ok: false, error: "Δεν βρέθηκε εταιρεία." };
      row = await db.partnerCompany.update({ where: { id: d.id }, data });
    } else {
      // Prevent duplicate by (tenant, vat)
      const dup = await db.partnerCompany.findFirst({
        where: { tenantId: ctx.tenantId, vat: d.vat, deletedAt: null },
        select: { id: true },
      });
      if (dup) {
        return {
          ok: false,
          error: "Υπάρχει ήδη εταιρεία συνεργάτη με αυτό το ΑΦΜ.",
        };
      }
      row = await db.partnerCompany.create({
        data: { ...data, tenantId: ctx.tenantId },
      });
    }
    revalidatePath("/carrier/partners");
    revalidatePath(`/carrier/partners/companies/${row.id}`);
    return { ok: true, data: { id: row.id } };
  } catch (e) {
    console.error("[upsertPartnerCompany]", e);
    return { ok: false, error: "Αποθήκευση εταιρείας απέτυχε." };
  }
}

/**
 * Looks up an AFM via the AADE API and creates (or finds) a PartnerCompany
 * for the current carrier tenant. Returns the company id.
 */
export async function createPartnerCompanyFromAfm(
  afm: string,
): Promise<ActionResult<{ id: string; created: boolean }>> {
  let ctx;
  try {
    ctx = await getCarrierContext();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const cleaned = afm.replace(/\D+/g, "");
  if (cleaned.length < 5) return { ok: false, error: "Λάθος ΑΦΜ." };

  const existing = await db.partnerCompany.findFirst({
    where: { tenantId: ctx.tenantId, vat: cleaned, deletedAt: null },
    select: { id: true },
  });
  if (existing) return { ok: true, data: { id: existing.id, created: false } };

  const res = await lookupAfm(cleaned);
  if (!res.ok) return { ok: false, error: res.error };

  try {
    const row = await db.partnerCompany.create({
      data: {
        tenantId: ctx.tenantId,
        vat: res.data.afm,
        legalName: res.data.legalName ?? "—",
        commercialName: res.data.commercialName ?? null,
        doyName: res.data.doyDescription ?? null,
        legalStatus: res.data.legalStatus ?? null,
        legalStatusKind: res.data.legalStatusKind ?? null,
        address: res.data.address ?? null,
        addressNo: res.data.addressNo ?? null,
        postalZip: res.data.postalZip ?? null,
        postalArea: res.data.postalArea ?? null,
      },
    });
    revalidatePath("/carrier/partners");
    return { ok: true, data: { id: row.id, created: true } };
  } catch (e) {
    console.error("[createPartnerCompanyFromAfm]", e);
    return { ok: false, error: "Δημιουργία εταιρείας απέτυχε." };
  }
}

export async function deletePartnerCompany(id: string): Promise<ActionResult> {
  let ctx;
  try {
    ctx = await getCarrierContext();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  try {
    const row = await db.partnerCompany.findFirst({
      where: { id, tenantId: ctx.tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!row) return { ok: false, error: "Δεν βρέθηκε εταιρεία." };
    await db.partnerCompany.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    revalidatePath("/carrier/partners");
    return { ok: true };
  } catch (e) {
    console.error("[deletePartnerCompany]", e);
    return { ok: false, error: "Διαγραφή απέτυχε." };
  }
}

// ---------- Partner Contact ----------

const contactSchema = z.object({
  id: z.string().optional(),
  companyId: z.string().min(1),
  name: z.string().trim().min(2, "Το όνομα είναι υποχρεωτικό"),
  role: z.string().trim().max(80).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  email: z.string().trim().email("Μη έγκυρο email").optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export async function upsertPartnerContact(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  let ctx;
  try {
    ctx = await getCarrierContext();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Λάθος δεδομένα",
    };
  }
  const d = parsed.data;

  const company = await db.partnerCompany.findFirst({
    where: { id: d.companyId, tenantId: ctx.tenantId, deletedAt: null },
    select: { id: true },
  });
  if (!company) return { ok: false, error: "Άκυρη εταιρεία." };

  const data = {
    name: d.name,
    role: d.role || null,
    phone: d.phone || null,
    email: d.email ? d.email.toLowerCase() : null,
    notes: d.notes || null,
  };

  try {
    let row;
    if (d.id) {
      const exists = await db.partnerContact.findFirst({
        where: { id: d.id, companyId: company.id, deletedAt: null },
        select: { id: true },
      });
      if (!exists) return { ok: false, error: "Δεν βρέθηκε επαφή." };
      row = await db.partnerContact.update({ where: { id: d.id }, data });
    } else {
      row = await db.partnerContact.create({
        data: { ...data, companyId: company.id },
      });
    }
    revalidatePath(`/carrier/partners/companies/${company.id}`);
    return { ok: true, data: { id: row.id } };
  } catch (e) {
    console.error("[upsertPartnerContact]", e);
    return { ok: false, error: "Αποθήκευση επαφής απέτυχε." };
  }
}

export async function deletePartnerContact(id: string): Promise<ActionResult> {
  let ctx;
  try {
    ctx = await getCarrierContext();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  try {
    const row = await db.partnerContact.findFirst({
      where: {
        id,
        deletedAt: null,
        company: { tenantId: ctx.tenantId },
      },
      select: { id: true, companyId: true },
    });
    if (!row) return { ok: false, error: "Δεν βρέθηκε επαφή." };
    await db.partnerContact.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    revalidatePath(`/carrier/partners/companies/${row.companyId}`);
    return { ok: true };
  } catch (e) {
    console.error("[deletePartnerContact]", e);
    return { ok: false, error: "Διαγραφή απέτυχε." };
  }
}
