import { PageHero } from "@/components/shared/page-hero";
import { listLeads } from "@/server/actions/carrier-leads.action";
import { LeadsClient } from "@/components/carrier/leads-client";

export const metadata = { title: "Νέα αιτήματα" };
export const dynamic = "force-dynamic";

export default async function CarrierLeadsPage() {
  const leads = await listLeads();
  const open = leads.filter((l) => !l.myOffer).length;
  const bidded = leads.filter((l) => l.myOffer).length;

  return (
    <>
      <PageHero
        eyebrow="Marketplace"
        title="Νέα αιτήματα"
        description="Όλα τα δημοσιευμένα αιτήματα μεταφοράς. Υπέβαλε προσφορά. Τα στοιχεία πελάτη αποκαλύπτονται μόνο εάν κερδίσεις."
        crumbs={[
          { href: "/carrier", label: "Επισκόπηση" },
          { label: "Νέα αιτήματα" },
        ]}
        kpis={[
          { label: "Διαθέσιμα", value: leads.length },
          { label: "Νέα προς εσένα", value: open, deltaTone: "positive" },
          { label: "Έχεις προσφέρει", value: bidded },
        ]}
      />
      <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <LeadsClient leads={leads} />
      </div>
    </>
  );
}
