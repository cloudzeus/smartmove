"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  CalendarClock,
  Clock,
  MapPin,
  Truck,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────────────

type ConfirmStatus = "NONE" | "PENDING" | "CONFIRMED" | "DECLINED";

export type StopGanttServiceType =
  | "CRANE" | "PACKING" | "LOADING" | "UNLOADING"
  | "ASSEMBLY" | "DISASSEMBLY" | "STORAGE" | "TRANSIT"
  | "CLEANUP" | "OTHER";

export type StopGanttTaskStatus =
  | "PLANNED" | "CONFIRMED" | "IN_PROGRESS" | "DONE" | "BLOCKED" | "CANCELLED";

export interface StopGanttTask {
  id: string;
  title: string;
  startAt: string;
  durationMinutes: number;
  status: StopGanttTaskStatus;
  assigneeKind: string;
  assigneeEmployeeId?: string | null;
  assigneeEmployeeName?: string | null;
  assigneePartnerName?: string | null;
  vehiclePlate?: string | null;
  confirmationStatus?: ConfirmStatus;
}

export interface StopGanttService {
  id: string;
  serviceType: StopGanttServiceType;
  label: string | null;
  tasks: StopGanttTask[];
}

export interface StopGanttStop {
  id: string;
  sequence: number;
  type: string; // "PICKUP" | "DROPOFF" | "WAYPOINT" | ...
  label: string | null;
  address: string;
  services: StopGanttService[];
}

export interface RescheduleResult {
  ok: boolean;
  error?: string;
  /** Non-blocking warning shown in yellow banner (e.g. saved despite conflict). */
  warning?: string | null;
  /** If server auto-shifted the task, the ISO start the client should snap to. */
  adjustedStartAt?: string | null;
}

interface Props {
  stops: StopGanttStop[];
  /** Fallback anchor when there are zero tasks (e.g. project scheduled start). */
  fallbackDate?: Date | null;
  onTaskClick?: (taskId: string) => void;
  /**
   * Called when a bar is dropped (move or edge-resize). If omitted, bars
   * are not draggable. Should persist and return ok=false to revert.
   */
  onReschedule?: (
    taskId: string,
    startAtIso: string,
    durationMinutes: number,
  ) => Promise<RescheduleResult>;
}

const SNAP_MINUTES = 15;
const SNAP_MS = SNAP_MINUTES * 60_000;
const MIN_DURATION_MIN = 15;
const DRAG_THRESHOLD_PX = 4;

// ─── Service visuals ────────────────────────────────────────────────

