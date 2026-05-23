import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHero } from "@/components/shared/page-hero";
import { CarrierCalendar, type CalendarEvent } from "@/components/carrier/calendar";

export const metadata = { title: "Ημερολόγιο" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ view?: string; date?: string }>;
}

export default async function CarrierCalendarPage({ searchParams }: PageProps) {
  const session = await auth();
  const userId = session!.user.id;
  const params = await searchParams;
  const view = (params.view as "month" | "week" | "day") ?? "month";
  const anchorDate = params.date ?? new Date().toISOString().slice(0, 10);

  // Window: ±3 months to cover any view easily without re-querying on nav.
  const center = new Date(anchorDate + "T00:00:00");
  const windowStart = new Date(center);
  windowStart.setMonth(center.getMonth() - 2);
  windowStart.setDate(1);
  const windowEnd = new Date(center);
  windowEnd.setMonth(center.getMonth() + 3);
  windowEnd.setDate(0);

  const [jobs, offers, leads] = await Promise.all([
    // Awarded jobs (won moves) with date
    db.moveRequest.findMany({
      where: {
        status: { in: ["AWARDED", "COMPLETED"] },
        offers: { some: { carrierUserId: userId, status: "ACCEPTED" } },
        preferredDate: { gte: windowStart, lte: windowEnd },
      },
      orderBy: { preferredDate: "asc" },
      include: {
        offers: {
          where: { carrierUserId: userId, status: "ACCEPTED" },
          select: { priceCents: true },
          take: 1,
        },
        user: { select: { name: true, email: true } },
      },
    }),
    // My OPEN offers (so I see what's pending & when it expires)
    db.offer.findMany({
      where: {
        carrierUserId: userId,
        status: "OPEN",
        validUntil: { gte: windowStart, lte: windowEnd },
      },
      orderBy: { validUntil: "asc" },
      include: {
        moveRequest: {
          select: {
            id: true,
            fromAddress: true,
            toAddress: true,
            preferredDate: true,
          },
        },
      },
    }),
    // Available leads (opportunities) with a preferred date in window
    db.moveRequest.findMany({
      where: {
        status: "PUBLISHED",
        offers: { none: { carrierUserId: userId } },
        preferredDate: { gte: windowStart, lte: windowEnd },
      },
      orderBy: { preferredDate: "asc" },
      take: 100,
      select: {
        id: true,
        fromAddress: true,
        toAddress: true,
        preferredDate: true,
        itemsCount: true,
        totalVolumeM3: true,
      },
    }),
  ]);

  const events: CalendarEvent[] = [
    ...jobs.map<CalendarEvent>((j) => ({
      id: `job-${j.id}`,
      kind: "job",
      title: shortRoute(j.fromAddress, j.toAddress),
      subtitle: j.user.name ?? j.user.email ?? "Πελάτης",
      date: (j.preferredDate ?? j.createdAt).toISOString(),
      flexDays: j.flexDays,
      priceCents: j.offers[0]?.priceCents ?? null,
      itemsCount: j.itemsCount,
      volumeM3: j.totalVolumeM3,
      href: `/carrier/leads/${j.id}`,
      stageHint: j.status === "COMPLETED" ? "DELIVERED" : "SCHEDULED",
    })),
    ...offers.map<CalendarEvent>((o) => ({
      id: `offer-${o.id}`,
      kind: "offer-expiry",
      title: `Λήγει: ${shortRoute(o.moveRequest.fromAddress, o.moveRequest.toAddress)}`,
      subtitle: `Προσφορά ${(o.priceCents / 100).toFixed(0)}€`,
      date: o.validUntil.toISOString(),
      priceCents: o.priceCents,
      itemsCount: null,
      volumeM3: null,
      href: `/carrier/leads/${o.moveRequestId}`,
      stageHint: "OPEN",
    })),
    ...leads.map<CalendarEvent>((l) => ({
      id: `lead-${l.id}`,
      kind: "opportunity",
      title: shortRoute(l.fromAddress, l.toAddress),
      subtitle: `${l.itemsCount} τεμ · ${l.totalVolumeM3.toFixed(1)} m³`,
      date: l.preferredDate!.toISOString(),
      priceCents: null,
      itemsCount: l.itemsCount,
      volumeM3: l.totalVolumeM3,
      href: `/carrier/leads/${l.id}`,
      stageHint: "PUBLISHED",
    })),
  ];

  const summary = {
    jobs: jobs.length,
    offers: offers.length,
    leads: leads.length,
    revenueCents: jobs.reduce((s, j) => s + (j.offers[0]?.priceCents ?? 0), 0),
  };

  return (
    <>
      <PageHero
        eyebrow="Planning"
        title="Ημερολόγιο"
        description="Όλη η εικόνα — ανατεθειμένες μεταφορές, λήξεις προσφορών, ευκαιρίες — σε ένα ενιαίο calendar."
        crumbs={[{ href: "/carrier", label: "Επισκόπηση" }, { label: "Ημερολόγιο" }]}
        tone="blue"
        kpis={[
          { label: "Ανατεθειμένες", value: summary.jobs },
          { label: "Λήξεις προσφορών", value: summary.offers },
          { label: "Ευκαιρίες", value: summary.leads },
          {
            label: "Έσοδα παραθύρου",
            value: `${(summary.revenueCents / 100).toFixed(0)}€`,
          },
        ]}
      />
      <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <CarrierCalendar
          initialView={view}
          initialDate={anchorDate}
          events={events}
        />
      </div>
    </>
  );
}

function shortRoute(from: string, to: string): string {
  const a = from.split(",").map((s) => s.trim()).filter(Boolean)[1] ?? from;
  const b = to.split(",").map((s) => s.trim()).filter(Boolean)[1] ?? to;
  return `${a} → ${b}`;
}
