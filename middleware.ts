import NextAuth from "next-auth";

import authConfig from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  matcher: [
    // Skip Next internals, public assets, the public marketing surface,
    // the places autocomplete (public) and auth API endpoints.
    "/((?!_next/static|_next/image|favicon.ico|api/auth|api/places|.*\\.(?:png|jpg|jpeg|svg|webp|gif|ico|css|js|map)).*)",
  ],
};
