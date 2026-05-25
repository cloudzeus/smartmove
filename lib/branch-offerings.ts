/**
 * Types + sync helpers για branch service offerings.
 * Δεν είναι "use server" — εξάγει types & sync utilities που χρειάζονται
 * server actions ΚΑΙ client components.
 */

export const BRANCH_OFFERING_TYPES = [
  "CRANE",
  "PACKING",
  "LOADING",
  "UNLOADING",
  "ASSEMBLY",
  "STORAGE",
  "CLEANUP",
  "VEHICLE_RENTAL",
  "DRIVER",
  "OTHER",
] as const;

export type BranchOfferingType = (typeof BRANCH_OFFERING_TYPES)[number];

export function parseOfferedServices(json: string | null): BranchOfferingType[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    if (!Array.isArray(v)) return [];
    return v.filter((x): x is BranchOfferingType =>
      BRANCH_OFFERING_TYPES.includes(x as BranchOfferingType),
    );
  } catch {
    return [];
  }
}
