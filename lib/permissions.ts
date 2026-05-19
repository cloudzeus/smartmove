/**
 * Granular permission registry. Used to gate admin server actions and to
 * render the UI matrix that lets a SUPERADMIN assign rights to EMPLOYEE
 * accounts.
 *
 * Convention: "<resource>:<action>" lowercase. Adding a new permission =
 * (1) append to the list below, (2) call `requirePermission()` from the
 * server action(s) it protects.
 */

export type Permission =
  | "tenants:read"
  | "tenants:write"
  | "tenants:delete"
  | "branches:write"
  | "vehicles:read"
  | "vehicles:write"
  | "plans:read"
  | "plans:write"
  | "subscriptions:read"
  | "subscriptions:write"
  | "subscriptions:cancel"
  | "users:read"
  | "users:write"
  | "users:impersonate"
  | "employees:read"
  | "employees:write"
  | "settings:read"
  | "settings:write"
  | "payments:read"
  | "payments:refund"
  | "scanfees:waive"
  | "retention:override"
  | "reviews:moderate"
  | "audit:read";

export interface PermissionDescriptor {
  key: Permission;
  group: string;
  label: string;
  description: string;
  /** Only SUPERADMIN can grant this permission. */
  superadminOnly?: boolean;
}

export const PERMISSIONS: PermissionDescriptor[] = [
  // Tenants
  { key: "tenants:read",   group: "Πελάτες (tenants)", label: "Προβολή πελατών",         description: "Λίστα και προφίλ μεταφορικών εταιρειών." },
  { key: "tenants:write",  group: "Πελάτες (tenants)", label: "Δημιουργία / επεξεργασία", description: "Δημιουργία νέων πελατών και αλλαγή στοιχείων." },
  { key: "tenants:delete", group: "Πελάτες (tenants)", label: "Διαγραφή",                description: "Soft-delete πελάτη από την πλατφόρμα.", superadminOnly: true },
  { key: "branches:write", group: "Πελάτες (tenants)", label: "Υποκαταστήματα",          description: "Δημιουργία / διαγραφή υποκαταστημάτων." },

  // Vehicles
  { key: "vehicles:read",  group: "Στόλος", label: "Προβολή",     description: "Λίστα οχημάτων πελατών." },
  { key: "vehicles:write", group: "Στόλος", label: "Διαχείριση",  description: "Προσθήκη, επεξεργασία, διαγραφή οχημάτων." },

  // Plans & subscriptions
  { key: "plans:read",            group: "Συνδρομές", label: "Προβολή πακέτων",      description: "Δες όλα τα πακέτα συνδρομής." },
  { key: "plans:write",           group: "Συνδρομές", label: "Διαχείριση πακέτων",   description: "Δημιουργία και επεξεργασία πακέτων.", superadminOnly: true },
  { key: "subscriptions:read",    group: "Συνδρομές", label: "Προβολή συνδρομών",    description: "Λίστα ενεργών συνδρομών πελατών." },
  { key: "subscriptions:write",   group: "Συνδρομές", label: "Ανάθεση / αλλαγή",     description: "Ανάθεση πακέτου σε πελάτη και overrides." },
  { key: "subscriptions:cancel",  group: "Συνδρομές", label: "Ακύρωση",              description: "Ακύρωση τρέχουσας συνδρομής πελάτη." },

  // Users (customers etc.)
  { key: "users:read",        group: "Χρήστες", label: "Προβολή", description: "Λίστα πελατών χρηστών." },
  { key: "users:write",       group: "Χρήστες", label: "Επεξεργασία", description: "Αλλαγή ρόλου, απενεργοποίηση χρήστη." },
  { key: "users:impersonate", group: "Χρήστες", label: "Impersonate", description: "Σύνδεση ως άλλος χρήστης για υποστήριξη.", superadminOnly: true },

  // Employees
  { key: "employees:read",  group: "Υπάλληλοι", label: "Προβολή υπαλλήλων",        description: "Λίστα υπαλλήλων της πλατφόρμας." },
  { key: "employees:write", group: "Υπάλληλοι", label: "Διαχείριση υπαλλήλων",     description: "Δημιουργία / επεξεργασία / απενεργοποίηση υπαλλήλων.", superadminOnly: true },

  // System
  { key: "settings:read",  group: "Σύστημα", label: "Προβολή ρυθμίσεων",    description: "Δες τις system settings." },
  { key: "settings:write", group: "Σύστημα", label: "Αλλαγή ρυθμίσεων",    description: "Άλλαξε retention, fees, Gemini caps.", superadminOnly: true },
  { key: "audit:read",     group: "Σύστημα", label: "Audit log",            description: "Δες όλες τις διαχειριστικές ενέργειες." },

  // Payments
  { key: "payments:read",   group: "Πληρωμές", label: "Προβολή πληρωμών", description: "Όλες οι συναλλαγές." },
  { key: "payments:refund", group: "Πληρωμές", label: "Επιστροφή χρημάτων", description: "Πραγματοποίηση refund.", superadminOnly: true },
  { key: "scanfees:waive",  group: "Πληρωμές", label: "Διαγραφή scan fee", description: "Απαλλαγή πελάτη από χρέωση €1 (waive)." },

  // Other
  { key: "retention:override", group: "Λοιπά", label: "Παράταση retention",  description: "Παράτεινε δωρεάν τη retention χρήστη.", superadminOnly: true },
  { key: "reviews:moderate",   group: "Λοιπά", label: "Έλεγχος κριτικών",    description: "Διαγραφή / απόκρυψη κριτικών." },
];

