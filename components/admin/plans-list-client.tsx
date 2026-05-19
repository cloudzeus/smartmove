"use client";

import { useState } from "react";
import { Edit2, Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PlanDialog, type PlanFormValues } from "./plan-dialog";

interface Plan {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  maxBranches: number;
  maxEmployees: number;
  maxVehicles: number;
  maxMonthlyJobs: number;
  crmEnabled: boolean;
  privateScanEnabled: boolean;
  apiAccessEnabled: boolean;
  prioritySupport: boolean;
  pricePerMonthCents: number;
  pricePerYearCents: number | null;
  commissionPct: number;
  isActive: boolean;
  sortOrder: number;
  _count: { subscriptions: number };
}

export function PlansListClient({ plans }: { plans: Plan[] }) {
  const [editing, setEditing] = useState<PlanFormValues | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <>
      <div className="mb-5 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {plans.length} πακέτα · {plans.filter((p) => p.isActive).length}{" "}
          ενεργά
        </p>
        <Button onClick={() => setCreating(true)} className="h-10 shadow-[var(--shadow-cta)]">
          <Plus className="mr-1 size-4" />
          Νέο πακέτο
        </Button>
      </div>

      {plans.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          Δεν έχουν δημιουργηθεί πακέτα ακόμα.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((p) => (
            <li key={p.id}>
              <article
                className={cn(
                  "flex h-full flex-col gap-4 rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)] transition-all",
                  !p.isActive && "opacity-60",
                )}
              >
                <header className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-display text-lg font-bold text-foreground">
                      {p.name}
                    </h3>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      {p.slug}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setEditing({
                        id: p.id,
                        name: p.name,
                        slug: p.slug,
                        description: p.description ?? undefined,
                        maxBranches: p.maxBranches,
                        maxEmployees: p.maxEmployees,
                        maxVehicles: p.maxVehicles,
                        maxMonthlyJobs: p.maxMonthlyJobs,
                        crmEnabled: p.crmEnabled,
                        privateScanEnabled: p.privateScanEnabled,
                        apiAccessEnabled: p.apiAccessEnabled,
                        prioritySupport: p.prioritySupport,
                        pricePerMonthEur: p.pricePerMonthCents / 100,
                        pricePerYearEur: p.pricePerYearCents
                          ? p.pricePerYearCents / 100
                          : null,
                        commissionPct: p.commissionPct,
                        isActive: p.isActive,
                        sortOrder: p.sortOrder,
                      })
                    }
                    className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
                  >
                    <Edit2 className="size-4" />
                  </button>
                </header>

                {p.description && (
                  <p className="text-xs text-muted-foreground">
                    {p.description}
                  </p>
                )}

                <div className="flex items-baseline gap-2">
                  <span className="font-display text-3xl font-bold text-foreground">
                    {(p.pricePerMonthCents / 100).toFixed(0)}€
                  </span>
                  <span className="text-xs text-muted-foreground">/μήνα</span>
                </div>

                <div className="rounded-lg bg-[var(--color-brand-blue-light)] px-3 py-2 text-center">
                  <p className="text-[10px] uppercase text-muted-foreground">
                    Commission ανά μεταφορά
                  </p>
                  <p className="font-display text-lg font-bold text-[var(--color-brand-blue-deep)]">
                    {p.commissionPct}%
                  </p>
                </div>

                <ul className="space-y-1 text-xs text-foreground">
                  <Limit label="Υποκαταστήματα" value={p.maxBranches} />
                  <Limit label="Χρήστες" value={p.maxEmployees} />
                  <Limit label="Οχήματα" value={p.maxVehicles} />
                  <Limit label="Jobs/μήνα" value={p.maxMonthlyJobs} />
                </ul>

                <div className="flex flex-wrap gap-1">
                  {p.crmEnabled && <FeatureChip>CRM</FeatureChip>}
                  {p.privateScanEnabled && <FeatureChip>Scan</FeatureChip>}
                  {p.apiAccessEnabled && <FeatureChip>API</FeatureChip>}
                  {p.prioritySupport && <FeatureChip>Priority</FeatureChip>}
                </div>

                <div className="mt-auto flex items-center justify-between border-t border-border pt-3 text-[11px]">
                  <span className="text-muted-foreground">
                    {p._count.subscriptions} ενεργές συνδρομές
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 font-bold uppercase",
                      p.isActive
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-secondary text-muted-foreground",
                    )}
                  >
                    {p.isActive ? "Ενεργό" : "Ανενεργό"}
                  </span>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}

      <PlanDialog open={creating} onOpenChange={setCreating} />
      <PlanDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        initial={editing}
      />
    </>
  );
}

function Limit({ label, value }: { label: string; value: number }) {
  return (
    <li className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-bold tabular-nums">{value}</span>
    </li>
  );
}

function FeatureChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
      ✓ {children}
    </span>
  );
}
