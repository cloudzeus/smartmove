"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const phoneSchema = z
  .string()
  .min(8, "Το τηλέφωνο πρέπει να έχει τουλάχιστον 8 ψηφία")
  .max(20, "Πολύ μεγάλο τηλέφωνο")
  .regex(
    /^\+?[\d\s\-()]{8,20}$/,
    "Μη έγκυρος αριθμός τηλεφώνου (αποδεκτά ψηφία, +, -, κενά)",
  );

const updateDetailsSchema = z.object({
  name: z.string().min(2, "Το ονοματεπώνυμο πρέπει να έχει τουλάχιστον 2 χαρακτήρες"),
  phone: phoneSchema,
  locale: z.enum(["el", "en"]).default("el"),
  timezone: z.string().min(3).max(64).default("Europe/Athens"),
  marketingConsent: z.coerce.boolean().default(false),
  image: z.string().url().optional().nullable(),
});

export type UserActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

/**
 * Lightweight action used by the missing-phone banner on the dashboard
 * overview. Only validates + persists the phone (no other profile fields).
 */
export async function setUserPhone(phone: string): Promise<UserActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Δεν είσαι συνδεδεμένος." };
  }
  const parsed = phoneSchema.safeParse(phone);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Σφάλμα" };
  }
  try {
    await db.user.update({
      where: { id: session.user.id },
      data: { phone: parsed.data.replace(/\s+/g, " ").trim() },
    });
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/settings");
    return { ok: true, message: "Το τηλέφωνο αποθηκεύτηκε." };
  } catch (e) {
    console.error("[setUserPhone]", e);
    return { ok: false, error: "Αποθήκευση απέτυχε." };
  }
}

export async function updateUserDetails(
  input: unknown,
): Promise<UserActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Δεν είσαι συνδεδεμένος." };
  }
  const parsed = updateDetailsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Σφάλμα" };
  }
  const d = parsed.data;
  try {
    await db.user.update({
      where: { id: session.user.id },
      data: {
        name: d.name.trim(),
        phone: d.phone.replace(/\s+/g, " ").trim(),
        locale: d.locale,
        timezone: d.timezone,
        marketingConsent: d.marketingConsent,
        image: d.image ?? null,
      },
    });
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/settings");
    return { ok: true, message: "Τα στοιχεία ενημερώθηκαν." };
  } catch (e) {
    console.error("[updateUserDetails]", e);
    return { ok: false, error: "Αποθήκευση απέτυχε." };
  }
}

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Δώσε τον τρέχοντα κωδικό"),
    newPassword: z
      .string()
      .min(8, "Τουλάχιστον 8 χαρακτήρες")
      .regex(/[A-ZΑ-Ω]/, "Πρέπει να έχει ένα κεφαλαίο γράμμα")
      .regex(/\d/, "Πρέπει να έχει έναν αριθμό"),
    confirmPassword: z.string().min(1, "Επιβεβαίωσε τον νέο κωδικό"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Ο νέος κωδικός και η επιβεβαίωση δεν ταιριάζουν",
    path: ["confirmPassword"],
  });

export async function changePassword(
  input: unknown,
): Promise<UserActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Δεν είσαι συνδεδεμένος." };
  }
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Σφάλμα" };
  }
  const d = parsed.data;
  try {
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { passwordHash: true },
    });
    if (!user?.passwordHash) {
      return {
        ok: false,
        error:
          "Δεν έχεις ορίσει κωδικό. Ο λογαριασμός χρησιμοποιεί OAuth (Microsoft / Google).",
      };
    }
    const ok = await bcrypt.compare(d.currentPassword, user.passwordHash);
    if (!ok) {
      return { ok: false, error: "Λάθος τρέχων κωδικός." };
    }
    const newHash = await bcrypt.hash(d.newPassword, 12);
    await db.user.update({
      where: { id: session.user.id },
      data: { passwordHash: newHash },
    });
    return { ok: true, message: "Ο κωδικός άλλαξε." };
  } catch (e) {
    console.error("[changePassword]", e);
    return { ok: false, error: "Αλλαγή κωδικού απέτυχε." };
  }
}

/** Convenience: does the current user have all mandatory fields? */
export async function getProfileCompleteness(userId: string) {
  const u = await db.user.findUnique({
    where: { id: userId },
    select: { name: true, phone: true, email: true, image: true },
  });
  if (!u) return { complete: false, missing: ["all"] as string[] };
  const missing: string[] = [];
  if (!u.name) missing.push("name");
  if (!u.phone) missing.push("phone");
  if (!u.email) missing.push("email");
  return { complete: missing.length === 0, missing };
}
