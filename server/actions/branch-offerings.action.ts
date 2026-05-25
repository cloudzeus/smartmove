"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { BRANCH_OFFERING_TYPES } from "@/lib/branch-offerings";

type ActionResult = { ok: true } | { ok: false; error: string };

const schema = z.object({
  branchId: z.string().min(1),
  offersToOthers: z.boolean(),
  services: z.array(z.enum(BRANCH_OFFERING_TYPES)).max(20).optional(),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export async function updateBranchOfferings(input: unknown): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Δεν είσαι συνδεδεμένος." };

  const role = session.user.role;
  if (role !== "TENANTADMIN" && role !== "SUPERADMIN") {
    return { ok: false, error: "Δικαίωμα μόνο σε admin εταιρείας." };
  }

  const membership = await db.tenantMembership.findFirst({
    where: { userId: session.user.id },
    select: { tenantId: true },
    orderBy: { createdAt: "asc" },
  });
  if (!membership) return { ok: false, error: "Δεν είσαι σε εταιρεία." };

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Λάθος δεδομένα" };
  }
  const d = parsed.data;

  const branch = await db.branch.findFirst({
    where: { id: d.branchId, tenantId: membership.tenantId, deletedAt: null },
    select: { id: true, tenantId: true },
  });
  if (!branch) return { ok: false, error: "Δεν βρέθηκε υποκατάστημα." };

  try {
    await db.branch.update({
      where: { id: branch.id },
      data: {
        offersToOthers: d.offersToOthers,
        offeredServices:
          d.offersToOthers && d.services && d.services.length > 0
            ? JSON.stringify(d.services)
            : null,
        offeringsNotes: d.offersToOthers ? (d.notes || null) : null,
      },
    });
    revalidatePath("/carrier/branches");
    revalidatePath(`/admin/tenants/${branch.tenantId}`);
    return { ok: true };
  } catch (e) {
    console.error("[updateBranchOfferings]", e);
    return { ok: false, error: "Αποθήκευση απέτυχε." };
  }
}