export const PERMISSION_GROUPS = Array.from(
  new Set(PERMISSIONS.map((p) => p.group)),
);

/**
 * Effective permission check. SUPERADMIN bypasses (has implicit *).
 * EMPLOYEE needs the permission in their `permissions` array.
 * Other roles (CUSTOMER, TENANT*) never have admin permissions.
 */
export function hasPermission(
  user: { role: string; permissions?: string[] } | null | undefined,
  permission: Permission,
): boolean {
  if (!user) return false;
  if (user.role === "SUPERADMIN") return true;
  if (user.role !== "EMPLOYEE") return false;
  return (user.permissions ?? []).includes(permission);
}

/** Throws if the user lacks the permission. Use at the top of server actions. */
export function requirePermission(
  user: { role: string; permissions?: string[] } | null | undefined,
  permission: Permission,
): void {
  if (!hasPermission(user, permission)) {
    throw new Error(`Δεν έχεις δικαίωμα: ${permission}`);
  }
}

/**
 * Curated permission presets the admin can pick when creating a new employee
 * so they don't have to tick 25 boxes by hand for common roles.
 */
export const PERMISSION_PRESETS: Array<{
  key: string;
  label: string;
  description: string;
  permissions: Permission[];
}> = [
  {
    key: "support",
    label: "Support Agent",
    description: "Διαβάζει όλα, δεν αλλάζει κρίσιμα στοιχεία.",
    permissions: [
      "tenants:read",
      "vehicles:read",
      "plans:read",
      "subscriptions:read",
      "users:read",
      "payments:read",
      "settings:read",
    ],
  },
  {
    key: "tenant-manager",
    label: "Tenant Manager",
    description: "Διαχείριση πελατών, οχημάτων και συνδρομών.",
    permissions: [
      "tenants:read",
      "tenants:write",
      "branches:write",
      "vehicles:read",
      "vehicles:write",
      "plans:read",
      "subscriptions:read",
      "subscriptions:write",
      "users:read",
    ],
  },
  {
    key: "billing",
    label: "Billing Admin",
    description: "Πληρωμές, refunds, retention overrides, scan fee waivers.",
    permissions: [
      "tenants:read",
      "users:read",
      "subscriptions:read",
      "payments:read",
      "payments:refund",
      "scanfees:waive",
      "audit:read",
    ],
  },
];
