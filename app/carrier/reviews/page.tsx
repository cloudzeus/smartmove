import { Star } from "lucide-react";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHero } from "@/components/shared/page-hero";
import { EmptyState } from "@/components/dashboard/empty-state";

export const metadata = { title: "Αξιολογήσεις" };
export const dynamic = "force-dynamic";

export default async function CarrierReviewsPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [reviews, agg] = await Promise.all([
    db.review.findMany({
      where: { carrierUserId: userId },
      orderBy: { createdAt: "desc" },
      include: {
        author: { select: { name: true, email: true } },
        moveRequest: { select: { fromAddress: true, toAddress: true } },
      },
    }),
    db.review.aggregate({
      where: { carrierUserId: userId },
      _avg: { rating: true },
      _count: { _all: true },
    }),
  ]);

  const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of reviews) dist[r.rating] = (dist[r.rating] ?? 0) + 1;
  const total = reviews.length;
  const avg = agg._avg.rating ?? 0;
  const fiveStars = dist[5] ?? 0;

  return (
    <>
      <PageHero
        eyebrow="Reputation"
        title="Αξιολογήσεις"
        description="Τι σου λένε οι πελάτες σου. Διαβάζοντας ξεχωρίζεις τι πάει καλά και τι μπορεί να βελτιωθεί."
        crumbs={[{ href: "/carrier", label: "Επισκόπηση" }, { label: "Αξιολογήσεις" }]}
        tone="amber"
        kpis={[
          { label: "Μέσος όρος", value: total > 0 ? `${avg.toFixed(1)} ★` : "—" },
          { label: "Σύνολο", value: total },
          { label: "5 αστέρια", value: fiveStars, deltaTone: "positive" },
          {
            label: "Ποσοστό 5★",
            value: total > 0 ? `${Math.round((fiveStars / total) * 100)}%` : "—",
            deltaTone: "positive",
          },
        ]}
      />

      <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {total === 0 ? (
          <EmptyState
            icon={Star}
            title="Καμία αξιολόγηση ακόμη"
            description="Όταν ολοκληρώνεις μια μεταφορά, ο πελάτης μπορεί να σε αξιολογήσει. Οι κριτικές θα εμφανίζονται εδώ."
            cta={{ label: "Δες μεταφορές", href: "/carrier/jobs" }}
          />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
            {/* Distribution */}
            <section className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
              <h2 className="font-display text-base font-bold text-foreground">
                Κατανομή βαθμολογιών
              </h2>
              <ul className="mt-4 flex flex-col gap-2">
                {[5, 4, 3, 2, 1].map((stars) => {
                  const count = dist[stars] ?? 0;
                  const pct = total > 0 ? (count / total) * 100 : 0;
                  return (
                    <li key={stars} className="flex items-center gap-3">
                      <span className="inline-flex w-10 items-center gap-1 text-xs font-bold tabular-nums text-foreground">
                        {stars}
                        <Star className="size-3 fill-amber-400 stroke-amber-400" />
                      </span>
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full bg-amber-400"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-8 text-right text-xs font-semibold tabular-nums text-muted-foreground">
                        {count}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>

            {/* Review list */}
            <section className="flex flex-col gap-3">
              {reviews.map((r) => (
                <article
                  key={r.id}
                  className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]"
                >
                  <header className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-foreground">
                        {r.author?.name ?? r.author?.email ?? "Πελάτης"}
                      </p>
                      {r.moveRequest && (
                        <p className="truncate text-xs text-muted-foreground">
                          {r.moveRequest.fromAddress} → {r.moveRequest.toAddress}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0">
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
                  </header>
                  {r.comment && (
                    <p className="mt-3 text-sm text-foreground">{r.comment}</p>
                  )}
                  <p className="mt-3 text-[11px] text-muted-foreground">
                    {new Intl.DateTimeFormat("el-GR", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    }).format(r.createdAt)}
                  </p>
                </article>
              ))}
            </section>
          </div>
        )}
      </div>
    </>
  );
}
