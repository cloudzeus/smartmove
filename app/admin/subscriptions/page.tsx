import Link from "next/link";
import { Receipt } from "lucide-react";

import { cn } from "@/lib/utils";
import { db } from "@/lib/db";
import { AdminPageHero } from "@/components/admin/page-hero";
import { EmptyState } from "@/components/dashboard/empty-state";

export const metadata = { title: "Admin · Συνδρομές" };
export const dynamic = "force-dynamic";

export default async function SubscriptionsPage() {
  const subs = await db.subscription.findMany({
    orderBy: { createdAt: "desc" },
    include: { tenant: true, plan: true },
  });

  const counts = {
    active: subs.filter((s) => s.status === "ACTIVE").length,
    trial: subs.filter((s) => s.status === "TRIAL").length,
    paused: subs.filter((s) => s.status === "PAUSED").length,
    cancelled: subs.filter((s) => s.status === "CANCELLED").length,
  };
  const mrr =
    subs
      .filter((s) => s.status === "ACTIVE" && s.billingCycle === "MONTHLY")
      .reduce((sum, s) => sum + (s.pricePerCycle ?? s.plan.pricePerMonthCents), 0) /
    100;

  return (
    <>
      <AdminPageHero
        eyebrow="Revenue"
        title="Ενεργές συνδρομές"
        description="Όλες οι συνδρομές πελατών (trial, ενεργές, σε παύση, ακυρωμένες) με την τρέχουσα μηνιαία τιμή και το commission ανά μεταφορά."
        crumbs={[
          { href: "/admin", label: "Admin" },
          { label: "Συνδρομές" },
        ]}
        tone="emerald"
        kpis={[
          { label: "Ενεργές", value: counts.active, deltaTone: "positive" },
          { label: "Σε trial", value: counts.trial, deltaTone: "neutral" },
          { label: "Σε παύση", value: counts.paused, deltaTone: "neutral" },
          { label: "MRR", value: `${mrr.toFixed(0)}€`, delta: "monthly", deltaTone: "neutral" },
        ]}
      />
      <div className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
        {subs.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="Καμία συνδρομή ακόμα"
            description="Δημιούργησε πακέτα και μετά ανάθεσέ τα σε πελάτες από τη σελίδα του κάθε tenant."
            cta={{ label: "Πήγαινε στα πακέτα", href: "/admin/plans" }}
          />
        ) : (
          <ul className="grid gap-3">
            {subs.map((s) => (
              <li
                key={s.id}
                className="grid items-center gap-3 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] sm:grid-cols-[1.5fr_1fr_1fr_1fr_auto]"
              >
                <Link
                  href={`/admin/tenants/${s.tenantId}`}
                  className="font-semibold text-foreground hover:text-[var(--color-brand-blue)]"
                >
                  {s.tenant.commercialName ?? s.tenant.legalName}
                  <p className="text-[11px] font-normal text-muted-foreground">
                    ΑΦΜ {s.tenant.vat}
                  </p>
                </Link>
                <span className="text-xs">
                  <span className="rounded-full bg-[var(--color-brand-blue-light)] px-2.5 py-1 text-xs font-bold text-[var(--color-brand-blue-deep)]">
                    {s.plan.name}
                  </span>
                </span>
                <span className="font-display text-base font-bold text-foreground">
                  {((s.pricePerCycle ?? s.plan.pricePerMonthCents) / 100).toFixed(0)}€
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    / {s.billingCycle.toLowerCase()}
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">
                  Commission{" "}
                  <strong className="text-foreground">
                    {s.commissionPct ?? s.plan.commissionPct}%
                  </strong>
                </span>
                <StatusBadge status={s.status} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    TRIAL: "bg-amber-50 text-amber-700",
    ACTIVE: "bg-emerald-50 text-emerald-700",
    PAUSED: "bg-secondary text-muted-foreground",
    CANCELLED: "bg-red-50 text-red-700",
    EXPIRED: "bg-secondary text-muted-foreground",
  };
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide",
        map[status] ?? "bg-secondary text-foreground",
      )}
    >
      {status}
    </span>
  );
}
