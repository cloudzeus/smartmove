"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";

import { signIn } from "@/lib/auth";
import { db } from "@/lib/db";

const signUpSchema = z.object({
  name: z.string().min(2, "Συμπλήρωσε το όνομά σου"),
  email: z.string().email("Μη έγκυρο email"),
  phone: z
    .string()
    .optional()
    .transform((v) => (v?.trim() === "" ? undefined : v?.trim())),
  password: z
    .string()
    .min(8, "Τουλάχιστον 8 χαρακτήρες")
    .regex(/[A-ZΑ-Ω]/, "Πρέπει να έχει ένα κεφαλαίο γράμμα")
    .regex(/\d/, "Πρέπει να έχει έναν αριθμό"),
  consent: z.literal("on", { message: "Πρέπει να αποδεχτείς τους όρους" }),
  marketing: z.string().optional(),
});

export type SignUpResult =
  | { ok: true; redirectTo?: string }
  | { ok: false; error: string };

/**
 * Role-aware default landing path after login. Admin staff lands in the
 * management console; regular customers and tenant staff land on their own
 * dashboards.
 */
function defaultLandingForRole(role?: string | null): string {
  switch (role) {
    case "SUPERADMIN":
    case "EMPLOYEE":
      return "/admin";
    case "TENANTADMIN":
    case "TENANTEMPLOYEE":
      return "/carrier";
    default:
      return "/dashboard";
  }
}

export async function signUpAction(formData: FormData): Promise<SignUpResult> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = signUpSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Σφάλμα" };
  }

  const data = parsed.data;
  const email = data.email.toLowerCase().trim();

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return { ok: false, error: "Αυτό το email χρησιμοποιείται ήδη." };
  }

  const passwordHash = await bcrypt.hash(data.password, 12);

  try {
    await db.user.create({
      data: {
        email,
        name: data.name.trim(),
        phone: data.phone,
        passwordHash,
        marketingConsent: data.marketing === "on",
        dataConsent: true,
        consentAt: new Date(),
      },
    });
  } catch (e) {
    console.error("[signUp] create user failed:", e);
    return { ok: false, error: "Κάτι πήγε στραβά. Δοκίμασε ξανά." };
  }

  // Auto sign-in
  try {
    await signIn("credentials", {
      email,
      password: data.password,
      redirect: false,
    });
  } catch (e) {
    // Even if sign-in fails (e.g. CSRF/cookie weirdness), the account exists.
    // User can sign in manually.
    console.error("[signUp] auto sign-in failed:", e);
  }

  // New sign-ups are always CUSTOMER by default — explicit instead of relying
  // on defaultLandingForRole() to keep the intent clear.
  return { ok: true, redirectTo: "/dashboard" };
}

const signInSchema = z.object({
  email: z.string().email("Μη έγκυρο email"),
  password: z.string().min(1, "Συμπλήρωσε τον κωδικό"),
});

export async function signInAction(formData: FormData): Promise<SignUpResult> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = signInSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Σφάλμα" };
  }

  const email = parsed.data.email.toLowerCase().trim();

  try {
    await signIn("credentials", {
      email,
      password: parsed.data.password,
      redirect: false,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("CredentialsSignin") || msg.includes("CallbackRouteError")) {
      return { ok: false, error: "Λάθος email ή κωδικός." };
    }
    console.error("[signIn] error:", e);
    return { ok: false, error: "Κάτι πήγε στραβά. Δοκίμασε ξανά." };
  }

  // Look up the role so the sign-in page can route to the right dashboard.
  const user = await db.user.findUnique({
    where: { email },
    select: { role: true },
  });
  return { ok: true, redirectTo: defaultLandingForRole(user?.role) };
}
