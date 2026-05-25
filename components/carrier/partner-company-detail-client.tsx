"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Globe,
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
import { PartnerServiceAreaEditor } from "./partner-service-area-editor";
import { parseServiceCities } from "@/lib/partner-service-area";
import {
  deletePartnerCompany,
  deletePartnerContact,
  upsertPartnerCompany,
  upsertPartnerContact,
} from "@/server/actions/carrier-partners.action";

interface Company {
  id: string;
  vat: string;
  legalName: string;
  commercialName: string | null;
  doyName: string | null;
  legalStatus: string | null;
  address: string | null;
  addressNo: string | null;
  postalZip: string | null;
  postalArea: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  notes: string | null;
}

interface Contact {
  id: string;
  name: string;
  role: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
}

interface LinkedPartner {
  id: string;
  name: string;
  kind: string;
  serviceMode: "ANY" | "CITIES" | "RADIUS";
  serviceCities: string | null;
  hqAddress: string | null;
  hqLat: number | null;
  hqLng: number | null;
  serviceRadiusKm: number | null;
}

export function PartnerCompanyDetailClient({
  company,
  contacts,
  partners,
  mapApiKey,
}: {
  company: Company;
  contacts: Contact[];
  partners: LinkedPartner[];
  mapApiKey?: string | null;
}) {
  const [editingCompany, setEditingCompany] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | "new" | null>(null);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
      <section className="flex flex-col gap-4">
        {/* Company profile */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
          <div className="mb-4 flex items-start justify-between gap-3">
            <h2 className="font-display text-base font-bold text-foreground">
              Στοιχεία εταιρείας
            </h2>
            <button
              type="button"
              onClick={() => setEditingCompany(true)}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-xs font-semibold hover:bg-secondary"
            >
              <Pencil className="size-3.5" />
              Επεξεργασία
            </button>
          </div>
          <dl className="grid gap-3 sm:grid-cols-2">
            <Row label="Επωνυμία" value={company.legalName} />
            <Row label="Διακριτικός τίτλος" value={company.commercialName ?? "—"} />
            <Row label="ΑΦΜ" value={company.vat} mono />
            <Row label="ΔΟΥ" value={company.doyName ?? "—"} />
            <Row label="Νομική μορφή" value={company.legalStatus ?? "—"} />
            <Row
              label="Διεύθυνση"
              value={
                [
                  [company.address, company.addressNo].filter(Boolean).join(" "),
                  [company.postalZip, company.postalArea].filter(Boolean).join(" "),
                ]
                  .filter(Boolean)
                  .join(", ") || "—"
              }
            />
            <Row label="Τηλέφωνο" value={company.phone ?? "—"} icon={Phone} />
            <Row label="Email" value={company.email ?? "—"} icon={Mail} />
            {company.website && (
              <Row label="Website" value={company.website} icon={Globe} />
            )}
          </dl>
          {company.notes && (
            <div className="mt-4 rounded-lg bg-secondary/40 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                Σημειώσεις
              </p>
              <p className="mt-1 whitespace-pre-line text-sm text-foreground">
                {company.notes}
              </p>
            </div>
          )}
        </div>

        {/* Linked partners */}
        {partners.length > 0 && (
          <div className="cx-card p-3">
            <h2 className="cx-h2 mb-2">
              Συνδεδεμένοι συνεργάτες · {partners.length}
            </h2>
            <ul className="space-y-3">
              {partners.map((p) => (
                <li key={p.id} className="space-y-2">
                  <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-1.5">
                    <Building2 className="size-3.5 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-semibold text-foreground">
                        {p.name}
                      </p>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        {p.kind}
                      </p>
                    </div>
                    <ServiceAreaSummaryBadge partner={p} />
                  </div>
                  <PartnerServiceAreaEditor partner={p} mapApiKey={mapApiKey} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Contacts column */}
      <aside className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-base font-bold text-foreground">
            Επαφές εταιρείας
          </h2>
          <button
            type="button"
            onClick={() => setEditingContact("new")}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--color-brand-blue)] px-3 text-xs font-bold text-white hover:bg-[var(--color-brand-blue-deep)]"
          >
            <UserPlus className="size-3.5" />
            Νέα επαφή
          </button>
        </div>

        {contacts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center">
            <p className="text-sm font-semibold text-foreground">Καμία επαφή ακόμη</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Πρόσθεσε π.χ. το λογιστήριο, τον οδηγό γερανού, τον υπεύθυνο
              ραντεβού.
            </p>
            <button
              type="button"
              onClick={() => setEditingContact("new")}
              className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg bg-foreground px-3 text-xs font-bold text-background"
            >
              <Plus className="size-3.5" />
              Πρόσθεσε
            </button>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {contacts.map((c) => (
              <li key={c.id}>
                <ContactRow
                  contact={c}
                  onEdit={() => setEditingContact(c)}
                />
              </li>
            ))}
          </ul>
        )}
      </aside>

      {editingCompany && (
        <CompanyEditDialog
          company={company}
          onClose={() => setEditingCompany(false)}
        />
      )}
      {editingContact && (
        <ContactDialog
          companyId={company.id}
          contact={editingContact === "new" ? null : editingContact}
          onClose={() => setEditingContact(null)}
        />
      )}
    </div>
  );
}

function Row({
  label,
  value,
  mono,
  icon: Icon,
}: {
  label: string;
  value: string;
  mono?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-border pb-2">
      <dt className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd
        className={cn(
          "flex items-center gap-1.5 text-sm font-medium text-foreground",
          mono && "font-mono tabular-nums",
        )}
      >
        {Icon && <Icon className="size-3.5 text-muted-foreground" />}
        <span className="truncate">{value}</span>
      </dd>
    </div>
  );
}

function ContactRow({
  contact,
  onEdit,
}: {
  contact: Contact;
  onEdit: () => void;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-3 shadow-[var(--shadow-card)]">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{contact.name}</p>
        {contact.role && (
          <p className="text-[11px] text-muted-foreground">{contact.role}</p>
        )}
        <div className="mt-1 flex flex-col gap-0.5 text-xs text-muted-foreground">
          {contact.phone && (
            <a href={`tel:${contact.phone}`} className="inline-flex items-center gap-1.5 hover:text-foreground">
              <Phone className="size-3" />
              {contact.phone}
            </a>
          )}
          {contact.email && (
            <a href={`mailto:${contact.email}`} className="inline-flex items-center gap-1.5 hover:text-foreground">
              <Mail className="size-3" />
              <span className="truncate">{contact.email}</span>
            </a>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
      >
        <Pencil className="size-3.5" />
      </button>
    </div>
  );
}

function CompanyEditDialog({
  company,
  onClose,
}: {
  company: Company;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    vat: company.vat,
    legalName: company.legalName,
    commercialName: company.commercialName ?? "",
    doyName: company.doyName ?? "",
    legalStatus: company.legalStatus ?? "",
    address: company.address ?? "",
    addressNo: company.addressNo ?? "",
    postalZip: company.postalZip ?? "",
    postalArea: company.postalArea ?? "",
    email: company.email ?? "",
    phone: company.phone ?? "",
    website: company.website ?? "",
    notes: company.notes ?? "",
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await upsertPartnerCompany({ id: company.id, ...form });
      if (res.ok) {
        router.refresh();
        onClose();
      } else setError(res.error);
    });
  };

  const remove = () => {
    if (!confirm(`Διαγραφή της εταιρείας ${company.legalName};`)) return;
    start(async () => {
      const res = await deletePartnerCompany(company.id);
      if (res.ok) {
        router.push("/carrier/partners");
        router.refresh();
      } else setError(res.error);
    });
  };

  return (
    <Modal title="Επεξεργασία εταιρείας" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="ΑΦΜ">
            <input
              value={form.vat}
              onChange={(e) => setForm({ ...form, vat: e.target.value.replace(/\D/g, "") })}
              className="h-10 w-full rounded-lg border border-border bg-background px-3 font-mono text-sm outline-none focus:border-[var(--color-brand-blue)]"
            />
          </Field>
          <Field label="ΔΟΥ">
            <input
              value={form.doyName}
              onChange={(e) => setForm({ ...form, doyName: e.target.value })}
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-[var(--color-brand-blue)]"
            />
          </Field>
          <Field label="Επωνυμία" className="sm:col-span-2">
            <input
              required
              value={form.legalName}
              onChange={(e) => setForm({ ...form, legalName: e.target.value })}
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-[var(--color-brand-blue)]"
            />
          </Field>
          <Field label="Διακριτικός τίτλος" className="sm:col-span-2">
            <input
              value={form.commercialName}
              onChange={(e) => setForm({ ...form, commercialName: e.target.value })}
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-[var(--color-brand-blue)]"
            />
          </Field>
          <Field label="Νομική μορφή" className="sm:col-span-2">
            <input
              value={form.legalStatus}
              onChange={(e) => setForm({ ...form, legalStatus: e.target.value })}
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-[var(--color-brand-blue)]"
            />
          </Field>
          <Field label="Οδός">
            <input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-[var(--color-brand-blue)]"
            />
          </Field>
          <Field label="Αριθμός">
            <input
              value={form.addressNo}
              onChange={(e) => setForm({ ...form, addressNo: e.target.value })}
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-[var(--color-brand-blue)]"
            />
          </Field>
          <Field label="ΤΚ">
            <input
              value={form.postalZip}
              onChange={(e) => setForm({ ...form, postalZip: e.target.value })}
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-[var(--color-brand-blue)]"
            />
          </Field>
          <Field label="Περιοχή">
            <input
              value={form.postalArea}
              onChange={(e) => setForm({ ...form, postalArea: e.target.value })}
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-[var(--color-brand-blue)]"
            />
          </Field>
          <Field label="Τηλέφωνο">
            <input
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
          <Field label="Website" className="sm:col-span-2">
            <input
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
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
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
          >
            <Trash2 className="size-3.5" />
            Διαγραφή
          </button>
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
    </Modal>
  );
}

function ContactDialog({
  companyId,
  contact,
  onClose,
}: {
  companyId: string;
  contact: Contact | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: contact?.name ?? "",
    role: contact?.role ?? "",
    phone: contact?.phone ?? "",
    email: contact?.email ?? "",
    notes: contact?.notes ?? "",
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await upsertPartnerContact({
        id: contact?.id,
        companyId,
        ...form,
      });
      if (res.ok) {
        router.refresh();
        onClose();
      } else setError(res.error);
    });
  };

  const remove = () => {
    if (!contact) return;
    if (!confirm(`Διαγραφή της επαφής ${contact.name};`)) return;
    start(async () => {
      const res = await deletePartnerContact(contact.id);
      if (res.ok) {
        router.refresh();
        onClose();
      } else setError(res.error);
    });
  };

  return (
    <Modal title={contact ? "Επεξεργασία επαφής" : "Νέα επαφή"} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Ονοματεπώνυμο" className="sm:col-span-2">
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-[var(--color-brand-blue)]"
            />
          </Field>
          <Field label="Ρόλος / θέση" className="sm:col-span-2">
            <input
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              placeholder="π.χ. λογιστήριο, υπεύθυνος ραντεβού"
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-[var(--color-brand-blue)]"
            />
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
              rows={2}
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
          {contact ? (
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
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-xl">
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

function ServiceAreaSummaryBadge({ partner }: {
  partner: {
    serviceMode: "ANY" | "CITIES" | "RADIUS";
    serviceCities: string | null;
    serviceRadiusKm: number | null;
  };
}) {
  if (partner.serviceMode === "ANY") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground ring-1 ring-inset ring-border">
        🌐 Παντού
      </span>
    );
  }
  if (partner.serviceMode === "CITIES") {
    const n = parseServiceCities(partner.serviceCities).length;
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-800 ring-1 ring-inset ring-sky-200">
        📍 {n} {n === 1 ? "πόλη" : "πόλεις"}
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200">
      ⊙ {partner.serviceRadiusKm ?? "—"} km
    </span>
  );
}
