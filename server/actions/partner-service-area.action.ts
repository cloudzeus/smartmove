"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { serializeServiceCities } from "@/lib/partner-service-area";

type ActionResult = { ok: true } | { ok: false; error: string };

const schema = z.object({
  partnerId: z.string().min(1),
  serviceMode: z.enum(["ANY", "CITIES", "RADIUS"]),
  // CITIES mode
  cities: z.array(z.string().trim().min(1).max(80)).max(50).optional(),
  // RADIUS mode
  hqAddress: z.string().trim().max(200).optional().or(z.literal("")),
  hqLat: z.coerce.number().min(-90).max(90).optional(),
  hqLng: z.coerce.number().min(-180).max(180).optional(),
  serviceRadiusKm: z.coerce.number().int().min(1).max(2000).optional(),
});

export async function updatePartnerServiceArea(
  input: unknown,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Δεν είσαι συνδεδεμένος." };

  const membership = await db.tenantMembership.findFirst({
    where: { userId: session.user.id },
    select: { tenantId: true, role: true },
    orderBy: { createdAt: "asc" },
  });
  if (!membership) return { ok: false, error: "Δεν είσαι σε εταιρεία." };

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Λάθος δεδομένα" };
  }
  const d = parsed.data;

  const partner = await db.carrierPartner.findFirst({
    where: { id: d.partnerId, tenantId: membership.tenantId, deletedAt: null },
    select: { id: true, companyId: true },
  });
  if (!partner) return { ok: false, error: "Δεν βρέθηκε ο συνεργάτης." };

  try {
    await db.carrierPartner.update({
      where: { id: partner.id },
      data: {
        serviceMode: d.serviceMode,
        serviceCities:
          d.serviceMode === "CITIES" && d.cities && d.cities.length > 0
            ? serializeServiceCities(d.cities)
            : null,
        hqAddress: d.serviceMode === "RADIUS" ? (d.hqAddress || null) : null,
        hqLat: d.serviceMode === "RADIUS" ? (d.hqLat ?? null) : null,
        hqLng: d.serviceMode === "RADIUS" ? (d.hqLng ?? null) : null,
        serviceRadiusKm:
          d.serviceMode === "RADIUS" ? (d.serviceRadiusKm ?? null) : null,
      },
    });
    revalidatePath("/carrier/partners");
    if (partner.companyId) {
      revalidatePath(`/carrier/partners/companies/${partner.companyId}`);
    }
    return { ok: true };
  } catch (e) {
    console.error("[updatePartnerServiceArea]", e);
    return { ok: false, error: "Αποθήκευση απέτυχε." };
  }
}
