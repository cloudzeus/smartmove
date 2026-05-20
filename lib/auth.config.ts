import type { NextAuthConfig } from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";

import { env, flags } from "./env";

/**
 * Edge-compatible config used by middleware.
 * No Node-only deps here (no Prisma, no bcrypt).
 *
 * Microsoft Entra ID is conditionally added so we don't crash if the env vars
 * are missing — the sign-in page will just hide the Microsoft button instead.
 */
const microsoftProvider = flags.hasMicrosoftAuth()
  ? [
      MicrosoftEntraID({
        clientId: env.msEntraId(),
        clientSecret: env.msEntraSecret(),
        issuer: env.msEntraIssuer(),
      }),
    ]
  : [];

export default {
  providers: microsoftProvider,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/sign-in",
    error: "/sign-in",
  },
  trustHost: true,
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const path = nextUrl.pathname;
      const isLoggedIn = !!auth?.user;
      const role = auth?.user?.role;

      // Public marketing & API routes
      const publicPaths = [
        "/",
        "/sign-in",
        "/sign-up",
        "/scan",
        "/api/auth",
        "/api/places",
      ];
      if (publicPaths.some((p) => path === p || path.startsWith(`${p}/`))) {
        return true;
      }

      // Static / Next internals — always allow
      if (
        path.startsWith("/_next") ||
        path.startsWith("/favicon") ||
        /\.(svg|png|jpe?g|webp|gif|ico|css|js|map)$/.test(path)
      ) {
        return true;
      }

      // Admin areas → SUPERADMIN + EMPLOYEE only
      if (path.startsWith("/admin")) {
        return isLoggedIn && (role === "SUPERADMIN" || role === "EMPLOYEE");
      }

      // Tenant (carrier company) backoffice → TENANTADMIN / TENANTEMPLOYEE + staff
      if (path.startsWith("/tenant") || path.startsWith("/carrier")) {
        return (
          isLoggedIn &&
          (role === "TENANTADMIN" ||
            role === "TENANTEMPLOYEE" ||
            role === "EMPLOYEE" ||
            role === "SUPERADMIN")
        );
      }

      // Any authenticated area (customer dashboard).
      // Note: /scan is public — auth is requested in-app only when needed
      // (AI scan + final submit) so the user does not lose form state.
      if (path.startsWith("/dashboard")) {
        return isLoggedIn;
      }

      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = (user as { role?: string }).role ?? "CUSTOMER";
        token.locale = (user as { locale?: string }).locale ?? "el";
        token.permissions =
          (user as { permissions?: string[] }).permissions ?? [];
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = (token.role as string) ?? "CUSTOMER";
        session.user.locale = (token.locale as string) ?? "el";
        session.user.permissions =
          (token.permissions as string[] | undefined) ?? [];
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
