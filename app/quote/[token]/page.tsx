import { notFound } from "next/navigation";
import {
  Building2,
  CheckCircle2,
  MapPin,
  Package,
  XCircle,
} from "lucide-react";

import { db } from "@/lib/db";
import { Logo } from "@/components/brand/logo";
import { PartnerQuoteFormClient } from "@/components/public/partner-quote-form-client";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ token: string }>;
}

const SERVICE_LABEL: Record<string, string> = {
  PACKING: "Αμπαλάζ / Πακετάρισμα",
  CRANE: "Γερανός",
  STORAGE: "Αποθήκευση",
  HANDYMAN: "Τεχνίτης",
  ELECTRICIAN: "Ηλεκτρολόγος",
  CARPENTER: "Ξυλουργός",
  OTHER: "Άλλη υπηρεσία",
};

export default async function PublicQuotePage({ params }: PageProps) {
  const { token } = await params;
  const row = await db.partnerQuoteRequest.findUnique({
    where: { token },
    include: {
      tenant: {
        select: { legalName: true, commercialName: true, phone: true, email: true },
      },
    },
  });
  if (!row) notFound();

  const tenantName =
    row.tenant.commercialName ?? row.tenant.legalName ?? "SmartMove";
  const snap = (row.moveSnapshotJson ?? {}) as {
    fromAddress?: string;
    toAddress?: string;
    preferredDate?: string;
    itemsCount?: number;
    totalVolumeM3?: number;
    scheduledStartAt?: string | null;
    estimatedMinutes?: number | null;
    stopAddress?: string;
    projectCode?: string;
  };
  // Prefer scheduled slot (carrier-confirmed) over the customer's preferred date.
  const slotAtIso =
    row.scheduledStartAt?.toISOString() ?? snap.scheduledStartAt ?? snap.preferredDate ?? null;
  const estMinutes = row.estimatedMinutes ?? snap.estimatedMinutes ?? null;
  const expired =
    row.status === "EXPIRED" ||
    (row.expiresAt && row.expiresAt < new Date());
  const closed =
    row.status === "QUOTED" ||
    row.status === "DECLINED" ||
    row.status === "CANCELLED" ||
    expired;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FBFCFE] via-white to-[var(--color-brand-blue-light)]/30 py-10 px-4">
      <div className="mx-auto max-w-2xl">
        <header className="mb-6 flex items-center justify-between gap-3">
          <Logo />
          <span className="rounded-full bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground shadow-sm ring-1 ring-border">
            Αίτημα προσφοράς
          </span>
        </header>

        <div className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-pop)] sm:p-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--color-brand-blue)]">
            {SERVICE_LABEL[row.service] ?? row.service}
          </p>
          <h1 className="mt-1 font-display text-2xl font-extrabold text-foreground sm:text-3xl">
            Γεια σου {row.recipientName ?? ""}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Η εταιρεία <strong className="text-foreground">{tenantName}</strong>{" "}
            ζητάει την προσφορά σου για μια μεταφορά.
          </p>

          {/* Work location (specific stop) — leads the email so partners
              in a single city know immediately if it concerns them. */}
          {snap.stopAddress && (
            <section className="mt-6 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800">
                📍 Σημείο εργασίας
              </p>
              <p className="mt-1.5 text-lg font-bold text-amber-950">
                {snap.stopAddress}
              </p>
              <p className="mt-2 text-[11px] italic text-amber-800">
                ⚠ Η εργασία αφορά αποκλειστικά αυτό το σημείο.
              </p>
            </section>
          )}

          {/* Move snapshot — secondary context */}
          <section className="mt-6 rounded-2xl border border-border bg-secondary/30 p-4">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              {snap.stopAddress ? "Συνολική διαδρομή (για context)" : "Στοιχεία μεταφοράς"}
            </p>
            <dl className="grid gap-2.5">
              <Row
                icon={MapPin}
                label="Παραλαβή"
                value={snap.fromAddress ?? "—"}
                iconClass="text-[var(--color-brand-blue)]"
              />
              <Row
                icon={MapPin}
                label="Παράδοση"
                value={snap.toAddress ?? "—"}
                iconClass="text-[var(--color-brand-red)]"
              />
              {slotAtIso && (
                <Row
                  icon={Building2}
                  label="Ημερομηνία & ώρα"
                  value={new Intl.DateTimeFormat("el-GR", {
                    weekday: "long",
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(new Date(slotAtIso))}
                />
              )}
              {estMinutes != null && (
                <Row
                  icon={Building2}
                  label="Εκτιμώμενη διάρκεια"
                  value={`${(estMinutes / 60).toFixed(1)} ώρες`}
                />
              )}
              {snap.itemsCount != null && (
                <Row
                  icon={Package}
                  label="Φορτίο"
                  value={`${snap.itemsCount} τεμ${snap.totalVolumeM3 != null ? ` · ${snap.totalVolumeM3.toFixed(1)} m³` : ""}`}
                />
              )}
            </dl>
            {row.notes && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-amber-800">
                  Σημείωση εταιρείας
                </p>
                <p className="mt-1 text-sm text-amber-900">{row.notes}</p>
              </div>
            )}
          </section>

          {/* Form or closed state */}
          {row.status === "PENDING" && !expired ? (
            <PartnerQuoteFormClient
              token={token}
              isCompany={!!row.partnerCompanyId}
            />
          ) : (
            <ClosedNotice
              status={row.status}
              quotedPriceCents={row.quotedPriceCents}
              expired={Boolean(expired)}
            />
          )}

          <footer className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-4 text-[11px] text-muted-foreground">
            <span>SmartMove — διαχείριση μεταφορών</span>
            {row.tenant.email && (
              <a
                href={`mailto:${row.tenant.email}`}
                className="font-semibold text-foreground hover:underline"
              >
                {row.tenant.email}
              </a>
            )}
          </footer>
        </div>
      </div>
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  value,
  iconClass,
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
  iconClass?: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className={`mt-0.5 size-4 shrink-0 ${iconClass ?? "text-muted-foreground"}`} />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="break-words text-sm font-semibold text-foreground">
          {value}
        </p>
      </div>
    </div>
  );
}

function ClosedNotice({
  status,
  quotedPriceCents,
  expired,
}: {
  status: string;
  quotedPriceCents: number | null;
  expired: boolean;
}) {
  if (status === "QUOTED" && quotedPriceCents != null) {
    return (
      <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
        <CheckCircle2 className="mx-auto size-10 text-emerald-600" />
        <p className="mt-2 font-display text-lg font-bold text-emerald-900">
          Η προσφορά σου καταχωρήθηκε
        </p>
        <p className="mt-1 text-sm text-emerald-800">
          Στάλθηκε στον μεταφορέα στα{" "}
          <strong className="font-display tabular-nums">
            {(quotedPriceCents / 100).toFixed(0)}€
          </strong>
          .
        </p>
      </div>
    );
  }
  return (
    <div className="mt-6 rounded-2xl border border-border bg-secondary/30 p-5 text-center">
      <XCircle className="mx-auto size-10 text-muted-foreground" />
      <p className="mt-2 font-display text-lg font-bold text-foreground">
        Το αίτημα δεν είναι πλέον ενεργό
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {expired
          ? "Έχει λήξει η προθεσμία υποβολής."
          : status === "CANCELLED"
            ? "Ο μεταφορέας ακύρωσε το αίτημα."
            : status === "DECLINED"
              ? "Είχε σημειωθεί ως άρνηση."
              : "Δεν είναι διαθέσιμο για υποβολή."}
      </p>
    </div>
  );
}
