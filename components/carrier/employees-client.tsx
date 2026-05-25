"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Mail,
  Pencil,
  Phone,
  Plus,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  deleteEmployee,
  upsertEmployee,
} from "@/server/actions/carrier-employees.action";

type Role =
  | "DRIVER"
  | "ASSISTANT"
  | "PACKER"
  | "OPERATIONS"
  | "ADMIN"
  | "OTHER";

const ROLE_LABELS: Record<Role, string> = {
  DRIVER: "Οδηγός",
  ASSISTANT: "Βοηθός",
  PACKER: "Packer",
  OPERATIONS: "Συντονισμός",
  ADMIN: "Διοίκηση",
  OTHER: "Άλλο",
};

const ROLE_COLORS: Record<Role, string> = {
  DRIVER: "bg-[var(--color-brand-blue-light)] text-[var(--color-brand-blue-deep)]",
  ASSISTANT: "bg-emerald-50 text-emerald-700",
  PACKER: "bg-amber-50 text-amber-700",
  OPERATIONS: "bg-violet-50 text-violet-700",
  ADMIN: "bg-rose-50 text-rose-700",
  OTHER: "bg-secondary text-foreground",
};

interface Employee {
  id: string;
  name: string;
  role: Role;
  phone: string | null;
  email: string | null;
  idNumber: string | null;
  notes: string | null;
  active: boolean;
  branchId: string | null;
  branchName: string | null;
}

export interface BranchOption {
  id: string;
  name: string;
  serviceRadiusKm: number;
  hasCoords: boolean;
}

