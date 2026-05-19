"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { upsertSubscription } from "@/server/actions/subscriptions.action";

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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  plans: Plan[];
  initial?: {
    id?: string;
    planId?: string;
    status?: string;
    billingCycle?: string;
    startsAt?: Date | string | null;
    endsAt?: Date | string | null;
    trialEndsAt?: Date | string | null;
    pricePerCycleEur?: number;
    commissionPct?: number | null;
    notes?: string | null;
  } | null;
}

export function SubscriptionDialog({
  open,
  onOpenChange,
  tenantId,
  plans,
  initial,
}: Props) {
  const router = useRouter();
  const [planId, setPlanId] = useState(initial?.planId ?? plans[0]?.id ?? "");
  const [status, setStatus] = useState(initial?.status ?? "TRIAL");
  const [billingCycle, setBillingCycle] = useState(
    initial?.billingCycle ?? "MONTHLY",
  );
  const [overrideCommission, setOverrideCommission] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const editing = !!initial?.id;
  const selectedPlan = plans.find((p) => p.id === planId);

  const [startsAt, setStartsAt] = useState<Date | null>(
    toDateOrNull(initial?.startsAt),
  );
  const [trialEndsAt, setTrialEndsAt] = useState<Date | null>(
    toDateOrNull(initial?.trialEndsAt),
  );
  const [endsAt, setEndsAt] = useState<Date | null>(
    toDateOrNull(initial?.endsAt),
  );

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const payload = {
      id: initial?.id,
      tenantId,
      planId,
      status,
      billingCycle,
      startsAt: String(fd.get("startsAt") ?? "") || undefined,
      endsAt: String(fd.get("endsAt") ?? "") || undefined,
      trialEndsAt: String(fd.get("trialEndsAt") ?? "") || undefined,
      pricePerCycleEur: fd.get("pricePerCycleEur")
        ? Number(fd.get("pricePerCycleEur"))
        : undefined,
      commissionPct: overrideCommission
        ? Number(fd.get("commissionPct"))
        : undefined,
      notes: String(fd.get("notes") ?? "") || undefined,
    };
    start(async () => {
      const res = await upsertSubscription(payload);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-3xl sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Επεξεργασία συνδρομής" : "Ανάθεση συνδρομής"}
          </DialogTitle>
          <DialogDescription>
            Διάλεξε πακέτο και ορισέ περίοδο. Μπορείς να κάνεις override σε
            προμήθεια ή τιμή για αυτόν τον πελάτη.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-foreground">
              Πακέτο συνδρομής
            </span>
            <select
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
              className="h-11 rounded-lg border border-input bg-card px-3 text-sm font-medium text-foreground"
              required
            >
              {plans.length === 0 ? (
                <option value="">— Δεν υπάρχουν πακέτα —</option>
              ) : (
                plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {(p.pricePerMonthCents / 100).toFixed(0)}€/μήνα ·{" "}
                    {p.commissionPct}% commission
                  </option>
                ))
              )}
            </select>
          </label>

          {selectedPlan && (
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-secondary/40 p-3 text-xs text-muted-foreground sm:grid-cols-4">
              <Mini label="Υποκατ." value={selectedPlan.maxBranches} />
              <Mini label="Χρήστες" value={selectedPlan.maxEmployees} />
              <Mini label="Οχήματα" value={selectedPlan.maxVehicles} />
              <Mini label="Jobs/μήνα" value={selectedPlan.maxMonthlyJobs} />
              <FeatureRow plan={selectedPlan} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-foreground">
                Κατάσταση
              </span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="h-11 rounded-lg border border-input bg-card px-3 text-sm font-medium text-foreground"
              >
                <option value="TRIAL">Trial</option>
                <option value="ACTIVE">Active</option>
                <option value="PAUSED">Paused</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="EXPIRED">Expired</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-foreground">
                Κύκλος χρέωσης
              </span>
              <select
                value={billingCycle}
                onChange={(e) => setBillingCycle(e.target.value)}
                className="h-11 rounded-lg border border-input bg-card px-3 text-sm font-medium text-foreground"
              >
                <option value="MONTHLY">Μηνιαία</option>
                <option value="YEARLY">Ετήσια</option>
                <option value="CUSTOM">Custom</option>
              </select>
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-foreground">
                Έναρξη
              </span>
              <DatePicker
                name="startsAt"
                value={startsAt}
                onChange={setStartsAt}
                placeholder="Επίλεξε έναρξη"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-foreground">
                Trial λήξη
              </span>
              <DatePicker
                name="trialEndsAt"
                value={trialEndsAt}
                onChange={setTrialEndsAt}
                placeholder="—"
                fromDate={startsAt ?? undefined}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-foreground">
                Λήξη
              </span>
              <DatePicker
                name="endsAt"
                value={endsAt}
                onChange={setEndsAt}
                placeholder="—"
                fromDate={startsAt ?? undefined}
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-foreground">
                Τιμή ανά κύκλο (€) — προαιρετικό override
              </span>
              <Input
                type="number"
                step="0.01"
                min={0}
                name="pricePerCycleEur"
                defaultValue={initial?.pricePerCycleEur}
                placeholder={
                  selectedPlan
                    ? (selectedPlan.pricePerMonthCents / 100).toFixed(2)
                    : ""
                }
              />
            </label>
            <div className="flex flex-col gap-1.5">
              <label className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <input
                  type="checkbox"
                  checked={overrideCommission}
                  onChange={(e) => setOverrideCommission(e.target.checked)}
                  className="size-3.5 cursor-pointer rounded border-border accent-[var(--color-brand-blue)]"
                />
                Override commission %
              </label>
              <Input
                type="number"
                step="0.1"
                min={0}
                max={100}
                name="commissionPct"
                disabled={!overrideCommission}
                defaultValue={initial?.commissionPct ?? selectedPlan?.commissionPct}
                placeholder={`${selectedPlan?.commissionPct ?? 5}%`}
              />
            </div>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-foreground">
              Σημειώσεις
            </span>
            <Textarea
              name="notes"
              defaultValue={initial?.notes ?? ""}
              rows={2}
              placeholder="π.χ. ειδική συμφωνία, εκτεταμένη trial..."
            />
          </label>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
              {error}
            </div>
          )}

          <div className="flex gap-2 border-t border-border pt-3">
            <Button
              type="button"
              variant="outline"
              className="h-10 flex-1"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Άκυρο
            </Button>
            <Button
              type="submit"
              className="h-10 flex-1 shadow-[var(--shadow-cta)]"
              disabled={pending || plans.length === 0}
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : editing ? (
                "Αποθήκευση"
              ) : (
                "Ανάθεση"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
      <p className="font-bold text-foreground">{value}</p>
    </div>
  );
}

function FeatureRow({ plan }: { plan: Plan }) {
  const features = [
    plan.crmEnabled && "CRM",
    plan.privateScanEnabled && "Private Scan",
    plan.apiAccessEnabled && "API",
    plan.prioritySupport && "Priority",
  ].filter(Boolean);
  return (
    <div className="col-span-2 sm:col-span-4 mt-2 flex flex-wrap items-center gap-1.5 border-t border-border pt-2 text-[10px]">
      <span className="font-semibold text-foreground">Features:</span>
      {features.length === 0 ? (
        <span>—</span>
      ) : (
        features.map((f) => (
          <span
            key={String(f)}
            className="rounded-full bg-[var(--color-brand-blue-light)] px-1.5 py-0.5 font-semibold text-[var(--color-brand-blue-deep)]"
          >
            {f}
          </span>
        ))
      )}
    </div>
  );
}

function toDateOrNull(d?: Date | string | null): Date | null {
  if (!d) return null;
  const dt = typeof d === "string" ? new Date(d) : d;
  return Number.isNaN(dt.getTime()) ? null : dt;
}
