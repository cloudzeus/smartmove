# 03 — Authentication (Auth.js v5)

## Στόχος

3 user types, 4 διαφορετικοί τρόποι sign-in, role-based access control παντού.

## src/lib/auth.config.ts (edge-compatible)

```typescript
import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

// Αυτό το config χρησιμοποιείται στο middleware (edge runtime).
// Καμία Node-only εξάρτηση εδώ (όχι Prisma, όχι bcrypt).
export default {
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/sign-in",
    error:  "/sign-in",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const path = nextUrl.pathname;

      // Public routes
      if (path === "/" || path.startsWith("/api/auth") || path.startsWith("/sign-")) {
        return true;
      }

      // Authenticated routes
      if (!isLoggedIn) return false;

      // Role-based
      const role = auth?.user?.role;
      if (path.startsWith("/admin") && role !== "ADMIN") return false;
      if (path.startsWith("/carrier") && !["CARRIER_OWNER","CARRIER_DRIVER","ADMIN"].includes(role!)) return false;

      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as any;
      return session;
    },
  },
} satisfies NextAuthConfig;
```

## src/lib/auth.ts (full config — Node runtime)

```typescript
import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import Resend from "next-auth/providers/resend";
import bcrypt from "bcryptjs";
import { z } from "zod";

import authConfig from "./auth.config";
import { db } from "./db";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(db),
  providers: [
    ...authConfig.providers,
    Resend({
      apiKey: process.env.AUTH_RESEND_KEY,
      from:   process.env.AUTH_EMAIL_FROM,
    }),
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(creds) {
        const parsed = credentialsSchema.safeParse(creds);
        if (!parsed.success) return null;

        const user = await db.user.findUnique({
          where: { email: parsed.data.email, deletedAt: null },
        });
        if (!user?.passwordHash) return null;

        const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!ok) return null;

        // Audit
        await db.auditLog.create({
          data: { actorId: user.id, actorType: "user", action: "sign_in", resource: "user", resourceId: user.id },
        });

        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
  events: {
    async signIn({ user }) {
      await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    },
  },
});
```

## src/middleware.ts

```typescript
import NextAuth from "next-auth";
import authConfig from "@/lib/auth.config";

export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: [
    // Skip Next internals & static
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|gif)).*)",
  ],
};
```

## src/types/next-auth.d.ts

```typescript
import "next-auth";
import { UserRole } from "@prisma/client";

declare module "next-auth" {
  interface User {
    id: string;
    role: UserRole;
  }
  interface Session {
    user: User & {
      id: string;
      role: UserRole;
      email: string;
      name?: string | null;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
  }
}
```

## src/app/api/auth/[...nextauth]/route.ts

```typescript
export { GET, POST } from "@/lib/auth";
export { handlers as default } from "@/lib/auth";
```

## Πατέντες χρήσης

### Server Component

```typescript
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/sign-in");

  return <h1>Καλώς ήρθες, {session.user.name}</h1>;
}
```

### Server Action

```typescript
"use server";
import { auth } from "@/lib/auth";

export async function createMoveRequest(input: unknown) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  // ... business logic
}
```

### Client Component

```typescript
"use client";
import { useSession, signIn, signOut } from "next-auth/react";

export function UserMenu() {
  const { data: session, status } = useSession();
  if (status === "loading") return null;
  return session ? <Button onClick={() => signOut()}>Logout</Button> : <Button onClick={() => signIn()}>Login</Button>;
}
```

### Role gate

```typescript
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export async function requireRole(...allowed: UserRole[]) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  if (!allowed.includes(session.user.role)) redirect("/");
  return session;
}

// usage
const session = await requireRole("CARRIER_OWNER", "ADMIN");
```

## Sign-up flow (ιδιώτης)

1. User υποβάλλει email + password σε `/sign-up`
2. Server Action `signUp({ email, password, role: 'CONSUMER' })`:
   - Validates με zod
   - Bcrypt hash (12 rounds)
   - Creates User με `emailVerified: null`
   - Sends magic-link verification email via Resend
3. User κλικάρει link → `/api/auth/verify-email?token=…`
4. Token validates → sets `emailVerified` → auto sign-in
5. Redirect → `/dashboard`

## Sign-up flow (μεταφορική)

1. Carrier owner υποβάλλει επιπλέον fields: legalName, vatNumber, taxOffice
2. Δημιουργείται User με `role: "CARRIER_OWNER"` + Carrier record με `kycStatus: "PENDING"`
3. Carrier μπορεί να μπει στο dashboard αλλά **δεν** μπορεί να υποβάλει bids μέχρι το KYC να γίνει `APPROVED`
4. Admin κάνει review στο `/admin/carriers/[id]` και approves/rejects

## Security checklist

- [x] CSRF: Auth.js built-in
- [x] Password rules: min 8 chars, ένα capital, ένα number (validated zod)
- [x] Bcrypt 12 rounds
- [x] Session expires: 30 days (rolling)
- [x] Rate limit on sign-in: 5 attempts / 15 min ανά IP (Redis)
- [x] Email verification mandatory για consumers
- [x] KYC mandatory για carriers
- [x] Audit log σε κάθε sign-in / sign-out / role change
- [x] No PII στο JWT (μόνο id + role)
- [ ] MFA (TOTP) — Y2 milestone
- [ ] WebAuthn / passkeys — Y2 milestone
