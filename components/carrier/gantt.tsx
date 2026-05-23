"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock,
  Pencil,
  Plus,
  Truck,
  User,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";

// ---------------- Types ----------------

export type TaskStatus =
  | "PLANNED"
  | "CONFIRMED"
  | "IN_PROGRESS"
  | "DONE"
  | "BLOCKED"
  | "CANCELLED";

export type TaskCategory =
  | "PREP"
  | "LOADING"
  | "TRANSIT"
  | "CRANE"
  | "UNLOADING"
  | "ASSEMBLY"
  | "STORAGE"
  | "CLEANUP"
  | "ADMIN"
  | "OTHER";

export interface GanttTask {
  id: string;
  title: string;
  category: TaskCategory;
  status: TaskStatus;
  /** ISO datetime */
  startAt: string;
  durationMinutes: number;
  assigneeKind: "EMPLOYEE" | "PARTNER" | "UNASSIGNED";
  assigneeName: string | null;
  vehiclePlate: string | null;
  /** Used for grouping rows. When `mode="byProject"` this is the project key. */
  groupKey?: string;
  groupLabel?: string;
  /** Optional anchor link (e.g. to project detail) */
  href?: string;
}

interface Props {
  tasks: GanttTask[];
  /** Initial timeline anchor (defaults to today). */
  initialAnchor?: string;
  /** How many days to render. Default 14. */
  days?: number;
  /** Grouping mode for lanes */
  mode?: "byProject" | "byAssignee" | "flat";
  onEdit?: (taskId: string) => void;
  onCreate?: () => void;
  /** Inline status change callback */
  onStatusChange?: (taskId: string, next: TaskStatus) => void;
}

// ---------------- Color tokens ----------------

const CATEGORY_COLOR: Record<TaskCategory, { bg: string; ring: string; text: string }> = {
  PREP: { bg: "bg-sky-500", ring: "ring-sky-500/30", text: "text-sky-700" },
  LOADING: { bg: "bg-amber-500", ring: "ring-amber-500/30", text: "text-amber-700" },
  TRANSIT: {
    bg: "bg-[var(--color-brand-blue)]",
    ring: "ring-[var(--color-brand-blue)]/30",
    text: "text-[var(--color-brand-blue-deep)]",
  },
  CRANE: { bg: "bg-orange-500", ring: "ring-orange-500/30", text: "text-orange-700" },
  UNLOADING: { bg: "bg-emerald-500", ring: "ring-emerald-500/30", text: "text-emerald-700" },
  ASSEMBLY: { bg: "bg-violet-500", ring: "ring-violet-500/30", text: "text-violet-700" },
  STORAGE: { bg: "bg-cyan-500", ring: "ring-cyan-500/30", text: "text-cyan-700" },
  CLEANUP: { bg: "bg-pink-500", ring: "ring-pink-500/30", text: "text-pink-700" },
  ADMIN: { bg: "bg-slate-500", ring: "ring-slate-500/30", text: "text-slate-700" },
  OTHER: { bg: "bg-zinc-500", ring: "ring-zinc-500/30", text: "text-zinc-700" },
};

const CATEGORY_LABEL: Record<TaskCategory, string> = {
  PREP: "Προετοιμασία",
  LOADING: "Φόρτωση",
  TRANSIT: "Διαδρομή",
  CRANE: "Γερανός",
  UNLOADING: "Ξεφόρτωμα",
  ASSEMBLY: "Συναρμολόγηση",
  STORAGE: "Αποθήκευση",
  CLEANUP: "Καθαρισμός",
  ADMIN: "Διαχείριση",
  OTHER: "Άλλο",
};

const STATUS_META: Record<
  TaskStatus,
  { label: string; chip: string; opacity: string }
