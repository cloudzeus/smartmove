"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Loader2,
  PauseCircle,
  PlayCircle,
  ShieldCheck,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  resetEmployeePassword,
  toggleEmployeeActive,
  updateEmployeeDetails,
  updateEmployeePermissions,
} from "@/server/actions/employees.action";
import { CredentialsModal } from "./credentials-modal";
import { PermissionsMatrix } from "./permissions-matrix";

interface Employee {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  role: string;
  active: boolean;
  permissions: string[];
  createdAt: Date;
  updatedAt: Date;
  invitedAt: Date | null;
}

interface Props {
  employee: Employee;
  actorRole: string;
  actorId: string;
  inviter: { name?: string | null; email?: string } | null;
}

interface RoleOption {
  value: "EMPLOYEE" | "SUPERADMIN";
  label: string;
  superadminOnly?: boolean;
}

const ROLES: RoleOption[] = [
  { value: "EMPLOYEE", label: "Υπάλληλος" },
  { value: "SUPERADMIN", label: "SuperAdmin", superadminOnly: true },
];

export function EmployeeDetailClient({
  employee,
  actorRole,
  actorId,
  inviter,
}: Props) {
  const router = useRouter();
  const actorIsSuperadmin = actorRole === "SUPERADMIN";
  const isSelf = actorId === employee.id;

  const [role, setRole] = useState<"EMPLOYEE" | "SUPERADMIN">(
    employee.role === "SUPERADMIN" ? "SUPERADMIN" : "EMPLOYEE",
  );
  const [permissions, setPermissions] = useState<string[]>(
    employee.permissions ?? [],
  );
  const [name, setName] = useState(employee.name ?? "");
  const [phone, setPhone] = useState(employee.phone ?? "");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [resetCreds, setResetCreds] = useState<{
    email: string;
    password: string;
  } | null>(null);
  const [pending, start] = useTransition();

  function notify(label: string) {
    setError(null);
    setSuccess(label);
    setTimeout(() => setSuccess(null), 2500);
  }

  function saveDetails() {
    setError(null);
    start(async () => {
      const res = await updateEmployeeDetails({
        id: employee.id,
        name,
        phone,
        role,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      notify("Τα στοιχεία ενημερώθηκαν");
      router.refresh();
    });
  }

  function savePermissions() {
    setError(null);
    start(async () => {
      const res = await updateEmployeePermissions({
        id: employee.id,
        permissions,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      notify("Τα δικαιώματα ενημερώθηκαν");
      router.refresh();
    });
  }

  function toggleActive() {
    setError(null);
    start(async () => {
      const res = await toggleEmployeeActive(employee.id, !employee.active);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      notify(employee.active ? "Απενεργοποιήθηκε" : "Ενεργοποιήθηκε");
      router.refresh();
    });
  }

  function resetPassword() {
    if (
      !confirm(
        `Σίγουρα θέλεις reset του κωδικού για ${employee.email}; Ο τρέχων κωδικός θα ακυρωθεί.`,
      )
    )
      return;
    setError(null);
    start(async () => {
      const res = await resetEmployeePassword(employee.id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (res.tempPassword) {
        setResetCreds({ email: employee.email, password: res.tempPassword });
      }
    });
  }

  const isSuperTarget = employee.role === "SUPERADMIN";

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-5">
          <section className="rounded-2xl border border-border bg-card p-5">
            <header className="mb-4 flex items-center justify-between gap-3">
              <h2 className="font-display text-base font-bold text-foreground">
                Στοιχεία
              </h2>
              <Button
                size="sm"
                onClick={saveDetails}
                disabled={pending}
                className="h-9 shadow-[var(--shadow-cta)]"
              >
                {pending ? <Loader2 className="size-4 animate-spin" /> : "Αποθήκευση"}
              </Button>
            </header>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Ονοματεπώνυμο">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  minLength={2}
                />
              </Field>
              <Field label="Email">
                <Input value={employee.email} disabled className="bg-secondary/40" />
              </Field>
              <Field label="Τηλέφωνο">
                <Input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  minLength={8}
                />
              </Field>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-foreground">Ρόλος</span>
                <div className="grid grid-cols-2 gap-2">
                  {ROLES.map((r) => {
                    const active = role === r.value;
                    const disabled =
                      (r.superadminOnly && !actorIsSuperadmin) ||
                      (isSelf && r.value !== employee.role);
                    return (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() =>
                          !disabled && setRole(r.value as "EMPLOYEE" | "SUPERADMIN")
                        }
                        disabled={disabled}
                        className={cn(
                          "rounded-lg border-2 px-2 py-2 text-xs font-bold transition-colors",
                          active
                            ? "border-[var(--color-brand-blue)] bg-[var(--color-brand-blue-light)] text-[var(--color-brand-blue-deep)]"
                            : "border-border bg-card text-muted-foreground hover:border-[var(--color-brand-blue)]/40",
                          disabled && "cursor-not-allowed opacity-50",
                        )}
                      >
                        {r.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-5">
            <header className="mb-4 flex items-center justify-between gap-3">
              <h2 className="font-display text-base font-bold text-foreground">
                Δικαιώματα πρόσβασης
              </h2>
              <Button
                size="sm"
                onClick={savePermissions}
                disabled={pending || isSuperTarget}
                className="h-9 shadow-[var(--shadow-cta)]"
              >
                {pending ? <Loader2 className="size-4 animate-spin" /> : "Αποθήκευση"}
              </Button>
            </header>
            <PermissionsMatrix
              value={permissions}
              onChange={setPermissions}
              actorIsSuperadmin={actorIsSuperadmin}
              disabled={isSuperTarget}
            />
          </section>
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
          {(error || success) && (
            <div
              className={cn(
                "flex items-start gap-2 rounded-2xl border p-4 text-xs",
                error
                  ? "border-destructive/40 bg-destructive/5 text-destructive"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700",
              )}
            >
              {error ? (
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
              ) : (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              )}
              {error ?? success}
            </div>
          )}

          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Κατάσταση
            </p>
            <p className="mt-1 font-display text-lg font-bold text-foreground">
              {employee.active ? "Ενεργός" : "Απενεργοποιημένος"}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Δημιουργήθηκε{" "}
              {new Intl.DateTimeFormat("el-GR").format(employee.createdAt)}
              {inviter && (
                <>
                  {" "}από {inviter.name ?? inviter.email}
                </>
              )}
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <Button
                variant="outline"
                onClick={toggleActive}
                disabled={pending || isSelf}
                className={cn(
                  "h-10",
                  !employee.active && "border-emerald-300 text-emerald-700",
                )}
              >
                {employee.active ? (
                  <>
                    <PauseCircle className="mr-1 size-4" />
                    Απενεργοποίηση
                  </>
                ) : (
                  <>
                    <PlayCircle className="mr-1 size-4" />
                    Ενεργοποίηση
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={resetPassword}
                disabled={pending}
                className="h-10"
              >
                <KeyRound className="mr-1 size-4" />
                Reset κωδικού
              </Button>
            </div>
            {isSelf && (
              <p className="mt-3 text-[11px] text-muted-foreground">
                Δεν μπορείς να απενεργοποιήσεις τον δικό σου λογαριασμό ή να
                αλλάξεις το role σου.
              </p>
            )}
          </div>

          {employee.role === "SUPERADMIN" && (
            <div className="rounded-2xl border border-[var(--color-brand-red)]/30 bg-[var(--color-brand-red-light)]/40 p-4 text-xs">
              <p className="flex items-center gap-1.5 font-bold text-[var(--color-brand-red-deep)]">
                <ShieldCheck className="size-4" />
                SuperAdmin
              </p>
              <p className="mt-1 text-muted-foreground">
                Έχει αυτόματα όλα τα δικαιώματα — δεν χρειάζεται ξεχωριστή
                ρύθμιση.
              </p>
            </div>
          )}
        </aside>
      </div>

      {resetCreds && (
        <CredentialsModal
          open
          onOpenChange={(o) => {
            if (!o) setResetCreds(null);
          }}
          email={resetCreds.email}
          password={resetCreds.password}
          title="Νέος προσωρινός κωδικός"
        />
      )}
    </>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-foreground">{label}</span>
      {children}
    </label>
  );
}
