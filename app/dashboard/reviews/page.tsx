import { Star } from "lucide-react";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHero } from "@/components/shared/page-hero";
import { EmptyState } from "@/components/dashboard/empty-state";

export const metadata = { title: "Αξιολογήσεις" };
export const dynamic = "force-dynamic";

export default async function ReviewsPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [reviewsGiven, completed] = await Promise.all([
    db.review.findMany({
      where: { authorUserId: userId },
      orderBy: { createdAt: "desc" },
      include: {
        carrier: { select: { name: true, email: true } },
        moveRequest: { select: { fromAddress: true, toAddress: true } },
      },
    }),
    db.moveRequest.findMany({
      where: {
        userId,
        status: "COMPLETED",
        review: null,
      },
      select: { id: true, fromAddress: true, toAddress: true },
    }),
  ]);

  const avgRating =
    reviewsGiven.length > 0
      ? reviewsGiven.reduce((s, r) => s + r.rating, 0) / reviewsGiven.length
      : 0;

  return (
    <>
      <PageHero
        eyebrow="Reviews"
        title="Αξιολογήσεις"
        description="Αξιολόγησε κάθε μεταφορέα που χρησιμοποίησες. Οι κριτικές σου βοηθούν άλλους πελάτες να επιλέξουν με ασφάλεια."
        crumbs={[
          { href: "/dashboard", label: "Επισκόπηση" },
          { label: "Αξιολογήσεις" },
        ]}
        tone="amber"
        kpis={[
          { label: "Κριτικές μου", value: reviewsGiven.length },
          { label: "Περιμένουν αξιολόγηση", value: completed.length, deltaTone: completed.length > 0 ? "neutral" : "positive" },
          { label: "Μέσος όρος", value: avgRating > 0 ? `${avgRating.toFixed(1)} ★` : "—" },
          { label: "5 αστέρων", value: reviewsGiven.filter((r) => r.rating === 5).length },
        ]}
      />
      <div className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
        {completed.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 font-display text-base font-bold text-foreground">
              Περιμένουν αξιολόγηση ({completed.length})
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {completed.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/50 p-4"
                >
                  <span className="text-sm font-semibold text-foreground">
                    {c.fromAddress} → {c.toAddress}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-800">
                    Αξιολόγησε →
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {reviewsGiven.length === 0 && completed.length === 0 ? (
          <EmptyState
            icon={Star}
            title="Καμία αξιολόγηση ακόμα"
            description="Όταν ολοκληρωθεί μια μεταφορά σου, θα μπορείς να αξιολογήσεις τον μεταφορέα και να μοιραστείς την εμπειρία σου με άλλους πελάτες."
            cta={{ label: "Δες τα αιτήματά μου", href: "/dashboard/requests" }}
          />
        ) : reviewsGiven.length === 0 ? null : (
          <section>
            <h2 className="mb-3 font-display text-base font-bold text-foreground">
              Οι κριτικές μου
            </h2>
            <ul className="grid gap-3">
              {reviewsGiven.map((r) => (
                <li
                  key={r.id}
                  className="rounded-2xl border border-border bg-card p-5"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-foreground">
                        {r.carrier.name ?? r.carrier.email}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {r.moveRequest.fromAddress} → {r.moveRequest.toAddress}
                      </p>
                    </div>
                    <div className="flex">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={
                            i < r.rating
                              ? "size-4 fill-amber-400 stroke-amber-400"
                              : "size-4 text-muted-foreground/30"
                          }
                        />
                      ))}
                    </div>
                  </div>
                  {r.comment && (
                    <p className="mt-3 text-sm text-muted-foreground">
                      {r.comment}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