> = {
  PLANNED: { label: "Πλάνο", chip: "bg-secondary text-muted-foreground", opacity: "opacity-80" },
  CONFIRMED: { label: "Επιβεβ.", chip: "bg-indigo-100 text-indigo-800", opacity: "" },
  IN_PROGRESS: {
    label: "Σε εξέλιξη",
    chip: "bg-amber-100 text-amber-800",
    opacity: "",
  },
  DONE: {
    label: "Ολοκληρώθηκε",
    chip: "bg-emerald-100 text-emerald-800",
    opacity: "",
  },
  BLOCKED: {
    label: "Μπλοκαρισμένο",
    chip: "bg-rose-100 text-rose-700",
    opacity: "opacity-90",
  },
  CANCELLED: {
    label: "Ακυρώθηκε",
    chip: "bg-secondary text-muted-foreground line-through",
    opacity: "opacity-50",
  },
};

// ---------------- Component ----------------

const DAY_WIDTH_PX = 160; // each day is 160px wide
const LANE_HEIGHT = 56;

export function Gantt({
  tasks,
  initialAnchor,
  days = 14,
  mode = "flat",
  onEdit,
  onCreate,
  onStatusChange,
}: Props) {
  const [anchor, setAnchor] = useState<Date>(() => {
    if (initialAnchor) return new Date(initialAnchor);
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  });

  const dates = useMemo(() => {
    const list: Date[] = [];
    const start = new Date(anchor);
    start.setHours(0, 0, 0, 0);
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      list.push(d);
    }
    return list;
  }, [anchor, days]);

  const startMs = dates[0].getTime();
  const endMs = startMs + days * 86400 * 1000;
  const totalMs = endMs - startMs;

  // Filter to visible window then group into lanes
  const visibleTasks = useMemo(
    () =>
      tasks.filter((t) => {
        const s = new Date(t.startAt).getTime();
        const e = s + t.durationMinutes * 60 * 1000;
        return e > startMs && s < endMs;
      }),
    [tasks, startMs, endMs],
  );

  const lanes = useMemo(() => {
    const map = new Map<string, { label: string; tasks: GanttTask[] }>();
    for (const t of visibleTasks) {
      let key: string;
      let label: string;
      if (mode === "byProject") {
        key = t.groupKey ?? "—";
        label = t.groupLabel ?? "Χωρίς project";
      } else if (mode === "byAssignee") {
        key = `${t.assigneeKind}:${t.assigneeName ?? "—"}`;
        label = t.assigneeName ?? "Χωρίς ανάθεση";
      } else {
        key = t.id;
        label = t.title;
      }
      if (!map.has(key)) map.set(key, { label, tasks: [] });
      map.get(key)!.tasks.push(t);
    }
    return Array.from(map.entries());
  }, [visibleTasks, mode]);

  // For flat mode each task gets its own lane
  // For grouped modes, we pack tasks into sub-lanes within a group when overlapping
  const laneRows = useMemo(() => {
    const rows: Array<{
      groupKey: string;
      groupLabel: string;
      sublanes: GanttTask[][];
    }> = [];
    for (const [key, { label, tasks: ts }] of lanes) {
      const sorted = [...ts].sort(
        (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
      );
      const sublanes: GanttTask[][] = [];
      for (const t of sorted) {
        const tStart = new Date(t.startAt).getTime();
        const tEnd = tStart + t.durationMinutes * 60_000;
        let placed = false;
        for (const sl of sublanes) {
          const last = sl[sl.length - 1];
          const lastEnd =
            new Date(last.startAt).getTime() + last.durationMinutes * 60_000;
          if (tStart >= lastEnd) {
            sl.push(t);
            placed = true;
            break;
          }
        }
        if (!placed) sublanes.push([t]);
      }
      rows.push({ groupKey: key, groupLabel: label, sublanes });
    }
    return rows;
  }, [lanes]);

  const shift = (delta: number) => {
    const d = new Date(anchor);
    d.setDate(d.getDate() + delta);
    setAnchor(d);
  };

  const totalLanes = laneRows.reduce((s, r) => s + r.sublanes.length, 0);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 border-b border-border bg-secondary/30 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAnchor(today())}
            className="inline-flex h-8 items-center rounded-md border border-border bg-card px-2.5 text-xs font-semibold text-foreground hover:bg-secondary"
          >
            Σήμερα
          </button>
          <div className="flex items-center rounded-md border border-border bg-card">
            <button
              type="button"
              onClick={() => shift(-days)}
              className="grid size-8 place-items-center text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <ChevronLeft className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => shift(days)}
              className="grid size-8 place-items-center border-l border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <ChevronRight className="size-3.5" />
            </button>
          </div>
          <span className="text-xs font-semibold text-foreground">
            {formatRange(dates[0], dates[dates.length - 1])}
          </span>
        </div>
        {onCreate && (
          <button
            type="button"
            onClick={onCreate}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[var(--color-brand-blue)] px-3 text-xs font-bold text-white hover:bg-[var(--color-brand-blue-deep)]"
          >
            <Plus className="size-3.5" />
            Νέα εργασία
          </button>
        )}
      </div>

      {/* Body — scrolls horizontally */}
      <div className="overflow-x-auto">
        <div className="flex" style={{ minWidth: 240 + days * DAY_WIDTH_PX }}>
          {/* Sticky lane labels column */}
          <div className="sticky left-0 z-10 w-60 shrink-0 border-r border-border bg-card">
            <div className="h-12 border-b border-border bg-secondary/30 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              {mode === "byProject"
                ? "Μεταφορά"
                : mode === "byAssignee"
                  ? "Ανάθεση"
                  : "Εργασία"}
            </div>
            {laneRows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Clock className="size-8 text-muted-foreground/50" />
                <p className="mt-2 px-3 text-xs text-muted-foreground">
                  Καμία εργασία στο παράθυρο.
                </p>
              </div>
            ) : (
              laneRows.map((row) => (
                <div key={row.groupKey} className="border-b border-border">
                  {row.sublanes.map((sub, i) => (
                    <div
                      key={i}
                      style={{ height: LANE_HEIGHT }}
                      className="flex items-center gap-2 px-3 text-xs"
                    >
                      {i === 0 ? (
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {row.groupLabel}
                          </p>
                          {row.sublanes.length > 1 && (
                            <p className="text-[10px] text-muted-foreground">
                              {row.sublanes.length} γραμμές
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="ml-3 text-[10px] text-muted-foreground/60">
                          ↳
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>

          {/* Timeline grid */}
          <div className="flex-1">
            {/* Date header */}
            <div
              className="flex h-12 border-b border-border bg-secondary/30"
              style={{ minWidth: days * DAY_WIDTH_PX }}
            >
              {dates.map((d) => {
                const isToday = isSameDay(d, new Date());
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                return (
                  <div
                    key={d.toISOString()}
                    style={{ width: DAY_WIDTH_PX }}
                    className={cn(
                      "shrink-0 border-r border-border px-2 py-1.5 last:border-r-0",
                      isWeekend && "bg-secondary/40",
                    )}
                  >
                    <div className="flex items-baseline gap-1.5">
                      <span
                        className={cn(
                          "text-[10px] font-bold uppercase",
                          isToday ? "text-[var(--color-brand-blue)]" : "text-muted-foreground",
                        )}
                      >
                        {WEEKDAY[(d.getDay() + 6) % 7]}
                      </span>
                      <span
                        className={cn(
                          "text-sm font-bold tabular-nums",
                          isToday ? "text-[var(--color-brand-blue)]" : "text-foreground",
                        )}
                      >
                        {d.getDate()}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {MONTH_SHORT[d.getMonth()]}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Rows */}
            <div className="relative" style={{ minWidth: days * DAY_WIDTH_PX }}>
              {/* Grid background lines */}
              <div className="pointer-events-none absolute inset-0 flex">
                {dates.map((d) => {
                  const isToday = isSameDay(d, new Date());
                  const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                  return (
                    <div
                      key={d.toISOString()}
                      style={{ width: DAY_WIDTH_PX }}
                      className={cn(
                        "shrink-0 border-r border-border last:border-r-0",
                        isWeekend && "bg-secondary/30",
                        isToday && "bg-[var(--color-brand-blue)]/5",
                      )}
                    />
                  );
                })}
              </div>

              {/* "Now" vertical line */}
              <NowLine startMs={startMs} totalMs={totalMs} totalHeight={totalLanes * LANE_HEIGHT} />

              {/* Lanes with bars */}
              {laneRows.map((row) => (
                <div key={row.groupKey} className="relative border-b border-border">
                  {row.sublanes.map((sub, i) => (
                    <div key={i} className="relative" style={{ height: LANE_HEIGHT }}>
                      {sub.map((t) => (
                        <Bar
                          key={t.id}
                          task={t}
                          startMs={startMs}
                          totalMs={totalMs}
                          onEdit={onEdit ? () => onEdit(t.id) : undefined}
                          onStatusChange={onStatusChange}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 border-t border-border bg-secondary/20 px-4 py-2 text-[10px]">
        <span className="font-bold uppercase tracking-wide text-muted-foreground">
          Κατηγορίες:
        </span>
        {(Object.keys(CATEGORY_LABEL) as TaskCategory[]).map((c) => (
          <span key={c} className="inline-flex items-center gap-1.5">
            <span className={cn("size-2 rounded-full", CATEGORY_COLOR[c].bg)} />
            <span className="text-muted-foreground">{CATEGORY_LABEL[c]}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------------- Bar ----------------

function Bar({
  task,
  startMs,
  totalMs,
  onEdit,
  onStatusChange,
}: {
  task: GanttTask;
  startMs: number;
  totalMs: number;
  onEdit?: () => void;
  onStatusChange?: (taskId: string, next: TaskStatus) => void;
}) {
  const tStart = new Date(task.startAt).getTime();
  const tDur = task.durationMinutes * 60_000;
  const tEnd = tStart + tDur;

  // Clamp to window
  const clampedStart = Math.max(tStart, startMs);
  const clampedEnd = Math.min(tEnd, startMs + totalMs);
  const left = ((clampedStart - startMs) / totalMs) * 100;
  const width = ((clampedEnd - clampedStart) / totalMs) * 100;

  const color = CATEGORY_COLOR[task.category];
  const status = STATUS_META[task.status];
  const Icon = assigneeIcon(task.assigneeKind);

  const [menuOpen, setMenuOpen] = useState(false);
  const hours = task.durationMinutes / 60;

  return (
    <div
      className={cn(
        "absolute top-1.5 bottom-1.5 group/bar overflow-visible",
        status.opacity,
      )}
      style={{ left: `${left}%`, width: `${width}%` }}
    >
      <div
        className={cn(
          "group/inner relative h-full overflow-hidden rounded-lg ring-1 transition-all hover:-translate-y-0.5 hover:shadow-lg",
          color.bg,
          color.ring,
          task.status === "DONE" && "ring-emerald-300",
          task.status === "BLOCKED" && "ring-rose-400",
          task.status === "CANCELLED" && "ring-zinc-300",
        )}
      >
        {/* Stripe for IN_PROGRESS */}
        {task.status === "IN_PROGRESS" && (
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, rgba(255,255,255,0.5) 0 6px, transparent 6px 12px)",
            }}
            aria-hidden
          />
        )}
        {/* Checkmark overlay for DONE */}
        {task.status === "DONE" && (
          <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
            <CheckCircle2 className="size-3.5 text-white drop-shadow" />
          </div>
        )}
        {task.status === "BLOCKED" && (
          <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
            <CircleAlert className="size-3.5 text-white drop-shadow" />
          </div>
        )}

        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="block h-full w-full px-2 text-left text-white"
          title={`${task.title} · ${hours.toFixed(1)}h`}
        >
          <p className="truncate text-[11px] font-bold leading-tight">
            {task.title}
          </p>
          <p className="flex items-center gap-1 truncate text-[9px] font-semibold opacity-90">
            <Icon className="size-2.5" />
            {task.assigneeName ?? "Χωρίς ανάθεση"} · {hours.toFixed(1)}h
            {task.vehiclePlate && (
              <>
                {" "}
                · <Truck className="size-2.5" />
                {task.vehiclePlate}
              </>
            )}
          </p>
        </button>
      </div>

      {/* Popover */}
      {menuOpen && (
        <div
          className="absolute left-0 top-full z-30 mt-1 w-72 rounded-xl border border-border bg-card p-3 shadow-2xl"
          onMouseLeave={() => setMenuOpen(false)}
        >
          <div className="mb-2 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-foreground">
                {task.title}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {CATEGORY_LABEL[task.category]} · {formatDt(new Date(task.startAt))} · {hours.toFixed(1)}h
              </p>
            </div>
            {onEdit && (
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onEdit();
                }}
                className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
                title="Επεξεργασία"
              >
                <Pencil className="size-3.5" />
              </button>
            )}
          </div>
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Ανάθεση
          </p>
          <p className="mb-2 text-xs font-semibold text-foreground">
            {task.assigneeName ?? "Χωρίς ανάθεση"}
            {task.vehiclePlate && (
              <span className="ml-1 text-muted-foreground">· {task.vehiclePlate}</span>
            )}
          </p>
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Κατάσταση
          </p>
          {onStatusChange ? (
            <div className="grid grid-cols-2 gap-1">
              {(["PLANNED", "IN_PROGRESS", "DONE", "BLOCKED"] as TaskStatus[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    onStatusChange(task.id, s);
                    setMenuOpen(false);
                  }}
                  className={cn(
                    "rounded-md px-2 py-1 text-[10px] font-bold transition-colors",
                    task.status === s
                      ? STATUS_META[s].chip + " ring-1 ring-foreground/20"
                      : "border border-border bg-card text-muted-foreground hover:bg-secondary",
                  )}
                >
                  {STATUS_META[s].label}
                </button>
              ))}
            </div>
          ) : (
            <span
              className={cn(
                "inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                status.chip,
              )}
            >
              {status.label}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function NowLine({
  startMs,
  totalMs,
  totalHeight,
}: {
  startMs: number;
  totalMs: number;
  totalHeight: number;
}) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  if (now === null) return null;
  if (now < startMs || now > startMs + totalMs) return null;
  const left = ((now - startMs) / totalMs) * 100;
  return (
    <div
      className="pointer-events-none absolute top-0 z-20"
      style={{ left: `${left}%`, height: totalHeight }}
    >
      <div className="absolute -left-1.5 top-0 size-3 rounded-full bg-[var(--color-brand-red)] shadow-md" />
      <div className="absolute top-0 h-full w-0.5 bg-[var(--color-brand-red)]" />
    </div>
  );
}

// ---------------- Helpers ----------------

const WEEKDAY = ["Δευ", "Τρι", "Τετ", "Πεμ", "Παρ", "Σαβ", "Κυρ"];
const MONTH_SHORT = [
  "Ιαν",
  "Φεβ",
  "Μαρ",
  "Απρ",
  "Μαϊ",
  "Ιουν",
  "Ιουλ",
  "Αυγ",
  "Σεπ",
  "Οκτ",
  "Νοε",
  "Δεκ",
];

function today(): Date {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatRange(a: Date, b: Date): string {
  const sameMonth =
    a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  if (sameMonth) {
    return `${a.getDate()}–${b.getDate()} ${MONTH_SHORT[a.getMonth()]} ${a.getFullYear()}`;
  }
  return `${a.getDate()} ${MONTH_SHORT[a.getMonth()]} – ${b.getDate()} ${MONTH_SHORT[b.getMonth()]} ${b.getFullYear()}`;
}

function formatDt(d: Date): string {
  return new Intl.DateTimeFormat("el-GR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function assigneeIcon(kind: GanttTask["assigneeKind"]) {
  if (kind === "EMPLOYEE") return User;
  if (kind === "PARTNER") return Users;
  return Clock;
}
