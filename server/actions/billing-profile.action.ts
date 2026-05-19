"use server";

import { revalidatePath } from "next/cache";
import { BillingDocumentType, CustomerType } from "@prisma/client";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const profileSchema = z.object({
  type: z.enum(["PERSON", "COMPANY"]),

  fullName: z.string().min(2, "Συμπλήρωσε ονοματεπώνυμο"),
  email: z
    .string()
    .email("Μη έγκυρο email")
    .optional()
    .or(z.literal("")),
  phone: z.string().optional(),

  // Company-only — required iff type === COMPANY
  vat: z.string().optional(),
  legalName: z.string().optional(),
  commercialName: z.string().optional(),
  doyCode: z.string().optional(),
  doyName: z.string().optional(),
  legalStatus: z.string().optional(),
  legalStatusKind: z.string().optional(),
  vatSystemFlag: z.string().optional(),

  address: z.string().optional(),
  addressNo: z.string().optional(),
  postalZip: z.string().optional(),
  postalArea: z.string().optional(),

  preferredDocument: z.enum(["RECEIPT", "INVOICE"]).optional(),
});

export type BillingProfileResult =
  | { ok: true }
  | { ok: false; error: string };

export async function upsertBillingProfile(
  input: unknown,
): Promise<BillingProfileResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Πρέπει να συνδεθείς." };
  }
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Σφάλμα" };
  }
  const d = parsed.data;

  if (d.type === "COMPANY") {
    if (!d.vat || !/^\d{9}$/.test(d.vat)) {
      return { ok: false, error: "Για επιχείρηση χρειάζεται έγκυρος ΑΦΜ (9 ψηφία)." };
    }
    if (!d.legalName) {
      return { ok: false, error: "Συμπλήρωσε επωνυμία επιχείρησης." };
    }
  }

  const preferredDocument: BillingDocumentType =
    (d.preferredDocument as BillingDocumentType | undefined) ??
    (d.type === "COMPANY" ? "INVOICE" : "RECEIPT");

  try {
    await db.billingProfile.upsert({
      where: { userId: session.user.id },
      update: {
        type: d.type as CustomerType,
        fullName: d.fullName.trim(),
        email: d.email?.trim() || null,
        phone: d.phone?.trim() || null,
        vat: d.type === "COMPANY" ? d.vat?.trim() || null : null,
        legalName: d.type === "COMPANY" ? d.legalName?.trim() || null : null,
        commercialName: d.commercialName?.trim() || null,
        doyCode: d.doyCode?.trim() || null,
        doyName: d.doyName?.trim() || null,
        legalStatus: d.legalStatus?.trim() || null,
        legalStatusKind: d.legalStatusKind?.trim() || null,
        vatSystemFlag: d.vatSystemFlag?.trim() || null,
        address: d.address?.trim() || null,
        addressNo: d.addressNo?.trim() || null,
        postalZip: d.postalZip?.trim() || null,
        postalArea: d.postalArea?.trim() || null,
        preferredDocument,
      },
      create: {
        userId: session.user.id,
        type: d.type as CustomerType,
        fullName: d.fullName.trim(),
        email: d.email?.trim() || null,
        phone: d.phone?.trim() || null,
        vat: d.type === "COMPANY" ? d.vat?.trim() || null : null,
        legalName: d.type === "COMPANY" ? d.legalName?.trim() || null : null,
        commercialName: d.commercialName?.trim() || null,
        doyCode: d.doyCode?.trim() || null,
        doyName: d.doyName?.trim() || null,
        legalStatus: d.legalStatus?.trim() || null,
        legalStatusKind: d.legalStatusKind?.trim() || null,
        vatSystemFlag: d.vatSystemFlag?.trim() || null,
        address: d.address?.trim() || null,
        addressNo: d.addressNo?.trim() || null,
        postalZip: d.postalZip?.trim() || null,
        postalArea: d.postalArea?.trim() || null,
        preferredDocument,
      },
    });
    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard/payments");
    return { ok: true };
  } catch (e) {
    console.error("[upsertBillingProfile]", e);
    return { ok: false, error: "Αποθήκευση απέτυχε." };
  }
}
