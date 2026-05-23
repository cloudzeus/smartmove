"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Clock,
  Loader2,
  Mail,
  Plus,
  Receipt,
  Send,
  UserPlus,
  X,
  XCircle,
} from "lucide-react";

import Link from "next/link";

import { cn } from "@/lib/utils";
import {
  cancelPartnerQuoteRequest,
  requestPartnerQuote,
} from "@/server/actions/partner-quote-requests.action";
import { assignJobTaskPartner } from "@/server/actions/carrier-job-tasks.action";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Service =
  | "PACKING"
  | "CRANE"
  | "STORAGE"
  | "HANDYMAN"
  | "ELECTRICIAN"
  | "CARPENTER"
  | "OTHER";

const SERVICES: { value: Service; label: string; emoji: string }[] = [
  { value: "PACKING", label: "Αμπαλάζ / Πακετάρισμα", emoji: "📦" },
  { value: "CRANE", label: "Γερανός", emoji: "🏗️" },
  { value: "STORAGE", label: "Αποθήκευση", emoji: "🏬" },
  { value: "HANDYMAN", label: "Τεχνίτης", emoji: "🛠️" },
  { value: "ELECTRICIAN", label: "Ηλεκτρολόγος", emoji: "💡" },
  { value: "CARPENTER", label: "Ξυλουργός", emoji: "🪵" },
  { value: "OTHER", label: "Άλλη", emoji: "•" },
];

export interface PartnerOption {
  id: string;
  name: string;
  kind: string;
  email: string | null;
  phone: string | null;
  companyId: string | null;
  companyName: string | null;
}

export interface CompanyOption {
  id: string;
  name: string;
  vat: string;
  email: string | null;
  phone: string | null;
}

export interface ContactOption {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  companyId: string;
  companyName: string;
}

/** Discriminated union of all targetable parties in the picker. */
type Target =
  | { kind: "partner"; id: string }
  | { kind: "company"; id: string }
  | { kind: "contact"; id: string };

export interface QuoteRequestRow {
  id: string;
  status: "PENDING" | "QUOTED" | "ACCEPTED" | "LOST" | "DECLINED" | "EXPIRED" | "CANCELLED";
  service: Service;
  recipientEmail: string;
  recipientName: string | null;
  notes: string | null;
  quotedPriceCents: number | null;
  quotedNotes: string | null;
  quotedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  partnerName: string | null;
  companyName: string | null;
}

export interface UnassignedTaskOption {
  id: string;
  title: string;
  category: string;
  startAt: string;
  durationMinutes: number;
}

export interface AssignablePartner {
  id: string;
  name: string;
  kind: string;
  companyName: string | null;
}

interface Props {
  moveRequestId: string;
  partners: PartnerOption[];
  companies?: CompanyOption[];
  contacts?: ContactOption[];
  acceptedSlotAt?: Date | null;
  requests: QuoteRequestRow[];
  /** Tasks of the move-request that have no assignee yet. */
  unassignedTasks?: UnassignedTaskOption[];
  /** Partners that can be assigned to a task (carrierPartner rows). */
  assignablePartners?: AssignablePartner[];
}

