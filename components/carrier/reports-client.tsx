"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { cn } from "@/lib/utils";
import type {
  CarrierReportsData,
  ReportRange,
} from "@/server/actions/carrier-reports.action";

const SERVICE_LABELS: Record<string, string> = {
  CRANE: "Γερανός",
  PACKING: "Συσκευασία",
  LOADING: "Φόρτωση",
  UNLOADING: "Εκφόρτωση",
  ASSEMBLY: "Συναρμολόγηση",
  DISASSEMBLY: "Αποσυναρμολόγηση",
  STORAGE: "Αποθήκευση",
  TRANSIT: "Μεταφορά",
  CLEANUP: "Καθαρισμός",
  OTHER: "Άλλο",
};

const RANGES: { value: ReportRange; label: string }[] = [
  { value: "month", label: "Μήνας" },
  { value: "quarter", label: "Τρίμηνο" },
  { value: "ytd", label: "Από αρχή έτους" },
];

function eur(cents: number) {
  return `${(cents / 100).toLocaleString("el-GR", { maximumFractionDigits: 0 })}€`;
}

function hours(minutes: number) {
  return `${(minutes / 60).toFixed(1)}h`;
}

export function CarrierReportsClient({ data }: { data: CarrierReportsData }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function setRange(r: ReportRange) {
    const next = new URLSearchParams(params);
    next.set("range", r);
    startTransition(() => router.push(`/carrier/reports?${next.toString()}`));
  }

  const maxRevenue = Math.max(1, ...data.revenueByService.map((r) => r.totalCents));
  const maxMinutes = Math.max(1, ...data.employeeUtilization.map((r) => r.assignedMinutes));

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2">
        {RANGES.map((r) => (
          <button
            key={r.value}
            type="button"
            onClick={() => setRange(r.value)}
            disabled={pending}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm font-medium transition",
              data.range === r.value
                ? "border-emerald-600 bg-emerald-600 text-white"
                : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400",
              pending && "opacity-60",
            )}
          >
            {r.label}
          </button>
        ))}
        <span className="ml-auto text-sm text-zinc-500">{data.rangeLabel}</span>
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <header className="mb-4 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-zinc-900">Έσοδα ανά υπηρεσία</h2>
          <span className="text-sm text-zinc-500">Σύνολο: {eur(data.totals.revenueCents)}</span>
        </header>
        {data.revenueByService.filter((r) => r.totalCents > 0).length === 0 ? (
          <p className="text-sm text-zinc-500">Δεν υπάρχουν έσοδα σε αυτή την περίοδο.</p>
        ) : (
          <ul className="space-y-3">
            {data.revenueByService
              .filter((r) => r.totalCents > 0)
              .map((row) => {
                const pct = (row.totalCents / maxRevenue) * 100;
                return (
                  <li key={row.serviceType}>
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="font-medium text-zinc-800">
                        {SERVICE_LABELS[row.serviceType] ?? row.serviceType}
                      </span>
                      <span className="text-zinc-600">
                        {eur(row.totalCents)}{" "}
                        <span className="text-xs text-zinc-400">({row.count})</span>
                      </span>
                    </div>
                    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-zinc-100">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <header className="mb-4 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-zinc-900">Χρήση προσωπικού</h2>
          <span className="text-sm text-zinc-500">Σύνολο: {hours(data.totals.assignedMinutes)}</span>
        </header>
        {data.employeeUtilization.length === 0 ? (
          <p className="text-sm text-zinc-500">Δεν υπάρχουν αναθέσεις σε αυτή την περίοδο.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500">
                <th className="pb-2 font-medium">Υπάλληλος</th>
                <th className="pb-2 font-medium">Tasks</th>
                <th className="pb-2 font-medium">Ώρες</th>
                <th className="pb-2 font-medium">Κατανομή</th>
              </tr>
            </thead>
            <tbody>
              {data.employeeUtilization.map((row) => {
                const pct = (row.assignedMinutes / maxMinutes) * 100;
                return (
                  <tr key={row.employeeId} className="border-b border-zinc-100 last:border-0">
                    <td className="py-2.5 font-medium text-zinc-800">{row.name}</td>
                    <td className="py-2.5 text-zinc-600">{row.taskCount}</td>
                    <td className="py-2.5 text-zinc-600">{hours(row.assignedMinutes)}</td>
                    <td className="py-2.5">
                      <div className="h-2 w-full max-w-[240px] overflow-hidden rounded-full bg-zinc-100">
                        <div
                          className="h-full rounded-full bg-blue-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <header className="mb-4">
          <h2 className="text-lg font-semibold text-zinc-900">Top υπηρεσίες</h2>
          <p className="text-xs text-zinc-500">Κατά πλήθος και έσοδα.</p>
        </header>
        {data.topServices.length === 0 ? (
          <p className="text-sm text-zinc-500">Δεν υπάρχουν δεδομένα.</p>
        ) : (
          <ol className="space-y-2">
            {data.topServices.map((row, i) => (
              <li
                key={row.serviceType}
                className="flex items-center justify-between rounded-lg border border-zinc-100 bg-zinc-50/50 px-3 py-2"
              >
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-xs font-semibold text-white">
                    {i + 1}
                  </span>
                  <span className="font-medium text-zinc-800">
                    {SERVICE_LABELS[row.serviceType] ?? row.serviceType}
                  </span>
                </div>
                <div className="text-sm text-zinc-600">
                  <span className="font-medium text-zinc-800">{row.count}</span> ×{" "}
                  <span>{eur(row.totalCents)}</span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
