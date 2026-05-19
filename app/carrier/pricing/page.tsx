import { PageHero } from "@/components/shared/page-hero";
import { listCatalogWithMyPrices } from "@/server/actions/carrier-pricing.action";
import { PricingClient } from "@/components/carrier/pricing-client";

export const metadata = { title: "Τιμολόγιο" };
export const dynamic = "force-dynamic";

export default async function CarrierPricingPage() {
  const items = await listCatalogWithMyPrices();
  const set = items.filter((i) => i.price).length;

  return (
    <>
      <PageHero
        eyebrow="Pricing"
        title="Τιμολόγιο μεταφορέα"
        description="Όρισε τιμές για κάθε αντικείμενο. Αυτές χρησιμοποιούνται ως default όταν υποβάλεις προσφορά — μπορείς να τις αλλάξεις ad-hoc σε κάθε αίτημα."
        crumbs={[
          { href: "/carrier", label: "Επισκόπηση" },
          { label: "Τιμολόγιο" },
        ]}
        kpis={[
          { label: "Items στον κατάλογο", value: items.length },
          {
            label: "Με τιμή",
            value: set,
            delta: `${Math.round((set / Math.max(1, items.length)) * 100)}%`,
            deltaTone: set === items.length ? "positive" : "neutral",
          },
          {
            label: "Χωρίς τιμή",
            value: items.length - set,
            deltaTone: items.length - set === 0 ? "positive" : "neutral",
          },
        ]}
      />
      <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <PricingClient items={items} />
      </div>
    </>
  );
}
