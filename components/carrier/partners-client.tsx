"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  ExternalLink,
  Handshake,
  Loader2,
  Mail,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  createPartnerCompanyFromAfm,
  deletePartner,
  upsertPartner,
} from "@/server/actions/carrier-partners.action";

type Kind =
  | "TRANSPORTER"
  | "CRANE"
  | "STORAGE"
  | "PACKER"
  | "ELECTRICIAN"
  | "CARPENTER"
  | "HANDYMAN"
  | "OTHER";

const KIND_LABELS: Record<Kind, string> = {
  TRANSPORTER: "Μεταφορέας",
  CRANE: "Γερανός",
  STORAGE: "Αποθήκη",
  PACKER: "Packer",
  ELECTRICIAN: "Ηλεκτρολόγος",
  CARPENTER: "Ξυλουργός",
  HANDYMAN: "Τεχνίτης",
  OTHER: "Άλλο",
};

const KIND_COLORS: Record<Kind, string> = {
  TRANSPORTER: "bg-[var(--color-brand-blue-light)] text-[var(--color-brand-blue-deep)]",
  CRANE: "bg-amber-50 text-amber-700",
  STORAGE: "bg-violet-50 text-violet-700",
  PACKER: "bg-emerald-50 text-emerald-700",
  ELECTRICIAN: "bg-yellow-50 text-yellow-800",
  CARPENTER: "bg-orange-50 text-orange-700",
  HANDYMAN: "bg-cyan-50 text-cyan-700",
  OTHER: "bg-secondary text-foreground",
};

interface Partner {
  id: string;
  name: string;
  kind: Kind;
  phone: string | null;
  email: string | null;
  notes: string | null;
  company: { id: string; name: string; vat: string } | null;
}

interface Company {
  id: string;
  vat: string;
  legalName: string;
  commercialName: string | null;
  doyName: string | null;
  phone: string | null;
  email: string | null;
  partnersCount: number;
}

