"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Globe,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Receipt,
  Search,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { SendOtpButton } from "./send-otp-button";
import { SetPasswordButton } from "./set-password-button";

export interface AdminTenantRow {
  id: string;
  vat: string;
  legalName: string;
  commercialName: string | null;
  doyName: string | null;
  address: string | null;
  addressNo: string | null;
  postalZip: string | null;
  postalArea: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  status: string;
  logoUrl: string | null;
  createdAt: Date;
  branchCount: number;
  vehicleCount: number;
  subscription: {
    status: string;
    planName: string;
    pricePerCycle: number | null;
    billingCycle: string;
    endsAt: Date | null;
  } | null;
}

interface Props {
  rows: AdminTenantRow[];
  page: number;
  totalPages: number;
  total: number;
  initialQuery: string;
  pageSize: number;
  withSubCount: number;
}

export function TenantsListClient({
  rows,
  page,
  totalPages,
  total,
  initialQuery,
  pageSize,
  withSubCount,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, start] = useTransition();
  const [query, setQuery] = useState(initialQuery);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Debounced URL update on search.
  useEffect(() => {
    const t = setTimeout(() => {
      if (query === initialQuery) return;
      start(() => {
        const params = new URLSearchParams(searchParams.toString());
        if (query.trim()) params.set("q", query.trim());
        else params.delete("q");
        params.delete("page"); // reset paging on new search
        router.push(`/admin/tenants?${params.toString()}`);
      });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const goToPage = (p: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (p > 1) params.set("page", String(p));
    else params.delete("page");
    start(() => {
      router.push(`/admin/tenants?${params.toString()}`);
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3 shadow-[var(--shadow-card)] sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Αναζήτηση με όνομα, ΑΦΜ, email, τηλέφωνο…"
            className="h-10 w-full rounded-lg border border-border bg-background pl-10 pr-9 text-sm outline-none focus:border-[var(--color-brand-blue)]"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-secondary"
            >
              <X className="size-3.5" />
            </button>
          )}
          {pending && (
            <Loader2 className="absolute right-9 top-1/2 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          {total === 0
            ? "Καμία εγγραφή"
            : `${total} εγγραφές · σελίδα ${page}/${totalPages} · με συνδρομή: ${withSubCount}`}
        </div>
      </div>

      {/* Results */}
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
          <Building2 className="mx-auto size-10 text-muted-foreground" />
          <p className="mt-3 text-sm font-semibold">Δεν βρέθηκε κανένας πελάτης</p>
          <p className="text-xs text-muted-foreground">
            Δοκίμασε άλλη αναζήτηση ή καθάρισε το φίλτρο.
          </p>
        </div>
      ) : (
        <ul className="grid gap-2">
          {rows.map((t) => (
            <li key={t.id}>
              <TenantAccordionRow
                t={t}
                expanded={expanded === t.id}
                onToggle={() =>
                  setExpanded((e) => (e === t.id ? null : t.id))
                }
              />
            </li>
          ))}
        </ul>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between rounded-xl border border-border bg-card p-3 text-sm">
          <span className="text-xs text-muted-foreground">
            Εμφανίζονται {(page - 1) * pageSize + 1}–
            {Math.min(page * pageSize, total)} από {total}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 1 || pending}
              onClick={() => goToPage(page - 1)}
              className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-background px-2.5 text-xs font-semibold hover:bg-secondary disabled:opacity-40"
            >
              <ChevronLeft className="size-3.5" />
              Προηγ.
            </button>
            <PageNumbers
              page={page}
              totalPages={totalPages}
              onSelect={goToPage}
              disabled={pending}
            />
            <button
              type="button"
              disabled={page >= totalPages || pending}
              onClick={() => goToPage(page + 1)}
              className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-background px-2.5 text-xs font-semibold hover:bg-secondary disabled:opacity-40"
            >
              Επόμ.
              <ChevronRight className="size-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TenantAccordionRow({
  t,
  expanded,
  onToggle,
}: {
  t: AdminTenantRow;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border bg-card shadow-[var(--shadow-card)] transition-all",
        expanded
          ? "border-[var(--color-brand-blue)]/40"
          : "border-border hover:border-[var(--color-brand-blue)]/30",
      )}
    >
      {/* Summary header */}
      <div className="grid items-center gap-3 p-4 sm:grid-cols-[1.6fr_1fr_1fr_auto_auto_auto]">
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-3 text-left"
        >
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform",
              expanded && "rotate-180",
            )}
          />
          {t.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={t.logoUrl}
              alt={t.legalName}
              className="size-10 rounded-lg border border-border bg-card object-contain p-0.5"
            />
          ) : (
            <span className="grid size-10 place-items-center rounded-lg bg-[var(--color-brand-blue-light)] text-[var(--color-brand-blue-deep)]">
              <Building2 className="size-5" />
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-bold text-foreground">
              {t.commercialName ?? t.legalName}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              ΑΦΜ {t.vat} {t.doyName && `· ${t.doyName}`}
            </p>
          </div>
        </button>

        <div className="text-xs text-muted-foreground">
          <p>
            <strong className="text-foreground">{t.branchCount}</strong>{" "}
            υποκαταστήματα
          </p>
          <p>
            <strong className="text-foreground">{t.vehicleCount}</strong>{" "}
            οχήματα
          </p>
        </div>

        <div className="text-xs">
          {t.subscription ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700">
              {t.subscription.planName}
            </span>
          ) : (
            <span className="rounded-full bg-secondary px-2 py-1 text-[10px] font-bold uppercase text-muted-foreground">
              Χωρίς συνδρομή
            </span>
          )}
        </div>

        <StatusBadge status={t.status} />

        <SendOtpButton tenantId={t.id} />
        <SetPasswordButton tenantId={t.id} />

        <Link
          href={`/admin/tenants/${t.id}`}
          className="inline-flex size-8 items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:bg-secondary hover:text-foreground"
          title="Πλήρης σελίδα"
        >
          <ExternalLink className="size-3.5" />
        </Link>
      </div>

      {/* Accordion content */}
      {expanded && <ExpandedTabs t={t} />}
    </div>
  );
}

