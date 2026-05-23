"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendMail } from "@/lib/mailgun";
import { renderAccountInviteEmail } from "@/lib/emails/account-invite";

export type CarrierOtpResult =
  | { ok: true; sentTo: string; tempPassword: string }
  | { ok: false; error: string };

export type InviteCarrierUserResult =
  | { ok: true; userId: string; sentTo: string; tempPassword: string }
  | { ok: false; error: string };

function generatePassword(): string {
  // 10-char alphanumeric, no ambiguous chars
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789abcdefghjkmnpqrstuvwxyz";
  let out = "";
  for (let i = 0; i < 10; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

/**
 * Generates a fresh one-time password for a user, persists the hash, and emails
 * the cleartext to them. Used by:
 *   - SUPERADMIN / EMPLOYEE on /admin/tenants → sends to tenant OWNER/ADMIN
 *   - TENANTADMIN on /carrier/team → sends to a user in their own tenant
 */
export async function sendOtpToUser(
  userId: string,
): Promise<CarrierOtpResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Δεν είσαι συνδεδεμένος." };
  }
  const requester = session.user;

  const target = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      active: true,
      deletedAt: true,
      tenantMemberships: { select: { tenantId: true, role: true } },
    },
  });
  if (!target || target.deletedAt) {
    return { ok: false, error: "Δεν βρέθηκε χρήστης." };
  }
  if (!target.email) {
    return { ok: false, error: "Ο χρήστης δεν έχει email." };
  }

  // Authorization
  const isStaff =
    requester.role === "SUPERADMIN" || requester.role === "EMPLOYEE";
  if (!isStaff) {
    if (requester.role !== "TENANTADMIN") {
      return { ok: false, error: "Δεν έχεις δικαίωμα." };
    }
    // Tenant admin can only act on members of the same tenant.
    const myMemberships = await db.tenantMembership.findMany({
      where: { userId: requester.id, role: { in: ["OWNER", "ADMIN"] } },
      select: { tenantId: true },
    });
    const myTenantIds = new Set(myMemberships.map((m) => m.tenantId));
    const sharesTenant = target.tenantMemberships.some((m) =>
      myTenantIds.has(m.tenantId),
    );
    if (!sharesTenant) {
      return { ok: false, error: "Ο χρήστης δεν ανήκει στην εταιρεία σου." };
    }
  }

  const tempPassword = generatePassword();
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  try {
    await db.user.update({
      where: { id: target.id },
      data: { passwordHash, active: true },
    });

    const invite = renderAccountInviteEmail({
      name: target.name ?? target.email,
      email: target.email,
      tempPassword,
      variant: "carrier",
      invitedByName: requester.name ?? undefined,
    });
    const mail = await sendMail({
      to: target.email,
      subject: invite.subject,
      html: invite.html,
      text: invite.text,
      tags: ["otp", "carrier"],
    });
    if (!mail.ok) {
      console.warn("[sendOtpToUser] email failed:", mail.error);
      return {
        ok: false,
        error: "Ο κωδικός δημιουργήθηκε αλλά το email απέτυχε.",
      };
    }

    return { ok: true, sentTo: target.email, tempPassword };
  } catch (e) {
    console.error("[sendOtpToUser]", e);
    return { ok: false, error: "Αποστολή OTP απέτυχε." };
  }
}

/**
 * Convenience for /admin/tenants — sends OTP to the tenant's primary admin.
 * Resolution order:
 *   1. Existing OWNER TenantMembership user
 *   2. Existing ADMIN TenantMembership user
 *   3. Fall back to tenant.email — creates a User (TENANTADMIN) +
 *      TenantMembership (OWNER) on-the-fly, then sends OTP.
 */
