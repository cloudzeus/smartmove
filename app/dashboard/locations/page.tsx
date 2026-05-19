import { MapPin } from "lucide-react";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHero } from "@/components/shared/page-hero";
import { EmptyState } from "@/components/dashboard/empty-state";
import { LocationCard } from "@/components/dashboard/locations/location-card";
import { LocationsActions } from "@/components/dashboard/locations/locations-actions";

export const metadata = { title: "Διευθύνσεις" };
export const dynamic = "force-dynamic";

export default async function LocationsPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [locations, historyCount, totalItems] = await Promise.all([
    db.savedLocation.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
      include: {
        _count: { select: { items: { where: { deletedAt: null } } } },
      },
    }),
    db.moveRequest.count({ where: { userId } }),
    db.savedItem.count({ where: { userId, deletedAt: null } }),
  ]);
  const primary = locations.find((l) => l.isPrimary);

  return (
    <>
      <PageHero
        eyebrow="My Places"
        title="Διευθύνσεις"
        description="Όλες οι τοποθεσίες σου σε ένα μέρος. Δώσε όνομα στο σπίτι, το γραφείο, την αποθήκη — για γρήγορη επιλογή σε μελλοντικά αιτήματα."
        crumbs={[
          { href: "/dashboard", label: "Επισκόπηση" },
          { label: "Διευθύνσεις" },
        ]}
        tone="amber"
        kpis={[
          { label: "Τοποθεσίες", value: locations.length },
          { label: "Κύρια", value: primary?.name ?? "—" },
          { label: "Έπιπλα σε αυτές", value: totalItems },
          { label: "Από ιστορικό", value: historyCount, delta: "διαθέσιμα", deltaTone: "neutral" },
        ]}
        action={<LocationsActions />}
      />

      <div className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
        {locations.length === 0 ? (
          <EmptyState
            icon={MapPin}
            title="Δεν έχεις προσθέσει διευθύνσεις"
            description={
              historyCount > 0
                ? `Έχεις ήδη χρησιμοποιήσει διευθύνσεις σε ${historyCount} αιτήματα — μπορείς να τις φέρεις απευθείας από το ιστορικό σου με ένα κλικ από το κουμπί "Από προηγούμενα αιτήματα" επάνω.`
                : "Πρόσθεσε τις τοποθεσίες που χρησιμοποιείς συχνά. Έτσι, κάθε φορά που δημιουργείς αίτημα μεταφοράς, τα στοιχεία συμπληρώνονται αυτόματα."
            }
          />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {locations.map((loc) => (
              <li key={loc.id}>
                <LocationCard location={loc} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
