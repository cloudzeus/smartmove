import Link from "next/link";
import { CreditCard, Receipt, ShieldCheck, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHero } from "@/components/shared/page-hero";
import { EmptyState } from "@/components/dashboard/empty-state";

export const metadata = { title: "Πληρωμές" };
export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  const session = await auth();
  const userId = session!.user.id;
  const [bookingPayments, scanFees, retentionPayments] = await Promise.all([
    db.payment.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        moveRequest: { select: { fromAddress: true, toAddress: true } },
      },
    }),
    db.scanFee.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        moveRequest: {
          select: { id: true, fromAddress: true, toAddress: true },
        },
      },
    }),
    db.retentionPayment.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const empty =
    bookingPayments.length === 0 &&
    scanFees.length === 0 &&
    retentionPayments.length === 0;

  const totalPaidCents =
    bookingPayments
      .filter((p) => p.status === "CAPTURED")
      .reduce((s, p) => s + p.amountCents, 0) +
    scanFees
      .filter((f) => f.status === "PAID")
      .reduce((s, f) => s + f.amountCents, 0) +
    retentionPayments
      .filter((r) => r.status === "PAID")
      .reduce((s, r) => s + r.amountCents, 0);
  const pendingCount =
    bookingPayments.filter((p) => p.status === "PENDING").length +
    scanFees.filter((f) => f.status === "PENDING").length +
    retentionPayments.filter((r) => r.status === "PENDING").length;

  return (
    <>
      <PageHero
        eyebrow="Billing"
        title="Πληρωμές"
        description="Όλες οι συναλλαγές: χρεώσεις AI scan ανά αίτημα, παρατάσεις διατήρησης δεδομένων και πληρωμές μεταφορών μέσω escrow."
        crumbs={[
          { href: "/dashboard", label: "Επισκόπηση" },
          { label: "Πληρωμές" },
        ]}
        tone="emerald"
        kpis={[
          { label: "Σύνολο πληρωμών", value: bookingPayments.length + scanFees.length + retentionPayments.length },
          { label: "Συνολικά πληρωμένα", value: `${(totalPaidCents / 100).toFixed(0)}€`, deltaTone: "positive" },
          { label: "Σε εκκρεμότητα", value: pendingCount, deltaTone: pendingCount > 0 ? "neutral" : "positive" },
          { label: "AI scan", value: scanFees.length },
        ]}
      />
      <div className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
        {empty ? (
          <EmptyState
            icon={CreditCard}
            title="Δεν υπάρχει ιστορικό πληρωμών"
            description="Όταν χρησιμοποιήσεις AI scan ή κάνεις παράταση διατήρησης δεδομένων, οι χρεώσεις σου θα εμφανίζονται εδώ — όλες σε ένα μέρος, με νόμιμα παραστατικά."
            cta={{ label: "Νέο αίτημα", href: "/scan" }}
          />
        ) : (
          <div className="flex flex-col gap-8">
            {scanFees.length > 0 && (
              <FeeSection
                icon={Sparkles}
                title="AI Scan — χρεώσεις ανά αίτημα"
                hint="€1 ανά μεταφορά που χρησιμοποίησε AI σκανάρισμα. Καλύπτει το κόστος της Google Gemini API."
              >
                <ul className="grid gap-3">
                  {scanFees.map((f) => (
                    <PaymentRow
                      key={f.id}
                      title={
                        f.moveRequest
                          ? `${f.moveRequest.fromAddress} → ${f.moveRequest.toAddress}`
                          : "AI Scan"
                      }
                      subtitle={`Αναφορά #${f.moveRequest?.id?.slice(-8).toUpperCase() ?? f.id.slice(-8).toUpperCase()}`}
                      href={f.moveRequest ? `/dashboard/requests/${f.moveRequest.id}` : undefined}
                      amountCents={f.amountCents}
                      status={f.status}
                      docType={f.documentType}
                      createdAt={f.createdAt}
                    />
                  ))}
                </ul>
              </FeeSection>
            )}

            {retentionPayments.length > 0 && (
              <FeeSection
                icon={ShieldCheck}
                title="Παρατάσεις διατήρησης δεδομένων"
                hint="Πληρωμές για παράταση της περιόδου διατήρησης πέρα από το δωρεάν παράθυρο."
              >
                <ul className="grid gap-3">
                  {retentionPayments.map((p) => (
                    <PaymentRow
                      key={p.id}
                      title={`Παράταση +${p.monthsAdded} ${p.monthsAdded === 1 ? "μήνας" : "μήνες"}`}
                      subtitle={`Νέα λήξη: ${formatDate(p.extendsUntil)}`}
                      amountCents={p.amountCents}
                      status={p.status}
                      docType={p.documentType}
                      createdAt={p.createdAt}
                    />
                  ))}
                </ul>
              </FeeSection>
            )}

            {bookingPayments.length > 0 && (
              <FeeSection
                icon={Receipt}
                title="Πληρωμές μεταφορών (escrow)"
                hint="Το ποσό δεσμεύεται και αποδίδεται στον μεταφορέα όταν επιβεβαιωθεί η παράδοση."
              >
                <ul className="grid gap-3">
                  {bookingPayments.map((p) => (
                    <PaymentRow
                      key={p.id}
                      title={`${p.moveRequest.fromAddress} → ${p.moveRequest.toAddress}`}
                      subtitle={p.provider}
                      amountCents={p.amountCents}
                      status={p.status}
                      createdAt={p.createdAt}
                    />
                  ))}
                </ul>
              </FeeSection>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function FeeSection({
  icon: Icon,
  title,
  hint,
  children,
}: {
  icon: typeof CreditCard;
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <header className="mb-3 flex items-center gap-2.5">
        <span className="grid size-8 place-items-center rounded-lg bg-[var(--color-brand-blue-light)] text-[var(--color-brand-blue-deep)]">
          <Icon className="size-4" />
        </span>
        <div>
          <h2 className="font-display text-base font-bold text-foreground">
            {title}
          </h2>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

function PaymentRow({
  title,
  subtitle,
  href,
  amountCents,
  status,
  docType,
  createdAt,
}: {
  title: string;
  subtitle?: string;
  href?: string;
  amountCents: number;
  status: string;
  docType?: string | null;
  createdAt: Date;
}) {
  const content = (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)] sm:grid sm:grid-cols-[1fr_auto_auto_auto] sm:items-center sm:gap-3">
      <div className="flex items-start justify-between gap-3 sm:min-w-0 sm:block">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{title}</p>
          {subtitle && (
            <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
          )}
          <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
            {formatDate(createdAt)}
          </p>
        </div>
        <span className="shrink-0 font-display text-lg font-bold tabular-nums text-foreground sm:hidden">
          {(amountCents / 100).toFixed(2)}€
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3 sm:contents sm:mt-0 sm:border-0 sm:pt-0">
        {docType && (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
              docType === "INVOICE"
                ? "bg-[var(--color-brand-blue-light)] text-[var(--color-brand-blue-deep)]"
                : "bg-secondary text-muted-foreground",
            )}
          >
            {docType === "INVOICE" ? "Τιμολόγιο" : "Απόδειξη"}
          </span>
        )}
        <StatusBadge status={status} />
        <span className="ml-auto hidden font-display text-lg font-bold tabular-nums text-foreground sm:inline">
          {(amountCents / 100).toFixed(2)}€
        </span>
      </div>
    </div>
  );
  return <li>{href ? <Link href={href}>{content}</Link> : content}</li>;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    PENDING: "bg-amber-50 text-amber-700",
    PAID: "bg-emerald-50 text-emerald-700",
    AUTHORIZED: "bg-emerald-50 text-emerald-700",
    CAPTURED: "bg-emerald-50 text-emerald-700",
    FAILED: "bg-red-50 text-red-700",
    REFUNDED: "bg-secondary text-foreground",
    WAIVED: "bg-secondary text-muted-foreground",
    EXPIRED: "bg-secondary text-muted-foreground",
  };
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide",
        map[status] ?? "bg-secondary text-foreground",
      )}
    >
      {status}
    </span>
  );
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("el-GR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}
