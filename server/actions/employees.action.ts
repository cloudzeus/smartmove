"use server";

import { randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendMail } from "@/lib/mailgun";
import { renderAccountInviteEmail } from "@/lib/emails/account-invite";
import { hasPermission, PERMISSIONS, type Permission } from "@/lib/permissions";

export type EmployeeActionResult =
  | { ok: true; id: string; tempPassword?: string }
  | { ok: false; error: string };

const VALID_ROLES = new Set(["EMPLOYEE", "SUPERADMIN"]);
const ALL_PERMISSION_KEYS = new Set(PERMISSIONS.map((p) => p.key));

const createSchema = z.object({
  email: z.string().email("Μη έγκυρο email"),
  name: z.string().min(2, "Συμπλήρωσε ονοματεπώνυμο"),
  phone: z
    .string()
    .min(8, "Συμπλήρωσε τηλέφωνο")
    .max(20)
    .regex(/^\+?[\d\s\-()]{8,20}$/, "Μη έγκυρο τηλέφωνο"),
  role: z.enum(["EMPLOYEE", "SUPERADMIN"]).default("EMPLOYEE"),
  permissions: z.array(z.string()).default([]),
  sendInvite: z.coerce.boolean().default(false),
});

const updateSchema = z.object({
  id: z.string(),
  name: z.string().min(2),
  phone: z.string().min(8).max(20),
  role: z.enum(["EMPLOYEE", "SUPERADMIN"]).default("EMPLOYEE"),
});

const permissionsSchema = z.object({
  id: z.string(),
  permissions: z.array(z.string()).default([]),
});

function assertCanManageEmployees(
  actor: { role: string; permissions?: string[] } | null | undefined,
): void {
  if (!actor) throw new Error("Δεν είσαι συνδεδεμένος.");
  if (actor.role === "SUPERADMIN") return;
  if (hasPermission(actor, "employees:write")) return;
  throw new Error("Δεν έχεις δικαίωμα διαχείρισης υπαλλήλων.");
}

function generatePassword(): string {
  // 12 chars: mix of letters + digits, no ambiguous chars
  const alphabet =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(12);
  let out = "";
  for (let i = 0; i < 12; i++) out += alphabet[bytes[i] % alphabet.length];
  // Ensure regex compliance: at least one uppercase + one digit (signup schema)
  return `${out}A1`;
}

function sanitizePermissions(perms: string[], targetRole: string): Permission[] {
  // Drop unknown keys
  const known = perms.filter((p): p is Permission => ALL_PERMISSION_KEYS.has(p as Permission));
  // SUPERADMIN has implicit all — no need to store any
  if (targetRole === "SUPERADMIN") return [];
  // De-duplicate
  return Array.from(new Set(known));
}

export async function createEmployee(input: unknown): Promise<EmployeeActionResult> {
  const session = await auth();
  try {
    assertCanManageEmployees(session?.user);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path?.length ? issue.path.join(".") : "field";
    console.error("[createEmployee] zod failed:", parsed.error.issues);
    return { ok: false, error: `${path}: ${issue?.message ?? "Σφάλμα"}` };
  }
  const d = parsed.data;

  // Only SUPERADMIN can create another SUPERADMIN
  if (d.role === "SUPERADMIN" && session?.user?.role !== "SUPERADMIN") {
    return {
      ok: false,
      error: "Μόνο SUPERADMIN μπορεί να δημιουργήσει άλλον SUPERADMIN.",
    };
  }

  const email = d.email.toLowerCase().trim();
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return { ok: false, error: "Υπάρχει ήδη χρήστης με αυτό το email." };
  }

  const tempPassword = generatePassword();
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  try {
    const created = await db.user.create({
      data: {
        email,
        name: d.name.trim(),
        phone: d.phone.trim(),
        role: d.role,
        permissions: sanitizePermissions(d.permissions, d.role),
        passwordHash,
        emailVerified: new Date(), // admins are trusted
        dataConsent: true,
        consentAt: new Date(),
        invitedAt: new Date(),
        invitedById: session!.user!.id,
        active: true,
      },
      select: { id: true },
    });
    const invite = renderAccountInviteEmail({
      name: d.name.trim(),
      email,
      tempPassword,
      variant: "employee",
      invitedByName: session!.user!.name ?? undefined,
    });
    const mail = await sendMail({
      to: email,
      subject: invite.subject,
      html: invite.html,
      text: invite.text,
      tags: ["account-invite", "employee"],
    });
    if (!mail.ok) {
      console.warn("[createEmployee] invite email failed:", mail.error);
    }

    revalidatePath("/admin/employees");
    return { ok: true, id: created.id, tempPassword };
  } catch (e) {
    console.error("[createEmployee]", e);
    return { ok: false, error: "Δημιουργία υπαλλήλου απέτυχε." };
  }
}

