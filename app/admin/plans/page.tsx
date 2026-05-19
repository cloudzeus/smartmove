import { db } from "@/lib/db";
import { AdminPageHero } from "@/components/admin/page-hero";
import { PlansListClient } from "@/components/admin/plans-list-client";

export const metadata = { title: "Admin · Πακέτα συνδρομών" };
export const dynamic = "force-dynamic";

export default async function PlansPage() {
  const plans = await db.subscriptionPlan.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { subscriptions: true } },
    },
  });

  const active = plans.filter((p) => p.isActive).length;
  const totalSubs = plans.reduce((s, p) => s + p._count.subscriptions, 0);
  const avgCommission =
    plans.length > 0
      ? plans.reduce((s, p) => s + p.commissionPct, 0) / plans.length
      : 0;

  return (
    <>
      <AdminPageHero
        eyebrow="Pricing"
        title="Πακέτα συνδρομών"
        description="Κάθε πακέτο περιλαμβάνει όρια (υποκαταστήματα, χρήστες, οχήματα, jobs), feature flags και commission % ανά μεταφορά."
        crumbs={[
          { href: "/admin", label: "Admin" },
          { label: "Πακέτα" },
        ]}
        tone="emerald"
        kpis={[
          { label: "Σύνολο πακέτων", value: plans.length },
          { label: "Ενεργά", value: active, deltaTone: "positive" },
          { label: "Συνδρομές", value: totalSubs },
          { label: "Μέσο commission", value: `${avgCommission.toFixed(1)}%` },
        ]}
      />
      <div className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
        <PlansListClient plans={plans} />
      </div>
    </>
  );
}