const SERVICE_LABELS: Record<StopGanttServiceType, string> = {
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

// Each service gets a saturated bar fill + a softer row tint.
const SERVICE_COLORS: Record<
  StopGanttServiceType,
  { bar: string; barRing: string; rowTint: string; dot: string }
> = {
  CRANE:        { bar: "bg-amber-500",   barRing: "ring-amber-600",   rowTint: "bg-amber-50/40",   dot: "bg-amber-500" },
  PACKING:      { bar: "bg-violet-500",  barRing: "ring-violet-600",  rowTint: "bg-violet-50/40",  dot: "bg-violet-500" },
  LOADING:      { bar: "bg-sky-500",     barRing: "ring-sky-600",     rowTint: "bg-sky-50/40",     dot: "bg-sky-500" },
  UNLOADING:    { bar: "bg-cyan-500",    barRing: "ring-cyan-600",    rowTint: "bg-cyan-50/40",    dot: "bg-cyan-500" },
  ASSEMBLY:     { bar: "bg-emerald-500", barRing: "ring-emerald-600", rowTint: "bg-emerald-50/40", dot: "bg-emerald-500" },
  DISASSEMBLY:  { bar: "bg-teal-500",    barRing: "ring-teal-600",    rowTint: "bg-teal-50/40",    dot: "bg-teal-500" },
  STORAGE:      { bar: "bg-slate-500",   barRing: "ring-slate-600",   rowTint: "bg-slate-50/40",   dot: "bg-slate-500" },
  TRANSIT:      { bar: "bg-blue-600",    barRing: "ring-blue-700",    rowTint: "bg-blue-50/40",    dot: "bg-blue-600" },
  CLEANUP:      { bar: "bg-lime-500",    barRing: "ring-lime-600",    rowTint: "bg-lime-50/40",    dot: "bg-lime-500" },
  OTHER:        { bar: "bg-zinc-500",    barRing: "ring-zinc-600",    rowTint: "bg-zinc-50/40",    dot: "bg-zinc-500" },
};

const STATUS_TONES: Record<StopGanttTaskStatus, { stripe: string; label: string; muted?: boolean }> = {
  PLANNED:     { stripe: "bg-zinc-300",    label: "Προγραμματισμένο" },
  CONFIRMED:   { stripe: "bg-emerald-400", label: "Επιβεβαιωμένο" },
  IN_PROGRESS: { stripe: "bg-blue-500",    label: "Σε εξέλιξη" },
  DONE:        { stripe: "bg-emerald-600", label: "Ολοκληρώθηκε" },
  BLOCKED:     { stripe: "bg-rose-500",    label: "Μπλοκαρισμένο" },
  CANCELLED:   { stripe: "bg-zinc-400",    label: "Ακυρωμένο", muted: true },
};

// ─── Helpers ────────────────────────────────────────────────────────

function fmtTime(d: Date) {
  return d.toLocaleTimeString("el-GR", { hour: "2-digit", minute: "2-digit" });
}
function fmtDate(d: Date) {
  return d.toLocaleDateString("el-GR", { weekday: "short", day: "2-digit", month: "short" });
}
function startOfHour(ms: number) {
  const d = new Date(ms);
  d.setMinutes(0, 0, 0);
  return d.getTime();
}
function endOfHour(ms: number) {
  const d = new Date(ms);
  if (d.getMinutes() === 0 && d.getSeconds() === 0 && d.getMilliseconds() === 0) return d.getTime();
  d.setMinutes(0, 0, 0);
  return d.getTime() + 3600_000;
}

function stopIcon(type: string) {
  if (type === "PICKUP")  return ArrowUpFromLine;
  if (type === "DROPOFF") return ArrowDownToLine;
  return MapPin;
}

function stopTypeLabel(type: string) {
  if (type === "PICKUP")  return "Φόρτωση";
  if (type === "DROPOFF") return "Εκφόρτωση";
  if (type === "WAYPOINT") return "Ενδιάμεση";
  return type;
}

interface FlatTask extends StopGanttTask {
  stopId: string;
  serviceId: string;
  serviceType: StopGanttServiceType;
}

function buildConflictSet(tasks: FlatTask[]): Set<string> {
  // Two tasks conflict if they share an employee assignee and overlap in time
  // (excluding CANCELLED).
  const out = new Set<string>();
  const live = tasks.filter((t) => t.status !== "CANCELLED" && t.assigneeEmployeeId);
  for (let i = 0; i < live.length; i++) {
    const a = live[i];
    const aStart = new Date(a.startAt).getTime();
    const aEnd = aStart + a.durationMinutes * 60_000;
    for (let j = i + 1; j < live.length; j++) {
      const b = live[j];
      if (b.assigneeEmployeeId !== a.assigneeEmployeeId) continue;
      const bStart = new Date(b.startAt).getTime();
      const bEnd = bStart + b.durationMinutes * 60_000;
      if (aStart < bEnd && bStart < aEnd) {
        out.add(a.id);
        out.add(b.id);
      }
    }
  }
  return out;
}

// ─── Component ──────────────────────────────────────────────────────

const LABEL_WIDTH = 240;
const LANE_HEIGHT = 40;
const STOP_HEADER_HEIGHT = 36;
const HEADER_HEIGHT = 48;
const MIN_BAR_WIDTH = 56;

export function StopGantt({ stops, fallbackDate, onTaskClick, onReschedule }: Props) {
  // Local overrides for optimistic drag preview + persisted updates that
  // haven't yet round-tripped through the server. Keyed by taskId.
  const [overrides, setOverrides] = useState<Record<string, { startAt: string; durationMinutes: number }>>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [warnMsg, setWarnMsg] = useState<string | null>(null);

  // Build a lookup of the server's current view of each task.
  const serverByTaskId = useMemo(() => {
    const m = new Map<string, { startAt: string; durationMinutes: number }>();
    for (const s of stops) {
      for (const svc of s.services) {
        for (const t of svc.tasks) {
          m.set(t.id, { startAt: t.startAt, durationMinutes: t.durationMinutes });
        }
      }
    }
    return m;
  }, [stops]);

  // The override is the SOURCE OF TRUTH on the client after a successful drag.
  // We do NOT auto-clear it when server data catches up — that race was the
  // cause of "snap back" reports. The override is dropped only when:
  //   (a) the task disappears from the stops list (deleted server-side), OR
  //   (b) the user starts a new drag on the same task (replaces the value), OR
  //   (c) a save failure reverts it.
  useEffect(() => {
    setOverrides((prev) => {
      let changed = false;
      const next: typeof prev = {};
      for (const [taskId, o] of Object.entries(prev)) {
        if (!serverByTaskId.has(taskId)) {
          changed = true;
          continue; // task deleted → drop
        }
        next[taskId] = o;
      }
      return changed ? next : prev;
    });
  }, [serverByTaskId]);

  const applyOverride = (t: StopGanttTask): StopGanttTask => {
    const o = overrides[t.id];
    if (!o) return t;
    return { ...t, startAt: o.startAt, durationMinutes: o.durationMinutes };
  };

  const flatTasks: FlatTask[] = useMemo(() => {
    const out: FlatTask[] = [];
    for (const stop of stops) {
      for (const svc of stop.services) {
        for (const t of svc.tasks) {
          const eff = applyOverride(t);
          out.push({ ...eff, stopId: stop.id, serviceId: svc.id, serviceType: svc.serviceType });
        }
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stops, overrides]);

  // Time range — span the first task to the last, with 30-min padding,
  // snapped to hour boundaries. Minimum 4h window so bars never look tiny.
  const range = useMemo(() => {
    if (flatTasks.length === 0) {
      const base = fallbackDate ? new Date(fallbackDate) : new Date();
      base.setHours(8, 0, 0, 0);
      const start = base.getTime();
      return { startMs: start, endMs: start + 10 * 3600_000 };
    }
    let earliest = Infinity;
    let latest = -Infinity;
    for (const t of flatTasks) {
      const s = new Date(t.startAt).getTime();
      const e = s + t.durationMinutes * 60_000;
      if (s < earliest) earliest = s;
      if (e > latest) latest = e;
    }
    const padded = {
      startMs: startOfHour(earliest - 30 * 60_000),
      endMs: endOfHour(latest + 30 * 60_000),
    };
    const minSpanMs = 4 * 3600_000;
    if (padded.endMs - padded.startMs < minSpanMs) {
      padded.endMs = padded.startMs + minSpanMs;
    }
    return padded;
  }, [flatTasks, fallbackDate]);

  const totalMs = range.endMs - range.startMs;
  const totalHours = totalMs / 3600_000;

  // Auto-scale hour width so the timeline targets ~1100px when possible,
  // but never let bars get unreadable (min 64px/hr) or absurdly wide (max 140).
  const hourWidth = useMemo(() => {
    const target = 1100;
    const ideal = target / totalHours;
    return Math.max(64, Math.min(140, Math.round(ideal)));
  }, [totalHours]);

  const timelineWidth = totalHours * hourWidth;

  // Day boundary lines (when crossing midnight)
  const dayBoundaries = useMemo(() => {
    const out: { offsetPx: number; label: string }[] = [];
    const start = new Date(range.startMs);
    let cursor = new Date(start);
    cursor.setHours(0, 0, 0, 0);
    cursor.setDate(cursor.getDate() + 1); // first midnight after start
    while (cursor.getTime() < range.endMs) {
      const offsetMs = cursor.getTime() - range.startMs;
      out.push({
        offsetPx: (offsetMs / totalMs) * timelineWidth,
        label: fmtDate(cursor),
      });
      cursor = new Date(cursor.getTime() + 86400_000);
    }
    return out;
  }, [range.startMs, range.endMs, totalMs, timelineWidth]);

  const hourTicks = useMemo(() => {
    const out: { ms: number; offsetPx: number }[] = [];
    for (let ms = range.startMs; ms < range.endMs; ms += 3600_000) {
      out.push({ ms, offsetPx: ((ms - range.startMs) / totalMs) * timelineWidth });
    }
    return out;
  }, [range.startMs, range.endMs, totalMs, timelineWidth]);

  const conflictIds = useMemo(() => buildConflictSet(flatTasks), [flatTasks]);

  // ─── Drag/resize state ────────────────────────────────────────────
  type DragMode = "move" | "resize-left" | "resize-right";
  interface DragState {
    taskId: string;
    mode: DragMode;
    pointerStartX: number;
    origStartMs: number;
    origDurationMin: number;
    previewStartMs: number;
    previewDurationMin: number;
    moved: boolean;
  }
  const [drag, setDrag] = useState<DragState | null>(null);

  const msPerPx = 3600_000 / hourWidth;
  const snapMs = (ms: number) => Math.round(ms / SNAP_MS) * SNAP_MS;

  // Window pointer listeners — attached only while dragging so we don't
  // pay the cost when idle.
  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => {
      const dxPx = e.clientX - drag.pointerStartX;
      const dxMs = dxPx * msPerPx;
      setDrag((cur) => {
        if (!cur) return cur;
        const moved = cur.moved || Math.abs(dxPx) > DRAG_THRESHOLD_PX;
        if (cur.mode === "move") {
          const next = snapMs(cur.origStartMs + dxMs);
          return { ...cur, previewStartMs: next, moved };
        }
        if (cur.mode === "resize-right") {
          const endMs = cur.origStartMs + cur.origDurationMin * 60_000 + dxMs;
          const snappedEnd = snapMs(endMs);
          const minEnd = cur.origStartMs + MIN_DURATION_MIN * 60_000;
          const finalEnd = Math.max(snappedEnd, minEnd);
          return { ...cur, previewDurationMin: Math.round((finalEnd - cur.origStartMs) / 60_000), moved };
        }
        // resize-left: start moves, end stays fixed
        const endMs = cur.origStartMs + cur.origDurationMin * 60_000;
        const rawStart = cur.origStartMs + dxMs;
        const snappedStart = snapMs(rawStart);
        const maxStart = endMs - MIN_DURATION_MIN * 60_000;
        const finalStart = Math.min(snappedStart, maxStart);
        return {
          ...cur,
          previewStartMs: finalStart,
          previewDurationMin: Math.round((endMs - finalStart) / 60_000),
          moved,
        };
      });
    };
    const onUp = async () => {
      const cur = drag;
      setDrag(null);
      if (!cur || !cur.moved) return; // treat as click
      const changedStart = cur.previewStartMs !== cur.origStartMs;
      const changedDur = cur.previewDurationMin !== cur.origDurationMin;
      if (!changedStart && !changedDur) return;
      const newStartIso = new Date(cur.previewStartMs).toISOString();
      // Optimistic update
      setOverrides((prev) => ({
        ...prev,
        [cur.taskId]: { startAt: newStartIso, durationMinutes: cur.previewDurationMin },
      }));
      if (!onReschedule) return;
      const res = await onReschedule(cur.taskId, newStartIso, cur.previewDurationMin);
      if (!res.ok) {
        // Revert override
        setOverrides((prev) => {
          const next = { ...prev };
          delete next[cur.taskId];
          return next;
        });
        setErrorMsg(res.error ?? "Η αποθήκευση απέτυχε.");
        console.error("[reschedule] failed:", res.error);
      } else {
        setErrorMsg(null);
        setWarnMsg(res.warning ?? null);
        // If server auto-snapped, update the override to the adjusted start.
        if (res.adjustedStartAt) {
          setOverrides((prev) => ({
            ...prev,
            [cur.taskId]: { startAt: res.adjustedStartAt!, durationMinutes: cur.previewDurationMin },
          }));
        }
        console.log("[reschedule] saved:", cur.taskId, res.adjustedStartAt ?? newStartIso, res.warning ? `(warning: ${res.warning})` : "");
      }
      // On success the parent will router.refresh() → stopsRef changes → overrides reset
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag, msPerPx, onReschedule]);

  const startDragOnBar = (e: React.PointerEvent, task: FlatTask, mode: DragMode) => {
    if (!onReschedule) return;
    e.preventDefault();
    e.stopPropagation();
    const s = new Date(task.startAt).getTime();
    setDrag({
      taskId: task.id,
      mode,
      pointerStartX: e.clientX,
      origStartMs: s,
      origDurationMin: task.durationMinutes,
      previewStartMs: s,
      previewDurationMin: task.durationMinutes,
      moved: false,
    });
  };

  // Current time indicator — deferred to client to avoid SSR/CSR hydration mismatch.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  const showNow = now !== null && now >= range.startMs && now <= range.endMs;
  const nowOffset = showNow && now !== null ? ((now - range.startMs) / totalMs) * timelineWidth : 0;

  // Empty state
  if (flatTasks.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center">
        <CalendarClock className="mx-auto h-10 w-10 text-zinc-400" />
        <p className="mt-3 text-sm font-medium text-zinc-700">
          Δεν υπάρχουν εργασίες ακόμη
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Πρόσθεσε αναθέσεις από την καρτέλα «Πλάνο» για να εμφανιστούν εδώ.
        </p>
      </div>
    );
  }

  const startDate = new Date(range.startMs);
  const endDate = new Date(range.endMs);
  const spanLabel =
    startDate.toDateString() === new Date(endDate.getTime() - 1).toDateString()
      ? fmtDate(startDate)
      : `${fmtDate(startDate)} → ${fmtDate(new Date(endDate.getTime() - 1))}`;

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      {/* Persistent error banner from a rejected drag */}
      {errorMsg && (
        <div className="flex items-start gap-2 border-b border-rose-200 bg-rose-50 px-3 py-2">
          <AlertTriangle className="size-4 shrink-0 text-rose-600 mt-0.5" />
          <p className="flex-1 text-[12px] text-rose-800">{errorMsg}</p>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold text-rose-700 hover:bg-rose-100"
          >
            ✕
          </button>
        </div>
      )}
      {/* Soft warning banner — saved despite conflict */}
      {warnMsg && (
        <div className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-3 py-2">
          <AlertTriangle className="size-4 shrink-0 text-amber-600 mt-0.5" />
          <p className="flex-1 text-[12px] text-amber-900">{warnMsg}</p>
          <button
            type="button"
            onClick={() => setWarnMsg(null)}
            className="shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 hover:bg-amber-100"
          >
            ✕
          </button>
        </div>
      )}
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-50/70 px-4 py-2.5">
        <div className="flex items-center gap-2 text-sm">
          <CalendarClock className="h-4 w-4 text-zinc-500" />
          <span className="font-semibold text-zinc-800">{spanLabel}</span>
          <span className="text-zinc-400">·</span>
          <span className="text-zinc-600">
            {fmtTime(startDate)} – {fmtTime(endDate)}
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs text-zinc-500">
          <span>{flatTasks.length} εργασί{flatTasks.length === 1 ? "α" : "ες"}</span>
          <span>·</span>
          <span>{stops.length} {stops.length === 1 ? "στάση" : "στάσεις"}</span>
          {conflictIds.size > 0 && (
            <>
              <span>·</span>
              <span className="inline-flex items-center gap-1 text-rose-600">
                <AlertTriangle className="h-3.5 w-3.5" />
                {conflictIds.size / 2} σύγκρουση{conflictIds.size / 2 === 1 ? "" : "ις"}
              </span>
            </>
          )}
          {drag && drag.moved && (
            <>
              <span>·</span>
              <span className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2 py-0.5 font-mono text-[11px] font-semibold text-white">
                {fmtDate(new Date(drag.previewStartMs))} {fmtTime(new Date(drag.previewStartMs))}
                {" → "}
                {fmtTime(new Date(drag.previewStartMs + drag.previewDurationMin * 60_000))}
                <span className="opacity-80">
                  ({Math.floor(drag.previewDurationMin / 60)}h{drag.previewDurationMin % 60 ? ` ${drag.previewDurationMin % 60}m` : ""})
                </span>
              </span>
            </>
          )}
        </div>
      </div>

      {/* Scrollable timeline area */}
      <div className="overflow-x-auto">
        <div style={{ width: LABEL_WIDTH + timelineWidth + 1 }}>
          {/* Header */}
          <div
            className="sticky top-0 z-20 flex border-b border-zinc-200 bg-white"
            style={{ height: HEADER_HEIGHT }}
          >
            <div
              className="shrink-0 border-r border-zinc-200 bg-zinc-50/80 px-3"
              style={{ width: LABEL_WIDTH }}
            >
              <div className="flex h-full flex-col justify-center">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                  Στάση / Υπηρεσία
                </div>
              </div>
            </div>
            <div className="relative flex-1">
              {/* Hour ticks */}
              {hourTicks.map((tick, i) => {
                const d = new Date(tick.ms);
                const isMidnight = d.getHours() === 0;
                return (
                  <div
                    key={i}
                    className="absolute top-0 bottom-0 border-l border-zinc-200 px-1.5"
                    style={{ left: tick.offsetPx, width: hourWidth }}
                  >
                    <div className="pt-2 font-mono text-[11px] font-semibold tabular-nums text-zinc-700">
                      {String(d.getHours()).padStart(2, "0")}:00
                    </div>
                    {isMidnight && i > 0 && (
                      <div className="pt-0.5 text-[10px] font-semibold text-blue-600">
                        {fmtDate(d)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Body */}
          <div className="relative">
            {/* vertical hour grid behind everything */}
            <div
              className="pointer-events-none absolute top-0 bottom-0"
              style={{ left: LABEL_WIDTH, width: timelineWidth }}
            >
              {hourTicks.map((tick, i) => (
                <div
                  key={i}
                  className="absolute top-0 bottom-0 border-l border-zinc-100"
                  style={{ left: tick.offsetPx }}
                />
              ))}
              {dayBoundaries.map((d, i) => (
                <div
                  key={`db-${i}`}
                  className="absolute top-0 bottom-0 border-l-2 border-dashed border-blue-300/70"
                  style={{ left: d.offsetPx }}
                />
              ))}
              {showNow && (
                <div
                  className="absolute top-0 bottom-0 z-10 border-l-2 border-rose-500"
                  style={{ left: nowOffset }}
                >
                  <div className="absolute -left-1.5 -top-1 h-3 w-3 rounded-full bg-rose-500 shadow ring-2 ring-white" />
                </div>
              )}
            </div>

            {stops.map((stop) => {
              const StopIcon = stopIcon(stop.type);
              const stopHasTasks = stop.services.some((s) => s.tasks.length > 0);
              return (
                <div key={stop.id}>
                  {/* Stop header row */}
                  <div
                    className="flex items-center border-b border-zinc-200 bg-gradient-to-r from-zinc-50 to-transparent"
                    style={{ height: STOP_HEADER_HEIGHT }}
                  >
                    <div
                      className="sticky left-0 z-10 flex h-full items-center gap-2 border-r border-zinc-200 bg-gradient-to-r from-zinc-50 to-white px-3"
                      style={{ width: LABEL_WIDTH }}
                    >
                      <span className="grid h-6 w-6 place-items-center rounded-full bg-zinc-900 text-[10px] font-bold text-white">
                        {stop.sequence}
                      </span>
                      <StopIcon className="h-3.5 w-3.5 text-zinc-500" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[11px] font-bold text-zinc-800">
                          {stop.label ?? stopTypeLabel(stop.type)}
                        </div>
                        <div className="truncate text-[10px] text-zinc-500">
                          {stop.address}
                        </div>
                      </div>
                    </div>
                    <div className="flex-1" />
                  </div>

                  {/* Service rows */}
                  {stop.services.length === 0 || !stopHasTasks ? (
                    <div
                      className="flex items-center border-b border-zinc-100"
                      style={{ height: LANE_HEIGHT }}
                    >
                      <div
                        className="sticky left-0 z-[5] h-full border-r border-zinc-200 bg-white px-3 py-1.5"
                        style={{ width: LABEL_WIDTH }}
                      />
                      <div className="flex h-full flex-1 items-center pl-3 text-[11px] italic text-zinc-400">
                        Χωρίς αναθέσεις
                      </div>
                    </div>
                  ) : (
                    stop.services.map((svc) => {
                      const colors = SERVICE_COLORS[svc.serviceType];
                      const label = svc.label || SERVICE_LABELS[svc.serviceType];
                      return (
                        <div
                          key={svc.id}
                          className={cn(
                            "relative flex border-b border-zinc-100 last:border-b-0",
                            colors.rowTint,
                          )}
                          style={{ height: LANE_HEIGHT }}
                        >
                          <div
                            className="sticky left-0 z-[5] flex h-full items-center gap-2 border-r border-zinc-200 bg-white px-3"
                            style={{ width: LABEL_WIDTH }}
                          >
                            <span className={cn("h-2 w-2 shrink-0 rounded-full", colors.dot)} />
                            <span className="truncate text-[11px] font-semibold text-zinc-700">
                              {label}
                            </span>
                            {svc.tasks.length > 1 && (
                              <span className="ml-auto inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-zinc-100 px-1 text-[9px] font-bold text-zinc-600">
                                {svc.tasks.length}
                              </span>
                            )}
                          </div>
                          <div className="relative flex-1">
                            {svc.tasks.length === 0 ? (
                              <div className="flex h-full items-center pl-2 text-[10px] italic text-zinc-400">
                                —
                              </div>
                            ) : (
                              svc.tasks.map((task) => {
                                const effective = applyOverride(task);
                                const isDragging = drag?.taskId === task.id;
                                const s = isDragging
                                  ? drag.previewStartMs
                                  : new Date(effective.startAt).getTime();
                                const durMin = isDragging
                                  ? drag.previewDurationMin
                                  : effective.durationMinutes;
                                const e = s + durMin * 60_000;
                                const left = ((s - range.startMs) / totalMs) * timelineWidth;
                                const widthRaw = (durMin * 60_000 / totalMs) * timelineWidth;
                                const width = Math.max(MIN_BAR_WIDTH, widthRaw);
                                const status = STATUS_TONES[effective.status];
                                const inConflict = conflictIds.has(task.id);
                                const assignee =
                                  effective.assigneeEmployeeName ??
                                  effective.assigneePartnerName ??
                                  "Χωρίς ανάθεση";
                                const flatForDrag: FlatTask = {
                                  ...effective,
                                  stopId: stop.id,
                                  serviceId: svc.id,
                                  serviceType: svc.serviceType,
                                };
                                const draggable = !!onReschedule;
                                return (
                                  <div
                                    key={task.id}
                                    role={onTaskClick ? "button" : undefined}
                                    tabIndex={onTaskClick ? 0 : -1}
                                    onPointerDown={
                                      draggable
                                        ? (ev) => {
                                            // Only react to primary button / touch
                                            if (ev.button !== undefined && ev.button !== 0) return;
                                            startDragOnBar(ev, flatForDrag, "move");
                                          }
                                        : undefined
                                    }
                                    onClick={() => {
                                      // Suppress click when the drag actually moved.
                                      if (drag?.taskId === task.id && drag?.moved) return;
                                      onTaskClick?.(task.id);
                                    }}
                                    onKeyDown={(ev) => {
                                      if (ev.key === "Enter" || ev.key === " ") {
                                        ev.preventDefault();
                                        onTaskClick?.(task.id);
                                      }
                                    }}
                                    title={`${task.title} · ${fmtTime(new Date(s))}–${fmtTime(new Date(e))} · ${assignee}`}
                                    className={cn(
                                      "group absolute flex select-none items-center gap-1.5 overflow-hidden rounded-md px-2 text-left text-white shadow-sm transition",
                                      "hover:z-20 hover:shadow-lg",
                                      draggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
                                      colors.bar,
                                      status.muted && "opacity-50 saturate-50",
                                      inConflict && "ring-2 ring-rose-500 ring-offset-1",
                                      isDragging && "z-30 shadow-xl ring-2 ring-white",
                                    )}
                                    style={{
                                      left,
                                      width,
                                      top: 4,
                                      height: LANE_HEIGHT - 8,
                                    }}
                                  >
                                    {/* Status stripe */}
                                    <span className={cn("absolute left-0 top-0 h-full w-1", status.stripe)} />
                                    {/* Left resize handle */}
                                    {draggable && (
                                      <span
                                        onPointerDown={(ev) => {
                                          if (ev.button !== undefined && ev.button !== 0) return;
                                          startDragOnBar(ev, flatForDrag, "resize-left");
                                        }}
                                        className="absolute left-0 top-0 z-10 h-full w-2 cursor-ew-resize bg-black/0 hover:bg-black/20"
                                      />
                                    )}
                                    {/* Right resize handle */}
                                    {draggable && (
                                      <span
                                        onPointerDown={(ev) => {
                                          if (ev.button !== undefined && ev.button !== 0) return;
                                          startDragOnBar(ev, flatForDrag, "resize-right");
                                        }}
                                        className="absolute right-0 top-0 z-10 h-full w-2 cursor-ew-resize bg-black/0 hover:bg-black/20"
                                      />
                                    )}
                                    <div className="ml-1 flex min-w-0 flex-1 items-center gap-1.5">
                                      <div className="min-w-0 flex-1">
                                        <div className="truncate text-[11px] font-bold leading-tight">
                                          {task.title}
                                        </div>
                                        <div className="flex items-center gap-1 truncate text-[10px] leading-tight opacity-90">
                                          <span className="font-mono tabular-nums">
                                            {fmtTime(new Date(s))}–{fmtTime(new Date(e))}
                                          </span>
                                          {assignee && (
                                            <>
                                              <span className="opacity-60">·</span>
                                              <UserRound className="h-2.5 w-2.5 shrink-0" />
                                              <span className="truncate">{assignee}</span>
                                            </>
                                          )}
                                          {effective.vehiclePlate && (
                                            <>
                                              <Truck className="ml-0.5 h-2.5 w-2.5 shrink-0" />
                                              <span className="font-mono truncate">{effective.vehiclePlate}</span>
                                            </>
                                          )}
                                        </div>
                                      </div>
                                      {inConflict && (
                                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-100" />
                                      )}
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-zinc-200 bg-zinc-50/70 px-4 py-2 text-[10px] text-zinc-500">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-semibold uppercase tracking-wide">Υπόμνημα</span>
              {(["LOADING", "UNLOADING", "PACKING", "CRANE", "TRANSIT"] as StopGanttServiceType[]).map((st) => (
                <span key={st} className="inline-flex items-center gap-1">
                  <span className={cn("h-2 w-2 rounded-full", SERVICE_COLORS[st].dot)} />
                  {SERVICE_LABELS[st]}
                </span>
              ))}
            </div>
            <div className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {totalHours.toFixed(1)}h εύρος
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
