"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  CarFront,
  Loader2,
  Map as MapIcon,
  MapPin,
  Plus,
  Receipt,
  Star,
  Trash2,
  Truck,
} from "lucide-react";
import { TenantMapTab } from "./tenant-map-tab";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { deleteBranch } from "@/server/actions/tenants.action";
import { deleteVehicle } from "@/server/actions/vehicles.action";
import { cancelSubscription } from "@/server/actions/subscriptions.action";
import {
  BranchDialog,
  type BranchFormValues,
} from "./branch-dialog";
import {
  VehicleDialog,
  type VehicleFormValues,
} from "./vehicle-dialog";
import { SubscriptionDialog } from "./subscription-dialog";

type Tab = "profile" | "branches" | "vehicles" | "map" | "subscription" | "users";

interface Branch {
  id: string;
  legalName: string;
  commercialName?: string | null;
  vat?: string | null;
  doyName?: string | null;
  address?: string | null;
  addressNo?: string | null;
  postalZip?: string | null;
  postalArea?: string | null;
  email?: string | null;
  phone?: string | null;
  isPrimary: boolean;
  lat?: number | null;
  lng?: number | null;
  serviceRadiusKm?: number | null;
}

interface Vehicle {
  id: string;
  plate: string;
  brand?: string | null;
  model?: string | null;
  year?: number | null;
  vehicleType: string;
  capacityKg?: number | null;
  capacityM3?: number | null;
  branchId?: string | null;
  status: string;
  insuranceExpiresAt?: Date | null;
  ktoExpiresAt?: Date | null;
  photoUrl?: string | null;
  registrationDocUrl?: string | null;
  baseAddress?: string | null;
  baseLat?: number | null;
  baseLng?: number | null;
  costPerKmCents?: number | null;
  minTripCents?: number | null;
  callOutCents?: number | null;
}

interface SubscriptionLite {
  id: string;
  status: string;
  billingCycle: string;
  pricePerCycle?: number | null;
  startsAt: Date;
  endsAt?: Date | null;
  trialEndsAt?: Date | null;
  maxBranches?: number | null;
  maxEmployees?: number | null;
  maxVehicles?: number | null;
  maxMonthlyJobs?: number | null;
  crmEnabled?: boolean | null;
  privateScanEnabled?: boolean | null;
  apiAccessEnabled?: boolean | null;
  prioritySupport?: boolean | null;
  commissionPct?: number | null;
  notes?: string | null;
  planId: string;
  plan: {
    name: string;
    commissionPct: number;
    pricePerMonthCents: number;
    maxBranches: number;
    maxEmployees: number;
    maxVehicles: number;
    maxMonthlyJobs: number;
    crmEnabled: boolean;
    privateScanEnabled: boolean;
    apiAccessEnabled: boolean;
    prioritySupport: boolean;
  };
}

interface Plan {
  id: string;
  name: string;
  maxBranches: number;
  maxEmployees: number;
  maxVehicles: number;
  maxMonthlyJobs: number;
  crmEnabled: boolean;
  privateScanEnabled: boolean;
  apiAccessEnabled: boolean;
  prioritySupport: boolean;
  commissionPct: number;
  pricePerMonthCents: number;
}

interface Tenant {
  id: string;
  vat: string;
  legalName: string;
  commercialName?: string | null;
  doyName?: string | null;
  legalStatus?: string | null;
  vatSystemFlag?: string | null;
  address?: string | null;
  addressNo?: string | null;
  postalZip?: string | null;
  postalArea?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  registeredAt?: Date | null;
  notes?: string | null;
  lat?: number | null;
  lng?: number | null;
}

interface Props {
  tenant: Tenant;
  branches: Branch[];
  vehicles: Vehicle[];
  subscriptions: SubscriptionLite[];
  plans: Plan[];
  maptilerApiKey?: string;
}

