"use server";

import { auth } from "@/lib/auth";
import { lookupAfm, type AadeLookupResult } from "@/lib/aade";

/**
 * Server action wrapper for AADE AFM lookup. Restricted to admins/employees
 * so this endpoint can't be abused by unauthenticated clients.
 */
export async function lookupAfmAction(
  afm: string,
): Promise<AadeLookupResult> {
  const session = await auth();
  const role = session?.user?.role;
  if (role !== "SUPERADMIN" && role !== "EMPLOYEE" && role !== "TENANTADMIN") {
    return { ok: false, error: "Δεν έχεις πρόσβαση σε αυτή τη λειτουργία." };
  }
  return lookupAfm(afm);
}
