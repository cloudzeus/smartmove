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
import { upsertPlan } from "@/server/actions/subscriptions.action";

export interface PlanFormValues {
  id?: string;
  name?: string;
  slug?: string;
  description?: string;
  maxBranches?: number;
  maxEmployees?: number;
  maxVehicles?: number;
  maxMonthlyJobs?: number;
  crmEnabled?: boolean;
  privateScanEnabled?: boolean;
  apiAccessEnabled?: boolean;
  prioritySupport?: boolean;
  pricePerMonthEur?: number;
  pricePerYearEur?: number | null;
  commissionPct?: number;
  isActive?: boolean;
  sortOrder?: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: PlanFormValues | null;
}

export function PlanDialog({ open, onOpenChange, initial }: Props) {
  const router = useRouter();
  const [crmEnabled, setCrmEnabled] = useState(initial?.crmEnabled ?? false);
  const [privateScanEnabled, setPrivateScanEnabled] = useState(
    initial?.privateScanEnabled ?? false,
  );
  const [apiAccessEnabled, setApiAccessEnabled] = useState(
    initial?.apiAccessEnabled ?? false,
  );
  const [prioritySupport, setPrioritySupport] = useState(
    initial?.prioritySupport ?? false,
  );
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const editing = !!initial?.id;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const payload = {
      id: initial?.id,
      name: String(fd.get("name") ?? ""),
      slug: String(fd.get("slug") ?? ""),
      description: String(fd.get("description") ?? "") || undefined,
      maxBranches: Number(fd.get("maxBranches") ?? 1),
      maxEmployees: Number(fd.get("maxEmployees") ?? 5),
      maxVehicles: Number(fd.get("maxVehicles") ?? 3),
      maxMonthlyJobs: Number(fd.get("maxMonthlyJobs") ?? 50),
      crmEnabled,
      privateScanEnabled,
      apiAccessEnabled,
      prioritySupport,
      pricePerMonthEur: Number(fd.get("pricePerMonthEur") ?? 0),
      pricePerYearEur: fd.get("pricePerYearEur")
        ? Number(fd.get("pricePerYearEur"))
        : undefined,
      commissionPct: Number(fd.get("commissionPct") ?? 5),
      isActive,
      sortOrder: Number(fd.get("sortOrder") ?? 0),
    };
    start(async () => {
      const res = await upsertPlan(payload);
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
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Επεξεργασία πακέτου" : "Νέο πακέτο συνδρομής"}
          </DialogTitle>
          <DialogDescription>
            Καθόρισε όρια (υποκαταστήματα, χρήστες, οχήματα, jobs), features και
            τιμολόγηση.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <F label="Όνομα" req>
              <Input
                name="name"
                defaultValue={initial?.name}
                required
                placeholder="Pro"
              />
            </F>
            <F label="Slug (μοναδικό)" req>
              <Input
                name="slug"
                defaultValue={initial?.slug}
                required
                placeholder="pro"
                className="font-mono"
              />
            </F>
          </div>

          <F label="Περιγραφή">
            <Textarea
              name="description"
              defaultValue={initial?.description}
              rows={2}
              placeholder="π.χ. Για μεσαίες μεταφορικές με 2-3 υποκαταστήματα"
            />
          </F>

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Όρια
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Num label="Υποκαταστήματα" name="maxBranches" def={initial?.maxBranches ?? 1} />
              <Num label="Χρήστες" name="maxEmployees" def={initial?.maxEmployees ?? 5} />
              <Num label="Οχήματα" name="maxVehicles" def={initial?.maxVehicles ?? 3} />
              <Num label="Jobs/μήνα" name="maxMonthlyJobs" def={initial?.maxMonthlyJobs ?? 50} />
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Features
            </p>
            <div className="grid grid-cols-2 gap-2">
              <FeatureToggle
                label="CRM"
                checked={crmEnabled}
                onChange={setCrmEnabled}
              />
              <FeatureToggle
                label="Private Scan (ιδιωτική ογκομέτρηση)"
                checked={privateScanEnabled}
                onChange={setPrivateScanEnabled}
              />
              <FeatureToggle
                label="API Access"
                checked={apiAccessEnabled}
                onChange={setApiAccessEnabled}
              />
              <FeatureToggle
                label="Priority Support"
                checked={prioritySupport}
                onChange={setPrioritySupport}
              />
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Τιμολόγηση
            </p>
            <div className="grid grid-cols-3 gap-2">
              <F label="€/μήνα">
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  name="pricePerMonthEur"
                  defaultValue={initial?.pricePerMonthEur ?? 0}
                />
              </F>
              <F label="€/έτος (προαιρ.)">
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  name="pricePerYearEur"
                  defaultValue={initial?.pricePerYearEur ?? undefined}
                />
              </F>
              <F label="Commission %">
                <Input
                  type="number"
                  step="0.1"
                  min={0}
                  max={100}
                  name="commissionPct"
                  defaultValue={initial?.commissionPct ?? 5}
                />
              </F>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-secondary/40 p-3 text-xs">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="size-4 cursor-pointer rounded border-border accent-[var(--color-brand-blue)]"
              />
              <span className="font-semibold text-foreground">Ενεργό πακέτο</span>
            </label>
            <F label="Sort order">
              <Input
                type="number"
                name="sortOrder"
                defaultValue={initial?.sortOrder ?? 0}
              />
            </F>
          </div>

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
              disabled={pending}
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : editing ? (
                "Αποθήκευση"
              ) : (
                "Δημιουργία"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function F({
  label,
  children,
  req,
}: {
  label: string;
  children: React.ReactNode;
  req?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold text-foreground">
        {label}
        {req && <span className="text-destructive"> *</span>}
      </span>
      {children}
    </label>
  );
}

function Num({
  label,
  name,
  def,
}: {
  label: string;
  name: string;
  def: number;
}) {
  return (
    <F label={label}>
      <Input type="number" min={0} name={name} defaultValue={def} />
    </F>
  );
}

function FeatureToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 rounded-lg bg-secondary/40 p-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 cursor-pointer rounded border-border accent-[var(--color-brand-blue)]"
      />
      <span className="text-xs font-medium text-foreground">{label}</span>
    </label>
  );
}