export function TenantDetailClient({
  tenant,
  branches,
  vehicles,
  subscriptions,
  plans,
  maptilerApiKey,
}: Props) {
  const [tab, setTab] = useState<Tab>("profile");
  const [branchDialog, setBranchDialog] = useState<BranchFormValues | null>(null);
  const [vehicleDialog, setVehicleDialog] = useState<VehicleFormValues | null>(
    null,
  );
  const [subscriptionDialog, setSubscriptionDialog] = useState<
    SubscriptionLite | true | null
  >(null);

  const currentSub = subscriptions[0];
  const branchMap = new Map(branches.map((b) => [b.id, b.legalName]));

  return (
    <>
      <div className="flex gap-1 overflow-x-auto rounded-2xl border border-border bg-card p-1 shadow-[var(--shadow-card)]">
        <Tab id="profile" current={tab} onClick={setTab} icon={Building2}>
          Στοιχεία
        </Tab>
        <Tab id="branches" current={tab} onClick={setTab} icon={MapPin}>
          Υποκαταστήματα ({branches.length})
        </Tab>
        <Tab id="vehicles" current={tab} onClick={setTab} icon={Truck}>
          Στόλος ({vehicles.length})
        </Tab>
        <Tab id="map" current={tab} onClick={setTab} icon={MapIcon}>
          Χάρτης
        </Tab>
        <Tab id="subscription" current={tab} onClick={setTab} icon={Receipt}>
          Συνδρομή
        </Tab>
      </div>

      <div className="mt-6">
        {tab === "profile" && <ProfileTab tenant={tenant} />}

        {tab === "branches" && (
          <BranchesTab
            branches={branches}
            onAdd={() => setBranchDialog({} as BranchFormValues)}
            onEdit={(b) => setBranchDialog(b)}
          />
        )}

        {tab === "vehicles" && (
          <VehiclesTab
            vehicles={vehicles}
            branchMap={branchMap}
            onAdd={() => setVehicleDialog({ tenantId: tenant.id })}
            onEdit={(v) =>
              setVehicleDialog({
                id: v.id,
                tenantId: tenant.id,
                plate: v.plate,
                brand: v.brand ?? undefined,
                model: v.model ?? undefined,
                year: v.year ?? undefined,
                vehicleType: v.vehicleType,
                capacityKg: v.capacityKg ?? undefined,
                capacityM3: v.capacityM3 ?? undefined,
                branchId: v.branchId,
                status: v.status,
                insuranceExpiresAt: v.insuranceExpiresAt
                  ? v.insuranceExpiresAt.toISOString()
                  : null,
                ktoExpiresAt: v.ktoExpiresAt
                  ? v.ktoExpiresAt.toISOString()
                  : null,
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
          />
        )}

        {tab === "map" && maptilerApiKey && (
          <TenantMapTab
            apiKey={maptilerApiKey}
            tenant={{
              id: tenant.id,
              label: tenant.commercialName ?? tenant.legalName,
              lat: tenant.lat ?? null,
              lng: tenant.lng ?? null,
            }}
            branches={branches.map((b) => ({
              id: b.id,
              label: b.commercialName ?? b.legalName,
              lat: b.lat ?? null,
              lng: b.lng ?? null,
              serviceRadiusKm: b.serviceRadiusKm ?? null,
              isPrimary: b.isPrimary,
            }))}
          />
        )}
        {tab === "map" && !maptilerApiKey && (
          <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center text-sm text-muted-foreground">
            Λείπει το MAPTILER_API_KEY από το environment.
          </div>
        )}

        {tab === "subscription" && (
          <SubscriptionTab
            subscription={currentSub}
            onAssign={() => setSubscriptionDialog(true)}
            onEdit={(s) => setSubscriptionDialog(s)}
          />
        )}
      </div>

      {branchDialog !== null && (
        <BranchDialog
          open
          onOpenChange={(o) => !o && setBranchDialog(null)}
          tenantId={tenant.id}
          initial={branchDialog}
        />
      )}
      {vehicleDialog !== null && (
        <VehicleDialog
          open
          onOpenChange={(o) => !o && setVehicleDialog(null)}
          tenantId={tenant.id}
          branches={branches.map((b) => ({
            id: b.id,
            legalName: b.legalName,
          }))}
          initial={vehicleDialog}
        />
      )}
      {subscriptionDialog !== null && (
        <SubscriptionDialog
          open
          onOpenChange={(o) => !o && setSubscriptionDialog(null)}
          tenantId={tenant.id}
          plans={plans}
          initial={
            subscriptionDialog === true
              ? null
              : {
                  id: subscriptionDialog.id,
                  planId: subscriptionDialog.planId,
                  status: subscriptionDialog.status,
                  billingCycle: subscriptionDialog.billingCycle,
                  startsAt: subscriptionDialog.startsAt,
                  endsAt: subscriptionDialog.endsAt,
                  trialEndsAt: subscriptionDialog.trialEndsAt,
                  commissionPct: subscriptionDialog.commissionPct,
                  pricePerCycleEur: subscriptionDialog.pricePerCycle
                    ? subscriptionDialog.pricePerCycle / 100
                    : undefined,
                  notes: subscriptionDialog.notes,
                }
          }
        />
      )}
    </>
  );
}

function Tab({
  id,
  current,
  onClick,
  icon: Icon,
  children,
}: {
  id: Tab;
  current: Tab;
  onClick: (t: Tab) => void;
  icon: typeof Building2;
  children: React.ReactNode;
}) {
  const active = id === current;
  return (
    <button
      type="button"
      onClick={() => onClick(id)}
      className={cn(
        "inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors",
        active
          ? "bg-[var(--color-brand-blue)] text-white shadow-sm"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground",
      )}
    >
      <Icon className="size-4" />
      {children}
    </button>
  );
}

function ProfileTab({ tenant }: { tenant: Tenant }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <section className="rounded-2xl border border-border bg-card p-5 lg:col-span-2">
        <h2 className="mb-4 font-display text-base font-bold text-foreground">
          Στοιχεία πελάτη
        </h2>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <Row label="ΑΦΜ">{tenant.vat}</Row>
          <Row label="Επωνυμία">{tenant.legalName}</Row>
          <Row label="Διακριτικός τίτλος">{tenant.commercialName ?? "—"}</Row>
          <Row label="ΔΟΥ">{tenant.doyName ?? "—"}</Row>
          <Row label="Νομική μορφή">{tenant.legalStatus ?? "—"}</Row>
          <Row label="Καθεστώς ΦΠΑ">{tenant.vatSystemFlag ?? "—"}</Row>
          <Row label="Έναρξη">
            {tenant.registeredAt
              ? new Intl.DateTimeFormat("el-GR").format(tenant.registeredAt)
              : "—"}
          </Row>
        </dl>
      </section>
      <section className="flex flex-col gap-3">
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground">
            Διεύθυνση
          </h3>
          <p className="mt-2 text-sm text-foreground">
            {tenant.address ?? "—"} {tenant.addressNo}
            <br />
            {tenant.postalZip} {tenant.postalArea}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground">
            Επικοινωνία
          </h3>
          <ul className="mt-2 space-y-1 text-sm text-foreground">
            {tenant.email && <li>{tenant.email}</li>}
            {tenant.phone && <li>{tenant.phone}</li>}
            {tenant.website && (
              <li>
                <a
                  href={tenant.website}
                  className="text-[var(--color-brand-blue)] hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  {tenant.website}
                </a>
              </li>
            )}
            {!tenant.email && !tenant.phone && !tenant.website && "—"}
          </ul>
        </div>
        {tenant.notes && (
          <div className="rounded-2xl border border-border bg-secondary/30 p-4 text-xs text-muted-foreground">
            <p className="mb-1 font-semibold text-foreground">Σημειώσεις</p>
            {tenant.notes}
          </div>
        )}
      </section>
    </div>
  );
}

function BranchesTab({
  branches,
  onAdd,
  onEdit,
}: {
  branches: Branch[];
  onAdd: () => void;
  onEdit: (b: BranchFormValues) => void;
}) {
  const router = useRouter();
  const [deleting, start] = useTransition();
  function onDelete(id: string, name: string) {
    if (!confirm(`Διαγραφή υποκαταστήματος "${name}";`)) return;
    start(async () => {
      const res = await deleteBranch(id);
      if (res.ok) router.refresh();
      else alert(res.error);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {branches.length} υποκαταστήματα · κάθε ένα μπορεί να έχει δικό του ΑΦΜ.
        </p>
        <Button onClick={onAdd} className="h-10 shadow-[var(--shadow-cta)]">
          <Plus className="mr-1 size-4" />
          Νέο υποκατάστημα
        </Button>
      </div>
      {branches.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          Κανένα υποκατάστημα ακόμα.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {branches.map((b) => (
            <li
              key={b.id}
              className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]"
            >
              <header className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 truncate font-display text-sm font-bold text-foreground">
                    {b.commercialName ?? b.legalName}
                    {b.isPrimary && (
                      <Star className="size-3.5 fill-amber-400 stroke-amber-400" />
                    )}
                  </p>
                  {b.commercialName && (
                    <p className="truncate text-xs text-muted-foreground">
                      {b.legalName}
                    </p>
                  )}
                  {b.vat && (
                    <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                      ΑΦΜ {b.vat}
                      {b.doyName && ` · ${b.doyName}`}
                    </p>
                  )}
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      onEdit({
                        id: b.id,
                        vat: b.vat,
                        legalName: b.legalName,
                        commercialName: b.commercialName ?? undefined,
                        doyName: b.doyName ?? undefined,
                        address: b.address ?? undefined,
                        addressNo: b.addressNo ?? undefined,
                        postalZip: b.postalZip ?? undefined,
                        postalArea: b.postalArea ?? undefined,
                        email: b.email ?? undefined,
                        phone: b.phone ?? undefined,
                        isPrimary: b.isPrimary,
                      })
                    }
                    className="rounded-md px-2 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-secondary"
                  >
                    Επεξεργασία
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(b.id, b.legalName)}
                    disabled={deleting}
                    className="grid size-7 place-items-center rounded-md text-destructive hover:bg-destructive/5"
                  >
                    {deleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                  </button>
                </div>
              </header>
              {(b.address || b.postalArea) && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {b.address} {b.addressNo}, {b.postalZip} {b.postalArea}
                </p>
              )}
              {(b.email || b.phone) && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {b.email} {b.phone && ` · ${b.phone}`}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function VehiclesTab({
  vehicles,
  branchMap,
  onAdd,
  onEdit,
}: {
  vehicles: Vehicle[];
  branchMap: Map<string, string>;
  onAdd: () => void;
  onEdit: (v: Vehicle) => void;
}) {
  const router = useRouter();
  const [deleting, start] = useTransition();
  function onDelete(id: string, plate: string) {
    if (!confirm(`Διαγραφή οχήματος ${plate};`)) return;
    start(async () => {
      const res = await deleteVehicle(id);
      if (res.ok) router.refresh();
      else alert(res.error);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {vehicles.length} οχήματα στον στόλο.
        </p>
        <Button onClick={onAdd} className="h-10 shadow-[var(--shadow-cta)]">
          <Plus className="mr-1 size-4" />
          Νέο όχημα
        </Button>
      </div>
      {vehicles.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          Κανένα όχημα ακόμα.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {vehicles.map((v) => (
            <li
              key={v.id}
              className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]"
            >
              <header className="flex items-start justify-between">
                <div>
                  <p className="font-mono text-lg font-bold tracking-widest text-foreground">
                    {v.plate}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {v.brand} {v.model} {v.year && `· ${v.year}`}
                  </p>
                </div>
                <span className="grid size-9 place-items-center rounded-xl bg-[var(--color-brand-blue-light)] text-[var(--color-brand-blue-deep)]">
                  <CarFront className="size-4" />
                </span>
              </header>
              <dl className="mt-3 grid grid-cols-2 gap-1 text-[10px]">
                {v.capacityM3 && (
                  <div className="rounded bg-secondary/40 px-2 py-1">
                    <dt className="uppercase text-muted-foreground">m³</dt>
                    <dd className="font-bold text-foreground">{v.capacityM3}</dd>
                  </div>
                )}
                {v.capacityKg && (
                  <div className="rounded bg-secondary/40 px-2 py-1">
                    <dt className="uppercase text-muted-foreground">kg</dt>
                    <dd className="font-bold text-foreground">{v.capacityKg}</dd>
                  </div>
                )}
              </dl>
              {v.branchId && branchMap.get(v.branchId) && (
                <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  <MapPin className="size-2.5" />
                  {branchMap.get(v.branchId)}
                </p>
              )}
              <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-[10px]">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 font-bold uppercase",
                    v.status === "ACTIVE"
                      ? "bg-emerald-50 text-emerald-700"
                      : v.status === "MAINTENANCE"
                        ? "bg-amber-50 text-amber-700"
                        : "bg-red-50 text-red-700",
                  )}
                >
                  {v.status}
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => onEdit(v)}
                    className="rounded px-2 py-0.5 text-foreground transition-colors hover:bg-secondary"
                  >
                    Επεξεργασία
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(v.id, v.plate)}
                    disabled={deleting}
                    className="rounded px-2 py-0.5 text-destructive hover:bg-destructive/5"
                  >
                    {deleting ? <Loader2 className="inline size-3 animate-spin" /> : "Διαγραφή"}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SubscriptionTab({
  subscription,
  onAssign,
  onEdit,
}: {
  subscription?: SubscriptionLite;
  onAssign: () => void;
  onEdit: (s: SubscriptionLite) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  function onCancel() {
    if (!subscription) return;
    if (!confirm("Ακύρωση τρέχουσας συνδρομής;")) return;
    start(async () => {
      const res = await cancelSubscription(subscription.id);
      if (res.ok) router.refresh();
      else alert(res.error);
    });
  }

  if (!subscription) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
        <p className="font-display text-base font-bold text-foreground">
          Δεν υπάρχει ενεργή συνδρομή
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Ανάθεσε πακέτο για να ξεκινήσει η συνεργασία.
        </p>
        <Button onClick={onAssign} className="mt-4 h-10 shadow-[var(--shadow-cta)]">
          Ανάθεση συνδρομής
        </Button>
      </div>
    );
  }

  const usedCommission = subscription.commissionPct ?? subscription.plan.commissionPct;
  const usedPrice = subscription.pricePerCycle ?? subscription.plan.pricePerMonthCents;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <section className="rounded-2xl border border-border bg-card p-5 lg:col-span-2">
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              Τρέχον πακέτο
            </p>
            <h2 className="font-display text-2xl font-bold text-foreground">
              {subscription.plan.name}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {subscription.status} · {subscription.billingCycle}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onEdit(subscription)}>
              Επεξεργασία
            </Button>
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={pending}
              className="border-destructive/40 text-destructive hover:bg-destructive/5"
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : "Ακύρωση"}
            </Button>
          </div>
        </header>
        <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Mini label="Υποκαταστήματα" value={subscription.maxBranches ?? subscription.plan.maxBranches} />
          <Mini label="Χρήστες" value={subscription.maxEmployees ?? subscription.plan.maxEmployees} />
          <Mini label="Οχήματα" value={subscription.maxVehicles ?? subscription.plan.maxVehicles} />
          <Mini label="Jobs/μήνα" value={subscription.maxMonthlyJobs ?? subscription.plan.maxMonthlyJobs} />
        </dl>
        <div className="mt-4 flex flex-wrap gap-2">
          {(subscription.crmEnabled ?? subscription.plan.crmEnabled) && (
            <Badge>CRM</Badge>
          )}
          {(subscription.privateScanEnabled ?? subscription.plan.privateScanEnabled) && (
            <Badge>Private Scan</Badge>
          )}
          {(subscription.apiAccessEnabled ?? subscription.plan.apiAccessEnabled) && (
            <Badge>API access</Badge>
          )}
          {(subscription.prioritySupport ?? subscription.plan.prioritySupport) && (
            <Badge>Priority support</Badge>
          )}
        </div>
      </section>
      <aside className="flex flex-col gap-3">
        <div className="rounded-2xl border border-[var(--color-brand-blue)]/30 bg-gradient-to-br from-[var(--color-brand-blue-light)] to-card p-5">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Τιμή ανά κύκλο
          </p>
          <p className="font-display text-2xl font-bold text-[var(--color-brand-blue-deep)]">
            {(usedPrice / 100).toFixed(2)}€
          </p>
          <p className="mt-3 text-[10px] uppercase tracking-wide text-muted-foreground">
            Commission ανά μεταφορά
          </p>
          <p className="font-display text-2xl font-bold text-[var(--color-brand-blue-deep)]">
            {usedCommission}%
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 text-xs text-muted-foreground">
          <p>
            <strong className="text-foreground">Έναρξη:</strong>{" "}
            {new Intl.DateTimeFormat("el-GR").format(subscription.startsAt)}
          </p>
          {subscription.trialEndsAt && (
            <p>
              <strong className="text-foreground">Trial έως:</strong>{" "}
              {new Intl.DateTimeFormat("el-GR").format(subscription.trialEndsAt)}
            </p>
          )}
          {subscription.endsAt && (
            <p>
              <strong className="text-foreground">Λήξη:</strong>{" "}
              {new Intl.DateTimeFormat("el-GR").format(subscription.endsAt)}
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm font-medium text-foreground">{children}</dd>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-secondary/40 px-3 py-2 text-center">
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
      <p className="font-display text-lg font-bold text-foreground">{value}</p>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
      ✓ {children}
    </span>
  );
}
