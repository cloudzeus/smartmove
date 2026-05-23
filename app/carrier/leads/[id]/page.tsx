import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Download,
  FileText,
  Lock,
  MapPin,
  Package,
  Users,
} from "lucide-react";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getLead, listMyVehicles } from "@/server/actions/carrier-leads.action";
import { RequestMap, type RouteStop } from "@/components/dashboard/request-map";
import { OfferForm } from "@/components/carrier/offer-form";
import {
  PartnerQuoteSection,
  type PartnerOption,
  type QuoteRequestRow,
} from "@/components/carrier/partner-quote-section";
import {
  TasksPanel,
  type PanelTask,
  type EmployeeOption,
  type PartnerOption as TaskPartnerOption,
  type VehicleOption,
} from "@/components/carrier/tasks-panel";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ matchPrice?: string }>;
}

export default async function CarrierLeadDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const matchPriceEur = sp.matchPrice ? Number(sp.matchPrice) : null;
  const [l, vehicles] = await Promise.all([getLead(id), listMyVehicles()]);
  if (!l) notFound();

  // Partner quote data — only available for tenant carriers.
  const session = await auth();
  const membership = session?.user?.id
    ? await db.tenantMembership.findFirst({
        where: { userId: session.user.id },
        select: { tenantId: true },
        orderBy: { createdAt: "asc" },
      })
    : null;

  let partnerOptions: PartnerOption[] = [];
  let companyOptions: import("@/components/carrier/partner-quote-section").CompanyOption[] =
    [];
  let contactOptions: import("@/components/carrier/partner-quote-section").ContactOption[] =
    [];
  let quoteRequests: QuoteRequestRow[] = [];
  let panelTasks: PanelTask[] = [];
  let employeeOptions: EmployeeOption[] = [];
  let taskPartnerOptions: TaskPartnerOption[] = [];
  let vehicleOptions: VehicleOption[] = [];
  if (membership) {
    const [partners, companies, contacts, quotes, taskRows, employees, vehiclesRows] =
      await Promise.all([
      db.carrierPartner.findMany({
        where: { tenantId: membership.tenantId, deletedAt: null },
        include: {
          company: { select: { id: true, legalName: true, commercialName: true } },
        },
        orderBy: { name: "asc" },
      }),
      db.partnerCompany.findMany({
        where: { tenantId: membership.tenantId, deletedAt: null },
        select: {
          id: true,
          legalName: true,
          commercialName: true,
          vat: true,
          email: true,
          phone: true,
        },
        orderBy: [{ commercialName: "asc" }, { legalName: "asc" }],
      }),
      db.partnerContact.findMany({
        where: {
          deletedAt: null,
          company: { tenantId: membership.tenantId, deletedAt: null },
        },
        include: {
          company: {
            select: { id: true, legalName: true, commercialName: true },
          },
        },
        orderBy: { name: "asc" },
      }),
      db.partnerQuoteRequest.findMany({
        where: { tenantId: membership.tenantId, moveRequestId: id },
        orderBy: { createdAt: "desc" },
        include: {
          partner: { select: { name: true } },
          partnerCompany: { select: { legalName: true, commercialName: true } },
        },
      }),
      db.jobTask.findMany({
        where: { tenantId: membership.tenantId, moveRequestId: id },
        orderBy: { startAt: "asc" },
        include: {
          assigneeEmployee: { select: { name: true } },
          assigneePartner: {
            select: { name: true, company: { select: { commercialName: true, legalName: true } } },
          },
          vehicle: { select: { plate: true } },
        },
      }),
      db.carrierEmployee.findMany({
        where: { tenantId: membership.tenantId, deletedAt: null, active: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, role: true },
      }),
      db.vehicle.findMany({
        where: { tenantId: membership.tenantId, deletedAt: null },
        orderBy: { plate: "asc" },
        select: { id: true, plate: true, brand: true, model: true },
      }),
    ]);
    partnerOptions = partners.map((p) => ({
      id: p.id,
      name: p.name,
      kind: p.kind,
      email: p.email,
      phone: p.phone,
      companyId: p.company?.id ?? null,
      companyName: p.company
        ? p.company.commercialName ?? p.company.legalName
        : null,
    }));
    companyOptions = companies.map((c) => ({
      id: c.id,
      name: c.commercialName ?? c.legalName,
      vat: c.vat,
      email: c.email,
      phone: c.phone,
    }));
    contactOptions = contacts.map((c) => ({
      id: c.id,
      name: c.name,
      role: c.role,
      email: c.email,
      phone: c.phone,
      companyId: c.company.id,
      companyName: c.company.commercialName ?? c.company.legalName,
    }));
    taskPartnerOptions = partners.map((p) => ({
      id: p.id,
      name: p.name,
      kind: p.kind,
      companyName: p.company
        ? p.company.commercialName ?? p.company.legalName
        : null,
    }));
    quoteRequests = quotes.map((q) => ({
      id: q.id,
      status: q.status,
      service: q.service as QuoteRequestRow["service"],
      recipientEmail: q.recipientEmail,
      recipientName: q.recipientName,
      notes: q.notes,
      quotedPriceCents: q.quotedPriceCents,
      quotedNotes: q.quotedNotes,
      quotedAt: q.quotedAt,
      expiresAt: q.expiresAt,
      createdAt: q.createdAt,
      partnerName: q.partner?.name ?? null,
      companyName: q.partnerCompany
        ? q.partnerCompany.commercialName ?? q.partnerCompany.legalName
        : null,
    }));
    panelTasks = taskRows.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      category: t.category,
      status: t.status,
      startAt: t.startAt,
      durationMinutes: t.durationMinutes,
      startedAt: t.startedAt,
      completedAt: t.completedAt,
      assigneeKind: t.assigneeKind,
      assigneeEmployeeId: t.assigneeEmployeeId,
      assigneePartnerId: t.assigneePartnerId,
      assigneeName:
        t.assigneeEmployee?.name ??
        (t.assigneePartner
          ? t.assigneePartner.name +
            (t.assigneePartner.company
              ? ` (${t.assigneePartner.company.commercialName ?? t.assigneePartner.company.legalName})`
              : "")
          : null),
      vehicleId: t.vehicleId,
      vehiclePlate: t.vehicle?.plate ?? null,
      notes: t.notes,
    }));
    employeeOptions = employees.map((e) => ({
      id: e.id,
      name: e.name,
      role: e.role,
    }));
    vehicleOptions = vehiclesRows.map((v) => ({
      id: v.id,
      plate: v.plate,
      label: [v.plate, v.brand, v.model].filter(Boolean).join(" · "),
    }));
  }

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
    <div className="mx-auto w-full max-w-[1440px] px-4 py-3 sm:px-5">
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
      <div className="grid gap-3 lg:grid-cols-[1fr_340px]">
        {/* MAIN */}
        <div className="flex min-w-0 flex-col gap-2.5">
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
          <details open className="group cx-card">
            <summary className="flex h-9 cursor-pointer list-none items-center gap-2 px-3 cx-transition hover:bg-[var(--cx-hover)] [&::-webkit-details-marker]:hidden">
              <ChevronDown className="size-3.5 -rotate-90 text-muted-foreground cx-transition group-open:rotate-0" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-foreground">
                Αντικείμενα
              </span>
              <span className="text-[11px] text-muted-foreground">
                · {l.itemsCount} τεμ · {l.totalVolumeM3.toFixed(1)} m³
              </span>
            </summary>
            <ul className="max-h-[268px] divide-y divide-border overflow-y-auto border-t border-border [scrollbar-width:thin]">
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
            <details open className="group cx-card">
              <summary className="flex h-9 cursor-pointer list-none items-center gap-2 px-3 cx-transition hover:bg-[var(--cx-hover)] [&::-webkit-details-marker]:hidden">
                <ChevronDown className="size-3.5 -rotate-90 text-muted-foreground cx-transition group-open:rotate-0" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-foreground">
                  Χάρτης διαδρομής
                </span>
              </summary>
              <div className="border-t border-border p-2">
                <RequestMap apiKey={maptilerKey} stops={routeStops} />
              </div>
            </details>
          )}

          {/* Gantt — μεταφέρθηκε εδώ για να γεμίσει τον χώρο κάτω από τον χάρτη */}
          {membership && (
            <TasksPanel
              moveRequestId={l.id}
              tasks={panelTasks}
              employees={employeeOptions}
              partners={taskPartnerOptions}
              vehicles={vehicleOptions}
            />
          )}
        </div>

        {/* RIGHT — sticky offer form */}
        <aside className="flex flex-col gap-2.5 lg:sticky lg:top-3 lg:self-start">
          {/* Contract block — shown when offer accepted */}
          {l.myOffer?.status === "ACCEPTED" && l.myOffer.contractPdfUrl && (
            <div className="cx-card overflow-hidden ring-1 ring-emerald-300">
              <div className="border-b border-emerald-200 bg-emerald-50 px-3 py-1.5">
                <h2 className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.06em] text-emerald-900">
                  <CheckCircle2 className="size-3.5" />
                  Συμφωνητικό
                  {l.myOffer.contractRef && (
                    <span className="ml-auto font-mono text-[9px] text-emerald-700">
                      {l.myOffer.contractRef}
                    </span>
                  )}
                </h2>
              </div>
              <div className="p-3">
                {l.myOffer.acceptedSlotAt && (
                  <p className="mb-3 text-xs font-semibold text-emerald-900">
                    Συμφωνημένη ώρα:{" "}
                    {new Intl.DateTimeFormat("el-GR", {
                      weekday: "long",
                      day: "2-digit",
                      month: "long",
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(new Date(l.myOffer.acceptedSlotAt))}
                  </p>
                )}
                <div className="flex flex-col gap-2">
                  <a
                    href={l.myOffer.contractPdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-700"
                  >
                    <FileText className="size-4" />
                    Άνοιγμα PDF
                  </a>
                  {l.myOffer.contractDocxUrl && (
                    <a
                      href={l.myOffer.contractDocxUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-4 text-xs font-semibold text-emerald-800 hover:bg-emerald-50"
                    >
                      <Download className="size-3.5" />
                      Κατέβασμα .docx
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="cx-card overflow-hidden ring-1 ring-[var(--cx-accent)]/30">
            <div className="border-b border-border bg-[var(--cx-accent-soft)] px-3 py-1.5">
              <h2 className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.06em] text-foreground">
                Η προσφορά σου
                {l.myOffer && (
                  <span className="ml-auto rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-900 ring-1 ring-inset ring-amber-200">
                    Ενεργή
                  </span>
                )}
              </h2>
            </div>
            <div className="p-3">
              <OfferForm
                moveRequestId={l.id}
                existing={l.myOffer ?? undefined}
                estimateMin={l.estimatedPriceMinCents}
                estimateMax={l.estimatedPriceMaxCents}
                vehicles={vehicles}
                suggestedPriceEur={matchPriceEur && matchPriceEur > 0 ? matchPriceEur : null}
              />
            </div>
          </div>

          {membership && (
            <PartnerQuoteSection
              moveRequestId={l.id}
              partners={partnerOptions}
              companies={companyOptions}
              contacts={contactOptions}
              acceptedSlotAt={l.myOffer?.acceptedSlotAt ?? null}
              requests={quoteRequests}
              unassignedTasks={panelTasks
                .filter((t) => t.assigneeKind === "UNASSIGNED" && t.status !== "CANCELLED" && t.status !== "DONE")
                .map((t) => ({
                  id: t.id,
                  title: t.title,
                  category: t.category,
                  startAt: typeof t.startAt === "string" ? t.startAt : t.startAt.toISOString(),
                  durationMinutes: t.durationMinutes,
                }))}
              assignablePartners={taskPartnerOptions.map((p) => ({
                id: p.id,
                name: p.name,
                kind: p.kind,
                companyName: p.companyName,
              }))}
            />
          )}
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