export async function sendTenantOwnerOtp(
  tenantId: string,
): Promise<CarrierOtpResult> {
  const session = await auth();
  if (
    session?.user?.role !== "SUPERADMIN" &&
    session?.user?.role !== "EMPLOYEE"
  ) {
    return { ok: false, error: "Δεν έχεις δικαίωμα." };
  }

  // Prefer OWNER, then ADMIN.
  const adminMembership =
    (await db.tenantMembership.findFirst({
      where: { tenantId, role: "OWNER", user: { deletedAt: null } },
      include: { user: { select: { id: true } } },
    })) ??
    (await db.tenantMembership.findFirst({
      where: { tenantId, role: "ADMIN", user: { deletedAt: null } },
      include: { user: { select: { id: true } } },
    }));

  if (adminMembership?.user) {
    return sendOtpToUser(adminMembership.user.id);
  }

  // No membership user yet — auto-provision from tenant.email.
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, email: true, legalName: true, commercialName: true },
  });
  if (!tenant) {
    return { ok: false, error: "Δεν βρέθηκε ο πελάτης." };
  }
  if (!tenant.email) {
    return {
      ok: false,
      error:
        "Ο πελάτης δεν έχει email επικοινωνίας. Συμπλήρωσε email στη φόρμα του πελάτη πρώτα.",
    };
  }

  const email = tenant.email.toLowerCase().trim();
  let user = await db.user.findUnique({ where: { email } });
  const tempPassword = generatePassword();
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  try {
    if (!user) {
      user = await db.user.create({
        data: {
          email,
          name: tenant.commercialName ?? tenant.legalName,
          role: "TENANTADMIN",
          passwordHash,
          active: true,
          invitedById: session.user.id,
          invitedAt: new Date(),
        },
      });
    } else {
      user = await db.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          active: true,
          role:
            user.role === "TENANTADMIN" || user.role === "SUPERADMIN"
              ? user.role
              : "TENANTADMIN",
        },
      });
    }

    // Ensure membership as OWNER.
    await db.tenantMembership.upsert({
      where: { userId_tenantId: { userId: user.id, tenantId: tenant.id } },
      update: { role: "OWNER" },
      create: { userId: user.id, tenantId: tenant.id, role: "OWNER" },
    });

    const invite = renderAccountInviteEmail({
      name: user.name ?? user.email,
      email: user.email,
      tempPassword,
      variant: "carrier",
      invitedByName: session.user.name ?? undefined,
    });
    const mail = await sendMail({
      to: user.email,
      subject: invite.subject,
      html: invite.html,
      text: invite.text,
      tags: ["otp", "carrier", "auto-provision"],
    });
    if (!mail.ok) {
      console.warn("[sendTenantOwnerOtp] email failed:", mail.error);
      return {
        ok: false,
        error: "Ο χρήστης δημιουργήθηκε αλλά το email απέτυχε.",
      };
    }

    return { ok: true, sentTo: user.email, tempPassword };
  } catch (e) {
    console.error("[sendTenantOwnerOtp]", e);
    return { ok: false, error: "Αποστολή OTP απέτυχε." };
  }
}

const inviteSchema = z.object({
  email: z.string().email("Μη έγκυρο email"),
  name: z.string().trim().min(1, "Το όνομα είναι υποχρεωτικό"),
  role: z.enum(["ADMIN", "MEMBER"]).default("MEMBER"),
});

/**
 * Tenant admin invites a user to their tenant.
 * Creates the User (CUSTOMER → upgraded to TENANTEMPLOYEE/TENANTADMIN) and
 * the membership, then sends them an OTP email.
 * Respects the active subscription's maxEmployees cap.
 */
export async function inviteCarrierUser(
  input: unknown,
): Promise<InviteCarrierUserResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Δεν είσαι συνδεδεμένος." };
  const requester = session.user;

  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Λάθος δεδομένα" };
  }
  const data = parsed.data;

  // Only TENANTADMIN (or staff) can invite team members.
  const isStaff =
    requester.role === "SUPERADMIN" || requester.role === "EMPLOYEE";
  let tenantId: string | null = null;

  if (!isStaff) {
    if (requester.role !== "TENANTADMIN") {
      return { ok: false, error: "Δεν έχεις δικαίωμα." };
    }
    const adminMembership = await db.tenantMembership.findFirst({
      where: { userId: requester.id, role: { in: ["OWNER", "ADMIN"] } },
      select: { tenantId: true },
    });
    if (!adminMembership) {
      return { ok: false, error: "Δεν είσαι διαχειριστής εταιρείας." };
    }
    tenantId = adminMembership.tenantId;
  } else {
    // Staff impersonation isn't supported here — staff manage via /admin.
    return { ok: false, error: "Χρήσε /admin για staff invites." };
  }

  // Enforce maxEmployees from active subscription.
  const sub = await db.subscription.findFirst({
    where: { tenantId, status: { in: ["TRIAL", "ACTIVE"] } },
    orderBy: { startsAt: "desc" },
    select: { maxEmployees: true, plan: { select: { maxEmployees: true } } },
  });
  const cap = sub?.maxEmployees ?? sub?.plan.maxEmployees ?? null;
  if (cap !== null) {
    const current = await db.tenantMembership.count({ where: { tenantId } });
    if (current >= cap) {
      return {
        ok: false,
        error: `Έφτασες το όριο χρηστών του πακέτου σου (${cap}). Αναβάθμισε για να προσθέσεις επιπλέον.`,
      };
    }
  }

  const email = data.email.toLowerCase().trim();

  // If user with that email already exists, attach them if not already in this tenant.
  let user = await db.user.findUnique({ where: { email } });
  if (user) {
    const existing = await db.tenantMembership.findFirst({
      where: { tenantId, userId: user.id },
    });
    if (existing) {
      return { ok: false, error: "Ο χρήστης είναι ήδη μέλος της εταιρείας." };
    }
  }

  const tempPassword = generatePassword();
  const passwordHash = await bcrypt.hash(tempPassword, 12);
  const targetRole = data.role === "ADMIN" ? "TENANTADMIN" : "TENANTEMPLOYEE";

  try {
    if (!user) {
      user = await db.user.create({
        data: {
          email,
          name: data.name,
          role: targetRole,
          passwordHash,
          active: true,
          invitedById: requester.id,
          invitedAt: new Date(),
        },
      });
    } else {
      user = await db.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          active: true,
          // Don't downgrade existing TENANTADMIN to TENANTEMPLOYEE.
          role:
            user.role === "TENANTADMIN" || user.role === "SUPERADMIN"
              ? user.role
              : targetRole,
        },
      });
    }

    await db.tenantMembership.create({
      data: {
        tenantId,
        userId: user.id,
        role: data.role,
      },
    });

    const invite = renderAccountInviteEmail({
      name: user.name ?? user.email,
      email: user.email,
      tempPassword,
      variant: "carrier",
      invitedByName: requester.name ?? undefined,
    });
    const mail = await sendMail({
      to: user.email,
      subject: invite.subject,
      html: invite.html,
      text: invite.text,
      tags: ["invite", "carrier"],
    });
    if (!mail.ok) {
      console.warn("[inviteCarrierUser] email failed:", mail.error);
    }

    return {
      ok: true,
      userId: user.id,
      sentTo: user.email,
      tempPassword,
    };
  } catch (e) {
    console.error("[inviteCarrierUser]", e);
    return { ok: false, error: "Πρόσκληση χρήστη απέτυχε." };
  }
}