export function EmployeesClient({
  employees, branches,
}: {
  employees: Employee[];
  branches: BranchOption[];
}) {
  const [editing, setEditing] = useState<Employee | "new" | null>(null);

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {employees.length} καταχωρημέν{employees.length === 1 ? "ος" : "οι"}
        </p>
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[var(--color-brand-blue)] px-4 text-sm font-bold text-white shadow-sm hover:bg-[var(--color-brand-blue-deep)]"
        >
          <UserPlus className="size-4" />
          Νέος υπάλληλος
        </button>
      </div>

      {employees.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <p className="text-sm font-semibold text-foreground">
            Δεν έχεις καταχωρήσει υπαλλήλους ακόμη.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Πρόσθεσε οδηγούς, βοηθούς και άλλα μέλη της ομάδας σου.
          </p>
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg bg-foreground px-4 text-sm font-bold text-background"
          >
            <Plus className="size-4" />
            Πρόσθεσε τον πρώτο
          </button>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {employees.map((e) => (
            <li key={e.id}>
              <EmployeeCard
                employee={e}
                onEdit={() => setEditing(e)}
              />
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <EmployeeDialog
          employee={editing === "new" ? null : editing}
          branches={branches}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

function EmployeeCard({
  employee,
  onEdit,
}: {
  employee: Employee;
  onEdit: () => void;
}) {
  const initials = employee.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
  return (
    <div
      className={cn(
        "group flex h-full flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-pop)]",
        !employee.active && "opacity-60",
      )}
    >
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--color-brand-blue)] text-sm font-bold text-white">
          {initials || "?"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-foreground">{employee.name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                ROLE_COLORS[employee.role],
              )}
            >
              {ROLE_LABELS[employee.role]}
            </span>
            {!employee.active && (
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                Ανενεργός
              </span>
            )}
            {employee.branchName && (
              <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-800 ring-1 ring-inset ring-sky-200">
                📍 {employee.branchName}
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
          title="Επεξεργασία"
        >
          <Pencil className="size-3.5" />
        </button>
      </div>

      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
        {employee.phone && (
          <a
            href={`tel:${employee.phone}`}
            className="inline-flex items-center gap-1.5 hover:text-foreground"
          >
            <Phone className="size-3.5" />
            {employee.phone}
          </a>
        )}
        {employee.email && (
          <a
            href={`mailto:${employee.email}`}
            className="inline-flex items-center gap-1.5 hover:text-foreground"
          >
            <Mail className="size-3.5" />
            <span className="truncate">{employee.email}</span>
          </a>
        )}
        {employee.idNumber && (
          <span className="text-[11px]">ID: {employee.idNumber}</span>
        )}
      </div>

      {employee.notes && (
        <p className="line-clamp-2 text-[11px] text-muted-foreground">
          {employee.notes}
        </p>
      )}
    </div>
  );
}

function EmployeeDialog({
  employee, branches, onClose,
}: {
  employee: Employee | null;
  branches: BranchOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: employee?.name ?? "",
    role: (employee?.role ?? "DRIVER") as Role,
    phone: employee?.phone ?? "",
    email: employee?.email ?? "",
    idNumber: employee?.idNumber ?? "",
    notes: employee?.notes ?? "",
    active: employee?.active ?? true,
    branchId: employee?.branchId ?? "",
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await upsertEmployee({ id: employee?.id, ...form });
      if (res.ok) {
        router.refresh();
        onClose();
      } else {
        setError(res.error);
      }
    });
  };

  const remove = () => {
    if (!employee) return;
    if (!confirm(`Διαγραφή του ${employee.name};`)) return;
    start(async () => {
      const res = await deleteEmployee(employee.id);
      if (res.ok) {
        router.refresh();
        onClose();
      } else {
        setError(res.error);
      }
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={submit}
        className="w-full max-w-lg rounded-2xl border border-border bg-card p-5 shadow-xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h3 className="font-display text-base font-bold text-foreground">
            {employee ? "Επεξεργασία υπαλλήλου" : "Νέος υπάλληλος"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-secondary"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Ονοματεπώνυμο" className="sm:col-span-2">
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-[var(--color-brand-blue)]"
              placeholder="π.χ. Μιχάλης Χατζηγιάγκος"
            />
          </Field>
          <Field label="Ειδικότητα">
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-[var(--color-brand-blue)]"
            >
              {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Υποκατάστημα"
            className="sm:col-span-2"
            hint={
              branches.length === 0
                ? "Δεν έχεις δηλώσει υποκαταστήματα. Δημιούργησε ένα στο /carrier/branches για να ορίσεις περιοχή εξυπηρέτησης."
                : "Καθορίζει την περιοχή εξυπηρέτησης (κληρονομείται από το υποκατάστημα)."
            }
          >
            {branches.length === 0 ? (
              <div className="flex h-10 items-center justify-between gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-3 text-[12px] text-muted-foreground">
                <span>— Δεν υπάρχουν υποκαταστήματα —</span>
                <a
                  href="/carrier/branches"
                  className="text-[11px] font-semibold text-[var(--cx-accent)] hover:underline"
                >
                  Δημιουργία →
                </a>
              </div>
            ) : (
              <select
                value={form.branchId}
                onChange={(e) => setForm({ ...form, branchId: e.target.value })}
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-[var(--color-brand-blue)]"
              >
                <option value="">— Χωρίς (εξυπηρετεί παντού) —</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}{b.hasCoords ? ` · ${b.serviceRadiusKm}km` : " (χωρίς συντεταγμένες)"}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Κατάσταση">
            <label className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) =>
                  setForm({ ...form, active: e.target.checked })
                }
                className="size-4 accent-[var(--color-brand-blue)]"
              />
              Ενεργός
            </label>
          </Field>
          <Field label="Τηλέφωνο">
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-[var(--color-brand-blue)]"
              placeholder="69xxxxxxxx"
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-[var(--color-brand-blue)]"
              placeholder="name@example.com"
            />
          </Field>
          <Field label="ID / δίπλωμα (προαιρετικό)" className="sm:col-span-2">
            <input
              value={form.idNumber}
              onChange={(e) => setForm({ ...form, idNumber: e.target.value })}
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-[var(--color-brand-blue)]"
            />
          </Field>
          <Field label="Σημειώσεις" className="sm:col-span-2">
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[var(--color-brand-blue)]"
            />
          </Field>
        </div>

        {error && (
          <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800">
            {error}
          </p>
        )}

        <div className="mt-4 flex justify-between gap-2">
          {employee ? (
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
            >
              <Trash2 className="size-3.5" />
              Διαγραφή
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 items-center rounded-lg border border-border bg-card px-3 text-sm font-medium hover:bg-secondary"
            >
              Άκυρο
            </button>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-foreground px-4 text-sm font-bold text-background disabled:opacity-50"
            >
              {pending && <Loader2 className="size-4 animate-spin" />}
              Αποθήκευση
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  children,
  className,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  hint?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-1", className)}>
      {hint && <span className="order-3 text-[10px] text-muted-foreground">{hint}</span>}
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
