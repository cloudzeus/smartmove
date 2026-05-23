import { Settings } from "lucide-react";

import { PageHero } from "@/components/shared/page-hero";
import { ComingSoonPanel } from "@/components/carrier/coming-soon";

export const metadata = { title: "Ρυθμίσεις" };

export default function CarrierSettingsPage() {
  return (
    <>
      <PageHero
        eyebrow="Preferences"
        title="Ρυθμίσεις"
        description="Διαχειρίσου ειδοποιήσεις, ώρες λειτουργίας και προτιμήσεις προβολής."
        crumbs={[{ href: "/carrier", label: "Επισκόπηση" }, { label: "Ρυθμίσεις" }]}
      />
      <div className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
        <ComingSoonPanel
          icon={Settings}
          title="Ρυθμίσεις εταιρείας — έρχεται σύντομα"
          description="Ειδοποιήσεις email/push, ώρες εξυπηρέτησης, προτιμώμενοι τύποι μεταφορών, αυτόματα φίλτρα leads, και άλλα."
          features={[
            "Email / push ειδοποιήσεις",
            "Ώρες εργασίας & διακοπές",
            "Αυτόματα φίλτρα νέων αιτημάτων",
            "Πρότυπα προσφοράς",
          ]}
          alternate={{
            label: "Διαχείριση χρηστών",
            href: "/carrier/team",
          }}
        />
      </div>
    </>
  );
}