export type SetPasswordResult =
  | { ok: true; sentTo: string | null }
  | { ok: false; error: string };

const setPasswordSchema = z.object({
  userId: z.string().min(1),
  newPassword: z
    .string()
    .min(8, "Ο κωδικός πρέπει να είναι τουλάχιστον 8 χαρακτήρες")
    .max(128, "Πολύ μεγάλος κωδικός"),
  notifyByEmail: z.boolean().default(true),
});

/**
 * SUPERADMIN / EMPLOYEE sets a custom password for a carrier (TENANTADMIN /
 * TENANTEMPLOYEE) user. Optionally emails the user that their password was
 * changed (without revealing it).
 *
 * Differs from `sendOtpToUser` (which generates + emails a random temp
 * password): this lets staff choose the exact password — useful for phone
 * support handoffs where the carrier dictates a password over the line.
 */
export async function setUserPasswordByAdmin(
  input: unknown,
): Promise<SetPasswordResult> {
  const session = await auth();
  if (
    session?.user?.role !== "SUPERADMIN" &&
    session?.user?.role !== "EMPLOYEE"
  ) {
    return { ok: false, error: "Δεν έχεις δικαίωμα." };
  }

  const parsed = setPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Λάθος δεδομένα",
    };
  }
  const { userId, newPassword, notifyByEmail } = parsed.data;

  const target = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      deletedAt: true,
    },
  });
  if (!target || target.deletedAt) {
    return { ok: false, error: "Δεν βρέθηκε χρήστης." };
  }
  // Guardrail: don't let admins flip a SUPERADMIN password via this path.
  if (target.role === "SUPERADMIN") {
    return {
      ok: false,
      error: "Δεν επιτρέπεται η αλλαγή κωδικού SUPERADMIN από εδώ.",
    };
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  try {
    await db.user.update({
      where: { id: target.id },
      data: { passwordHash, active: true },
    });

    let sentTo: string | null = null;
    if (notifyByEmail && target.email) {
      const invite = renderAccountInviteEmail({
        name: target.name ?? target.email,
        email: target.email,
        tempPassword: newPassword,
        variant: "carrier",
        invitedByName: session.user!.name ?? undefined,
      });
      const mail = await sendMail({
        to: target.email,
        subject: "SmartMove — Ο κωδικός σου ενημερώθηκε",
        html: invite.html,
        text: invite.text,
        tags: ["password-set", "admin"],
      });
      if (mail.ok) sentTo = target.email;
      else console.warn("[setUserPasswordByAdmin] email failed:", mail.error);
    }

    return { ok: true, sentTo };
  } catch (e) {
    console.error("[setUserPasswordByAdmin]", e);
    return { ok: false, error: "Αλλαγή κωδικού απέτυχε." };
  }
}

/**
 * Convenience for /admin/tenants/[id]: sets a chosen password for the tenant's
 * OWNER (or ADMIN if no OWNER exists).
 */
export async function setTenantOwnerPasswordByAdmin(
  tenantId: string,
  newPassword: string,
  notifyByEmail = true,
): Promise<SetPasswordResult> {
  const session = await auth();
  if (
    session?.user?.role !== "SUPERADMIN" &&
    session?.user?.role !== "EMPLOYEE"
  ) {
    return { ok: false, error: "Δεν έχεις δικαίωμα." };
  }

  const owner =
    (await db.tenantMembership.findFirst({
      where: { tenantId, role: "OWNER", user: { deletedAt: null } },
      select: { userId: true },
    })) ??
    (await db.tenantMembership.findFirst({
      where: { tenantId, role: "ADMIN", user: { deletedAt: null } },
      select: { userId: true },
    }));

  if (!owner) {
    return {
      ok: false,
      error:
        "Ο πελάτης δεν έχει ακόμα διαχειριστή. Στείλε πρώτα OTP για να δημιουργηθεί ο χρήστης.",
    };
  }

  return setUserPasswordByAdmin({
    userId: owner.userId,
    newPassword,
    notifyByEmail,
  });
}
