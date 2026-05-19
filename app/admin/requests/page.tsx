import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { AdminPageHero } from "@/components/admin/page-hero";
import {
  RequestsClient,
  type AdminRequest,
} from "@/components/admin/requests-client";

export const metadata = { title: "Admin · Αιτήματα" };
export const dynamic = "force-dynamic";

export default async function AdminRequestsPage() {
  const requests = await db.moveRequest.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { id: true, name: true, email: true } },
      _count: { select: { offers: true } },
    },
  });

  const items: AdminRequest[] = requests.map((r) => ({
    id: r.id,
    status: r.status,
    type: r.type,
    fromAddress: r.fromAddress,
    toAddress: r.toAddress,
    fromLat: r.fromLat,
    fromLng: r.fromLng,
    toLat: r.toLat,
    toLng: r.toLng,
    preferredDate: r.preferredDate,
    publishedAt: r.publishedAt,
    createdAt: r.createdAt,
    itemsCount: r.itemsCount,
    totalVolumeM3: r.totalVolumeM3,
    estimatedPriceMinCents: r.estimatedPriceMinCents,
    estimatedPriceMaxCents: r.estimatedPriceMaxCents,
    offersCount: r._count.offers,
    user: {
      id: r.user.id,
      name: r.user.name,
      email: r.user.email,
    },
  }));

  const count = (s: AdminRequest["status"]) =>
    items.filter((r) => r.status === s).length;

  return (
    <>
      <AdminPageHero
        eyebrow="Operations"
        title="Αιτήματα μεταφοράς"
        description="Όλα τα αιτήματα που έχουν δημιουργήσει οι πελάτες, με κατάσταση και προσφορές μεταφορέων."
        crumbs={[
          { href: "/admin", label: "Admin" },
          { label: "Αιτήματα" },
        ]}
        kpis={[
          { label: "Σύνολο", value: items.length },
          {
            label: "Ενεργά",
            value: count("PUBLISHED") + count("AWARDED"),
            deltaTone: "positive",
          },
          { label: "Ολοκληρωμένα", value: count("COMPLETED") },
          { label: "Ακυρωμένα", value: count("CANCELLED"), deltaTone: "negative" },
        ]}
      />
      <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <RequestsClient
          requests={items}
          maptilerApiKey={env.maptilerApiKey()}
        />
      </div>
    </>
  );
}
