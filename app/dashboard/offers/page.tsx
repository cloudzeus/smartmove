import { Receipt } from "lucide-react";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHero } from "@/components/shared/page-hero";
import { EmptyState } from "@/components/dashboard/empty-state";

export const metadata = { title: "Προσφορές" };
export const dynamic = "force-dynamic";

export default async function OffersPage() {
  const session = await auth();
  const userId = session!.user.id;
  const offers = await db.offer.findMany({
    where: { moveRequest: { userId } },
    orderBy: { createdAt: "desc" },
    include: {
      moveRequest: { select: { id: true, fromAddress: true, toAddress: true } },
      carrier: { select: { name: true, email: true } },
    },
  });

  const openOffers = offers.filter((o) => o.status === "OPEN").length;
  const acceptedOffers = offers.filter((o) => o.status === "ACCEPTED").length;
  const avgPrice =
    offers.length > 0
      ? offers.reduce((s, o) => s + o.priceCents, 0) / offers.length / 100
      : 0;

  return (
    <>
      <PageHero
        eyebrow="Carrier Bids"
        title="Προσφορές"
        description="Όλες οι προσφορές που έχεις λάβει από επαληθευμένους μεταφορείς, σε όλα τα αιτήματά σου."
        crumbs={[
          { href: "/dashboard", label: "Επισκόπηση" },
          { label: "Προσφορές" },
        ]}
        tone="amber"
        kpis={[
          { label: "Σύνολο προσφορών", value: offers.length },
          { label: "Σε αναμονή", value: openOffers, deltaTone: openOffers > 0 ? "positive" : "neutral" },
          { label: "Αποδεκτές", value: acceptedOffers, deltaTone: "positive" },
          { label: "Μέση τιμή", value: avgPrice > 0 ? `${avgPrice.toFixed(0)}€` : "—" },
        ]}
      />
      <div className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
        {offers.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="Καμία προσφορά ακόμα"
            description="Μόλις δημιουργήσεις αίτημα μεταφοράς, οι επαληθευμένοι μεταφορείς της περιοχής σου θα στέλνουν εδώ τις προσφορές τους — συνήθως μέσα σε 30–60 λεπτά."
            cta={{ label: "Δες τα αιτήματά μου", href: "/dashboard/requests" }}
            secondaryCta={{ label: "Νέο αίτημα", href: "/scan" }}
          />
        ) : (
          <ul className="grid gap-3">
            {offers.map((o) => (
              <li
                key={o.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-0.5 hover:border-[var(--color-brand-blue)]/30 hover:shadow-[0_10px_30px_rgba(15,23,42,0.08)] sm:p-5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground sm:text-base">
                    {o.carrier.name ?? o.carrier.email}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {o.moveRequest.fromAddress} → {o.moveRequest.toAddress}
                  </p>
                </div>
                <span className="shrink-0 font-display text-lg font-bold tabular-nums text-[var(--color-brand-blue-deep)] sm:text-xl">
                  {(o.priceCents / 100).toFixed(0)}€
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
