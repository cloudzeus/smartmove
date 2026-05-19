import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Package, Receipt, User } from "lucide-react";

import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { cn } from "@/lib/utils";
import { AdminPageHero } from "@/components/admin/page-hero";
import { RequestMap, type RouteStop } from "@/components/dashboard/request-map";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

interface StoredItem {
  name: string;
  quantity: number;
  length_cm: number;
  width_cm: number;
  height_cm: number;
  volume_m3: number;
  photoUrl?: string;
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: "Πρόχειρο", cls: "bg-slate-100 text-slate-800" },
  PUBLISHED: { label: "Δημοσιευμένο", cls: "bg-sky-100 text-sky-800" },
  AWARDED: { label: "Ανατέθηκε", cls: "bg-amber-100 text-amber-800" },
  COMPLETED: { label: "Ολοκληρώθηκε", cls: "bg-emerald-100 text-emerald-800" },
  CANCELLED: { label: "Ακυρώθηκε", cls: "bg-rose-100 text-rose-800" },
};

export default async function AdminRequestDetailPage({ params }: PageProps) {
  const { id } = await params;

  const r = await db.moveRequest.findUnique({
    where: { id },
    include: {
      user: {
        select: { id: true, name: true, email: true, phone: true, createdAt: true },
      },
      stops: { orderBy: { sequence: "asc" } },
      offers: {
        orderBy: { createdAt: "desc" },
        include: {
          carrier: { select: { id: true, name: true, email: true } },
        },
      },
      payment: true,
      review: true,
    },
  });

  if (!r) notFound();

  const ref = r.id.slice(-8).toUpperCase();
  const status = STATUS_LABEL[r.status] ?? { label: r.status, cls: "" };
  const items = (r.itemsJson as unknown as StoredItem[]) ?? [];
  const maptilerKey = env.maptilerApiKey();

  const routeStops: RouteStop[] =
    r.multiStop && r.stops.length > 0
      ? r.stops.map((s) => ({
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
            id: `${r.id}-from`,
            sequence: 1,
            type: "PICKUP",
            label: null,
            address: r.fromAddress,
            lat: r.fromLat,
            lng: r.fromLng,
          },
          {
            id: `${r.id}-to`,
            sequence: 2,
            type: "DELIVERY",
            label: null,
            address: r.toAddress,
            lat: r.toLat,
            lng: r.toLng,
          },
        ];

  return (
    <>
      <AdminPageHero
        eyebrow="Operations"
        title={`Αίτημα #${ref}`}
        description={`${r.fromAddress} → ${r.toAddress}`}
        crumbs={[
          { href: "/admin", label: "Admin" },
          { href: "/admin/requests", label: "Αιτήματα" },
          { label: `#${ref}` },
        ]}
        action={
          <Link
            href="/admin/requests"
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
            {/* Status / meta strip */}
            <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-bold uppercase",
                    status.cls,
                  )}
                >
                  {status.label}
                </span>
                <span className="text-xs text-muted-foreground">
                  Δημοσιεύτηκε {formatDate(r.publishedAt)}
                </span>
              </div>
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span>
                  <strong className="text-foreground">{r.itemsCount}</strong> τεμ.
                </span>
                <span>
                  <strong className="text-foreground">
                    {r.totalVolumeM3.toFixed(2)}
                  </strong>{" "}
                  m³
                </span>
                <span>
                  <strong className="text-foreground">{r.offers.length}</strong>{" "}
                  προσφορές
                </span>
              </div>
            </section>

            {/* Map */}
            {maptilerKey && <RequestMap apiKey={maptilerKey} stops={routeStops} />}

            {/* Route textual */}
            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="mb-3 font-display text-base font-bold text-foreground">
                Σημεία διαδρομής
              </h2>
              <ol className="flex flex-col gap-2">
                {routeStops.map((s, i) => (
                  <li
                    key={s.id}
                    className="flex items-start gap-3 rounded-xl bg-secondary/40 p-3 text-sm"
                  >
                    <span
                      className={cn(
                        "grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold text-white",
                        s.type === "PICKUP" ? "bg-sky-600" : "bg-rose-600",
                      )}
                    >
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                        {s.type === "PICKUP" ? "Παραλαβή" : "Παράδοση"}
                        {s.label && ` · ${s.label}`}
                      </p>
                      <p className="font-semibold text-foreground">{s.address}</p>
                      {s.lat != null && s.lng != null && (
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {s.lat.toFixed(5)}, {s.lng.toFixed(5)}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            {/* Items */}
            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="mb-3 flex items-center gap-2 font-display text-base font-bold text-foreground">
                <Package className="size-4 text-[var(--color-brand-blue)]" />
                Αντικείμενα ({r.itemsCount})
              </h2>
              <ul className="max-h-[320px] divide-y divide-border overflow-y-auto rounded-xl border border-border bg-secondary/20">
                {items.map((it, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-3 px-4 py-2 text-sm"
                  >
                    {it.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={it.photoUrl}
                        alt={it.name}
                        className="size-12 shrink-0 rounded-lg border border-border bg-card object-cover"
                      />
                    ) : (
                      <span className="grid size-12 shrink-0 place-items-center rounded-lg border border-dashed border-border bg-secondary/40 text-[10px] text-muted-foreground">
                        —
                      </span>
                    )}
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-medium">{it.quantity}× {it.name}</span>
                      <span className="ml-2 text-[11px] text-muted-foreground">
                        {it.length_cm}×{it.width_cm}×{it.height_cm} cm
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-bold tabular-nums">
                      {(it.volume_m3 * it.quantity).toFixed(2)} m³
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {/* Sidebar */}
          <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
            {/* Customer */}
            <section className="rounded-2xl border border-border bg-card p-4">
              <h3 className="mb-2 flex items-center gap-1.5 font-display text-sm font-bold">
                <User className="size-4 text-[var(--color-brand-blue)]" />
                Πελάτης
              </h3>
              <p className="text-sm font-semibold text-foreground">
                {r.user.name ?? "—"}
              </p>
              <p className="text-xs text-muted-foreground">{r.user.email}</p>
              {r.user.phone && (
                <p className="text-xs text-muted-foreground">{r.user.phone}</p>
              )}
              <Link
                href={`/admin/users/${r.user.id}`}
                className="mt-2 inline-block text-xs font-semibold text-[var(--color-brand-blue)] hover:underline"
              >
                Όλα τα αιτήματα του χρήστη →
              </Link>
            </section>

            {/* Estimate */}
            <section className="rounded-2xl border border-[var(--color-brand-blue)]/30 bg-gradient-to-br from-[var(--color-brand-blue-light)] to-card p-4">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                Εκτίμηση κόστους
              </p>
              {r.estimatedPriceMinCents && r.estimatedPriceMaxCents ? (
                <p className="font-display text-2xl font-bold text-[var(--color-brand-blue-deep)]">
                  {Math.round(r.estimatedPriceMinCents / 100)}€ –{" "}
                  {Math.round(r.estimatedPriceMaxCents / 100)}€
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">—</p>
              )}
            </section>

            {/* Offers */}
            <section className="rounded-2xl border border-border bg-card p-4">
              <h3 className="mb-2 flex items-center gap-1.5 font-display text-sm font-bold">
                <Receipt className="size-4 text-[var(--color-brand-blue)]" />
                Προσφορές ({r.offers.length})
              </h3>
              {r.offers.length === 0 ? (
                <p className="text-xs text-muted-foreground">Καμία ακόμα.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {r.offers.map((o) => (
                    <li
                      key={o.id}
                      className="rounded-xl border border-border bg-secondary/30 p-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold">
                          {o.carrier.name ?? o.carrier.email}
                        </span>
                        <span className="font-bold text-[var(--color-brand-blue-deep)]">
                          {(o.priceCents / 100).toFixed(0)}€
                        </span>
                      </div>
                      {o.notes && (
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {o.notes}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Payment */}
            {r.payment && (
              <section className="rounded-2xl border border-border bg-card p-4">
                <h3 className="mb-2 font-display text-sm font-bold">Πληρωμή</h3>
                <p className="text-xs">Κατάσταση: <strong>{r.payment.status}</strong></p>
                <p className="text-xs">
                  Ποσό: <strong>{(r.payment.amountCents / 100).toFixed(2)}€</strong>
                </p>
              </section>
            )}
          </aside>
        </div>
      </div>
    </>
  );
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("el-GR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}
