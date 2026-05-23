import { MapPin } from "lucide-react";

import { PageHero } from "@/components/shared/page-hero";
import { ComingSoonPanel } from "@/components/carrier/coming-soon";

export const metadata = { title: "Υποκαταστήματα" };

export default function CarrierBranchesPage() {
  return (
    <>
      <PageHero
        eyebrow="Coverage"
        title="Υποκαταστήματα"
        description="Διαχειρίσου τα φυσικά POPs σου και τις ακτίνες εξυπηρέτησης ανά πόλη."
        crumbs={[
          { href: "/carrier", label: "Επισκόπηση" },
          { label: "Υποκαταστήματα" },
        ]}
        tone="amber"
      />
      <div className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
        <ComingSoonPanel
          icon={MapPin}
          title="Υποκαταστήματα — έρχεται σύντομα"
          description="Θα μπορείς να ορίσεις τα φυσικά σημεία της εταιρείας σου και την ακτίνα εξυπηρέτησης κάθε ενός. Το matching engine θα δείχνει μόνο αιτήματα που πέφτουν εντός της εμβέλειάς σου."
          features={[
            "Πολλαπλά POPs ανά εταιρεία",
            "Ακτίνα εξυπηρέτησης σε km",
            "Αυτόματη γεωκωδικοποίηση από διεύθυνση",
            "Στατιστικά αιτημάτων ανά υποκατάστημα",
          ]}
          alternate={{ label: "Δες τα οχήματά σου", href: "/carrier/fleet" }}
        />
      </div>
    </>
  );
}
