"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Mail, Plus, ShieldCheck, X } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  inviteCarrierUser,
  type InviteCarrierUserResult,
} from "@/server/actions/carrier-otp.action";
import { SendOtpButton } from "@/components/admin/send-otp-button";

interface TeamItem {
  membershipId: string;
  userId: string;
  name: string | null;
  email: string;
  role: string;
  userRole: string;
  active: boolean;
  branchName: string | null;
  invitedAt: Date | null;
  isSelf: boolean;
}

interface Props {
  items: TeamItem[];
  maxEmployees: number | null;
}

export function CarrierTeamClient({ items, maxEmployees }: Props) {
  const [open, setOpen] = useState(false);
  const atCap = maxEmployees != null && items.length >= maxEmployees;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={atCap}
          className={cn(
            "inline-flex h-10 items-center gap-1.5 rounded-lg px-4 text-sm font-bold text-white shadow-[0_6px_20px_rgba(37,99,235,0.25)] transition-colors",
            atCap
              ? "cursor-not-allowed bg-muted text-muted-foreground shadow-none"
              : "bg-gradient-to-r from-[var(--color-brand-blue)] to-[#3B82F6] hover:from-[var(--color-brand-blue-deep)] hover:to-[var(--color-brand-blue)]",
          )}
          title={atCap ? "Έφτασες το όριο του πακέτου σου" : undefined}
        >
          <Plus className="size-4" />
          Πρόσκληση μέλους
        </button>
      </div>

      <ul className="grid gap-2">
        {items.map((m) => (
          <li
            key={m.membershipId}
            className="grid items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)] sm:grid-cols-[1.6fr_1fr_auto_auto]"
          >
            <div>
              <p className="font-semibold text-foreground">
                {m.name ?? m.email.split("@")[0]}{" "}
                {m.isSelf && (
                  <span className="ml-1 rounded-full bg-secondary px-1.5 text-[10px] font-bold uppercase text-muted-foreground">
                    εσύ
                  </span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">{m.email}</p>
              {m.branchName && (
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Υποκατάστημα: {m.branchName}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <RoleBadge role={m.role} />
              {!m.active && (
                <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800">
                  Ανενεργός
                </span>
              )}
            </div>
            <div>
              {!m.isSelf && (
                <SendOtpButton userId={m.userId} label="Νέο OTP" />
              )}
            </div>
            <div className="text-right text-[11px] text-muted-foreground">
              {m.invitedAt ? `Προσκλήθηκε ${formatDate(m.invitedAt)}` : "—"}
            </div>
          </li>
        ))}
      </ul>

      {open && <InviteDialog onClose={() => setOpen(false)} />}
    </div>
  );
}

function InviteDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"ADMIN" | "MEMBER">("MEMBER");
  const [result, setResult] = useState<InviteCarrierUserResult | null>(null);

  const submit = () => {
    setResult(null);
    start(async () => {
      const r = await inviteCarrierUser({ email, name, role });
      setResult(r);
      if (r.ok) {
        router.refresh();
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-card p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Πρόσκληση μέλους</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-secondary"
          >
            <X className="size-4" />
          </button>
        </div>

        {result?.ok ? (
          <div className="space-y-3">
            <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
              <p className="flex items-center gap-1.5 font-semibold">
                <CheckCircle2 className="size-4" />
                Στάλθηκε στο {result.sentTo}
              </p>
              <p className="mt-1 text-xs">
                Προσωρινός κωδικός:{" "}
                <span className="font-mono font-bold">{result.tempPassword}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-lg bg-foreground py-2 text-sm font-bold text-background"
            >
              Κλείσιμο
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <Field label="Όνομα">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Π.χ. Γιάννης Παπαδόπουλος"
                className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-[var(--color-brand-blue)]"
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.gr"
                className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-[var(--color-brand-blue)]"
              />
            </Field>
            <Field label="Ρόλος">
              <div className="grid grid-cols-2 gap-2">
                {(["MEMBER", "ADMIN"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
                      role === r
                        ? "border-[var(--color-brand-blue)] bg-[var(--color-brand-blue-light)] text-[var(--color-brand-blue-deep)]"
                        : "border-border bg-background text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {r === "ADMIN" ? "Διαχειριστής" : "Μέλος"}
                  </button>
                ))}
              </div>
            </Field>

            {result?.ok === false && (
              <p className="rounded-lg bg-rose-50 p-2 text-xs text-rose-800">
                {result.error}
              </p>
            )}

            <button
              type="button"
              disabled={pending || !email || !name}
              onClick={submit}
              className="mt-1 inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-[var(--color-brand-blue)] to-[#3B82F6] text-sm font-bold text-white disabled:opacity-50"
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Mail className="size-4" />
              )}
              Αποστολή πρόσκλησης + OTP
            </button>
          </div>
        )}
      </div>
    </div>
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
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function RoleBadge({ role }: { role: string }) {
  const map: Record<string, { label: string; cls: string; icon?: typeof ShieldCheck }> = {
    OWNER: {
      label: "Owner",
      cls: "bg-amber-100 text-amber-800",
      icon: ShieldCheck,
    },
    ADMIN: {
      label: "Διαχειριστής",
      cls: "bg-sky-100 text-sky-800",
      icon: ShieldCheck,
    },
    MEMBER: { label: "Μέλος", cls: "bg-secondary text-foreground" },
  };
  const e = map[role] ?? { label: role, cls: "bg-secondary text-foreground" };
  const Icon = e.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold",
        e.cls,
      )}
    >
      {Icon && <Icon className="size-3" />}
      {e.label}
    </span>
  );
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("el-GR", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  }).format(d);
}