export function PartnerQuoteSection({
  moveRequestId,
  partners,
  companies = [],
  contacts = [],
  acceptedSlotAt,
  requests,
  unassignedTasks = [],
  assignablePartners = [],
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <section className="cx-card">
      <header className="flex items-start justify-between gap-3 border-b border-border px-3 py-2.5">
        <div>
          <h2 className="cx-h2">Συνεργάτες</h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Ζήτησε προσφορά ή ανάθεσε γρήγορα εργασίες σε συνεργάτη.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md bg-[var(--cx-accent)] px-2.5 text-[11px] font-semibold text-primary-foreground cx-transition cx-press hover:opacity-90"
        >
          <Plus className="size-3" />
          Νέο αίτημα
        </button>
      </header>

      {/* Quick-assign: tasks without an assignee */}
      {unassignedTasks.length > 0 && assignablePartners.length > 0 && (
        <div className="border-b border-border px-3 py-2">
          <div className="mb-1.5 flex items-center gap-2">
            <span className="cx-eyebrow">Εργασίες χωρίς ανάθεση</span>
            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-amber-800 ring-1 ring-inset ring-amber-200">
              {unassignedTasks.length}
            </span>
          </div>
          <ul className="divide-y divide-[var(--cx-divider)]">
            {unassignedTasks.map((t) => (
              <li key={t.id}>
                <UnassignedTaskRow task={t} partners={assignablePartners} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {requests.length === 0 ? (
        <div className="px-3 py-4 text-center">
          <p className="text-[11px] text-muted-foreground">
            Δεν έχεις στείλει αιτήματα προσφοράς ακόμη.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-[var(--cx-divider)]">
          {requests.map((r) => (
            <li key={r.id}>
              <QuoteRequestCard request={r} />
            </li>
          ))}
        </ul>
      )}

      {open && (
        <NewRequestDialog
          moveRequestId={moveRequestId}
          partners={partners}
          companies={companies}
          contacts={contacts}
          acceptedSlotAt={acceptedSlotAt ?? null}
          onClose={() => setOpen(false)}
        />
      )}
    </section>
  );
}

const CATEGORY_LABEL: Record<string, string> = {
  PREP: "Προετοιμασία", LOADING: "Φόρτωση", UNLOADING: "Ξεφόρτωμα",
  CRANE: "Γερανός", TRANSIT: "Διαδρομή", ASSEMBLY: "Συναρμολόγηση",
  DISASSEMBLY: "Αποσυναρμολόγηση", STORAGE: "Αποθήκευση", CLEANUP: "Καθαρισμός",
  OTHER: "Άλλο",
};

function UnassignedTaskRow({
  task, partners,
}: {
  task: UnassignedTaskOption;
  partners: AssignablePartner[];
}) {
  const [open, setOpen] = useState(false);
  const [justAssigned, setJustAssigned] = useState<string | null>(null);
  const router = useRouter();
  const start = new Date(task.startAt);

  return (
    <>
      <div className="flex items-center gap-2.5 py-1.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-[12px] font-semibold">{task.title}</p>
            {justAssigned && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-800 ring-1 ring-inset ring-emerald-200">
                <CheckCircle2 className="size-2.5" />
                Ανατέθηκε
              </span>
            )}
          </div>
          <p className="truncate text-[10px] text-muted-foreground">
            {CATEGORY_LABEL[task.category] ?? task.category} ·{" "}
            <span className="tabular-nums">
              {start.toLocaleDateString("el-GR", { day: "2-digit", month: "short" })}{" "}
              {start.toLocaleTimeString("el-GR", { hour: "2-digit", minute: "2-digit" })}
            </span>
            {" · "}{task.durationMinutes}′
          </p>
          {justAssigned && (
            <p className="truncate text-[10px] text-emerald-700">→ {justAssigned}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="Ανάθεση σε συνεργάτη"
          className="grid size-7 shrink-0 place-items-center rounded-md border border-border bg-card text-muted-foreground cx-transition cx-press hover:border-[var(--cx-accent)] hover:text-[var(--cx-accent)] active:bg-[var(--cx-accent-soft)]"
        >
          <UserPlus className="size-3.5" />
        </button>
      </div>
      {open && (
        <AssignPartnerDialog
          task={task}
          partners={partners}
          onClose={() => setOpen(false)}
          onAssigned={(partnerName) => {
            setJustAssigned(partnerName);
            setOpen(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function AssignPartnerDialog({
  task, partners, onClose, onAssigned,
}: {
  task: UnassignedTaskOption;
  partners: AssignablePartner[];
  onClose: () => void;
  onAssigned: (partnerName: string) => void;
}) {
  const [selectedId, setSelectedId] = useState<string>(partners[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleAssign() {
    if (!selectedId) {
      setError("Επέλεξε συνεργάτη.");
      return;
    }
    const partner = partners.find((p) => p.id === selectedId);
    if (!partner) {
      setError("Άκυρος συνεργάτης.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await assignJobTaskPartner(task.id, partner.id);
      if (res.ok) {
        onAssigned(partner.name + (partner.companyName ? ` (${partner.companyName})` : ""));
      } else {
        setError(res.error ?? "Η ανάθεση απέτυχε.");
      }
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ανάθεση σε συνεργάτη</DialogTitle>
          <DialogDescription>{task.title}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          <label className="cx-eyebrow">Συνεργάτης</label>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            disabled={pending}
            className="h-9 w-full rounded-md border border-border bg-background px-2.5 text-[13px] outline-none focus:border-[var(--cx-accent)] focus:ring-1 focus:ring-[var(--cx-accent)]"
          >
            {partners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}{p.companyName ? ` — ${p.companyName}` : ""} · {p.kind}
              </option>
            ))}
          </select>
        </div>
        {error && (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-800">
            {error}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={onClose}>Άκυρο</Button>
          <Button onClick={handleAssign} disabled={pending || !selectedId}>
            {pending ? "Παρακαλώ…" : "Ανάθεση"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function QuoteRequestCard({ request: r }: { request: QuoteRequestRow }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const svc = SERVICES.find((s) => s.value === r.service);

  const STATUS_MAP: Record<
    QuoteRequestRow["status"],
    { label: string; cls: string; icon: typeof Clock }
  > = {
    PENDING: { label: "Στάλθηκε", cls: "bg-amber-50 text-amber-800", icon: Clock },
    QUOTED: {
      label: "Έλαβες προσφορά",
      cls: "bg-emerald-50 text-emerald-800",
      icon: CheckCircle2,
    },
    ACCEPTED: {
      label: "Επιλέχθηκε",
      cls: "bg-indigo-50 text-indigo-800",
      icon: CheckCircle2,
    },
    LOST: {
      label: "Δεν επιλέχθηκε",
      cls: "bg-secondary text-muted-foreground",
      icon: XCircle,
    },
    DECLINED: { label: "Αρνήθηκε", cls: "bg-rose-50 text-rose-700", icon: XCircle },
    EXPIRED: { label: "Έληξε", cls: "bg-secondary text-muted-foreground", icon: Clock },
    CANCELLED: {
      label: "Ακυρώθηκε",
      cls: "bg-secondary text-muted-foreground",
      icon: XCircle,
    },
  };
  const STATUS = STATUS_MAP[r.status];
  const StatusIcon = STATUS.icon;

  const cancel = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Ακύρωση του αιτήματος προσφοράς;")) return;
    start(async () => {
      const res = await cancelPartnerQuoteRequest(r.id);
      if (res.ok) router.refresh();
      else alert(res.error);
    });
  };

  return (
    <div className="flex items-start gap-3 p-4">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--color-brand-blue-light)] text-[var(--color-brand-blue-deep)]">
        <Receipt className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-bold text-foreground">
            {svc?.emoji} {svc?.label ?? r.service}
          </p>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
              STATUS.cls,
            )}
          >
            <StatusIcon className="size-3" />
            {STATUS.label}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {r.recipientName ?? r.recipientEmail}
          {r.companyName && ` · ${r.companyName}`}
        </p>
        {r.notes && (
          <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
            «{r.notes}»
          </p>
        )}
        {r.status === "QUOTED" && r.quotedPriceCents != null && (
          <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50/60 p-2.5">
            <div className="flex items-baseline justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-800">
                Προσφορά
              </span>
              <span className="font-display text-xl font-bold tabular-nums text-emerald-900">
                {(r.quotedPriceCents / 100).toFixed(0)}€
              </span>
            </div>
            {r.quotedNotes && (
              <p className="mt-1 text-[11px] text-emerald-800/90">
                {r.quotedNotes}
              </p>
            )}
            <p className="mt-1 text-[10px] text-emerald-700/70">
              {r.quotedAt && new Date(r.quotedAt).toLocaleString("el-GR")}
            </p>
          </div>
        )}
      </div>
      {r.status === "PENDING" && (
        <button
          type="button"
          onClick={cancel}
          disabled={pending}
          className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
          title="Ακύρωση αιτήματος"
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <X className="size-4" />
          )}
        </button>
      )}
    </div>
  );
}

function NewRequestDialog({
  moveRequestId,
  partners,
  companies,
  contacts,
  acceptedSlotAt,
  onClose,
}: {
  moveRequestId: string;
  partners: PartnerOption[];
  companies: CompanyOption[];
  contacts: ContactOption[];
  acceptedSlotAt: Date | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Unified picker — selectKey is the serialized target ("kind:id")
  const [selectKey, setSelectKey] = useState<string>("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [service, setService] = useState<Service>("CRANE");
  const [notes, setNotes] = useState("");
  const [validHours, setValidHours] = useState("72");

  // Scheduling fields — pre-filled from accepted slot when available
  const [scheduledStartAt, setScheduledStartAt] = useState<string>(() =>
    acceptedSlotAt ? toLocalInput(new Date(acceptedSlotAt)) : "",
  );
  const [hours, setHours] = useState<string>("2");

  const totalOptions = partners.length + companies.length + contacts.length;

  const onPickTarget = (key: string) => {
    setSelectKey(key);
    if (!key) return;
    const [kind, id] = key.split(":");
    if (kind === "partner") {
      const p = partners.find((x) => x.id === id);
      if (p) {
        setRecipientName(p.name);
        if (p.email) setRecipientEmail(p.email);
      }
    } else if (kind === "company") {
      const c = companies.find((x) => x.id === id);
      if (c) {
        setRecipientName(c.name);
        if (c.email) setRecipientEmail(c.email);
      }
    } else if (kind === "contact") {
      const c = contacts.find((x) => x.id === id);
      if (c) {
        setRecipientName(`${c.name}${c.role ? ` (${c.role})` : ""}`);
        if (c.email) setRecipientEmail(c.email);
      }
    }
  };

  const parsedTarget = (): Target | null => {
    if (!selectKey) return null;
    const [kind, id] = selectKey.split(":");
    if (kind === "partner" || kind === "company" || kind === "contact") {
      return { kind, id };
    }
    return null;
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const target = parsedTarget();
    let partnerId: string | undefined;
    let partnerCompanyId: string | undefined;
    let partnerContactId: string | undefined;
    if (target) {
      if (target.kind === "partner") {
        const p = partners.find((x) => x.id === target.id);
        partnerId = p?.id;
        partnerCompanyId = p?.companyId ?? undefined;
      } else if (target.kind === "company") {
        partnerCompanyId = target.id;
      } else if (target.kind === "contact") {
        const c = contacts.find((x) => x.id === target.id);
        partnerContactId = c?.id;
        partnerCompanyId = c?.companyId;
      }
    }
    start(async () => {
      const res = await requestPartnerQuote({
        moveRequestId,
        partnerId,
        partnerCompanyId,
        partnerContactId,
        recipientEmail,
        recipientName,
        service,
        notes: notes || undefined,
        validHours,
        scheduledStartAt: scheduledStartAt
          ? new Date(scheduledStartAt).toISOString()
          : undefined,
        estimatedMinutes: hours
          ? Math.max(15, Math.round(Number(hours) * 60))
          : undefined,
      });
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
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-base font-bold text-foreground">
              Νέο αίτημα προσφοράς από συνεργάτη
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Στέλνουμε email με τα στοιχεία της μεταφοράς. Ο συνεργάτης απαντά
              μέσω secure link χωρίς να χρειάζεται λογαριασμό.
            </p>
            {acceptedSlotAt && (
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                <CheckCircle2 className="size-3" />
                Επιβεβαιωμένη μεταφορά · slot {formatDt(new Date(acceptedSlotAt))}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-secondary"
          >
            <X className="size-4" />
          </button>
        </div>

        <Field label="Υπηρεσία">
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {SERVICES.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => setService(s.value)}
                className={cn(
                  "inline-flex h-10 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors",
                  service === s.value
                    ? "border-[var(--color-brand-blue)] bg-[var(--color-brand-blue-light)] text-[var(--color-brand-blue-deep)]"
                    : "border-border bg-background text-muted-foreground hover:bg-secondary",
                )}
              >
                <span>{s.emoji}</span>
                <span className="truncate">{s.label}</span>
              </button>
            ))}
          </div>
        </Field>

        {/* Unified picker — partners + companies + contacts */}
        <Field label="Παραλήπτης" className="mt-3">
          {totalOptions === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-secondary/30 p-3 text-center">
              <p className="text-xs text-muted-foreground">
                Δεν έχεις καταχωρήσει συνεργάτες ακόμη.
              </p>
              <Link
                href="/carrier/partners"
                className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-md bg-foreground px-3 text-[11px] font-bold text-background"
              >
                Διαχείριση συνεργατών
              </Link>
            </div>
          ) : (
            <select
              value={selectKey}
              onChange={(e) => onPickTarget(e.target.value)}
              className="h-10 w-full rounded-lg border-2 border-border bg-white px-3 text-sm font-medium outline-none focus:border-[var(--color-brand-blue)]"
            >
              <option value="">— Επέλεξε ή πληκτρολόγησε νέο παρακάτω —</option>
              {partners.length > 0 && (
                <optgroup label="👤 Πρόσωπα (συνεργάτες)">
                  {partners.map((p) => (
                    <option key={p.id} value={`partner:${p.id}`}>
                      {p.name}
                      {p.companyName ? ` · ${p.companyName}` : ""}
                      {p.email ? ` (${p.email})` : ""}
                    </option>
                  ))}
                </optgroup>
              )}
              {companies.length > 0 && (
                <optgroup label="🏢 Εταιρείες">
                  {companies.map((c) => (
                    <option key={c.id} value={`company:${c.id}`}>
                      {c.name} · ΑΦΜ {c.vat}
                      {c.email ? ` (${c.email})` : ""}
                    </option>
                  ))}
                </optgroup>
              )}
              {contacts.length > 0 && (
                <optgroup label="📇 Επαφές εταιρειών">
                  {contacts.map((c) => (
                    <option key={c.id} value={`contact:${c.id}`}>
                      {c.name}
                      {c.role ? ` (${c.role})` : ""} · {c.companyName}
                      {c.email ? ` — ${c.email}` : ""}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          )}
        </Field>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Όνομα παραλήπτη">
            <input
              required
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              className="h-10 w-full rounded-lg border-2 border-border bg-white px-3 text-sm font-medium outline-none focus:border-[var(--color-brand-blue)]"
              placeholder="π.χ. Δημήτρης Σταύρου"
            />
          </Field>
          <Field label="Email παραλήπτη">
            <input
              type="email"
              required
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              className="h-10 w-full rounded-lg border-2 border-border bg-white px-3 text-sm font-medium outline-none focus:border-[var(--color-brand-blue)]"
              placeholder="name@example.com"
            />
          </Field>
        </div>

        {/* Scheduled start + duration */}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Πρόγραμμα έναρξης">
            <input
              type="datetime-local"
              value={scheduledStartAt}
              onChange={(e) => setScheduledStartAt(e.target.value)}
              className="h-10 w-full rounded-lg border-2 border-border bg-white px-3 text-sm font-medium outline-none focus:border-[var(--color-brand-blue)]"
            />
            {acceptedSlotAt && (
              <span className="text-[10px] text-emerald-700">
                Από slot πελάτη
              </span>
            )}
          </Field>
          <Field label="Διάρκεια (ώρες)">
            <input
              type="number"
              min={0.25}
              step={0.25}
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              className="h-10 w-full rounded-lg border-2 border-border bg-white px-3 text-sm font-bold tabular-nums outline-none focus:border-[var(--color-brand-blue)]"
            />
          </Field>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {[0.5, 1, 2, 3, 4, 6, 8].map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => setHours(String(h))}
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-[10px] font-semibold transition-colors",
                hours === String(h)
                  ? "border-[var(--color-brand-blue)] bg-[var(--color-brand-blue-light)] text-[var(--color-brand-blue-deep)]"
                  : "border-border bg-background text-muted-foreground hover:text-foreground",
              )}
            >
              {h}h
            </button>
          ))}
        </div>

        <Field label="Σημείωση προς συνεργάτη (προαιρετικό)" className="mt-3">
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="π.χ. 3ος όροφος χωρίς ασανσέρ, βαριά αντικείμενα, ειδική πρόσβαση..."
            className="w-full rounded-lg border-2 border-border bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-brand-blue)]"
          />
        </Field>

        <Field label="Ισχύς αιτήματος (ώρες)" className="mt-3">
          <div className="flex gap-1.5">
            {[24, 48, 72, 168].map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setValidHours(String(h))}
                className={cn(
                  "flex-1 rounded-md border px-2 py-1.5 text-xs font-semibold transition-colors",
                  validHours === String(h)
                    ? "border-[var(--color-brand-blue)] bg-[var(--color-brand-blue-light)] text-[var(--color-brand-blue-deep)]"
                    : "border-border bg-background text-muted-foreground hover:text-foreground",
                )}
              >
                {h < 168 ? `${h}h` : "1 εβδ."}
              </button>
            ))}
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
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--color-brand-blue)] px-4 text-sm font-bold text-white hover:bg-[var(--color-brand-blue-deep)] disabled:opacity-50"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            Αποστολή
          </button>
        </div>
      </form>
    </div>
  );
}

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDt(d: Date): string {
  return new Intl.DateTimeFormat("el-GR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
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