export function PartnersClient({
  partners,
  companies,
}: {
  partners: Partner[];
  companies: Company[];
}) {
  const [tab, setTab] = useState<"people" | "companies">("people");
  const [editing, setEditing] = useState<Partner | "new" | null>(null);
  const [addingCompany, setAddingCompany] = useState(false);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-xl border border-border bg-card p-1">
          <TabBtn active={tab === "people"} onClick={() => setTab("people")}>
            <Handshake className="size-4" />
            Πρόσωπα <span className="opacity-60">({partners.length})</span>
          </TabBtn>
          <TabBtn
            active={tab === "companies"}
            onClick={() => setTab("companies")}
          >
            <Building2 className="size-4" />
            Εταιρείες <span className="opacity-60">({companies.length})</span>
          </TabBtn>
        </div>
        <div className="flex gap-2">
          {tab === "people" ? (
            <button
              type="button"
              onClick={() => setEditing("new")}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[var(--color-brand-blue)] px-4 text-sm font-bold text-white hover:bg-[var(--color-brand-blue-deep)]"
            >
              <UserPlus className="size-4" />
              Νέος συνεργάτης
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setAddingCompany(true)}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[var(--color-brand-blue)] px-4 text-sm font-bold text-white hover:bg-[var(--color-brand-blue-deep)]"
            >
              <Building2 className="size-4" />
              Νέα εταιρεία
            </button>
          )}
        </div>
      </div>

      {tab === "people" ? (
        partners.length === 0 ? (
          <EmptyBox
            title="Κανείς συνεργάτης ακόμη"
            hint="Πρόσθεσε π.χ. έναν freelance οδηγό γερανού ή έναν συνεργαζόμενο μεταφορέα."
            onAdd={() => setEditing("new")}
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {partners.map((p) => (
              <li key={p.id}>
                <PartnerCard partner={p} onEdit={() => setEditing(p)} />
              </li>
            ))}
          </ul>
        )
      ) : companies.length === 0 ? (
        <EmptyBox
          title="Καμία εταιρεία συνεργάτη ακόμη"
          hint="Καταχώρισε εταιρεία με ΑΦΜ και πρόσθεσε επαφές της μέσα."
          onAdd={() => setAddingCompany(true)}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {companies.map((c) => (
            <li key={c.id}>
              <CompanyCard company={c} />
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <PartnerDialog
          partner={editing === "new" ? null : editing}
          companies={companies}
          onClose={() => setEditing(null)}
        />
      )}

      {addingCompany && (
        <AfmCompanyDialog
          onClose={() => setAddingCompany(false)}
        />
      )}
    </>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors",
        active
          ? "bg-[var(--color-brand-blue)] text-white"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function EmptyBox({
  title,
  hint,
  onAdd,
}: {
  title: string;
  hint: string;
  onAdd: () => void;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      <button
        type="button"
        onClick={onAdd}
        className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg bg-foreground px-4 text-sm font-bold text-background"
      >
        <Plus className="size-4" />
        Πρόσθεσε
      </button>
    </div>
  );
}

function PartnerCard({
  partner,
  onEdit,
}: {
  partner: Partner;
  onEdit: () => void;
}) {
  const initials = partner.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
  return (
    <div className="flex h-full flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-pop)]">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-amber-500 text-sm font-bold text-white">
          {initials || "?"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-foreground">{partner.name}</p>
          <span
            className={cn(
              "mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
              KIND_COLORS[partner.kind],
            )}
          >
            {KIND_LABELS[partner.kind]}
          </span>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <Pencil className="size-3.5" />
        </button>
      </div>

      {partner.company && (
        <Link
          href={`/carrier/partners/companies/${partner.company.id}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/30 px-2 py-1.5 text-[11px] font-semibold text-foreground hover:bg-secondary"
        >
          <Building2 className="size-3.5 text-muted-foreground" />
          <span className="truncate">{partner.company.name}</span>
          <span className="ml-auto font-mono text-[10px] text-muted-foreground">
            {partner.company.vat}
          </span>
        </Link>
      )}

      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
        {partner.phone && (
          <a href={`tel:${partner.phone}`} className="inline-flex items-center gap-1.5 hover:text-foreground">
            <Phone className="size-3.5" />
            {partner.phone}
          </a>
        )}
        {partner.email && (
          <a href={`mailto:${partner.email}`} className="inline-flex items-center gap-1.5 hover:text-foreground">
            <Mail className="size-3.5" />
            <span className="truncate">{partner.email}</span>
          </a>
        )}
      </div>

      {partner.notes && (
        <p className="line-clamp-2 text-[11px] text-muted-foreground">
          {partner.notes}
        </p>
      )}
    </div>
  );
}

function CompanyCard({ company }: { company: Company }) {
  return (
    <Link
      href={`/carrier/partners/companies/${company.id}`}
      className="group flex h-full flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-pop)]"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--color-brand-blue)] text-white">
          <Building2 className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-foreground">
            {company.commercialName ?? company.legalName}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            ΑΦΜ {company.vat}
            {company.doyName ? ` · ${company.doyName}` : ""}
          </p>
        </div>
        <ExternalLink className="size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </div>

      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
        {company.phone && (
          <span className="inline-flex items-center gap-1.5">
            <Phone className="size-3.5" />
            {company.phone}
          </span>
        )}
        {company.email && (
          <span className="inline-flex items-center gap-1.5 truncate">
            <Mail className="size-3.5" />
            {company.email}
          </span>
        )}
      </div>

      <p className="mt-auto text-[11px] font-semibold text-[var(--color-brand-blue-deep)]">
        {company.partnersCount} συνδεδεμέν
        {company.partnersCount === 1 ? "ος συνεργάτης" : "οι συνεργάτες"} →
      </p>
    </Link>
  );
}

function PartnerDialog({
  partner,
  companies,
  onClose,
}: {
  partner: Partner | null;
  companies: Company[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: partner?.name ?? "",
    kind: (partner?.kind ?? "TRANSPORTER") as Kind,
    phone: partner?.phone ?? "",
    email: partner?.email ?? "",
    notes: partner?.notes ?? "",
    companyId: partner?.company?.id ?? "",
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await upsertPartner({ id: partner?.id, ...form });
      if (res.ok) {
        router.refresh();
        onClose();
      } else setError(res.error);
    });
  };

  const remove = () => {
    if (!partner) return;
    if (!confirm(`Διαγραφή του ${partner.name};`)) return;
    start(async () => {
      const res = await deletePartner(partner.id);
      if (res.ok) {
        router.refresh();
        onClose();
      } else setError(res.error);
    });
  };

  return (
    <Modal title={partner ? "Επεξεργασία συνεργάτη" : "Νέος συνεργάτης"} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Ονοματεπώνυμο" className="sm:col-span-2">
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-[var(--color-brand-blue)]"
              placeholder="π.χ. Δημήτρης Σταύρου"
            />
          </Field>
          <Field label="Ειδικότητα">
            <select
              value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value as Kind })}
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-[var(--color-brand-blue)]"
            >
              {(Object.keys(KIND_LABELS) as Kind[]).map((k) => (
                <option key={k} value={k}>
                  {KIND_LABELS[k]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Εταιρεία (προαιρετικό)">
            <select
              value={form.companyId}
              onChange={(e) => setForm({ ...form, companyId: e.target.value })}
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-[var(--color-brand-blue)]"
            >
              <option value="">— Ανεξάρτητος —</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.commercialName ?? c.legalName} (ΑΦΜ {c.vat})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Τηλέφωνο">
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-[var(--color-brand-blue)]"
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
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

        <ModalActions
          onClose={onClose}
          onDelete={partner ? remove : undefined}
          pending={pending}
        />
      </form>
    </Modal>
  );
}

function AfmCompanyDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [afm, setAfm] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (afm.replace(/\D/g, "").length < 5) {
      setError("Λάθος ΑΦΜ.");
      return;
    }
    start(async () => {
      const res = await createPartnerCompanyFromAfm(afm.trim());
      if (res.ok && res.data) {
        router.push(`/carrier/partners/companies/${res.data.id}`);
        router.refresh();
        onClose();
      } else if (!res.ok) {
        setError(res.error);
      }
    });
  };

  return (
    <Modal title="Νέα εταιρεία συνεργάτη — αναζήτηση ΑΦΜ" onClose={onClose}>
      <form onSubmit={submit}>
        <p className="mb-3 text-xs text-muted-foreground">
          Συμπληρώνουμε αυτόματα επωνυμία, ΔΟΥ και διεύθυνση από το μητρώο
          ΑΑΔΕ.
        </p>
        <Field label="ΑΦΜ">
          <div className="flex gap-2">
            <input
              autoFocus
              value={afm}
              onChange={(e) =>
                setAfm(e.target.value.replace(/\D/g, "").slice(0, 12))
              }
              inputMode="numeric"
              className="h-10 flex-1 rounded-lg border border-border bg-background px-3 font-mono text-base tracking-wider outline-none focus:border-[var(--color-brand-blue)]"
              placeholder="999999999"
            />
            <button
              type="submit"
              disabled={pending}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-foreground px-4 text-sm font-bold text-background disabled:opacity-50"
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Search className="size-4" />
              )}
              Αναζήτηση
            </button>
          </div>
        </Field>
        {error && (
          <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800">
            {error}
          </p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 items-center rounded-lg border border-border bg-card px-3 text-sm font-medium hover:bg-secondary"
          >
            Άκυρο
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h3 className="font-display text-base font-bold text-foreground">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-secondary"
          >
            <X className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalActions({
  onClose,
  onDelete,
  pending,
}: {
  onClose: () => void;
  onDelete?: () => void;
  pending: boolean;
}) {
  return (
    <div className="mt-4 flex justify-between gap-2">
      {onDelete ? (
        <button
          type="button"
          onClick={onDelete}
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
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-1", className)}>
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
