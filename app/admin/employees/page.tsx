import Link from "next/link";
import {
  ArrowUpRight,
  PauseCircle,
  Plus,
  ShieldCheck,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { db } from "@/lib/db";
import { AdminPageHero } from "@/components/admin/page-hero";
import { EmptyState } from "@/components/dashboard/empty-state";

export const metadata = { title: "Admin · Υπάλληλοι" };
export const dynamic = "force-dynamic";

export default async function EmployeesPage() {
  const employees = await db.user.findMany({
    where: {
      role: { in: ["EMPLOYEE", "SUPERADMIN"] },
      deletedAt: null,
    },
    orderBy: [{ active: "desc" }, { role: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      role: true,
      active: true,
      permissions: true,
      createdAt: true,
      image: true,
    },
  });

  const stats = {
    total: employees.length,
    active: employees.filter((e) => e.active).length,
    superadmins: employees.filter((e) => e.role === "SUPERADMIN").length,
  };

  return (
    <>
      <AdminPageHero
        eyebrow="Team"
        title="Υπάλληλοι"
        description="Διαχείριση εσωτερικών χρηστών της πλατφόρμας (Employees + SuperAdmins) και των δικαιωμάτων πρόσβασής τους ανά λειτουργικότητα."
        crumbs={[
          { href: "/admin", label: "Admin" },
          { label: "Υπάλληλοι" },
        ]}
        tone="amber"
        action={
          <Link
            href="/admin/employees/new"
            className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-gradient-to-r from-[var(--color-brand-blue)] to-[#3B82F6] px-5 text-sm font-bold text-white shadow-[0_6px_20px_rgba(37,99,235,0.25)] hover:from-[var(--color-brand-blue-deep)] hover:to-[var(--color-brand-blue)]"
          >
            <Plus className="size-4" />
            Νέος υπάλληλος
          </Link>
        }
        kpis={[
          { label: "Σύνολο", value: stats.total },
          { label: "Ενεργοί", value: stats.active, deltaTone: "positive" },
          { label: "SuperAdmins", value: stats.superadmins, deltaTone: "neutral" },
          { label: "Απενεργοποιημένοι", value: stats.total - stats.active },
        ]}
      />

      <div className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
        {/* Mini stats — keep below for visual rhythm but more compact since hero already shows KPIs */}
        <div className="mb-6 hidden gap-3 sm:hidden sm:grid-cols-3">
          <Stat label="Σύνολο" value={stats.total} icon={Users} accent="blue" />
          <Stat
            label="Ενεργοί"
            value={stats.active}
            icon={Users}
            accent="emerald"
          />
          <Stat
            label="SuperAdmins"
            value={stats.superadmins}
            icon={ShieldCheck}
            accent="red"
          />
        </div>

        {employees.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Κανένας υπάλληλος ακόμα"
            description="Πρόσθεσε το πρώτο μέλος της εσωτερικής ομάδας και όρισε τα δικαιώματα πρόσβασής του."
            cta={{ label: "Νέος υπάλληλος", href: "/admin/employees/new" }}
          />
        ) : (
          <ul className="grid gap-3">
            {employees.map((e) => {
              const initials = (e.name ?? e.email)
                .split(/[\s@]/)
                .map((p) => p[0])
                .filter(Boolean)
                .slice(0, 2)
                .join("")
                .toUpperCase();
              return (
                <li key={e.id}>
                  <Link
                    href={`/admin/employees/${e.id}`}
                    className={cn(
                      "grid items-center gap-3 rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:border-[var(--color-brand-blue)]/30 hover:shadow-[var(--shadow-pop)]",
                      "sm:grid-cols-[auto_1.5fr_1fr_auto_auto]",
                      !e.active && "opacity-75",
                    )}
                  >
                    <div className="grid size-11 place-items-center overflow-hidden rounded-xl bg-[var(--color-brand-blue-light)] font-bold text-[var(--color-brand-blue-deep)]">
                      {e.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={e.image}
                          alt={e.name ?? e.email}
                          className="size-full object-cover"
                        />
                      ) : (
                        initials || "?"
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-display text-sm font-bold text-foreground">
                        {e.name ?? "—"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {e.email} · {e.phone ?? "—"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <RoleBadge role={e.role} />
                      {e.role === "EMPLOYEE" && (
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                          {e.permissions.length} permissions
                        </span>
                      )}
                    </div>
                    {!e.active ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                        <PauseCircle className="size-3" />
                        Off
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                        Ενεργός
                      </span>
                    )}
                    <ArrowUpRight className="size-4 text-muted-foreground" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number;
  icon: typeof Users;
  accent: "blue" | "emerald" | "red";
}) {
  const accentMap = {
    blue: "bg-[var(--color-brand-blue-light)] text-[var(--color-brand-blue-deep)]",
    emerald: "bg-emerald-50 text-emerald-700",
    red: "bg-[var(--color-brand-red-light)] text-[var(--color-brand-red-deep)]",
  };
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
      <span
        className={cn(
          "grid size-10 place-items-center rounded-xl",
          accentMap[accent],
        )}
      >
        <Icon className="size-5" />
      </span>
      <div>
        <p className="font-display text-2xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  if (role === "SUPERADMIN") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-brand-red)]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--color-brand-red-deep)]">
        <ShieldCheck className="size-3" />
        SuperAdmin
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-brand-blue-light)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--color-brand-blue-deep)]">
      Employee
    </span>
  );
}
