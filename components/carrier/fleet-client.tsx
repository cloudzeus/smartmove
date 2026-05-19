"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Calendar,
  Euro,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Search,
  Trash2,
  Truck,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  VehicleDialog,
  type VehicleFormValues,
} from "@/components/admin/vehicle-dialog";
import { deleteVehicle } from "@/server/actions/vehicles.action";

interface FleetVehicle {
  id: string;
  plate: string;
  brand: string | null;
  model: string | null;
  year: number | null;
  vehicleType: string;
  capacityKg: number | null;
  capacityM3: number | null;
  fuelType: string | null;
  color: string | null;
  branchId: string | null;
  branchName: string | null;
  status: string;
  insuranceExpiresAt: string | null;
  ktoExpiresAt: string | null;
  photoUrl: string | null;
  registrationDocUrl: string | null;
  baseAddress: string | null;
  baseLat: number | null;
  baseLng: number | null;
  costPerKmCents: number;
  minTripCents: number;
  callOutCents: number;
}

interface Props {
  tenantId: string;
  vehicles: FleetVehicle[];
  branches: Array<{ id: string; legalName: string }>;
  canEdit: boolean;
  atCap: boolean;
  maxVehicles: number | null;
}

const VEHICLE_TYPE_LABEL: Record<string, string> = {
  VAN_SMALL: "Van μικρό",
  VAN_LARGE: "Van μεγάλο",
  TRUCK_3_5T: "3.5 τόνων",
  TRUCK_5T: "5 τόνων",
  TRUCK_7_5T: "7.5 τόνων",
  TRUCK_12T: "12 τόνων",
  TRAILER: "Νταλίκα",
  OTHER: "Άλλο",
};

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  ACTIVE: { label: "Ενεργό", cls: "bg-emerald-100 text-emerald-800" },
  INACTIVE: { label: "Ανενεργό", cls: "bg-slate-100 text-slate-700" },
  MAINTENANCE: { label: "Συντήρηση", cls: "bg-amber-100 text-amber-800" },
};

