import { redirect } from "next/navigation";

import { auth } from "./auth";
import { db } from "./db";

/**
 * Returns the active terms version, or null if no terms have been published yet.
 * Cached at request level — call freely.
 */
export async function getActiveTerms() {
  return db.termsVersion.findFirst({
    where: { isActive: true },
    orderBy: { publishedAt: "desc" },
  });
}

/**
 * Returns true when the user must accept (or re-accept) the latest active
 * terms. Returns false when:
 *   - no active terms exist (system not configured yet)
 *   - the user has already accepted the active version
 */
export async function userNeedsToAcceptTerms(
  userId: string,
): Promise<{ needed: false } | { needed: true; activeVersion: string }> {
  const active = await getActiveTerms();
  if (!active) return { needed: false };

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { termsAcceptedVersion: true },
  });
  if (user?.termsAcceptedVersion === active.version) {
    return { needed: false };
  }
  return { needed: true, activeVersion: active.version };
}

/**
 * Server-side gate to call from authenticated layouts. Redirects to
 * /terms/accept if the user must accept new terms. Never redirects when the
 * user is already on the accept page (avoids loops).
 */
export async function requireAcceptedTerms(currentPath?: string): Promise<void> {
  // Don't gate the accept page itself or the sign-in flow.
  if (
    currentPath?.startsWith("/terms/accept") ||
    currentPath?.startsWith("/sign-in") ||
    currentPath?.startsWith("/sign-up") ||
    currentPath?.startsWith("/api/")
  ) {
    return;
  }

  const session = await auth();
  if (!session?.user?.id) return; // unauthenticated handled elsewhere

  // Staff (SUPERADMIN/EMPLOYEE) can manage terms; don't lock them out.
  if (
    session.user.role === "SUPERADMIN" ||
    session.user.role === "EMPLOYEE"
  ) {
    return;
  }

  const check = await userNeedsToAcceptTerms(session.user.id);
  if (check.needed) {
    redirect("/terms/accept");
  }
}
