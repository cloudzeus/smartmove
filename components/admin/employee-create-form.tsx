"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, Mail, Phone, ShieldCheck, User } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PERMISSION_PRESETS, type Permission } from "@/lib/permissions";
import { createEmployee } from "@/server/actions/employees.action";
import { CredentialsModal } from "./credentials-modal";
import { PermissionsMatrix } from "./permissions-matrix";

interface Props {
  actorRole: string;
}

interface RoleOption {
  value: "EMPLOYEE" | "SUPERADMIN";
  label: string;
  description: string;
  superadminOnly?: boolean;
}

const ROLES: RoleOption[] = [
  {
    value: "EMPLOYEE",
    label: "Υπάλληλος",
    description: "Πρόσβαση μόνο σε όσα του δίνεις παρακάτω.",
  },
  {
    value: "SUPERADMIN",
    label: "SuperAdmin",
    description: "Πλήρης πρόσβαση. Διάθεσε με σύνεση.",
    superadminOnly: true,
  },
];

export function EmployeeCreateForm({ actorRole }: Props) {
  const router = useRouter();
  const [role, setRole] = useState<"EMPLOYEE" | "SUPERADMIN">("EMPLOYEE");
  const [permissions, setPermissions] = useState<string[]>([]);
  const [createdCreds, setCreatedCreds] = useState<{
    email: string;
    password: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const actorIsSuperadmin = actorRole === "SUPERADMIN";

  function applyPreset(perms: Permission[]) {
    setPermissions(perms);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "");
    const payload = {
      email,
      name: String(fd.get("name") ?? ""),
      phone: String(fd.get("phone") ?? ""),
      role,
      permissions,
    };
    start(async () => {
      const res = await createEmployee(payload);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (res.tempPassword) {
        setCreatedCreds({ email, password: res.tempPassword });
      } else {
        router.push(`/admin/employees/${res.id}`);
      }
      router.refresh();
    });
  }

  return (
    <>
      <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-5">
          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="mb-4 font-display text-base font-bold text-foreground">
              Στοιχεία υπαλλήλου
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field icon={User} label="Ονοματεπώνυμο" required>
                <Input name="name" required minLength={2} placeholder="π.χ. Νίκος Παππάς" />
              </Field>
              <Field icon={Mail} label="Email" required>
                <Input type="email" name="email" required placeholder="nikos@smartmove.gr" />
              </Field>
              <Field icon={Phone} label="Τηλέφωνο" required>
                <Input
                  type="tel"
                  name="phone"
                  required
                  minLength={8}
                  placeholder="69 1234 5678"
                />
              </Field>
              <div className="flex flex-col gap-1.5">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <ShieldCheck className="size-3.5 text-muted-foreground" />
                  Ρόλος
                  <span className="text-destructive">*</span>
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {ROLES.map((r) => {
                    const active = role === r.value;
                    const disabled = r.superadminOnly && !actorIsSuperadmin;
                    return (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => !disabled && setRole(r.value)}
                        disabled={disabled}
                        className={cn(
                          "flex flex-col gap-1 rounded-lg border-2 p-3 text-left text-xs transition-colors",
                          active
                            ? "border-[var(--color-brand-blue)] bg-[var(--color-brand-blue-light)]"
                            : "border-border bg-card hover:border-[var(--color-brand-blue)]/40",
                          disabled && "cursor-not-allowed opacity-50",
                        )}
                      >
                        <span className="font-bold text-foreground">{r.label}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {r.description}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-5">
            <header className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-bold text-foreground">
                  Δικαιώματα πρόσβασης
                </h2>
                <p className="text-xs text-muted-foreground">
                  {role === "SUPERADMIN"
                    ? "Οι SuperAdmin έχουν αυτόματα πλήρη πρόσβαση."
                    : "Διάλεξε ένα preset για γρήγορο setup, ή τα έπιμέρους δικαιώματα παρακάτω."}
                </p>
              </div>
              <span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-bold text-muted-foreground">
                {role === "SUPERADMIN" ? "—" : `${permissions.length} επιλεγμένα`}
              </span>
            </header>

            {role === "EMPLOYEE" && (
              <>
                <div className="mb-4 grid gap-2 sm:grid-cols-3">
                  {PERMISSION_PRESETS.map((preset) => (
                    <button
                      key={preset.key}
                      type="button"
                      onClick={() =>
                        applyPreset(
                          actorIsSuperadmin
                            ? preset.permissions
                            : preset.permissions.filter((p) => {
                                // hide superadmin-only ones
                                return true;
                              }),
                        )
                      }
                      className="flex flex-col items-start gap-1 rounded-xl border border-border bg-secondary/40 p-3 text-left transition-colors hover:border-[var(--color-brand-blue)]/40 hover:bg-secondary"
                    >
                      <span className="font-display text-xs font-bold text-foreground">
                        {preset.label}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {preset.description}
                      </span>
                      <span className="mt-0.5 text-[10px] font-bold text-[var(--color-brand-blue)]">
                        {preset.permissions.length} permissions →
                      </span>
                    </button>
                  ))}
                </div>

                <PermissionsMatrix
                  value={permissions}
                  onChange={setPermissions}
                  actorIsSuperadmin={actorIsSuperadmin}
                />
              </>
            )}
          </section>
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
          {error && (
            <div className="flex items-start gap-2 rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-xs text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">
              Θα δημιουργηθεί λογαριασμός με <strong>προσωρινό κωδικό</strong>{" "}
              που θα εμφανιστεί άπαξ. Θα τον στείλεις στον υπάλληλο με ασφαλή
              τρόπο.
            </p>
            <Button
              type="submit"
              disabled={pending}
              className="mt-4 h-12 w-full text-base shadow-[var(--shadow-cta)]"
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Δημιουργία υπαλλήλου"
              )}
            </Button>
          </div>
        </aside>
      </form>

      {createdCreds && (
        <CredentialsModal
          open
          onOpenChange={(o) => {
            if (!o) {
              setCreatedCreds(null);
              router.push("/admin/employees");
            }
          }}
          email={createdCreds.email}
          password={createdCreds.password}
        />
      )}
    </>
  );
}

function Field({
  icon: Icon,
  label,
  required,
  children,
}: {
  icon: typeof User;
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
        <Icon className="size-3.5 text-muted-foreground" />
        {label}
        {required && <span className="text-destructive">*</span>}
      </span>
      {children}
    </label>
  );
}
