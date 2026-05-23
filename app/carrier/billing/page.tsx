import { ClipboardList, Wallet } from "lucide-react";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHero } from "@/components/shared/page-hero";
import { ComingSoonPanel } from "@/components/carrier/coming-soon";

export const metadata = { title: "Συνδρομή" };
export const dynamic = "force-dynamic";

export default async function CarrierBillingPage() {
  const session = await auth();
  const userId = session!.user.id;

  // Real revenue snapshot so the page has value even before the subscription
  // & invoice UI ships.
  const [paymentsAll, last30] = await Promise.all([
    db.payment.aggregate({
      _sum: { amountCents: true },
      _count: { _all: true },
      where: { status: "CAPTURED", offer: { carrierUserId: userId } },
    }),
    db.payment.aggregate({
      _sum: { amountCents: true },
      _count: { _all: true },
      where: {
        status: "CAPTURED",
        offer: { carrierUserId: userId },
        createdAt: { gte: new Date(Date.now() - 30 * 86400 * 1000) },
      },
    }),
  ]);

  const lifetimeEur = (paymentsAll._sum.amountCents ?? 0) / 100;
  const last30Eur = (last30._sum.amountCents ?? 0) / 100;

  return (
    <>
      <PageHero
        eyebrow="Finance"
        title="Συνδρομή & έσοδα"
        description="Δες τα έσοδά σου από το marketplace και διαχειρίσου τη συνδρομή σου."
        crumbs={[{ href: "/carrier", label: "Επισκόπηση" }, { label: "Συνδρομή" }]}
        tone="emerald"
        kpis={[
          { label: "Έσοδα lifetime", value: `${lifetimeEur.toFixed(0)}€` },
          { label: "Πληρωμές", value: paymentsAll._count._all },
          { label: "Έσοδα 30 ημ.", value: `${last30Eur.toFixed(0)}€`, deltaTone: "positive" },
          { label: "Πληρωμές 30 ημ.", value: last30._count._all },
        ]}
      />
      <div className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
        <ComingSoonPanel
          icon={Wallet}
          title="Διαχείριση συνδρομής — έρχεται σύντομα"
          description="Εδώ θα μπορείς να δεις και να αλλάξεις το πακέτο σου, να κατεβάσεις τιμολόγια και να ορίσεις τρόπο πληρωμής."
          features={[
            "Πλάνα Trial / Active / Pro",
            "Λήψη τιμολογίων PDF",
            "Auto-renewal & ακύρωση",
            "Όριο χρηστών & vehicle slots",
          ]}
          alternate={{
            label: "Δες τα οικονομικά σου",
            href: "/carrier/jobs",
          }}
        />
      </div>
    </>
  );
}
