import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  ChevronDown,
  Lock,
  MapPin,
  Package,
  Users,
} from "lucide-react";

import { env } from "@/lib/env";
import { getLead, listMyVehicles } from "@/server/actions/carrier-leads.action";
import { RequestMap, type RouteStop } from "@/components/dashboard/request-map";
import { OfferForm } from "@/components/carrier/offer-form";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CarrierLeadDetailPage({ params }: PageProps) {
  const { id } = await params;
  const [l, vehicles] = await Promise.all([getLead(id), listMyVehicles()]);
  if (!l) notFound();

  const ref = l.id.slice(-8).toUpperCase();
  const maptilerKey = env.maptilerApiKey();

  const routeStops: RouteStop[] =
    l.multiStop && l.stops.length > 0
      ? l.stops.map((s) => ({
          id: `${l.id}-${s.sequence}`,
          sequence: s.sequence,
          type: s.type as "PICKUP" | "DELIVERY",
          label: null,
          address: s.locality,
          lat: s.lat,
          lng: s.lng,
        }))
      : [
          {
            id: `${l.id}-from`,
            sequence: 1,
            type: "PICKUP",
            label: null,
            address: l.fromLocality,
            lat: l.fromLat,
            lng: l.fromLng,
          },
          {
            id: `${l.id}-to`,
            sequence: 2,
            type: "DELIVERY",
            label: null,
            address: l.toLocality,
            lat: l.toLat,
            lng: l.toLng,
          },
        ];

  const dateStr = l.preferredDate
    ? formatDate(l.preferredDate) +
      (l.flexDays > 0 ? ` (±${l.flexDays}d)` : "")
    : "Ευέλικτη";

  const distanceKm =
    l.fromLat != null && l.fromLng != null && l.toLat != null && l.toLng != null
      ? haversineKm(l.fromLat, l.fromLng, l.toLat, l.toLng)
      : null;

  // Property pills — only render when non-default values
  const pills: Array<{ k: string; v: string; warn?: boolean }> = [];
  pills.push({ k: "Όροφοι", v: `${l.fromFloor}↑ → ${l.toFloor}↑` });
  if (l.fromElevator !== "NONE" || l.toElevator !== "NONE") {
    pills.push({
      k: "Ασανσέρ",
      v: `${elevatorShort(l.fromElevator)} / ${elevatorShort(l.toElevator)}`,
    });
  }
  if (l.crane !== "NONE") {
    pills.push({ k: "Γερανός", v: craneLabel(l.crane), warn: true });
  }
  if (l.packing) pills.push({ k: "Αμπαλάζ", v: "Ναι", warn: true });
  if (l.truckAccess !== "EASY") {
    pills.push({ k: "Πρόσβαση", v: truckLabel(l.truckAccess), warn: true });
  }
  if (l.shared) pills.push({ k: "Shared", v: "Ναι" });

  return (
    <div className="mx-auto w-full max-w-[1320px] px-4 py-3 sm:px-6 lg:px-8">
      {/* Top bar — single line */}
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <Link
          href="/carrier/leads"
          className="inline-flex items-center gap-1 hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Αιτήματα
        </Link>
        <Sep />
        <span className="font-mono text-foreground">#{ref}</span>
        <Sep />
        <span className="inline-flex items-center gap-1">
          <Lock className="size-3" />
          Ανώνυμο
        </span>
        <Sep />
        <span className="inline-flex items-center gap-1">
          <Users className="size-3" />
          {l.offersCount} προσφορές
        </span>
        <Sep />
        <span>{relativeTime(l.publishedAt)}</span>
      </div>

      {/* Hero band — the decision-critical line */}
      <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-border pb-3">
        <h1 className="flex items-center gap-1.5 font-display text-xl font-bold text-foreground sm:text-2xl">
          <MapPin className="size-4 text-sky-600" />
          <span className="truncate">{l.fromLocality}</span>
          <span className="text-muted-foreground/60">→</span>
          <MapPin className="size-4 text-rose-600" />
          <span className="truncate">{l.toLocality}</span>
        </h1>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <CalendarClock className="size-3.5" />
            <strong className="text-foreground">{dateStr}</strong>
          </span>
          {distanceKm != null && (
            <>
              <span>·</span>
              <span>
                ~<strong className="text-foreground">
                  {distanceKm.toFixed(1)}
                </strong>{" "}
                km
              </span>
            </>
          )}
          <span>·</span>
          <span>
            <strong className="text-foreground">{l.itemsCount}</strong> τεμ
          </span>
          <span>·</span>
          <span>
            <strong className="text-foreground">
              {l.totalVolumeM3.toFixed(1)}
            </strong>{" "}
            m³
          </span>
          <span>·</span>
          <span>{typeLabel(l.type)}</span>
          {l.estimatedPriceMinCents != null &&
            l.estimatedPriceMaxCents != null && (
              <>
                <span>·</span>
                <span className="text-foreground">
                  Εκτίμηση{" "}
                  <strong>
                    {Math.round(l.estimatedPriceMinCents / 100)}–
                    {Math.round(l.estimatedPriceMaxCents / 100)}€
                  </strong>
                </span>
              </>
            )}
        </div>
      </div>

      {/* 2-pane layout */}
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        {/* MAIN */}
        <div className="flex min-w-0 flex-col gap-4">
          {/* Property pills */}
          {pills.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {pills.map((p) => (
                <span
                  key={p.k}
                  className={
                    "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] " +
                    (p.warn
                      ? "border-amber-300 bg-amber-50 text-amber-900"
                      : "border-border bg-card text-foreground")
                  }
                >
                  <span className="text-muted-foreground">{p.k}:</span>
                  <span className="font-semibold">{p.v}</span>
                </span>
              ))}
            </div>
          )}

          {/* Items — accordion */}
          <details className="group rounded-lg border border-border bg-card">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 hover:bg-secondary/30">
              <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide">
                <span className="grid size-5 place-items-center rounded bg-[var(--color-brand-blue-light)] text-[var(--color-brand-blue-deep)]">
                  <Package className="size-3" />
                </span>
                <span className="text-foreground">Αντικείμενα</span>
                <span className="text-muted-foreground">
                  · {l.itemsCount} τεμ · {l.totalVolumeM3.toFixed(1)} m³
                </span>
              </span>
              <ChevronDown className="size-3.5 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <ul className="divide-y divide-border border-t border-border">
              {l.items.map((it, i) => (
                <li
                  key={i}
                  className="flex items-center gap-3 px-3 py-1.5 text-sm"
                >
                  {it.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={it.photoUrl}
                      alt={it.name}
                      className="size-10 shrink-0 rounded border border-border object-cover"
                    />
                  ) : (
                    <span className="grid size-10 shrink-0 place-items-center rounded border border-dashed border-border bg-secondary/30 text-[10px] text-muted-foreground">
                      ?
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">
                      {it.quantity}× {it.name}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {it.length_cm}×{it.width_cm}×{it.height_cm} cm
                    </span>
                  </span>
                  <span className="shrink-0 text-[11px] font-semibold tabular-nums text-muted-foreground">
                    {(it.volume_m3 * it.quantity).toFixed(2)} m³
                  </span>
                </li>
              ))}
            </ul>
          </details>

          {/* Map — accordion */}
          {maptilerKey && (
            <details className="group rounded-lg border border-border bg-card">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 hover:bg-secondary/30">
                <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide">
                  <span className="grid size-5 place-items-center rounded bg-sky-100 text-sky-700">
                    <MapPin className="size-3" />
                  </span>
                  <span className="text-foreground">Χάρτης διαδρομής</span>
                </span>
                <ChevronDown className="size-3.5 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <div className="border-t border-border p-2">
                <RequestMap apiKey={maptilerKey} stops={routeStops} />
              </div>
            </details>
          )}
        </div>

        {/* RIGHT — sticky offer form */}
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <div className="overflow-hidden rounded-lg border-2 border-[var(--color-brand-blue)]/30 bg-card shadow-[0_4px_16px_rgba(37,99,235,0.08)]">
            <div className="border-b border-[var(--color-brand-blue)]/30 bg-gradient-to-r from-[var(--color-brand-blue-light)] to-card px-4 py-2.5">
              <h2 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-[var(--color-brand-blue-deep)]">
                <span className="grid size-5 place-items-center rounded bg-[var(--color-brand-blue)] text-white">
                  €
                </span>
                Η προσφορά σου
                {l.myOffer && (
                  <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold text-amber-900">
                    Ενεργή
                  </span>
                )}
              </h2>
            </div>
            <div className="p-4">
              <OfferForm
                moveRequestId={l.id}
                existing={l.myOffer ?? undefined}
                estimateMin={l.estimatedPriceMinCents}
                estimateMax={l.estimatedPriceMaxCents}
                vehicles={vehicles}
              />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Sep() {
  return <span className="text-muted-foreground/40">·</span>;
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("el-GR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(d);
}

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function relativeTime(d: Date): string {
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `πριν ${m}ʹ`;
  const h = Math.floor(m / 60);
  if (h < 24) return `πριν ${h}h`;
  const days = Math.floor(h / 24);
  return `πριν ${days}d`;
}

function elevatorShort(v: string): string {
  switch (v) {
    case "NONE":
      return "—";
    case "SMALL":
      return "S";
    case "MEDIUM":
      return "M";
    case "LARGE":
      return "L";
    default:
      return v;
  }
}

function craneLabel(v: string): string {
  switch (v) {
    case "SOME":
      return "Μερικά";
    case "ALL":
      return "Όλο";
    default:
      return v;
  }
}

function truckLabel(v: string): string {
  switch (v) {
    case "LIMITED":
      return "Περιορισμένη";
    case "NARROW":
      return "Στενό";
    default:
      return v;
  }
}

function typeLabel(v: string): string {
  switch (v) {
    case "HOUSE":
      return "Κατοικία";
    case "FURNITURE":
      return "Έπιπλα";
    case "BUSINESS":
      return "Επαγγελματικό";
    case "HEAVY":
      return "Βαρέα";
    default:
      return v;
  }
}
