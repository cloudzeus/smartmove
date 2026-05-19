"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building,
  CalendarClock,
  CheckCircle2,
  ConstructionIcon,
  Layers as LayersIcon,
  MapPin,
  PackageOpen,
  Repeat,
  ShieldCheck,
  Truck,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type {
  CraneRequirement,
  ElevatorSize,
  JobItem,
  PropertyDetails,
  RouteInfo,
  TruckAccess,
} from "./wizard-types";

const ELEVATOR_OPTIONS: Array<{ value: ElevatorSize; label: string }> = [
  { value: "none", label: "Όχι" },
  { value: "small", label: "Μικρό" },
  { value: "medium", label: "Μεσαίο" },
  { value: "large", label: "Μεγάλο" },
];

const CRANE_OPTIONS: Array<{
  value: CraneRequirement;
  label: string;
  hint: string;
}> = [
  { value: "none", label: "Όχι", hint: "Δεν χρειάζεται" },
  { value: "some", label: "Ναι, για κάποια αντικείμενα", hint: "π.χ. πιάνο, ντουλάπα" },
  { value: "all", label: "Ναι, για όλο το φορτίο", hint: "π.χ. δεν χωράει στο κλιμακοστάσιο" },
];

const TRUCK_OPTIONS: Array<{ value: TruckAccess; label: string }> = [
  { value: "easy", label: "Καλή πρόσβαση" },
  { value: "limited", label: "Περιορισμένη" },
  { value: "narrow", label: "Στενό δρομάκι / πεζόδρομος" },
];

interface ContractSummaryProps {
  route: RouteInfo;
  items: JobItem[];
  property: PropertyDetails;
  onPropertyChange: (p: PropertyDetails) => void;
  onBack: () => void;
  onSubmit: () => void;
  submitting?: boolean;
  submitted?: boolean;
  error?: string | null;
  ref?: string | null;
  emailSent?: boolean;
}

