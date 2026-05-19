"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

async function carrierTenantId(): Promise<{ ok: true; tenantId: string; userId: string } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Δεν είσαι συνδεδεμένος." };
  const role = session.user.role;
  if (
    role !== "TENANTADMIN" &&
    role !== "TENANTEMPLOYEE" &&
    role !== "SUPERADMIN" &&
    role !== "EMPLOYEE"
  ) {
    return { ok: false, error: "Δεν έχεις δικαίωμα μεταφορέα." };
  }
  const m = await db.tenantMembership.findFirst({
    where: { userId: session.user.id },
    select: { tenantId: true },
    orderBy: { createdAt: "asc" },
  });
  if (!m) return { ok: false, error: "Δεν είσαι μέλος καμίας εταιρείας." };
  return { ok: true, tenantId: m.tenantId, userId: session.user.id };
}

export interface CatalogEntryWithPrice {
  key: string;
  nameEl: string;
  nameEn: string;
  category: string | null;
  defaultVolumeM3: number | null;
  sortOrder: number;
  /** Carrier's price overrides — null when not set yet. */
  price: {
    basePriceCents: number;
    craneSurchargeCents: number;
    packingSurchargeCents: number;
  } | null;
}

export async function listCatalogWithMyPrices(): Promise<CatalogEntryWithPrice[]> {
  const ctx = await carrierTenantId();
  if (!ctx.ok) throw new Error(ctx.error);

  const [items, prices] = await Promise.all([
    db.itemCatalog.findMany({
      where: { isActive: true },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
    }),
    db.carrierItemPrice.findMany({
      where: { tenantId: ctx.tenantId },
    }),
  ]);

  const priceByKey = new Map(prices.map((p) => [p.itemKey, p]));

  return items.map((it) => {
    const p = priceByKey.get(it.key);
    return {
      key: it.key,
      nameEl: it.nameEl,
      nameEn: it.nameEn,
      category: it.category,
      defaultVolumeM3: it.defaultVolumeM3,
      sortOrder: it.sortOrder,
      price: p
        ? {
            basePriceCents: p.basePriceCents,
            craneSurchargeCents: p.craneSurchargeCents,
            packingSurchargeCents: p.packingSurchargeCents,
          }
        : null,
    };
  });
}

const upsertSchema = z.object({
  itemKey: z.string().min(1),
  basePriceEur: z.coerce.number().min(0).max(100000),
  craneSurchargeEur: z.coerce.number().min(0).max(100000),
  packingSurchargeEur: z.coerce.number().min(0).max(100000),
});

export type UpsertPriceResult =
  | { ok: true; itemKey: string }
  | { ok: false; error: string };

export async function upsertCarrierPrice(
  input: unknown,
): Promise<UpsertPriceResult> {
  const ctx = await carrierTenantId();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const parsed = upsertSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Λάθος δεδομένα",
    };
  }
  const d = parsed.data;
  const base = Math.round(d.basePriceEur * 100);
  const crane = Math.round(d.craneSurchargeEur * 100);
  const packing = Math.round(d.packingSurchargeEur * 100);

  // Verify the item key exists.
  const item = await db.itemCatalog.findUnique({ where: { key: d.itemKey } });
  if (!item) return { ok: false, error: "Άγνωστο item." };

  try {
    // If everything is zero, delete (= "no preset price"). Else upsert.
    if (base === 0 && crane === 0 && packing === 0) {
      await db.carrierItemPrice.deleteMany({
        where: { tenantId: ctx.tenantId, itemKey: d.itemKey },
      });
    } else {
      await db.carrierItemPrice.upsert({
        where: {
          tenantId_itemKey: {
            tenantId: ctx.tenantId,
            itemKey: d.itemKey,
          },
        },
        update: {
          basePriceCents: base,
          craneSurchargeCents: crane,
          packingSurchargeCents: packing,
        },
        create: {
          tenantId: ctx.tenantId,
          itemKey: d.itemKey,
          basePriceCents: base,
          craneSurchargeCents: crane,
          packingSurchargeCents: packing,
        },
      });
    }
    revalidatePath("/carrier/pricing");
    return { ok: true, itemKey: d.itemKey };
  } catch (e) {
    console.error("[upsertCarrierPrice]", e);
    return { ok: false, error: "Αποθήκευση απέτυχε." };
  }
}

/**
 * Bulk update: apply a flat percentage uplift to every base price. Useful
 * for periodic price adjustments. Returns the number of rows updated.
 */
export async function applyPercentageUplift(
  percent: number,
): Promise<{ ok: boolean; updated?: number; error?: string }> {
  const ctx = await carrierTenantId();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  if (!Number.isFinite(percent) || percent <= -50 || percent >= 200) {
    return { ok: false, error: "Παράλογο ποσοστό." };
  }
  const factor = 1 + percent / 100;
  try {
    const result = await db.$executeRaw`
      UPDATE "CarrierItemPrice"
      SET "basePriceCents" = ROUND("basePriceCents" * ${factor}),
          "craneSurchargeCents" = ROUND("craneSurchargeCents" * ${factor}),
          "packingSurchargeCents" = ROUND("packingSurchargeCents" * ${factor}),
          "updatedAt" = NOW()
      WHERE "tenantId" = ${ctx.tenantId}
    `;
    revalidatePath("/carrier/pricing");
    return { ok: true, updated: result };
  } catch (e) {
    console.error("[applyPercentageUplift]", e);
    return { ok: false, error: "Αναπροσαρμογή απέτυχε." };
  }
}