function ExpandedTabs({ t }: { t: AdminTenantRow }) {
  const [tab, setTab] = useState<"profile" | "contact" | "subscription">(
    "profile",
  );
  return (
    <div className="border-t border-border bg-secondary/30 p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        <TabBtn active={tab === "profile"} onClick={() => setTab("profile")}>
          Στοιχεία
        </TabBtn>
        <TabBtn active={tab === "contact"} onClick={() => setTab("contact")}>
          Επικοινωνία
        </TabBtn>
        <TabBtn
          active={tab === "subscription"}
          onClick={() => setTab("subscription")}
        >
          Συνδρομή
        </TabBtn>
        <span className="ml-auto flex items-center gap-1.5">
          <Link
            href={`/admin/tenants/${t.id}/edit`}
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-[11px] font-semibold hover:bg-secondary"
          >
            <Pencil className="size-3" />
            Επεξεργασία
          </Link>
          <Link
            href={`/admin/tenants/${t.id}`}
            className="inline-flex h-7 items-center gap-1.5 rounded-md bg-foreground px-2.5 text-[11px] font-bold text-background hover:bg-foreground/90"
          >
            Πλήρης διαχείριση
            <ExternalLink className="size-3" />
          </Link>
        </span>
      </div>

      {tab === "profile" && (
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KV label="Επωνυμία" value={t.legalName} />
          <KV label="Διακριτικό" value={t.commercialName ?? "—"} />
          <KV label="ΑΦΜ" value={t.vat} />
          <KV label="ΔΟΥ" value={t.doyName ?? "—"} />
          <KV
            label="Διεύθυνση"
            value={
              [t.address, t.addressNo].filter(Boolean).join(" ") || "—"
            }
            colSpan={2}
          />
          <KV
            label="Τ.Κ. / Περιοχή"
            value={
              [t.postalZip, t.postalArea].filter(Boolean).join(" · ") || "—"
            }
            colSpan={2}
          />
        </dl>
      )}

      {tab === "contact" && (
        <div className="grid gap-2 sm:grid-cols-2">
          <ContactRow icon={Mail} label="Email" value={t.email} />
          <ContactRow icon={Phone} label="Τηλέφωνο" value={t.phone} />
          <ContactRow
            icon={Globe}
            label="Website"
            value={t.website}
            href={t.website ?? undefined}
          />
          <ContactRow
            icon={MapPin}
            label="Έδρα"
            value={
              [t.address, t.addressNo, t.postalZip, t.postalArea]
                .filter(Boolean)
                .join(", ") || null
            }
          />
        </div>
      )}

      {tab === "subscription" && (
        <div>
          {t.subscription ? (
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <KV label="Πακέτο" value={t.subscription.planName} />
              <KV label="Κατάσταση" value={t.subscription.status} />
              <KV
                label="Κύκλος"
                value={t.subscription.billingCycle}
              />
              <KV
                label="Τιμή/κύκλο"
                value={
                  t.subscription.pricePerCycle != null
                    ? `${(t.subscription.pricePerCycle / 100).toFixed(2)}€`
                    : "—"
                }
              />
              <KV
                label="Λήγει"
                value={
                  t.subscription.endsAt
                    ? new Date(t.subscription.endsAt).toLocaleDateString("el-GR")
                    : "—"
                }
                colSpan={2}
              />
            </dl>
          ) : (
            <div className="flex items-center gap-2 rounded-lg bg-background p-3 text-sm text-muted-foreground">
              <Receipt className="size-4" />
              Δεν υπάρχει ενεργή συνδρομή. Άνοιξε την «Πλήρης διαχείριση» για ανάθεση πακέτου.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PageNumbers({
  page,
  totalPages,
  onSelect,
  disabled,
}: {
  page: number;
  totalPages: number;
  onSelect: (p: number) => void;
  disabled: boolean;
}) {
  // Compact pager: show first, last, current ±1 (with ellipses).
  const nums = new Set<number>([1, totalPages, page - 1, page, page + 1]);
  const list = Array.from(nums)
    .filter((n) => n >= 1 && n <= totalPages)
    .sort((a, b) => a - b);

  const out: Array<number | "..."> = [];
  let prev = 0;
  for (const n of list) {
    if (n - prev > 1) out.push("...");
    out.push(n);
    prev = n;
  }

  return (
    <div className="flex items-center gap-1">
      {out.map((n, i) =>
        n === "..." ? (
          <span key={`g-${i}`} className="px-1.5 text-xs text-muted-foreground">
            …
          </span>
        ) : (
          <button
            key={n}
            type="button"
            disabled={disabled || n === page}
            onClick={() => onSelect(n)}
            className={cn(
              "h-8 min-w-8 rounded-md px-2 text-xs font-semibold transition-colors",
              n === page
                ? "bg-foreground text-background"
                : "border border-border bg-background hover:bg-secondary",
            )}
          >
            {n}
          </button>
        ),
      )}
    </div>
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
        "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
        active
          ? "bg-foreground text-background"
          : "bg-background text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function KV({
  label,
  value,
  colSpan,
}: {
  label: string;
  value: string;
  colSpan?: number;
}) {
  return (
    <div
      className="rounded-lg border border-border bg-background px-3 py-2"
      style={colSpan ? { gridColumn: `span ${colSpan}` } : undefined}
    >
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm font-semibold text-foreground">{value}</dd>
    </div>
  );
}

function ContactRow({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: typeof Mail;
  label: string;
  value: string | null;
  href?: string;
}) {
  const content = value ?? "—";
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-border bg-background px-3 py-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        {href && value ? (
          <a
            href={href.startsWith("http") ? href : `https://${href}`}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-semibold text-[var(--color-brand-blue)] hover:underline"
          >
            {value}
          </a>
        ) : (
          <p className="truncate text-sm font-semibold text-foreground">
            {content}
          </p>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    ACTIVE: { label: "Ενεργός", cls: "bg-emerald-50 text-emerald-700" },
    PAUSED: { label: "Παύση", cls: "bg-amber-50 text-amber-700" },
    SUSPENDED: { label: "Αναστολή", cls: "bg-red-50 text-red-700" },
  };
  const e = map[status] ?? {
    label: status,
    cls: "bg-secondary text-foreground",
  };
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide",
        e.cls,
      )}
    >
      {e.label}
    </span>
  );
}