export function ContractSummary({
  route,
  items,
  property,
  onPropertyChange,
  onBack,
  onSubmit,
  submitting,
  submitted,
  error,
  ref: submissionRef,
  emailSent,
}: ContractSummaryProps) {
  const totalItems = items.reduce((s, i) => s + i.quantity, 0);
  const totalVolume = items.reduce(
    (s, i) => s + i.volume_m3 * i.quantity,
    0,
  );
  const suggestedVehicle = suggestVehicle(totalVolume);
  const estimatedDistance = estimateDistance(route.from, route.to);
  const basePrice = useMemo(
    () => estimatePrice(totalVolume, estimatedDistance, property),
    [totalVolume, estimatedDistance, property],
  );

  if (submitted) {
    return (
      <SubmittedConfirmation
        route={route}
        totalVolume={totalVolume}
        ref={submissionRef}
        emailSent={emailSent}
      />
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="flex flex-col gap-5">
        {/* Route summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Διαδρομή</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-[var(--color-brand-blue-light)] text-[var(--color-brand-blue-deep)]">
                  <MapPin className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="font-display text-sm font-bold text-foreground sm:text-base">
                    {route.from || "—"}{" "}
                    <ArrowRight className="mx-1 inline-block size-3.5 text-muted-foreground" />{" "}
                    {route.to || "—"}
                  </p>
                  <p className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                    {route.when && (
                      <span className="inline-flex items-center gap-1">
                        <CalendarClock className="size-3" />
                        {formatDate(route.when)}
                      </span>
                    )}
                    {route.flex > 0 && (
                      <span>· ±{route.flex} ημ. ευελιξία</span>
                    )}
                    {route.shared && (
                      <span className="inline-flex items-center gap-1 text-emerald-700">
                        <Repeat className="size-3" /> Shared Load
                      </span>
                    )}
                  </p>
                </div>
              </div>
              {estimatedDistance && (
                <div className="rounded-xl border border-border bg-secondary/40 px-4 py-2 text-center">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Απόσταση (εκτίμηση)
                  </p>
                  <p className="font-display text-lg font-bold text-foreground">
                    ~{estimatedDistance} χλμ
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Items summary */}
        <Card>
          <CardHeader className="pb-3 flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Λίστα αντικειμένων</CardTitle>
              <CardDescription>
                {totalItems} αντικείμενα · {totalVolume.toFixed(2)} m³ συνολικά
              </CardDescription>
            </div>
            <span className="rounded-full bg-[var(--color-brand-blue-light)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-brand-blue-deep)]">
              {items[0]?.source === "ai" ? "Από AI scan" : "Χειροκίνητη επιλογή"}
            </span>
          </CardHeader>
          <CardContent>
            <ul className="max-h-[260px] space-y-1.5 overflow-y-auto rounded-xl border border-border bg-secondary/30 p-2">
              {items.map((it) => (
                <li
                  key={it.id}
                  className="flex items-center justify-between gap-2 rounded-lg bg-card px-3 py-2 text-sm"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-foreground">
                      {it.quantity}× {it.name}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {it.length_cm}×{it.width_cm}×{it.height_cm} cm
                    </span>
                  </span>
                  <span className="text-xs font-semibold text-foreground tabular-nums">
                    {(it.volume_m3 * it.quantity).toFixed(2)} m³
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Property details */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Στοιχεία χώρου</CardTitle>
            <CardDescription>
              Συμπλήρωσε για να λάβεις ακριβείς προσφορές.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div className="grid gap-5 sm:grid-cols-2">
              <FloorPanel
                title="Αναχώρηση"
                icon={Building}
                floor={property.fromFloor}
                onFloorChange={(v) =>
                  onPropertyChange({ ...property, fromFloor: v })
                }
                elevator={property.fromElevator}
                onElevatorChange={(v) =>
                  onPropertyChange({ ...property, fromElevator: v })
                }
              />
              <FloorPanel
                title="Προορισμός"
                icon={Building}
                floor={property.toFloor}
                onFloorChange={(v) =>
                  onPropertyChange({ ...property, toFloor: v })
                }
                elevator={property.toElevator}
                onElevatorChange={(v) =>
                  onPropertyChange({ ...property, toElevator: v })
                }
              />
            </div>

            <Divider />

            <Field
              icon={ConstructionIcon}
              label="Χρειάζεται γερανός;"
              hint="Όταν αντικείμενα δεν χωράνε σε κλιμακοστάσιο / ασανσέρ."
            >
              <RadioCardGroup
                value={property.crane}
                options={CRANE_OPTIONS}
                onChange={(v) =>
                  onPropertyChange({ ...property, crane: v as CraneRequirement })
                }
              />
            </Field>

            <Field
              icon={Truck}
              label="Πρόσβαση φορτηγού"
              hint="Πόσο εύκολα φτάνει φορτηγό στην είσοδο;"
            >
              <RadioCardGroup
                value={property.truckAccess}
                options={TRUCK_OPTIONS.map((o) => ({ ...o, hint: "" }))}
                onChange={(v) =>
                  onPropertyChange({
                    ...property,
                    truckAccess: v as TruckAccess,
                  })
                }
              />
            </Field>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-secondary/30 p-4 transition-colors hover:border-[var(--color-brand-blue)]/40">
              <input
                type="checkbox"
                checked={property.packing}
                onChange={(e) =>
                  onPropertyChange({ ...property, packing: e.target.checked })
                }
                className="mt-0.5 size-5 cursor-pointer rounded border-border accent-[var(--color-brand-blue)]"
              />
              <span className="flex flex-col leading-tight">
                <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <PackageOpen className="size-4 text-[var(--color-brand-blue)]" />
                  Χρειάζομαι υπηρεσία αμπαλάζ
                </span>
                <span className="mt-1 text-xs text-muted-foreground">
                  Ο μεταφορέας πακετάρει τα ευαίσθητα αντικείμενα (επιπλέον
                  χρέωση).
                </span>
              </span>
            </label>

            <Field icon={LayersIcon} label="Σημειώσεις προς τον μεταφορέα">
              <Textarea
                value={property.notes}
                onChange={(e) =>
                  onPropertyChange({ ...property, notes: e.target.value })
                }
                placeholder="Π.χ. ο καναπές δεν αποσυναρμολογείται, η ντουλάπα είναι πολύ ψηλή για ασανσέρ, κ.λπ."
                rows={3}
              />
            </Field>
          </CardContent>
        </Card>
      </div>

      {/* Sticky contract sidebar */}
      <div className="flex flex-col gap-3 lg:sticky lg:top-24 lg:self-start">
        <Card className="border-[var(--color-brand-blue)]/40 bg-gradient-to-br from-[var(--color-brand-blue-light)] to-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Σύνοψη αιτήματος</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <SummaryRow label="Αντικείμενα" value={`${totalItems}`} />
            <SummaryRow
              label="Όγκος"
              value={`${totalVolume.toFixed(2)} m³`}
              highlight
            />
            <SummaryRow
              label="Όχημα"
              value={suggestedVehicle}
              small
            />
            {estimatedDistance && (
              <SummaryRow
                label="Απόσταση"
                value={`~${estimatedDistance} χλμ`}
                small
              />
            )}
            <SummaryRow
              label="Ευελιξία"
              value={route.flex === 0 ? "Σταθερή ημέρα" : `±${route.flex} ημέρες`}
              small
            />
            <SummaryRow
              label="Γερανός"
              value={
                CRANE_OPTIONS.find((c) => c.value === property.crane)?.label ??
                "—"
              }
              small
            />
            <SummaryRow
              label="Αμπαλάζ"
              value={property.packing ? "Ναι" : "Όχι"}
              small
            />
            <div className="my-1 border-t border-border" />
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Εκτιμώμενο εύρος αγοράς
              </p>
              <p className="font-display text-2xl font-bold text-[var(--color-brand-blue-deep)]">
                {basePrice.min}€ – {basePrice.max}€
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Οι τελικές προσφορές διαμορφώνονται από τους μεταφορείς.
              </p>
            </div>
          </CardContent>
        </Card>

        <Button
          className="h-12 w-full text-base shadow-[var(--shadow-cta)]"
          onClick={onSubmit}
          disabled={submitting || items.length === 0}
        >
          {submitting ? (
            "Δημοσίευση…"
          ) : (
            <>
              <CheckCircle2 className="mr-2 size-4" />
              Δημοσίευση αιτήματος
            </>
          )}
        </Button>
        <Button
          variant="ghost"
          className="h-10 w-full text-sm"
          onClick={onBack}
          disabled={submitting}
        >
          <ArrowLeft className="mr-1 size-4" />
          Πίσω στα αντικείμενα
        </Button>

        <div className="rounded-xl border border-border bg-card p-3 text-[11px] leading-relaxed text-muted-foreground">
          <p className="flex items-center gap-1.5 font-semibold text-foreground">
            <ShieldCheck className="size-3.5 text-[var(--color-brand-blue)]" />
            Δωρεάν & χωρίς υποχρέωση
          </p>
          <p className="mt-1">
            Η δημοσίευση είναι δωρεάν. Πληρώνεις μόνο τον μεταφορέα που θα
            επιλέξεις, μέσω escrow.
          </p>
        </div>
      </div>
    </div>
  );
}

function SubmittedConfirmation({
  route,
  totalVolume,
  ref,
  emailSent,
}: {
  route: RouteInfo;
  totalVolume: number;
  ref?: string | null;
  emailSent?: boolean;
}) {
  return (
    <Card className="mx-auto max-w-2xl">
      <CardContent className="flex flex-col items-center gap-5 py-12 text-center">
        <div className="grid size-16 place-items-center rounded-2xl bg-emerald-100 text-emerald-700">
          <CheckCircle2 className="size-8" />
        </div>
        <div>
          <h2 className="font-display text-2xl font-bold text-foreground">
            Το αίτημά σου δημοσιεύτηκε
          </h2>
          {ref && (
            <p className="mt-1 font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Αναφορά #{ref}
            </p>
          )}
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Επαληθευμένοι μεταφορείς της περιοχής σας ενημερώνονται. Οι πρώτες
            προσφορές φτάνουν συνήθως μέσα σε 30-60 λεπτά στο email σου.
          </p>
        </div>

        {emailSent && (
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            <CheckCircle2 className="size-3.5" />
            Σου στείλαμε email επιβεβαίωσης με όλες τις λεπτομέρειες
          </div>
        )}

        <div className="grid w-full max-w-md grid-cols-2 gap-3 text-left">
          <Mini label="Διαδρομή" value={`${route.from || "—"} → ${route.to || "—"}`} />
          <Mini label="Όγκος" value={`${totalVolume.toFixed(2)} m³`} />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <a
            href="/dashboard/requests"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground hover:bg-muted"
          >
            Δες το αίτημά μου
          </a>
          <a
            href="/scan"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground hover:bg-primary/90"
          >
            Δημοσίευση νέου αιτήματος
          </a>
        </div>
      </CardContent>
    </Card>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-secondary/40 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="truncate text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  highlight,
  small,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  small?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span
        className={cn(
          "text-muted-foreground",
          small ? "text-xs" : "text-sm",
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "font-semibold text-foreground tabular-nums",
          small ? "text-xs" : "text-sm",
          highlight && "font-display text-lg text-[var(--color-brand-blue-deep)]",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function Field({
  icon: Icon,
  label,
  hint,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-[var(--color-brand-blue)]" />
        <span className="text-sm font-semibold text-foreground">{label}</span>
      </div>
      {hint && <p className="-mt-1 text-xs text-muted-foreground">{hint}</p>}
      {children}
    </div>
  );
}

function FloorPanel({
  title,
  floor,
  onFloorChange,
  elevator,
  onElevatorChange,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  floor: number;
  onFloorChange: (v: number) => void;
  elevator: ElevatorSize;
  onElevatorChange: (v: ElevatorSize) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-secondary/30 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-foreground">Όροφος</span>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={-2}
            max={20}
            value={floor}
            onChange={(e) =>
              onFloorChange(
                Math.max(-2, Math.min(20, Number(e.target.value) || 0)),
              )
            }
            className="h-10 w-20 rounded-lg border border-input bg-card px-3 text-center text-sm font-bold text-foreground focus-visible:border-[var(--color-brand-blue)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          />
          <span className="text-xs text-muted-foreground">
            {floorLabel(floor)}
          </span>
        </div>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-foreground">Ασανσέρ</span>
        <RadioCardGroup
          value={elevator}
          options={ELEVATOR_OPTIONS.map((o) => ({ ...o, hint: "" }))}
          onChange={(v) => onElevatorChange(v as ElevatorSize)}
          compact
        />
      </label>
    </div>
  );
}

function RadioCardGroup<T extends string>({
  value,
  options,
  onChange,
  compact,
}: {
  value: T;
  options: ReadonlyArray<{ value: T; label: string; hint?: string }>;
  onChange: (v: T) => void;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "grid gap-2",
        compact
          ? "grid-cols-4"
          : "grid-cols-1 sm:grid-cols-3",
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "rounded-xl border-2 p-2.5 text-left transition-colors",
              compact ? "px-2 text-center" : "",
              active
                ? "border-[var(--color-brand-blue)] bg-[var(--color-brand-blue-light)]"
                : "border-border bg-card hover:border-[var(--color-brand-blue)]/40",
            )}
          >
            <span
              className={cn(
                "block text-sm font-semibold",
                active
                  ? "text-[var(--color-brand-blue-deep)]"
                  : "text-foreground",
                compact && "text-xs",
              )}
            >
              {opt.label}
            </span>
            {opt.hint && !compact && (
              <span className="mt-0.5 block text-[11px] text-muted-foreground">
                {opt.hint}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function Divider() {
  return <div className="h-px w-full bg-border" />;
}

function suggestVehicle(volumeCubicM: number): string {
  if (volumeCubicM === 0) return "—";
  if (volumeCubicM <= 4) return "Μικρό βαν (έως 4 m³)";
  if (volumeCubicM <= 12) return "Βαν 3.5T (έως 12 m³)";
  if (volumeCubicM <= 22) return "Φορτηγό 5T (έως 22 m³)";
  if (volumeCubicM <= 35) return "Φορτηγό 7.5T (έως 35 m³)";
  return "Φορτηγό 12T (35+ m³)";
}

function estimateDistance(from: string, to: string): number | null {
  if (!from || !to) return null;
  // Very rough heuristic based on common Greek routes.
  const f = from.toLowerCase();
  const t = to.toLowerCase();
  const has = (s: string, kw: string) => s.includes(kw);
  if (has(f, "αθήν") && has(t, "θεσσαλον")) return 502;
  if (has(f, "θεσσαλον") && has(t, "αθήν")) return 502;
  if (has(f, "αθήν") && has(t, "πάτρα")) return 211;
  if (has(f, "πάτρα") && has(t, "αθήν")) return 211;
  if (has(f, "αθήν") && has(t, "ηράκλειο")) return 700;
  if (has(f, "αθήν") && has(t, "ιωάννιν")) return 444;
  if (f.startsWith(t.split(",")[0]) || t.startsWith(f.split(",")[0])) return 15;
  // Generic placeholder
  return null;
}

function estimatePrice(
  volumeM3: number,
  distanceKm: number | null,
  property: PropertyDetails,
): { min: number; max: number } {
  let base = 60 + volumeM3 * 20;
  if (distanceKm) base += distanceKm * 0.7;
  // Floor surcharges
  const floors = property.fromFloor + property.toFloor;
  const elevatorOk =
    property.fromElevator !== "none" && property.toElevator !== "none";
  if (!elevatorOk && floors > 0) base += floors * 15;
  // Crane
  if (property.crane === "some") base += 80;
  if (property.crane === "all") base += 250;
  // Packing
  if (property.packing) base += volumeM3 * 8;
  // Truck access
  if (property.truckAccess === "limited") base += 30;
  if (property.truckAccess === "narrow") base += 80;

  const min = Math.round(base * 0.85);
  const max = Math.round(base * 1.25);
  return { min, max };
}

function floorLabel(n: number): string {
  if (n < 0) return `${Math.abs(n)}ο υπόγειο`;
  if (n === 0) return "Ισόγειο";
  if (n === 1) return "1ος όροφος";
  return `${n}ος όροφος`;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("el-GR", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}
