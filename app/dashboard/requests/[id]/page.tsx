import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Clock,
  Construction,
  MapPin,
  PackageOpen,
  Receipt,
  Repeat,
  ShieldCheck,
  Star,
  Truck,
} from "lucide-react";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/dashboard/empty-state";
import { RequestMap, type RouteStop } from "@/components/dashboard/request-map";
import { OfferAcceptList } from "@/components/dashboard/offer-accept-list";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

interface StoredItem {
  id?: string;
  name: string;
  quantity: number;
  length_cm: number;
  width_cm: number;
  height_cm: number;
  volume_m3: number;
  source?: string;
  photoUrl?: string;
  photoUploadedAt?: string;
  photoRetainUntil?: string | null;
}

export default async function RequestDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await auth();
  const userId = session!.user.id;

  const moveRequest = await db.moveRequest.findUnique({
    where: { id },
    include: {
      stops: { orderBy: { sequence: "asc" } },
      offers: {
        orderBy: { createdAt: "desc" },
        include: {
          carrier: {
            select: {
              id: true,
              name: true,
              email: true,
              tenantMemberships: {
                select: {
                  tenant: {
                    select: { commercialName: true, legalName: true },
                  },
                },
                take: 1,
              },
            },
          },
        },
      },
      payment: true,
      review: true,
    },
  });

  if (!moveRequest || moveRequest.userId !== userId) {
    notFound();
  }

  const items = (moveRequest.itemsJson as unknown as StoredItem[]) ?? [];
  const ref = moveRequest.id.slice(-8).toUpperCase();
  const maptilerKey = env.maptilerApiKey();

  const routeStops: RouteStop[] =
    moveRequest.multiStop && moveRequest.stops.length > 0
      ? moveRequest.stops.map((s) => ({
          id: s.id,
          sequence: s.sequence,
          type: s.type as "PICKUP" | "DELIVERY",
          label: s.label,
          address: s.address,
          lat: s.lat,
          lng: s.lng,
        }))
      : [
          {
            id: `${moveRequest.id}-from`,
            sequence: 1,
            type: "PICKUP",
            label: null,
            address: moveRequest.fromAddress,
            lat: moveRequest.fromLat,
            lng: moveRequest.fromLng,
          },
          {
            id: `${moveRequest.id}-to`,
            sequence: 2,
            type: "DELIVERY",
            label: null,
            address: moveRequest.toAddress,
            lat: moveRequest.toLat,
            lng: moveRequest.toLng,
          },
        ];

  return (
    <>
      <PageHeader
        title={`Αίτημα #${ref}`}
        description={`${moveRequest.fromAddress} → ${moveRequest.toAddress}`}
        crumbs={[
          { href: "/dashboard", label: "Επισκόπηση" },
          { href: "/dashboard/requests", label: "Αιτήματα" },
          { label: `#${ref}` },
        ]}
        action={
          <Link
            href="/dashboard/requests"
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-secondary"
          >
            <ArrowLeft className="size-4" />
            Επιστροφή
          </Link>
        }
      />

      <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="flex flex-col gap-6">
            {/* Timeline */}
            <Timeline status={moveRequest.status} />

            {/* Map */}
            {maptilerKey && (
              <RequestMap apiKey={maptilerKey} stops={routeStops} />
            )}

            {/* Route */}
            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="mb-3 font-display text-base font-bold text-foreground">
                Διαδρομή
              </h2>
              {moveRequest.multiStop && moveRequest.stops.length > 0 ? (
                <ol className="flex flex-col gap-3">
                  {moveRequest.stops.map((stop, i) => (
                    <li
                      key={stop.id}
                      className="flex items-start gap-3 rounded-xl bg-secondary/40 p-3"
                    >
                      <span
                        className={cn(
                          "grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold text-white",
                          stop.type === "PICKUP"
                            ? "bg-[var(--color-brand-blue)]"
                            : "bg-[var(--color-brand-red)]",
                        )}
                      >
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {stop.type === "PICKUP" ? "Παραλαβή" : "Παράδοση"}
                          {stop.label && ` · ${stop.label}`}
                        </p>
                        <p className="text-sm font-semibold text-foreground">
                          {stop.address}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="flex flex-col gap-2">
                  <p className="flex items-start gap-2 text-sm">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-[var(--color-brand-blue)]" />
                    <span className="font-semibold text-foreground">
                      {moveRequest.fromAddress}
                    </span>
                  </p>
                  <p className="flex items-start gap-2 text-sm">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-[var(--color-brand-red)]" />
                    <span className="font-semibold text-foreground">
                      {moveRequest.toAddress}
                    </span>
                  </p>
                </div>
              )}
              <dl className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                <KV
                  label="Ημερομηνία"
                  value={
                    moveRequest.preferredDate
                      ? formatDate(moveRequest.preferredDate)
                      : "Ευέλικτη"
                  }
                />
                <KV
                  label="Ευελιξία"
                  value={
                    moveRequest.flexDays > 0
                      ? `±${moveRequest.flexDays} ημ.`
                      : "Σταθερή"
                  }
                />
                <KV
                  label="Shared Load"
                  value={moveRequest.shared ? "Ναι" : "Όχι"}
                />
                <KV label="Τύπος" value={typeLabel(moveRequest.type)} />
              </dl>
            </section>

            {/* Items */}
            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="mb-3 flex items-center justify-between gap-3 font-display text-base font-bold text-foreground">
                <span>Αντικείμενα</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {moveRequest.itemsCount} τεμ. ·{" "}
                  <span className="font-bold text-foreground">
                    {moveRequest.totalVolumeM3.toFixed(2)} m³
                  </span>
                </span>
              </h2>
              <ul className="max-h-[400px] divide-y divide-border overflow-y-auto rounded-xl border border-border bg-secondary/20">
                {items.map((it, idx) => (
                  <li
                    key={idx}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm"
                  >
                    {it.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={it.photoUrl}
                        alt={it.name}
                        className="size-12 shrink-0 rounded-lg border border-border bg-card object-cover"
                      />
                    ) : (
                      <span className="grid size-12 shrink-0 place-items-center rounded-lg border border-dashed border-border bg-secondary/50 text-[10px] text-muted-foreground">
                        —
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-foreground">
                        {it.quantity}× {it.name}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {it.length_cm}×{it.width_cm}×{it.height_cm} cm
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-bold tabular-nums text-foreground">
                      {(it.volume_m3 * it.quantity).toFixed(2)} m³
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Property */}
            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="mb-3 font-display text-base font-bold text-foreground">
                Στοιχεία χώρου
              </h2>
              <dl className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
                <KV label="Όροφος αναχώρησης" value={floorLabel(moveRequest.fromFloor)} />
                <KV label="Ασανσέρ αναχώρησης" value={elevatorLabel(moveRequest.fromElevator)} />
                <KV label="Όροφος προορισμού" value={floorLabel(moveRequest.toFloor)} />
                <KV label="Ασανσέρ προορισμού" value={elevatorLabel(moveRequest.toElevator)} />
                <KV label="Γερανός" value={craneLabel(moveRequest.crane)} />
                <KV label="Αμπαλάζ" value={moveRequest.packing ? "Ναι" : "Όχι"} />
                <KV label="Πρόσβαση φορτηγού" value={truckLabel(moveRequest.truckAccess)} />
              </dl>
              {moveRequest.notes && (
                <div className="mt-4 rounded-xl bg-secondary/40 p-3 text-xs text-muted-foreground">
                  <p className="mb-1 font-semibold text-foreground">Σημειώσεις</p>
                  {moveRequest.notes}
                </div>
              )}
            </section>
          </div>

          {/* Sidebar */}
          <aside className="flex flex-col gap-3 lg:sticky lg:top-6 lg:self-start">
            <div className="rounded-2xl border border-[var(--color-brand-blue)]/30 bg-gradient-to-br from-[var(--color-brand-blue-light)] to-card p-5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Εκτιμώμενη αξία
              </p>
              {moveRequest.estimatedPriceMinCents &&
              moveRequest.estimatedPriceMaxCents ? (
                <p className="font-display text-2xl font-bold text-[var(--color-brand-blue-deep)]">
                  {Math.round(moveRequest.estimatedPriceMinCents / 100)}€ –{" "}
                  {Math.round(moveRequest.estimatedPriceMaxCents / 100)}€
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Θα διαμορφωθεί από τις προσφορές
                </p>
              )}
            </div>

            {/* Offers */}
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="mb-3 flex items-center justify-between gap-2 font-display text-base font-bold text-foreground">
                <span className="flex items-center gap-2">
                  <Receipt className="size-4 text-[var(--color-brand-blue)]" />
                  Προσφορές μεταφορέων
                </span>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                  {moveRequest.offers.length}
                </span>
              </h3>
              <OfferAcceptList
                moveRequestId={moveRequest.id}
                moveStatus={moveRequest.status}
                offers={moveRequest.offers.map((o) => {
                  const tenant =
                    o.carrier.tenantMemberships[0]?.tenant ?? null;
                  return {
                    id: o.id,
                    priceCents: o.priceCents,
                    estimatedDays: o.estimatedDays,
                    notes: o.notes,
                    status: o.status,
                    validUntil: o.validUntil.toISOString(),
                    carrierName: o.carrier.name ?? o.carrier.email ?? "Μεταφορέας",
                    carrierBadge:
                      tenant?.commercialName ?? tenant?.legalName ?? null,
                    proposedSlots: parseProposedSlots(o.proposedSlotsJson),
                    acceptedSlotAt: o.acceptedSlotAt?.toISOString() ?? null,
                    contractPdfUrl: o.contractPdfUrl,
                    contractDocxUrl: o.contractDocxUrl,
                    contractRef: o.contractRef,
                  };
                })}
              />
            </div>

            {/* Quick links */}
            <div className="rounded-2xl border border-border bg-card p-5 text-xs text-muted-foreground">
              <p className="mb-3 font-semibold text-foreground">Σχετικά</p>
              <ul className="space-y-2">
                <li className="flex items-center gap-2">
                  <ShieldCheck className="size-3.5 text-[var(--color-brand-blue)]" />
                  Δωρεάν & χωρίς υποχρέωση
                </li>
                <li className="flex items-center gap-2">
                  <Star className="size-3.5 text-amber-500" />
                  Αξιολόγηση μετά την παράδοση
                </li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}

function Timeline({ status }: { status: string }) {
  const steps = [
    { key: "PUBLISHED", label: "Δημοσιεύτηκε", icon: CheckCircle2 },
    { key: "AWARDED", label: "Επιλογή μεταφορέα", icon: Receipt },
    { key: "IN_PROGRESS", label: "Εκτέλεση", icon: Truck },
    { key: "COMPLETED", label: "Ολοκληρώθηκε", icon: Star },
  ];
  const currentIdx = Math.max(
    0,
    steps.findIndex((s) =>
      s.key === status ||
      (status === "COMPLETED" && s.key === "COMPLETED") ||
      (status === "AWARDED" && s.key === "AWARDED"),
    ),
  );
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <ol className="grid grid-cols-4 gap-2">
        {steps.map((s, i) => {
          const done = i < currentIdx || status === "COMPLETED";
          const active = i === currentIdx && status !== "COMPLETED";
          return (
            <li key={s.key} className="flex flex-col items-center gap-1.5">
              <span
                className={cn(
                  "grid size-9 place-items-center rounded-full border-2 transition-colors",
                  done
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : active
                      ? "border-[var(--color-brand-blue)] bg-[var(--color-brand-blue)] text-white"
                      : "border-border bg-card text-muted-foreground",
                )}
              >
                <s.icon className="size-4" />
              </span>
              <span
                className={cn(
                  "text-center text-[11px] font-semibold leading-tight",
                  active
                    ? "text-[var(--color-brand-blue-deep)]"
                    : done
                      ? "text-foreground"
                      : "text-muted-foreground",
                )}
              >
                {s.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-secondary/40 px-3 py-2">
      <dt className="text-[10px] uppercase text-muted-foreground">{label}</dt>
      <dd className="text-sm font-semibold text-foreground">{value}</dd>
    </div>
  );
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("el-GR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

function floorLabel(n: number): string {
  if (n < 0) return `${Math.abs(n)}ο υπόγειο`;
  if (n === 0) return "Ισόγειο";
  if (n === 1) return "1ος όροφος";
  return `${n}ος όροφος`;
}

function elevatorLabel(v: string): string {
  switch (v) {
    case "NONE": return "Όχι";
    case "SMALL": return "Μικρό";
    case "MEDIUM": return "Μεσαίο";
    case "LARGE": return "Μεγάλο";
    default: return v;
  }
}

function craneLabel(v: string): string {
  switch (v) {
    case "NONE": return "Όχι";
    case "SOME": return "Μερικά";
    case "ALL": return "Όλο το φορτίο";
    default: return v;
  }
}

function truckLabel(v: string): string {
  switch (v) {
    case "EASY": return "Καλή";
    case "LIMITED": return "Περιορισμένη";
    case "NARROW": return "Στενό δρομάκι";
    default: return v;
  }
}

function typeLabel(v: string): string {
  switch (v) {
    case "HOUSE": return "Κατοικία";
    case "FURNITURE": return "Έπιπλα";
    case "BUSINESS": return "Επαγγελματικός";
    case "HEAVY": return "Βαρέα";
    default: return v;
  }
}

const LEGACY_PERIOD_HOUR: Record<string, number> = {
  MORNING: 9,
  AFTERNOON: 13,
  EVENING: 18,
};

function parseProposedSlots(
  json: unknown,
): Array<{ date: string; hour: number }> {
  if (!Array.isArray(json)) return [];
  const out: Array<{ date: string; hour: number }> = [];
  for (const raw of json) {
    if (!raw || typeof raw !== "object") continue;
    const s = raw as { date?: unknown; hour?: unknown; period?: unknown };
    if (typeof s.date !== "string") continue;
    let hour: number | null = null;
    if (typeof s.hour === "number" && Number.isFinite(s.hour)) {
      hour = Math.round(s.hour);
    } else if (typeof s.period === "string" && s.period in LEGACY_PERIOD_HOUR) {
      hour = LEGACY_PERIOD_HOUR[s.period];
    }
    if (hour == null || hour < 0 || hour > 23) continue;
    out.push({ date: s.date, hour });
  }
  return out;
}