export async function updateEmployeeDetails(
  input: unknown,
): Promise<EmployeeActionResult> {
  const session = await auth();
  try {
    assertCanManageEmployees(session?.user);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Σφάλμα" };
  }
  const d = parsed.data;

  // Only SUPERADMIN can promote/demote SUPERADMIN
  const target = await db.user.findUnique({
    where: { id: d.id },
    select: { role: true },
  });
  if (!target || !VALID_ROLES.has(target.role)) {
    return { ok: false, error: "Δεν βρέθηκε υπάλληλος." };
  }
  if (
    (d.role === "SUPERADMIN" || target.role === "SUPERADMIN") &&
    session?.user?.role !== "SUPERADMIN"
  ) {
    return {
      ok: false,
      error: "Μόνο SUPERADMIN μπορεί να αλλάξει SUPERADMIN role.",
    };
  }

  try {
    await db.user.update({
      where: { id: d.id },
      data: {
        name: d.name.trim(),
        phone: d.phone.trim(),
        role: d.role,
      },
    });
    revalidatePath("/admin/employees");
    revalidatePath(`/admin/employees/${d.id}`);
    return { ok: true, id: d.id };
  } catch (e) {
    console.error("[updateEmployeeDetails]", e);
    return { ok: false, error: "Αποθήκευση απέτυχε." };
  }
}

export async function updateEmployeePermissions(
  input: unknown,
): Promise<EmployeeActionResult> {
  const session = await auth();
  try {
    assertCanManageEmployees(session?.user);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const parsed = permissionsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Σφάλμα" };
  }
  const d = parsed.data;

  const target = await db.user.findUnique({
    where: { id: d.id },
    select: { role: true },
  });
  if (!target || !VALID_ROLES.has(target.role)) {
    return { ok: false, error: "Δεν βρέθηκε υπάλληλος." };
  }
  if (target.role === "SUPERADMIN") {
    return {
      ok: false,
      error: "Οι SUPERADMIN έχουν αυτόματα όλα τα δικαιώματα.",
    };
  }

  // Non-superadmin actors can't grant superadmin-only permissions
  const sanitized = sanitizePermissions(d.permissions, target.role);
  const actorIsSuper = session?.user?.role === "SUPERADMIN";
  const filtered = actorIsSuper
    ? sanitized
    : sanitized.filter((k) => {
        const desc = PERMISSIONS.find((p) => p.key === k);
        return !desc?.superadminOnly;
      });

  try {
    await db.user.update({
      where: { id: d.id },
      data: { permissions: filtered },
    });
    revalidatePath("/admin/employees");
    revalidatePath(`/admin/employees/${d.id}`);
    return { ok: true, id: d.id };
  } catch (e) {
    console.error("[updateEmployeePermissions]", e);
    return { ok: false, error: "Αποθήκευση δικαιωμάτων απέτυχε." };
  }
}

export async function toggleEmployeeActive(
  id: string,
  active: boolean,
): Promise<EmployeeActionResult> {
  const session = await auth();
  try {
    assertCanManageEmployees(session?.user);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  if (id === session?.user?.id) {
    return { ok: false, error: "Δεν μπορείς να απενεργοποιήσεις τον εαυτό σου." };
  }
  try {
    await db.user.update({
      where: { id },
      data: { active },
    });
    revalidatePath("/admin/employees");
    revalidatePath(`/admin/employees/${id}`);
    return { ok: true, id };
  } catch (e) {
    console.error("[toggleEmployeeActive]", e);
    return { ok: false, error: "Αλλαγή κατάστασης απέτυχε." };
  }
}

export async function resetEmployeePassword(
  id: string,
): Promise<EmployeeActionResult> {
  const session = await auth();
  try {
    assertCanManageEmployees(session?.user);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const target = await db.user.findUnique({
    where: { id },
    select: { role: true, email: true, name: true },
  });
  if (!target || !VALID_ROLES.has(target.role)) {
    return { ok: false, error: "Δεν βρέθηκε υπάλληλος." };
  }
  const tempPassword = generatePassword();
  const passwordHash = await bcrypt.hash(tempPassword, 12);
  try {
    await db.user.update({
      where: { id },
      data: { passwordHash },
    });

    const invite = renderAccountInviteEmail({
      name: target.name ?? target.email ?? "",
      email: target.email ?? "",
      tempPassword,
      variant: "employee",
      invitedByName: session!.user!.name ?? undefined,
    });
    const mail = await sendMail({
      to: target.email!,
      subject: "SmartMove — Νέος προσωρινός κωδικός",
      html: invite.html,
      text: invite.text,
      tags: ["password-reset", "employee"],
    });
    if (!mail.ok) {
      console.warn("[resetEmployeePassword] email failed:", mail.error);
    }

    return { ok: true, id, tempPassword };
  } catch (e) {
    console.error("[resetEmployeePassword]", e);
    return { ok: false, error: "Reset κωδικού απέτυχε." };
  }
}