export function CarrierFleetClient({
  tenantId,
  vehicles,
  branches,
  canEdit,
  atCap,
  maxVehicles,
}: Props) {
  const router = useRouter();
  const [dialog, setDialog] = useState<VehicleFormValues | null>(null);
  const [query, setQuery] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return vehicles;
    return vehicles.filter(
      (v) =>
        v.plate.toLowerCase().includes(q) ||
        (v.brand?.toLowerCase().includes(q) ?? false) ||
        (v.model?.toLowerCase().includes(q) ?? false) ||
        (v.branchName?.toLowerCase().includes(q) ?? false),
    );
  }, [vehicles, query]);

  const onDelete = (id: string, plate: string) => {
    if (!confirm(`Διαγραφή οχήματος ${plate};`)) return;
    setDeleting(id);
    start(async () => {
      const r = await deleteVehicle(id);
      setDeleting(null);
      if (r.ok) router.refresh();
      else alert(r.error);
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-3 shadow-[var(--shadow-card)] sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Αναζήτηση: πινακίδα, μάρκα…"
            className="h-9 w-full rounded-lg border border-border bg-background pl-8 pr-3 text-sm outline-none focus:border-[var(--color-brand-blue)]"
          />
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => setDialog({ tenantId } as VehicleFormValues)}
            disabled={atCap}
            className={cn(
              "inline-flex h-10 items-center gap-1.5 rounded-lg px-4 text-sm font-bold text-white transition-colors",
              atCap
                ? "cursor-not-allowed bg-muted text-muted-foreground"
                : "bg-gradient-to-r from-[var(--color-brand-blue)] to-[#3B82F6] shadow-[0_6px_20px_rgba(37,99,235,0.25)] hover:from-[var(--color-brand-blue-deep)] hover:to-[var(--color-brand-blue)]",
            )}
            title={
              atCap
                ? `Έφτασες το όριο πακέτου (${maxVehicles})`
                : undefined
            }
          >
            <Plus className="size-4" />
            Νέο όχημα
          </button>
        )}
      </div>

      {/* Cap warning */}
      {atCap && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>
            Έφτασες το όριο των <strong>{maxVehicles}</strong> οχημάτων του
            πακέτου σου. Αναβάθμισε ή απενεργοποίησε ένα όχημα για να
            προσθέσεις νέο.
          </span>
        </div>
      )}

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
          <Truck className="mx-auto size-10 text-muted-foreground" />
          <p className="mt-3 text-sm font-semibold">
            {query
              ? "Καμία αντιστοιχία στην αναζήτηση"
              : "Δεν υπάρχουν οχήματα ακόμα"}
          </p>
          {!query && canEdit && !atCap && (
            <button
              type="button"
              onClick={() => setDialog({ tenantId } as VehicleFormValues)}
              className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg bg-foreground px-4 text-xs font-bold text-background"
            >
              <Plus className="size-3.5" />
              Πρόσθεσε το πρώτο
            </button>
          )}
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((v) => {
            const st = STATUS_LABEL[v.status] ?? {
              label: v.status,
              cls: "bg-secondary",
            };
            const needsPricing = v.costPerKmCents === 0;
            const needsBase = v.baseLat == null || v.baseLng == null;
            return (
              <li
                key={v.id}
                className={cn(
                  "flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:shadow-lg",
                  v.status === "ACTIVE"
                    ? "border-border"
                    : "border-dashed border-border opacity-80",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    {v.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={v.photoUrl}
                        alt={v.plate}
                        className="size-12 rounded-lg border border-border object-cover"
                      />
                    ) : (
                      <span className="grid size-12 place-items-center rounded-lg bg-[var(--color-brand-blue-light)] text-[var(--color-brand-blue-deep)]">
                        <Truck className="size-5" />
                      </span>
                    )}
                    <div>
                      <p className="font-mono text-base font-bold uppercase tracking-wider text-foreground">
                        {v.plate}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {[v.brand, v.model, v.year].filter(Boolean).join(" · ") ||
                          VEHICLE_TYPE_LABEL[v.vehicleType] ||
                          v.vehicleType}
                      </p>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                      st.cls,
                    )}
                  >
                    {st.label}
                  </span>
                </div>

                <dl className="grid grid-cols-2 gap-1.5 text-[11px]">
                  <Meta
                    label="Χωρητικότητα"
                    value={
                      v.capacityM3 != null
                        ? `${v.capacityM3} m³`
                        : v.capacityKg != null
                          ? `${v.capacityKg} kg`
                          : "—"
                    }
                  />
                  <Meta label="Τύπος" value={VEHICLE_TYPE_LABEL[v.vehicleType] ?? v.vehicleType} />
                  <Meta
                    label="Υποκατάστημα"
                    value={v.branchName ?? "—"}
                    icon={MapPin}
                  />
                  <Meta
                    label="€/χλμ"
                    value={
                      v.costPerKmCents > 0
                        ? `${(v.costPerKmCents / 100).toFixed(2)}€`
                        : "—"
                    }
                    icon={Euro}
                    tone={needsPricing ? "warn" : undefined}
                  />
                </dl>

                {(needsPricing || needsBase) && (
                  <div className="flex flex-wrap gap-1 text-[10px]">
                    {needsBase && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-900">
                        ⚠ Λείπει βάση
                      </span>
                    )}
                    {needsPricing && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-900">
                        ⚠ Λείπει €/χλμ
                      </span>
                    )}
                  </div>
                )}

                {(v.insuranceExpiresAt || v.ktoExpiresAt) && (
                  <div className="flex flex-wrap gap-2 border-t border-border/60 pt-2 text-[10px] text-muted-foreground">
                    {v.insuranceExpiresAt && (
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="size-3" />
                        Ασφάλεια:{" "}
                        {new Date(v.insuranceExpiresAt).toLocaleDateString("el-GR")}
                      </span>
                    )}
                    {v.ktoExpiresAt && (
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="size-3" />
                        ΚΤΕΟ:{" "}
                        {new Date(v.ktoExpiresAt).toLocaleDateString("el-GR")}
                      </span>
                    )}
                  </div>
                )}

                {canEdit && (
                  <div className="mt-auto flex items-center gap-1.5 border-t border-border/60 pt-3">
                    <button
                      type="button"
                      onClick={() =>
                        setDialog({
                          id: v.id,
                          tenantId,
                          plate: v.plate,
                          brand: v.brand ?? undefined,
                          model: v.model ?? undefined,
                          year: v.year ?? undefined,
                          vehicleType: v.vehicleType,
                          capacityKg: v.capacityKg ?? undefined,
                          capacityM3: v.capacityM3 ?? undefined,
                          fuelType: v.fuelType ?? undefined,
                          color: v.color ?? undefined,
                          branchId: v.branchId,
                          status: v.status,
                          insuranceExpiresAt: v.insuranceExpiresAt,
                          ktoExpiresAt: v.ktoExpiresAt,
                          photoUrl: v.photoUrl,
                          registrationDocUrl: v.registrationDocUrl,
                          baseAddress: v.baseAddress,
                          baseLat: v.baseLat,
                          baseLng: v.baseLng,
                          costPerKmCents: v.costPerKmCents,
                          minTripCents: v.minTripCents,
                          callOutCents: v.callOutCents,
                        })
                      }
                      className="inline-flex flex-1 h-8 items-center justify-center gap-1.5 rounded-md border border-border bg-background text-xs font-semibold hover:bg-secondary"
                    >
                      <Pencil className="size-3" />
                      Επεξεργασία
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(v.id, v.plate)}
                      disabled={pending && deleting === v.id}
                      className="inline-flex size-8 items-center justify-center rounded-md border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                      title="Διαγραφή"
                    >
                      {pending && deleting === v.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="size-3.5" />
                      )}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {dialog && (
        <VehicleDialog
          open={dialog !== null}
          onOpenChange={(o) => !o && setDialog(null)}
          tenantId={tenantId}
          branches={branches}
          initial={dialog}
        />
      )}
    </div>
  );
}

function Meta({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon?: typeof MapPin;
  tone?: "warn";
}) {
  return (
    <div className="rounded-lg bg-secondary/40 px-2 py-1.5">
      <dt className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd
        className={cn(
          "flex items-center gap-1 text-xs font-semibold",
          tone === "warn" ? "text-amber-700" : "text-foreground",
        )}
      >
        {Icon && <Icon className="size-3" />}
        {value}
      </dd>
    </div>
  );
}
