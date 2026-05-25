"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Filter, FolderKanban, Search, User, Users } from "lucide-react";

import { cn } from "@/lib/utils";
import type { GanttTask } from "./gantt";
import { StopGantt, type StopGanttStop } from "./stop-gantt";
import { rescheduleJobTask } from "@/server/actions/carrier-job-tasks.action";

type Mode = "byProject" | "byAssignee" | "flat";

interface MasterTask {
  id: string;
  title: string;
  category: GanttTask["category"];
  status: GanttTask["status"];
  startAt: string;
  durationMinutes: number;
  assigneeKind: GanttTask["assigneeKind"];
  assigneeName: string | null;
  vehiclePlate: string | null;
  moveRequestId: string;
  projectLabel: string;
}

export function TasksMasterClient({
  initialMode,
  tasks,
}: {
  initialMode: Mode;
  tasks: MasterTask[];
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks.filter((t) => {
      if (statusFilter !== "ALL" && t.status !== statusFilter) return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        t.projectLabel.toLowerCase().includes(q) ||
        (t.assigneeName?.toLowerCase().includes(q) ?? false) ||
        (t.vehiclePlate?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [tasks, query, statusFilter]);

  const router = useRouter();

  // Synthesize StopGantt stops grouped by current mode.
  const syntheticStops: StopGanttStop[] = useMemo(() => {
    if (filtered.length === 0) return [];
    const groups = new Map<string, { label: string; tasks: typeof filtered }>();
    for (const t of filtered) {
      const key =
        mode === "byProject"
          ? t.moveRequestId
          : mode === "byAssignee"
            ? `${t.assigneeKind}:${t.assigneeName ?? "—"}`
            : "all";
      const label =
        mode === "byProject"
          ? t.projectLabel
          : mode === "byAssignee"
            ? (t.assigneeName ?? "Χωρίς ανάθεση")
            : "Όλες οι εργασίες";
      const cur = groups.get(key) ?? { label, tasks: [] };
      cur.tasks.push(t);
      groups.set(key, cur);
    }
    let seq = 1;
    return Array.from(groups.entries()).map(([key, g]) => ({
      id: `grp-${key}`,
      sequence: seq++,
      type: "WAYPOINT",
      label: g.label,
      address: "",
      services: [
        {
          id: `svc-${key}`,
          serviceType: "OTHER" as const,
          label: null,
          tasks: g.tasks.map((t) => ({
            id: t.id,
            title: t.title,
            startAt: t.startAt,
            durationMinutes: t.durationMinutes,
            status: t.status,
            assigneeKind: t.assigneeKind,
            assigneeEmployeeName: t.assigneeKind === "EMPLOYEE" ? t.assigneeName : null,
            assigneePartnerName: t.assigneeKind === "PARTNER" ? t.assigneeName : null,
            vehiclePlate: t.vehiclePlate,
          })),
        },
      ],
    }));
  }, [filtered, mode]);

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3 shadow-[var(--shadow-card)] lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-lg border border-border bg-card p-0.5">
            <ModeBtn
              active={mode === "byAssignee"}
              onClick={() => setMode("byAssignee")}
              icon={Users}
            >
              Ανά πρόσωπο
            </ModeBtn>
            <ModeBtn
              active={mode === "byProject"}
              onClick={() => setMode("byProject")}
              icon={FolderKanban}
            >
              Ανά project
            </ModeBtn>
            <ModeBtn
              active={mode === "flat"}
              onClick={() => setMode("flat")}
              icon={Filter}
            >
              Flat
            </ModeBtn>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-0.5">
            {["ALL", "PLANNED", "IN_PROGRESS", "DONE"].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "inline-flex h-7 items-center rounded-md px-2 text-[11px] font-semibold transition-colors",
                  statusFilter === s
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                {labelFor(s)}
                <span className="ml-1 opacity-60 tabular-nums">
                  ({s === "ALL" ? tasks.length : tasks.filter((t) => t.status === s).length})
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Αναζήτηση τίτλου, project, υπαλλήλου…"
            className="h-10 w-full rounded-lg border-2 border-border bg-white pl-9 pr-3 text-sm font-medium outline-none focus:border-[var(--color-brand-blue)] md:w-72"
          />
        </div>
      </div>

      {/* Workload by person (only in byAssignee mode) */}
      {mode === "byAssignee" && (
        <WorkloadSummary tasks={filtered} />
      )}

      {/* Dynamic Gantt — ίδιο με το lead detail πλάνο εργασιών (drag-drop, auto-snap, conflict resolution) */}
      <StopGantt
        stops={syntheticStops}
        onReschedule={async (id, startAtIso, durationMinutes) => {
          const res = await rescheduleJobTask({ id, startAt: startAtIso, durationMinutes });
          if (!res.ok) return { ok: false, error: res.error };
          router.refresh();
          return {
            ok: true,
            warning: res.warning ?? null,
            adjustedStartAt: res.adjustedStartAt ?? null,
          };
        }}
      />

      {/* Footer list — clickable */}
      {filtered.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-3">
          <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Λίστα ({filtered.length})
          </p>
          <ul className="grid gap-1.5">
            {filtered
              .slice()
              .sort(
                (a, b) =>
                  new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
              )
              .slice(0, 30)
              .map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/carrier/leads/${t.moveRequestId}`}
                    className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-secondary/40"
                  >
                    <span
                      className={cn(
                        "size-2 shrink-0 rounded-full",
                        t.status === "DONE"
                          ? "bg-emerald-500"
                          : t.status === "IN_PROGRESS"
                            ? "bg-amber-500"
                            : t.status === "BLOCKED"
                              ? "bg-rose-500"
                              : "bg-secondary",
                      )}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-foreground">
                        {t.title}
                      </p>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {t.projectLabel} ·{" "}
                        {new Intl.DateTimeFormat("el-GR", {
                          weekday: "short",
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        }).format(new Date(t.startAt))}
                      </p>
                    </div>
                    <span className="text-[10px] font-semibold tabular-nums text-muted-foreground">
                      {(t.durationMinutes / 60).toFixed(1)}h
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {t.assigneeName ?? "—"}
                    </span>
                  </Link>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function WorkloadSummary({ tasks }: { tasks: MasterTask[] }) {
  const byPerson = new Map<string, { name: string; kind: string; mins: number; count: number }>();
  for (const t of tasks) {
    const key = `${t.assigneeKind}:${t.assigneeName ?? "—"}`;
    const cur = byPerson.get(key) ?? {
      name: t.assigneeName ?? "Χωρίς ανάθεση",
      kind: t.assigneeKind,
      mins: 0,
      count: 0,
    };
    cur.mins += t.durationMinutes;
    cur.count += 1;
    byPerson.set(key, cur);
  }
  const list = Array.from(byPerson.values()).sort((a, b) => b.mins - a.mins);
  if (list.length === 0) return null;
  const maxMins = list[0].mins;
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
      <p className="mb-3 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        Φόρτος ανά πρόσωπο
      </p>
      <ul className="grid gap-2">
        {list.slice(0, 8).map((p) => {
          const Icon =
            p.kind === "EMPLOYEE"
              ? User
              : p.kind === "PARTNER"
                ? Users
                : Users;
          return (
            <li key={p.name} className="flex items-center gap-3">
              <div className="flex w-44 shrink-0 items-center gap-2 truncate">
                <span className="grid size-7 shrink-0 place-items-center rounded-md bg-secondary text-muted-foreground">
                  <Icon className="size-3.5" />
                </span>
                <span className="truncate text-xs font-semibold text-foreground">
                  {p.name}
                </span>
              </div>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-[var(--color-brand-blue)]"
                  style={{ width: `${(p.mins / maxMins) * 100}%` }}
                />
              </div>
              <span className="w-12 text-right text-[11px] font-bold tabular-nums text-foreground">
                {(p.mins / 60).toFixed(1)}h
              </span>
              <span className="w-8 text-right text-[10px] tabular-nums text-muted-foreground">
                {p.count}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ModeBtn({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof User;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[11px] font-semibold transition-colors",
        active
          ? "bg-[var(--color-brand-blue)] text-white"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground",
      )}
    >
      <Icon className="size-3.5" />
      {children}
    </button>
  );
}

function labelFor(s: string): string {
  switch (s) {
    case "ALL":
      return "Όλες";
    case "PLANNED":
      return "Πλάνο";
    case "IN_PROGRESS":
      return "Σε εξέλιξη";
    case "DONE":
      return "Done";
    default:
      return s;
  }
}
