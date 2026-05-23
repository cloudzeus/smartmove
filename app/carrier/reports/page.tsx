import { BarChart3 } from "lucide-react";

import { PageHero } from "@/components/shared/page-hero";
import { getCarrierReports, type ReportRange } from "@/server/actions/carrier-reports.action";
import { CarrierReportsClient } from "@/components/carrier/reports-client";

export const metadata = { title: "Αναφορές" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ range?: string }>;
}

function parseRange(v: string | undefined): ReportRange {
  return v === "quarter" || v === "ytd" ? v : "month";
}

export default async function CarrierReportsPage({ searchParams }: PageProps) {
  const { range: rangeParam } = await searchParams;
  const range = parseRange(rangeParam);
  const data = await getCarrierReports(range);

  const revenueEur = (data.totals.revenueCents / 100).toFixed(0);
  const hours = (data.totals.assignedMinutes / 60).toFixed(0);

  return (
    <>
      <PageHero
        eyebrow="Analytics"
        title="Αναφορές"
        description="Έσοδα ανά υπηρεσία, χρήση προσωπικού και κορυφαίες υπηρεσίες ανά περίοδο."
        crumbs={[{ href: "/carrier", label: "Επισκόπηση" }, { label: "Αναφορές" }]}
        tone="emerald"
        kpis={[
          { label: "Έσοδα", value: `${revenueEur}€` },
          { label: "Projects", value: data.totals.projectCount },
          { label: "Υπηρεσίες", value: data.totals.serviceCount },
          { label: "Ώρες εργασίας", value: `${hours}h` },
        ]}
      />
      <div className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
        {data.totals.serviceCount === 0 && data.totals.assignedMinutes === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white/60 p-10 text-center">
            <BarChart3 className="mx-auto h-10 w-10 text-zinc-400" />
            <h3 className="mt-3 text-base font-semibold text-zinc-800">
              Δεν υπάρχουν δεδομένα για αυτή την περίοδο
            </h3>
            <p className="mt-1 text-sm text-zinc-500">
              Δοκίμασε άλλο εύρος ή ολοκλήρωσε projects με υπηρεσίες και αναθέσεις.
            </p>
          </div>
        ) : (
          <CarrierReportsClient data={data} />
        )}
      </div>
    </>
  );
}
