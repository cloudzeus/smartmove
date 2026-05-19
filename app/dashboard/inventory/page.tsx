import { PackageOpen } from "lucide-react";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHero } from "@/components/shared/page-hero";
import { EmptyState } from "@/components/dashboard/empty-state";
import { InventoryBoard } from "@/components/dashboard/inventory/inventory-board";

export const metadata = { title: "Έπιπλα" };
export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [items, locations] = await Promise.all([
    db.savedItem.findMany({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: "desc" },
    }),
    db.savedLocation.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
      select: { id: true, name: true, type: true, city: true },
    }),
  ]);

  const totalQty = items.reduce((s, i) => s + i.quantity, 0);
  const totalVolume = items.reduce(
    (s, i) => s + i.volume_m3 * i.quantity,
    0,
  );
  const itemsWithoutLocation = items.filter((i) => !i.locationId).length;

  return (
    <>
      <PageHero
        eyebrow="My Inventory"
        title="Τα έπιπλά μου"
        description="Όλα τα αντικείμενά σου ταξινομημένα ανά τοποθεσία. Όταν δημιουργείς αίτημα μεταφοράς, διαλέγεις από την έτοιμη λίστα — χωρίς να ξαναπληκτρολογήσεις τίποτα."
        crumbs={[
          { href: "/dashboard", label: "Επισκόπηση" },
          { label: "Τα έπιπλά μου" },
        ]}
        tone="emerald"
        kpis={[
          { label: "Αντικείμενα", value: totalQty },
          { label: "Όγκος (m³)", value: totalVolume.toFixed(2) },
          { label: "Τοποθεσίες", value: locations.length },
          {
            label: "Χωρίς location",
            value: itemsWithoutLocation,
            deltaTone: itemsWithoutLocation > 0 ? "neutral" : "positive",
          },
        ]}
      />

      <div className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
        {items.length === 0 ? (
          <EmptyState
            icon={PackageOpen}
            title="Δεν έχεις προσθέσει έπιπλα ακόμα"
            description="Φτιάξε τη ψηφιακή σου λίστα: καναπέδες, κρεβάτια, ηλεκτρικές συσκευές, κουτιά… ταξινομημένα ανά τοποθεσία (σπίτι, εξοχικό, αποθήκη)."
            cta={{ label: "Πρόσθεσε το πρώτο αντικείμενο", href: "#" }}
            secondaryCta={{
              label: "Δες πρώτα τις διευθύνσεις",
              href: "/dashboard/locations",
            }}
          />
        ) : (
          <InventoryBoard items={items} locations={locations} />
        )}
      </div>
    </>
  );
}
