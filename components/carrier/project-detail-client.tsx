"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Box,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  CircleAlert,
  ClipboardList,
  Clock,
  GanttChartSquare,
  Handshake,
  KanbanSquare,
  Loader2,
  Mail,
  MapPin,
  Network,
  PackageCheck,
  Pencil,
  Plus,
  Send,
  Sparkles,
  Trash2,
  Truck as TruckIcon,
  User,
  Wrench,
  X,
  XCircle,
} from "lucide-react";

import {
  upsertJobTask,
  rescheduleJobTask,
  deleteJobTask,
  setJobTaskStatus,
} from "@/server/actions/carrier-job-tasks.action";
import {
  addProjectService,
  updateProjectService,
  deleteProjectService,
  setProjectStatus,
} from "@/server/actions/carrier-projects.action";
import { sendTaskReminder } from "@/server/actions/task-reminders.action";
import {
  sendServiceQuoteCampaign,
  acceptServiceQuote,
  cancelServiceQuote,
} from "@/server/actions/service-quote-campaign.action";
import {
  confirmTaskByAdmin,
  resendTaskConfirmation,
} from "@/server/actions/task-confirmation.action";
import { Gantt, type GanttTask } from "@/components/carrier/gantt";
import { StopGantt, type StopGanttStop } from "@/components/carrier/stop-gantt";

// ─────────────────────── TYPES ───────────────────────

type ServiceType =
  | "CRANE"
  | "PACKING"
  | "LOADING"
  | "UNLOADING"
  | "ASSEMBLY"
  | "DISASSEMBLY"
  | "STORAGE"
  | "TRANSIT"
  | "CLEANUP"
  | "OTHER";

type TaskStatus =
  | "PLANNED"
  | "CONFIRMED"
  | "IN_PROGRESS"
  | "DONE"
  | "BLOCKED"
  | "CANCELLED";

const SERVICE_META: Record<
  ServiceType,
  { label: string; icon: typeof Wrench; tone: string; ring: string }
> = {
  CRANE:       { label: "Γερανός",         icon: Wrench,        tone: "bg-orange-100 text-orange-800",   ring: "ring-orange-200" },
  PACKING:     { label: "Αμπαλάζ",         icon: Box,           tone: "bg-violet-100 text-violet-800",   ring: "ring-violet-200" },
  LOADING:     { label: "Φόρτωση",         icon: PackageCheck,  tone: "bg-blue-100 text-blue-800",       ring: "ring-blue-200" },
  UNLOADING:   { label: "Εκφόρτωση",       icon: PackageCheck,  tone: "bg-rose-100 text-rose-800",       ring: "ring-rose-200" },
  ASSEMBLY:    { label: "Συναρμολόγηση",   icon: Wrench,        tone: "bg-teal-100 text-teal-800",       ring: "ring-teal-200" },
  DISASSEMBLY: { label: "Αποσυναρμολόγηση",icon: Wrench,        tone: "bg-cyan-100 text-cyan-800",       ring: "ring-cyan-200" },
  STORAGE:     { label: "Αποθήκευση",      icon: Box,           tone: "bg-amber-100 text-amber-800",     ring: "ring-amber-200" },
  TRANSIT:     { label: "Διαδρομή",        icon: TruckIcon,     tone: "bg-slate-200 text-slate-800",     ring: "ring-slate-300" },
  CLEANUP:     { label: "Καθαρισμός",      icon: Sparkles,      tone: "bg-emerald-100 text-emerald-800", ring: "ring-emerald-200" },
  OTHER:       { label: "Άλλο",            icon: ClipboardList, tone: "bg-zinc-100 text-zinc-800",       ring: "ring-zinc-200" },
};

const SERVICE_OPTIONS: ServiceType[] = [
  "CRANE", "PACKING", "LOADING", "UNLOADING", "ASSEMBLY",
  "DISASSEMBLY", "STORAGE", "TRANSIT", "CLEANUP", "OTHER",
];

const TASK_STATUS_META: Record<
  TaskStatus,
  { label: string; tone: string; icon: typeof Circle; accent: string }
> = {
  PLANNED:     { label: "Προγραμματισμένο", tone: "bg-sky-50 border-sky-300 text-sky-900",             icon: Circle,       accent: "bg-sky-500" },
  CONFIRMED:   { label: "Επιβεβαιωμένο",    tone: "bg-indigo-50 border-indigo-300 text-indigo-900",   icon: CheckCircle2, accent: "bg-indigo-500" },
  IN_PROGRESS: { label: "Σε εξέλιξη",       tone: "bg-amber-50 border-amber-300 text-amber-900",       icon: Clock,        accent: "bg-amber-500" },
  DONE:        { label: "Ολοκληρώθηκε",     tone: "bg-emerald-50 border-emerald-300 text-emerald-900", icon: CheckCircle2, accent: "bg-emerald-500" },
  BLOCKED:     { label: "Μπλοκαρισμένο",    tone: "bg-rose-50 border-rose-300 text-rose-900",          icon: CircleAlert,  accent: "bg-rose-500" },
  CANCELLED:   { label: "Ακυρώθηκε",        tone: "bg-zinc-50 border-zinc-300 text-zinc-700",          icon: XCircle,      accent: "bg-zinc-500" },
};

const KANBAN_COLUMNS: TaskStatus[] = ["PLANNED", "CONFIRMED", "IN_PROGRESS", "DONE", "BLOCKED", "CANCELLED"];

type ConfirmStatus = "NONE" | "PENDING" | "CONFIRMED" | "DECLINED";

interface TaskRow {
  id: string;
  title: string;
  status: TaskStatus;
  startAt: string;
  durationMinutes: number;
  assigneeKind: string;
  assigneeEmployee: { id: string; name: string } | null;
  assigneePartner: { id: string; name: string } | null;
  vehicle: {
    id: string;
    plate: string;
    brand: string | null;
    model: string | null;
  } | null;
  assigneeConfirmationStatus: ConfirmStatus;
  assigneeConfirmedAt: string | null;
  assigneeConfirmationSentAt: string | null;
  blockerIds: string[];
  blockers: Array<{ id: string; title: string; status: string }>;
  assignments: Array<{
    id: string;
    isPrimary: boolean;
    role: string | null;
    employee: { id: string; name: string } | null;
    partner: { id: string; name: string } | null;
  }>;
}

interface QuoteRow {
  id: string;
  status:
    | "PENDING" | "QUOTED" | "ACCEPTED" | "LOST"
    | "DECLINED" | "EXPIRED" | "CANCELLED";
  recipientName: string | null;
  recipientEmail: string;
  scheduledStartAt: string | null;
  estimatedMinutes: number | null;
  quotedPriceCents: number | null;
  quotedNotes: string | null;
  quotedAt: string | null;
  createdAt: string;
  partner: { id: string; name: string } | null;
}

interface ServiceRow {
  id: string;
  serviceType: ServiceType;
  label: string | null;
  quantity: number;
  unitPriceCents: number | null;
  totalPriceCents: number | null;
  partner: { id: string; name: string } | null;
  quoteRequests: QuoteRow[];
  tasks: TaskRow[];
}

interface StopRow {
  id: string;
  sequence: number;
  type: string;
  label: string | null;
  address: string;
  services: ServiceRow[];
}

interface ProjectData {
  id: string;
  status: string;
  moveRequestId: string;
  stops: StopRow[];
}

interface OptionEmployee { id: string; name: string; role: string; }
interface OptionPartner  { id: string; name: string; kind: string; }
interface OptionCompany  { id: string; name: string; hasEmail: boolean; }
interface OptionVehicle  { id: string; plate: string; brand: string | null; model: string | null; }

// ─────────────────────── ROOT ───────────────────────

export function ProjectDetailClient({
  project, employees, partners, companies, vehicles, history,
}: {
  project: ProjectData;
  employees: OptionEmployee[];
  partners: OptionPartner[];
  companies: OptionCompany[];
  vehicles: OptionVehicle[];
  history: import("@/lib/project-history").HistoryEvent[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [tab, setTab] = useState<"plan" | "kanban" | "gantt" | "flow" | "history">("plan");

  // Flatten all tasks across all services for kanban + counts.
  const allTasks = useMemo(() => {
    const out: Array<TaskRow & { serviceType: ServiceType; stopAddress: string; stopType: string }> = [];
    for (const stop of project.stops) {
      for (const svc of stop.services) {
        for (const t of svc.tasks) {
          out.push({
            ...t,
            serviceType: svc.serviceType,
            stopAddress: stop.address,
            stopType: stop.type,
          });
        }
      }
    }
    return out;
  }, [project.stops]);

  const tasksByStatus = useMemo(() => {
    const m: Record<TaskStatus, typeof allTasks> = {
      PLANNED: [], CONFIRMED: [], IN_PROGRESS: [], DONE: [], BLOCKED: [], CANCELLED: [],
    };
    for (const t of allTasks) m[t.status].push(t);
    return m;
  }, [allTasks]);

  const updateStatus = (status: string) => {
    start(async () => {
      await setProjectStatus({ id: project.id, status });
      router.refresh();
    });
  };

  return (
    <>
      {/* Status toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          <ProgressPill tasks={allTasks} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Project status:</span>
          <select
            value={project.status}
            disabled={pending}
            onChange={(e) => updateStatus(e.target.value)}
            className="h-8 rounded-lg border border-border bg-white px-2 text-xs font-bold"
          >
            <option value="DRAFT">Προσχέδιο</option>
            <option value="PLANNED">Προγραμματισμένο</option>
            <option value="IN_PROGRESS">Σε εξέλιξη</option>
            <option value="COMPLETED">Ολοκληρώθηκε</option>
            <option value="CANCELLED">Ακυρώθηκε</option>
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border overflow-x-auto">
        <TabButton active={tab === "plan"}   onClick={() => setTab("plan")}   icon={ClipboardList}     label="Πλάνο" />
        <TabButton active={tab === "kanban"} onClick={() => setTab("kanban")} icon={KanbanSquare}      label="Kanban" count={allTasks.length} />
        <TabButton active={tab === "gantt"}  onClick={() => setTab("gantt")}  icon={GanttChartSquare}  label="Gantt" />
        <TabButton active={tab === "flow"}   onClick={() => setTab("flow")}   icon={Network}           label="Flow" />
        <TabButton active={tab === "history"} onClick={() => setTab("history")} icon={Clock}            label="Ιστορικό" count={history.length} />
      </div>

      {tab === "plan" && (
        <PlanView
          project={project}
          employees={employees}
          partners={partners}
          companies={companies}
          vehicles={vehicles}
          projectTasks={allTasks}
        />
      )}
      {tab === "kanban" && (
        <KanbanView
          tasksByStatus={tasksByStatus}
          moveRequestId={project.moveRequestId}
          projectId={project.id}
          employees={employees}
          partners={partners}
          vehicles={vehicles}
          projectTasks={allTasks}
        />
      )}
      {tab === "gantt" && (
        <GanttView
          project={project}
          tasks={allTasks}
          moveRequestId={project.moveRequestId}
          employees={employees}
          partners={partners}
          vehicles={vehicles}
          projectTasks={allTasks}
        />
      )}
      {tab === "flow" && <FlowView project={project} />}
      {tab === "history" && <HistoryTimeline events={history} />}
    </>
  );
}

// ─────────────────────── GANTT VIEW ───────────────────────

function GanttView({
  project, tasks, moveRequestId, employees, partners, vehicles, projectTasks,
}: {
  project: ProjectData;
  tasks: Array<TaskRow & { serviceType: ServiceType; stopAddress: string; stopType: string }>;
  moveRequestId: string;
  employees: OptionEmployee[];
  partners: OptionPartner[];
  vehicles: OptionVehicle[];
  projectTasks: TaskRow[];
}) {
  const router = useRouter();
  const [editingTask, setEditingTask] = useState<TaskRow | null>(null);

  // Build the StopGantt stop→service→task tree directly from the project.
  const stopsForGantt: StopGanttStop[] = project.stops.map((stop) => ({
    id: stop.id,
    sequence: stop.sequence,
    type: stop.type,
    label: stop.label,
    address: stop.address,
    services: stop.services.map((svc) => ({
      id: svc.id,
      serviceType: svc.serviceType,
      label: svc.label,
      tasks: svc.tasks.map((t) => ({
        id: t.id,
        title: t.title,
        startAt: t.startAt,
        durationMinutes: t.durationMinutes,
        status: t.status,
        assigneeKind: t.assigneeKind,
        assigneeEmployeeId: t.assigneeEmployee?.id ?? null,
        assigneeEmployeeName: t.assigneeEmployee?.name ?? null,
        assigneePartnerName: t.assigneePartner?.name ?? null,
        vehiclePlate: t.vehicle?.plate ?? null,
        confirmationStatus: t.assigneeConfirmationStatus,
      })),
    })),
  }));

  // taskId → TaskRow lookup so bar clicks can open the edit dialog.
  const taskById = new Map<string, TaskRow>();
  for (const t of tasks) taskById.set(t.id, t);

  return (
    <>
      <StopGantt
        stops={stopsForGantt}
        onTaskClick={(id) => {
          const row = taskById.get(id);
          if (row) setEditingTask(row);
        }}
        onReschedule={async (id, startAtIso, durationMinutes) => {
          const res = await rescheduleJobTask({ id, startAt: startAtIso, durationMinutes });
          if (!res.ok) return { ok: false, error: res.error };
          router.refresh();
          return { ok: true };
        }}
      />
      {editingTask && (
        <TaskAssignDialog
          existing={editingTask}
          serviceLabel=""
          moveRequestId={moveRequestId}
          employees={employees}
          partners={partners}
          vehicles={vehicles}
          projectTasks={projectTasks}
          onClose={() => setEditingTask(null)}
          onSaved={() => {
            setEditingTask(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

// ─────────────────────── DAY GANTT (hour columns) ───────────────────────

const HOUR_WIDTH_PX = 70;
const DAY_GANTT_START_HOUR = 6;   // show 06:00 → 22:00 by default
const DAY_GANTT_END_HOUR = 22;
const DAY_LANE_HEIGHT = 56;
const DAY_LABEL_WIDTH = 160;

function DayGantt({
  tasks,
  initialDay,
  moveRequestId,
  employees,
  partners,
  vehicles,
  projectTasks,
}: {
  tasks: Array<TaskRow & { serviceType: ServiceType; stopAddress: string }>;
  initialDay: Date;
  moveRequestId: string;
  employees: OptionEmployee[];
  partners: OptionPartner[];
  vehicles: OptionVehicle[];
  projectTasks: TaskRow[];
}) {
  const router = useRouter();
  const [day, setDay] = useState<Date>(() => {
    const d = new Date(initialDay);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [editingTask, setEditingTask] = useState<TaskRow | null>(null);
  const [tooltipBar, setTooltipBar] = useState<{
    task: TaskRow & { serviceType: ServiceType; stopAddress: string };
    x: number;
    y: number;
  } | null>(null);

  const dayStart = useMemo(() => {
    const d = new Date(day);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [day]);
  const dayEnd = useMemo(() => {
    const d = new Date(day);
    d.setHours(23, 59, 59, 999);
    return d;
  }, [day]);

  // Tasks intersecting the current day.
  const dayTasks = useMemo(() => {
    return tasks.filter((t) => {
      const s = new Date(t.startAt).getTime();
      const e = s + t.durationMinutes * 60_000;
      return s <= dayEnd.getTime() && e >= dayStart.getTime();
    });
  }, [tasks, dayStart, dayEnd]);

  // Group tasks into lanes by assignee. Within each assignee, pack into
  // sub-lanes so overlapping tasks stack vertically.
  const lanes = useMemo(() => {
    const byAssignee = new Map<string, { label: string; tasks: typeof dayTasks }>();
    for (const t of dayTasks) {
      const name = t.assigneeEmployee?.name ?? t.assigneePartner?.name ?? "Χωρίς ανάθεση";
      const key = `${t.assigneeKind}:${name}`;
      if (!byAssignee.has(key)) byAssignee.set(key, { label: name, tasks: [] });
      byAssignee.get(key)!.tasks.push(t);
    }
    return Array.from(byAssignee.entries()).map(([key, { label, tasks: ts }]) => {
      const sorted = [...ts].sort(
        (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
      );
      const sublanes: typeof ts[] = [];
      for (const t of sorted) {
        const tStart = new Date(t.startAt).getTime();
        let placed = false;
        for (const sl of sublanes) {
          const last = sl[sl.length - 1];
          const lastEnd = new Date(last.startAt).getTime() + last.durationMinutes * 60_000;
          if (tStart >= lastEnd) { sl.push(t); placed = true; break; }
        }
        if (!placed) sublanes.push([t]);
      }
      return { key, label, sublanes };
    });
  }, [dayTasks]);

  // Hour range — extend if tasks bleed outside default window.
  const range = useMemo(() => {
    let startHour = DAY_GANTT_START_HOUR;
    let endHour = DAY_GANTT_END_HOUR;
    for (const t of dayTasks) {
      const s = new Date(t.startAt);
      const e = new Date(s.getTime() + t.durationMinutes * 60_000);
      if (s.getDate() === day.getDate()) {
        startHour = Math.min(startHour, s.getHours());
      } else {
        startHour = 0;
      }
      if (e.getDate() === day.getDate()) {
        endHour = Math.max(endHour, e.getHours() + (e.getMinutes() > 0 ? 1 : 0));
      } else {
        endHour = 24;
      }
    }
    return { startHour, endHour };
  }, [dayTasks, day]);

  const totalHours = range.endHour - range.startHour;
  const totalWidth = totalHours * HOUR_WIDTH_PX;
  const totalLanes = lanes.reduce((s, l) => s + Math.max(1, l.sublanes.length), 0);

  const shiftDay = (delta: number) => {
    const d = new Date(day);
    d.setDate(d.getDate() + delta);
    setDay(d);
  };
  const goToday = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    setDay(d);
  };

  const isToday = isSameDay(day, new Date());
  const now = new Date();
  const showNowLine =
    isToday &&
    now.getHours() >= range.startHour &&
    now.getHours() <= range.endHour;
  const nowOffsetPx = showNowLine
    ? ((now.getHours() + now.getMinutes() / 60 - range.startHour) * HOUR_WIDTH_PX)
    : 0;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-secondary/30 px-4 py-2.5">
        <div className="flex items-center gap-1">
          <button onClick={() => shiftDay(-1)}
            className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
            title="Προηγούμενη μέρα">
            <ChevronRight className="size-4 rotate-180" />
          </button>
          <button onClick={goToday}
            className={`inline-flex h-8 items-center rounded-md px-3 text-xs font-bold transition ${
              isToday
                ? "bg-[var(--color-brand-blue)] text-white"
                : "border border-border bg-white hover:bg-secondary"
            }`}>
            Σήμερα
          </button>
          <button onClick={() => shiftDay(1)}
            className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
            title="Επόμενη μέρα">
            <ChevronRight className="size-4" />
          </button>
        </div>
        <div className="text-sm font-bold text-foreground">
          {day.toLocaleDateString("el-GR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
        </div>
        <div className="text-xs text-muted-foreground">
          {dayTasks.length} εργασί{dayTasks.length === 1 ? "α" : "ες"} · {lanes.length} {lanes.length === 1 ? "πόρος" : "πόροι"}
        </div>
      </div>

      {dayTasks.length === 0 ? (
        <div className="p-12 text-center">
          <CalendarClock className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">Καμία εργασία για αυτή τη μέρα</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div style={{ width: DAY_LABEL_WIDTH + totalWidth + 1 }}>
            {/* Hour header */}
            <div className="sticky top-0 z-10 flex border-b border-border bg-card">
              <div
                className="shrink-0 border-r border-border bg-secondary/40 px-3 py-2 text-[11px] font-bold uppercase text-muted-foreground"
                style={{ width: DAY_LABEL_WIDTH }}
              >
                Πόρος
              </div>
              <div className="flex">
                {Array.from({ length: totalHours }).map((_, i) => {
                  const hour = range.startHour + i;
                  return (
                    <div
                      key={hour}
                      className="shrink-0 border-r border-border py-2 text-center"
                      style={{ width: HOUR_WIDTH_PX }}
                    >
                      <div className="font-mono text-xs font-bold tabular-nums">
                        {String(hour).padStart(2, "0")}:00
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Lanes */}
            <div className="relative">
              {/* "Now" indicator */}
              {showNowLine && (
                <div
                  className="pointer-events-none absolute top-0 z-20 bottom-0 border-l-2 border-rose-500"
                  style={{ left: DAY_LABEL_WIDTH + nowOffsetPx }}
                >
                  <div className="absolute -left-2 -top-1 size-3 rounded-full bg-rose-500 ring-2 ring-white animate-pulse" />
                  <div className="absolute -top-5 left-1 text-[10px] font-extrabold uppercase text-rose-600">
                    Τώρα
                  </div>
                </div>
              )}

              {lanes.map((lane) => {
                const laneHeight = Math.max(1, lane.sublanes.length) * DAY_LANE_HEIGHT;
                return (
                  <div
                    key={lane.key}
                    className="relative flex border-b border-border last:border-b-0"
                    style={{ height: laneHeight }}
                  >
                    <div
                      className="sticky left-0 z-[5] flex items-center gap-2 border-r border-border bg-card px-3 py-2"
                      style={{ width: DAY_LABEL_WIDTH }}
                    >
                      <div className="grid size-7 place-items-center rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 text-[10px] font-extrabold text-white">
                        {lane.label.charAt(0).toUpperCase()}
                      </div>
                      <span className="truncate text-xs font-bold">{lane.label}</span>
                    </div>
                    <div
                      className="relative flex-1"
                      style={{
                        backgroundImage: `repeating-linear-gradient(to right, #f1f5f9 0 1px, transparent 1px ${HOUR_WIDTH_PX}px)`,
                      }}
                    >
                      {lane.sublanes.map((sublane, slIdx) =>
                        sublane.map((t) => {
                          const s = new Date(t.startAt);
                          const e = new Date(s.getTime() + t.durationMinutes * 60_000);
                          const startHourFloat = Math.max(
                            range.startHour,
                            s.getHours() + s.getMinutes() / 60 +
                              (s.getDate() < day.getDate() ? -24 : s.getDate() > day.getDate() ? 24 : 0),
                          );
                          const endHourFloat = Math.min(
                            range.endHour,
                            e.getHours() + e.getMinutes() / 60 +
                              (e.getDate() < day.getDate() ? -24 : e.getDate() > day.getDate() ? 24 : 0),
                          );
                          const left = (startHourFloat - range.startHour) * HOUR_WIDTH_PX;
                          const width = Math.max(40, (endHourFloat - startHourFloat) * HOUR_WIDTH_PX);
                          const top = slIdx * DAY_LANE_HEIGHT + 6;
                          const height = DAY_LANE_HEIGHT - 12;
                          const meta = SERVICE_META[t.serviceType];
                          const Icon = meta.icon;
                          const statusMeta = TASK_STATUS_META[t.status];
                          return (
                            <button
                              type="button"
                              key={t.id}
                              onClick={() => setEditingTask(t)}
                              onMouseEnter={(ev) => {
                                const rect = ev.currentTarget.getBoundingClientRect();
                                setTooltipBar({
                                  task: t,
                                  x: rect.left + rect.width / 2,
                                  y: rect.top,
                                });
                              }}
                              onMouseLeave={() => setTooltipBar(null)}
                              className={`absolute cursor-pointer overflow-hidden rounded-lg border-2 text-left shadow-sm transition hover:z-10 hover:shadow-md hover:scale-[1.02] ${meta.tone} ${statusMeta.tone.split(" ").filter((c) => c.startsWith("border")).join(" ")}`}
                              style={{ left, width, top, height }}
                            >
                              <div className={`absolute left-0 top-0 bottom-0 w-1 ${statusMeta.accent}`} />
                              <div className="flex h-full items-center gap-1.5 pl-2 pr-2 text-[11px]">
                                <Icon className="size-3 shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <div className="truncate font-bold leading-tight">{t.title}</div>
                                  <div className="truncate text-[10px] opacity-80">
                                    {s.toLocaleTimeString("el-GR", { hour: "2-digit", minute: "2-digit" })}–
                                    {e.toLocaleTimeString("el-GR", { hour: "2-digit", minute: "2-digit" })}
                                  </div>
                                </div>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer summary */}
            <div className="flex border-t border-border bg-secondary/20 px-3 py-2 text-[10px] text-muted-foreground">
              <span className="ml-auto">{totalLanes} {totalLanes === 1 ? "γραμμή" : "γραμμές"} · {totalHours}h εύρος</span>
            </div>
          </div>
        </div>
      )}

      {/* Floating tooltip on hover */}
      {tooltipBar && (
        <GanttBarTooltip
          task={tooltipBar.task}
          x={tooltipBar.x}
          y={tooltipBar.y}
        />
      )}

      {/* Click-to-edit modal */}
      {editingTask && (
        <TaskAssignDialog
          existing={editingTask}
          serviceLabel=""
          moveRequestId={moveRequestId}
          employees={employees}
          partners={partners}
          vehicles={vehicles}
          projectTasks={projectTasks}
          onClose={() => setEditingTask(null)}
          onSaved={() => {
            setEditingTask(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function GanttBarTooltip({
  task, x, y,
}: {
  task: TaskRow & { serviceType: ServiceType; stopAddress: string };
  x: number;
  y: number;
}) {
  const start = new Date(task.startAt);
  const end = new Date(start.getTime() + task.durationMinutes * 60_000);
  const fmt = (d: Date) =>
    d.toLocaleTimeString("el-GR", { hour: "2-digit", minute: "2-digit" });
  const meta = SERVICE_META[task.serviceType];
  const statusMeta = TASK_STATUS_META[task.status];
  const allNames = collectAllAssigneeNames(task);
  const assignee = allNames[0] ?? null;
  const vehicleLabel = task.vehicle
    ? [task.vehicle.brand, task.vehicle.model].filter(Boolean).join(" ") ||
      task.vehicle.plate
    : null;
  const cs = task.assigneeConfirmationStatus;
  const cm =
    cs === "PENDING"   ? { label: "Εκκρεμεί επιβεβ.", tone: "text-amber-700" } :
    cs === "CONFIRMED" ? { label: "Επιβεβαιωμένο", tone: "text-emerald-700" } :
    cs === "DECLINED"  ? { label: "Απορρίφθηκε", tone: "text-rose-700" } :
    null;
  const blockerSummary = task.blockers && task.blockers.length > 0
    ? `${task.blockers.filter((b) => b.status !== "DONE" && b.status !== "CANCELLED").length}/${task.blockers.length} blockers εκκρεμούν`
    : null;

  return (
    <div
      className="pointer-events-none fixed z-[100] -translate-x-1/2 -translate-y-full"
      style={{ left: x, top: y - 8 }}
    >
      <div className="w-72 rounded-xl border border-border bg-white p-3 shadow-2xl ring-1 ring-black/5">
        <div className={`mb-1 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase ${meta.tone}`}>
          {meta.label}
        </div>
        <p className="mt-1 text-sm font-bold leading-tight text-foreground">
          {task.title}
        </p>
        <div className="mt-2 grid gap-1 text-[11px]">
          <div className="flex items-center gap-1.5">
            <Clock className="size-3 text-muted-foreground" />
            <span className="font-mono font-semibold">{fmt(start)}–{fmt(end)}</span>
            <span className="text-muted-foreground">({Math.round(task.durationMinutes / 60 * 10) / 10}h)</span>
          </div>
          <div className="flex items-start gap-1.5">
            <MapPin className="size-3 shrink-0 text-muted-foreground" />
            <span className="text-muted-foreground">{task.stopAddress}</span>
          </div>
          <div className="flex items-start gap-1.5">
            <User className="size-3 shrink-0 text-muted-foreground" />
            {assignee ? (
              <div className="flex flex-wrap items-baseline gap-x-1">
                <span className="font-semibold">{assignee}</span>
                {allNames.slice(1).map((n) => (
                  <span key={n} className="rounded bg-[var(--color-brand-blue-soft)] px-1 text-[9px] font-bold text-[var(--color-brand-blue-deep)]">
                    + {n}
                  </span>
                ))}
              </div>
            ) : (
              <span className="italic text-rose-700">Χωρίς ανάθεση</span>
            )}
          </div>
          {vehicleLabel && (
            <div className="flex items-center gap-1.5">
              <TruckIcon className="size-3 text-muted-foreground" />
              <span>{vehicleLabel}</span>
            </div>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-border pt-2">
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${statusMeta.tone}`}>
            {statusMeta.label}
          </span>
          {cm && (
            <span className={`text-[10px] font-bold ${cm.tone}`}>{cm.label}</span>
          )}
          {blockerSummary && (
            <span className="text-[10px] font-bold text-rose-700">🔗 {blockerSummary}</span>
          )}
        </div>
        <p className="mt-2 border-t border-border pt-1.5 text-center text-[10px] italic text-muted-foreground">
          Click για επεξεργασία
        </p>
      </div>
    </div>
  );
}

function collectAllAssigneeNames(task: TaskRow): string[] {
  // Prefer assignments[] (multi-assignee). Fallback to legacy single fields.
  if (task.assignments && task.assignments.length > 0) {
    const names: string[] = [];
    const seen = new Set<string>();
    // Primary first
    for (const a of task.assignments) {
      if (!a.isPrimary) continue;
      const n = a.employee?.name ?? a.partner?.name;
      if (n && !seen.has(n)) { names.push(n); seen.add(n); }
    }
    for (const a of task.assignments) {
      if (a.isPrimary) continue;
      const n = a.employee?.name ?? a.partner?.name;
      if (n && !seen.has(n)) { names.push(n); seen.add(n); }
    }
    if (names.length > 0) return names;
  }
  const legacy = task.assigneeEmployee?.name ?? task.assigneePartner?.name;
  return legacy ? [legacy] : [];
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth() === b.getMonth() &&
         a.getDate() === b.getDate();
}

function serviceToCategory(s: ServiceType): GanttTask["category"] {
  switch (s) {
    case "CRANE": return "CRANE";
    case "PACKING": return "PREP";
    case "LOADING": return "LOADING";
    case "UNLOADING": return "UNLOADING";
    case "ASSEMBLY":
    case "DISASSEMBLY": return "ASSEMBLY";
    case "STORAGE": return "STORAGE";
    case "TRANSIT": return "TRANSIT";
    case "CLEANUP": return "CLEANUP";
    default: return "OTHER";
  }
}

// ─────────────────────── FLOW VIEW (SVG node graph) ───────────────────────

function FlowView({ project }: { project: ProjectData }) {
  const STOP_W = 200;
  const SVC_W = 200;
  const TASK_W = 220;
  const COL_GAP = 80;
  const ROW_GAP = 16;
  const NODE_H = 52;

  // Compute layout: vertical stack of service rows, each with stop label on
  // left, service in middle, list of tasks/quotes on right.
  let y = 20;
  const stopLayouts: Array<{
    stop: StopRow;
    yStart: number;
    yEnd: number;
    services: Array<{
      svc: ServiceRow;
      y: number;
      nodes: Array<{ y: number; kind: "task" | "quote"; label: string; meta: string; status: string }>;
    }>;
  }> = [];

  for (const stop of project.stops) {
    const yStart = y;
    const services: typeof stopLayouts[number]["services"] = [];
    for (const svc of stop.services) {
      const svcY = y;
      const nodes: typeof services[number]["nodes"] = [];
      let innerY = y;
      for (const t of svc.tasks) {
        nodes.push({
          y: innerY,
          kind: "task",
          label: t.title.slice(0, 28),
          meta:
            t.assigneeEmployee?.name ??
            t.assigneePartner?.name ??
            "Χωρίς ανάθεση",
          status: t.status,
        });
        innerY += NODE_H + ROW_GAP;
      }
      for (const q of svc.quoteRequests.filter((q) => q.status !== "LOST" && q.status !== "CANCELLED")) {
        nodes.push({
          y: innerY,
          kind: "quote",
          label: q.partner?.name ?? q.recipientName ?? "—",
          meta:
            q.status === "QUOTED" && q.quotedPriceCents != null
              ? `Προσφορά ${(q.quotedPriceCents / 100).toLocaleString("el-GR")}€`
              : q.status,
          status: q.status,
        });
        innerY += NODE_H + ROW_GAP;
      }
      if (nodes.length === 0) {
        nodes.push({
          y: innerY,
          kind: "task",
          label: "(καμία ανάθεση)",
          meta: "",
          status: "EMPTY",
        });
        innerY += NODE_H + ROW_GAP;
      }
      services.push({ svc, y: svcY, nodes });
      y = innerY;
    }
    stopLayouts.push({ stop, yStart, yEnd: y, services });
    y += 30;
  }
  const totalH = Math.max(200, y + 20);
  const totalW = STOP_W + COL_GAP + SVC_W + COL_GAP + TASK_W + 40;

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card p-4">
      <svg width={totalW} height={totalH} className="block min-w-full">
        {/* Edges */}
        {stopLayouts.map((sl) =>
          sl.services.map((sv) => (
            <g key={`edge-${sv.svc.id}`}>
              <line
                x1={STOP_W}
                y1={(sl.yStart + sl.yEnd) / 2}
                x2={STOP_W + COL_GAP}
                y2={sv.y + NODE_H / 2}
                stroke="#cbd5e1"
                strokeWidth={1.5}
              />
              {sv.nodes.map((n, i) => (
                <line
                  key={`edge2-${sv.svc.id}-${i}`}
                  x1={STOP_W + COL_GAP + SVC_W}
                  y1={sv.y + NODE_H / 2}
                  x2={STOP_W + COL_GAP + SVC_W + COL_GAP}
                  y2={n.y + NODE_H / 2}
                  stroke={n.kind === "quote" ? "#fbbf24" : "#cbd5e1"}
                  strokeDasharray={n.kind === "quote" ? "4 3" : ""}
                  strokeWidth={1.5}
                />
              ))}
            </g>
          )),
        )}
        {/* Stop nodes */}
        {stopLayouts.map((sl, idx) => {
          const isPickup = sl.stop.type === "PICKUP";
          const cy = (sl.yStart + sl.yEnd) / 2;
          return (
            <g key={`stop-${sl.stop.id}`}>
              <title>{`${idx + 1}. ${isPickup ? "Παραλαβή" : "Παράδοση"} — ${sl.stop.address}`}</title>
              <rect
                x={0}
                y={cy - NODE_H / 2}
                width={STOP_W}
                height={NODE_H}
                rx={12}
                fill={isPickup ? "#dbeafe" : "#ffe4e6"}
                stroke={isPickup ? "#3b82f6" : "#ef4444"}
                strokeWidth={2}
              />
              <foreignObject x={10} y={cy - NODE_H / 2 + 6} width={STOP_W - 20} height={NODE_H - 12}>
                <div
                  style={{
                    fontFamily: "system-ui,-apple-system,sans-serif",
                    color: isPickup ? "#1e40af" : "#991b1b",
                    fontSize: 11,
                    lineHeight: 1.2,
                    overflow: "hidden",
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 11 }}>
                    {idx + 1}. {isPickup ? "Παραλαβή" : "Παράδοση"}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: "#475569",
                      marginTop: 2,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {sl.stop.address}
                  </div>
                </div>
              </foreignObject>
            </g>
          );
        })}
        {/* Service nodes */}
        {stopLayouts.map((sl) =>
          sl.services.map((sv) => {
            const meta = SERVICE_META[sv.svc.serviceType];
            const colors = svcSvgColors(sv.svc.serviceType);
            const tipParts = [
              meta.label,
              `Ποσότητα: ${sv.svc.quantity}`,
              sv.svc.totalPriceCents != null
                ? `Σύνολο: ${(sv.svc.totalPriceCents / 100).toLocaleString("el-GR")}€`
                : "Καμία τιμή",
              sv.svc.partner ? `Συνεργάτης: ${sv.svc.partner.name}` : null,
              sv.svc.label ? `Σημείωση: ${sv.svc.label}` : null,
            ].filter(Boolean);
            return (
              <g key={`svc-${sv.svc.id}`}>
                <title>{tipParts.join("\n")}</title>
                <rect
                  x={STOP_W + COL_GAP}
                  y={sv.y}
                  width={SVC_W}
                  height={NODE_H}
                  rx={10}
                  fill={colors.fill}
                  stroke={colors.stroke}
                  strokeWidth={1.5}
                />
                <foreignObject x={STOP_W + COL_GAP + 10} y={sv.y + 6} width={SVC_W - 20} height={NODE_H - 12}>
                  <div
                    style={{
                      fontFamily: "system-ui,-apple-system,sans-serif",
                      lineHeight: 1.2,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: 12,
                        color: colors.text,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {meta.label}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: "#475569",
                        marginTop: 2,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      ×{sv.svc.quantity}
                      {sv.svc.totalPriceCents != null && ` · ${(sv.svc.totalPriceCents / 100).toLocaleString("el-GR")}€`}
                      {sv.svc.partner && ` · 🤝 ${sv.svc.partner.name}`}
                    </div>
                  </div>
                </foreignObject>
              </g>
            );
          }),
        )}
        {/* Task / quote nodes */}
        {stopLayouts.map((sl) =>
          sl.services.flatMap((sv) =>
            sv.nodes.map((n, i) => {
              const colors = flowNodeColors(n.status, n.kind);
              return (
                <g key={`node-${sv.svc.id}-${i}`}>
                  <title>{`${n.label}${n.meta ? ` — ${n.meta}` : ""}\nStatus: ${n.status}`}</title>
                  <rect
                    x={STOP_W + COL_GAP + SVC_W + COL_GAP}
                    y={n.y}
                    width={TASK_W}
                    height={NODE_H}
                    rx={8}
                    fill={colors.fill}
                    stroke={colors.stroke}
                    strokeWidth={1.5}
                  />
                  <foreignObject
                    x={STOP_W + COL_GAP + SVC_W + COL_GAP + 8}
                    y={n.y + 6}
                    width={TASK_W - 16}
                    height={NODE_H - 12}
                  >
                    <div
                      style={{
                        fontFamily: "system-ui,-apple-system,sans-serif",
                        lineHeight: 1.2,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: 11,
                          color: colors.text,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {n.kind === "quote" ? "💬 " : ""}
                        {n.label}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: "#475569",
                          marginTop: 2,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {n.meta}
                      </div>
                    </div>
                  </foreignObject>
                </g>
              );
            }),
          ),
        )}
      </svg>
      <p className="mt-3 text-[10px] text-muted-foreground">
        💡 Συνεχόμενες γραμμές = αναθέσεις (tasks) · Διακεκομμένες = εκκρεμή quotes σε partners
      </p>
    </div>
  );
}

function svcSvgColors(s: ServiceType): { fill: string; stroke: string; text: string } {
  const map: Record<ServiceType, { fill: string; stroke: string; text: string }> = {
    CRANE:       { fill: "#fff7ed", stroke: "#fb923c", text: "#9a3412" },
    PACKING:     { fill: "#f5f3ff", stroke: "#a78bfa", text: "#5b21b6" },
    LOADING:     { fill: "#eff6ff", stroke: "#60a5fa", text: "#1e40af" },
    UNLOADING:   { fill: "#fef2f2", stroke: "#fb7185", text: "#9f1239" },
    ASSEMBLY:    { fill: "#f0fdfa", stroke: "#5eead4", text: "#115e59" },
    DISASSEMBLY: { fill: "#ecfeff", stroke: "#67e8f9", text: "#155e75" },
    STORAGE:     { fill: "#fffbeb", stroke: "#fcd34d", text: "#92400e" },
    TRANSIT:     { fill: "#f1f5f9", stroke: "#94a3b8", text: "#334155" },
    CLEANUP:     { fill: "#ecfdf5", stroke: "#6ee7b7", text: "#065f46" },
    OTHER:       { fill: "#fafafa", stroke: "#a1a1aa", text: "#3f3f46" },
  };
  return map[s];
}

function flowNodeColors(status: string, kind: "task" | "quote"): { fill: string; stroke: string; text: string } {
  if (kind === "quote") {
    if (status === "QUOTED") return { fill: "#ecfdf5", stroke: "#34d399", text: "#065f46" };
    return { fill: "#fffbeb", stroke: "#fbbf24", text: "#92400e" };
  }
  switch (status) {
    case "DONE":        return { fill: "#ecfdf5", stroke: "#10b981", text: "#065f46" };
    case "IN_PROGRESS": return { fill: "#fffbeb", stroke: "#f59e0b", text: "#92400e" };
    case "CONFIRMED":   return { fill: "#eef2ff", stroke: "#6366f1", text: "#3730a3" };
    case "BLOCKED":     return { fill: "#fef2f2", stroke: "#ef4444", text: "#991b1b" };
    case "CANCELLED":   return { fill: "#fafafa", stroke: "#a1a1aa", text: "#71717a" };
    case "EMPTY":       return { fill: "#fafafa", stroke: "#e4e4e7", text: "#a1a1aa" };
    default:            return { fill: "#f0f9ff", stroke: "#7dd3fc", text: "#075985" };
  }
}

// ─────────────────────── HISTORY TIMELINE ───────────────────────

const HISTORY_META: Record<
  import("@/lib/project-history").HistoryEvent["kind"],
  { tone: string; icon: typeof Clock }
> = {
  PROJECT_CREATED:       { tone: "bg-indigo-100 text-indigo-800 ring-indigo-200",   icon: Sparkles },
  TASK_CREATED:          { tone: "bg-sky-100 text-sky-800 ring-sky-200",            icon: Plus },
  TASK_CONFIRMED:        { tone: "bg-emerald-100 text-emerald-800 ring-emerald-200", icon: CheckCircle2 },
  TASK_DECLINED:         { tone: "bg-rose-100 text-rose-800 ring-rose-200",          icon: XCircle },
  TASK_STARTED:          { tone: "bg-amber-100 text-amber-800 ring-amber-200",       icon: Clock },
  TASK_COMPLETED:        { tone: "bg-emerald-100 text-emerald-900 ring-emerald-200", icon: CheckCircle2 },
  REMINDER_SENT:         { tone: "bg-amber-50 text-amber-700 ring-amber-200",        icon: Bell },
  QUOTE_REQUEST_SENT:    { tone: "bg-violet-100 text-violet-800 ring-violet-200",    icon: Send },
  QUOTE_RECEIVED:        { tone: "bg-emerald-100 text-emerald-800 ring-emerald-200", icon: Handshake },
  QUOTE_ACCEPTED:        { tone: "bg-indigo-100 text-indigo-800 ring-indigo-200",    icon: CheckCircle2 },
  QUOTE_LOST:            { tone: "bg-zinc-100 text-zinc-600 ring-zinc-200",          icon: XCircle },
  AVAILABILITY_OVERRIDE: { tone: "bg-rose-100 text-rose-800 ring-rose-200",          icon: CircleAlert },
};

function HistoryTimeline({
  events,
}: {
  events: import("@/lib/project-history").HistoryEvent[];
}) {
  const [filter, setFilter] = useState<"all" | "tasks" | "quotes" | "alerts">("all");

  const filtered = events.filter((e) => {
    if (filter === "all") return true;
    if (filter === "tasks") {
      return e.kind.startsWith("TASK_") || e.kind === "REMINDER_SENT";
    }
    if (filter === "quotes") return e.kind.startsWith("QUOTE_");
    if (filter === "alerts") return e.kind === "AVAILABILITY_OVERRIDE" || e.kind === "TASK_DECLINED";
    return true;
  });

  // Group events by calendar day for the timeline header.
  const groups = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const e of filtered) {
      const day = new Date(e.at).toLocaleDateString("el-GR", {
        weekday: "long", day: "2-digit", month: "long", year: "numeric",
      });
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(e);
    }
    return Array.from(map.entries());
  }, [filtered]);

  if (events.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-12 text-center">
        <Clock className="mx-auto size-10 text-muted-foreground" />
        <p className="mt-3 text-sm text-muted-foreground">
          Καμία δραστηριότητα ακόμη
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter chips */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
        <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          Φίλτρο
        </span>
        {([
          { id: "all", label: `Όλα (${events.length})` },
          { id: "tasks", label: "Εργασίες" },
          { id: "quotes", label: "Quotes" },
          { id: "alerts", label: "Alerts" },
        ] as const).map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`inline-flex h-7 items-center rounded-md px-2.5 text-xs font-semibold transition ${
              filter === f.id
                ? "bg-[var(--color-brand-blue)] text-white shadow-sm"
                : "text-muted-foreground hover:bg-secondary"
            }`}
          >
            {f.label}
          </button>
        ))}
        <span className="ml-auto text-[10px] text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? "γεγονός" : "γεγονότα"}
        </span>
      </div>

      {/* Timeline */}
      <div className="space-y-6">
        {groups.map(([day, items]) => (
          <section key={day}>
            <div className="mb-2 flex items-center gap-3">
              <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                {day}
              </h3>
              <div className="h-px flex-1 bg-border" />
              <span className="text-[10px] text-muted-foreground">
                {items.length} {items.length === 1 ? "γεγονός" : "γεγονότα"}
              </span>
            </div>
            <ol className="relative ml-3 space-y-2 border-l-2 border-border pl-5">
              {items.map((e) => {
                const meta = HISTORY_META[e.kind];
                const Icon = meta.icon;
                const time = new Date(e.at).toLocaleTimeString("el-GR", {
                  hour: "2-digit", minute: "2-digit",
                });
                return (
                  <li key={e.id} className="relative">
                    <span className={`absolute -left-[27px] top-2 grid size-5 place-items-center rounded-full ring-4 ring-card ${meta.tone.split(" ").filter((c) => c.startsWith("bg-")).join(" ")}`}>
                      <Icon className="size-3" />
                    </span>
                    <div className={`group flex items-start gap-3 rounded-lg border bg-white p-3 ring-1 transition hover:shadow-sm ${meta.tone}`}>
                      <div className="flex-1">
                        <div className="flex flex-wrap items-baseline gap-2">
                          <span className="font-mono text-xs font-bold tabular-nums text-muted-foreground">
                            {time}
                          </span>
                          <span className="text-sm font-semibold">{e.title}</span>
                        </div>
                        {e.detail && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {e.detail}
                          </p>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}

function TabButton({
  active, onClick, icon: Icon, label, count,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof ClipboardList;
  label: string;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
        active
          ? "border-[var(--color-brand-blue)] text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      <Icon className="size-4" />
      {label}
      {count !== undefined && (
        <span className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
          active ? "bg-[var(--color-brand-blue)] text-white" : "bg-secondary text-muted-foreground"
        }`}>{count}</span>
      )}
    </button>
  );
}

function ProgressPill({ tasks }: { tasks: Array<{ status: TaskStatus }> }) {
  const done = tasks.filter((t) => t.status === "DONE").length;
  const inProgress = tasks.filter((t) => t.status === "IN_PROGRESS").length;
  const blocked = tasks.filter((t) => t.status === "BLOCKED").length;
  const total = tasks.length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-3 text-xs">
        <span className="font-bold text-foreground">{done}/{total} ολοκληρώθηκαν</span>
        {inProgress > 0 && <span className="text-amber-700">⏱ {inProgress} σε εξέλιξη</span>}
        {blocked > 0 && <span className="text-rose-700">⚠ {blocked} μπλοκ.</span>}
      </div>
      <div className="h-1.5 w-48 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─────────────────────── PLAN VIEW ───────────────────────

function PlanView({
  project, employees, partners, companies, vehicles, projectTasks,
}: {
  project: ProjectData;
  employees: OptionEmployee[];
  partners: OptionPartner[];
  companies: OptionCompany[];
  vehicles: OptionVehicle[];
  projectTasks: TaskRow[];
}) {
  const [openStops, setOpenStops] = useState<Set<string>>(
    new Set(project.stops.map((s) => s.id)),
  );
  const toggle = (id: string) => {
    setOpenStops((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  return (
    <div className="space-y-3">
      {project.stops.map((stop, i) => (
        <StopBlock
          key={stop.id}
          stop={stop}
          stopIndex={i}
          total={project.stops.length}
          open={openStops.has(stop.id)}
          onToggle={() => toggle(stop.id)}
          employees={employees}
          partners={partners}
          companies={companies}
          vehicles={vehicles}
          moveRequestId={project.moveRequestId}
          projectId={project.id}
          projectTasks={projectTasks}
        />
      ))}
    </div>
  );
}

// ─────────────────────── STOP BLOCK (redesigned) ───────────────────────

function StopBlock({
  stop, stopIndex, total, open, onToggle,
  employees, partners, companies, vehicles, moveRequestId, projectId, projectTasks,
}: {
  stop: StopRow;
  stopIndex: number;
  total: number;
  open: boolean;
  onToggle: () => void;
  employees: OptionEmployee[];
  partners: OptionPartner[];
  companies: OptionCompany[];
  vehicles: OptionVehicle[];
  moveRequestId: string;
  projectId: string;
  projectTasks: TaskRow[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [addingService, setAddingService] = useState(false);
  const [newType, setNewType] = useState<ServiceType>("OTHER");

  const isPickup = stop.type === "PICKUP";
  const stopRevenue = stop.services.reduce((s, sv) => s + (sv.totalPriceCents ?? 0), 0);
  const totalTasks = stop.services.reduce((s, sv) => s + sv.tasks.length, 0);
  const doneTasks = stop.services.reduce(
    (s, sv) => s + sv.tasks.filter((t) => t.status === "DONE").length, 0,
  );

  const handleAdd = () => {
    start(async () => {
      const res = await addProjectService({
        projectStopId: stop.id, serviceType: newType, quantity: 1,
      });
      if (res.ok) {
        setAddingService(false);
        setNewType("OTHER");
        router.refresh();
      } else alert(res.error);
    });
  };

  return (
    <div className={`overflow-hidden rounded-2xl border-2 bg-card transition ${
      open
        ? isPickup ? "border-blue-200 shadow-sm" : "border-rose-200 shadow-sm"
        : "border-border"
    }`}>
      {/* Stop header — colored gradient strip */}
      <button
        type="button"
        onClick={onToggle}
        className={`flex w-full items-center justify-between gap-3 p-4 text-left transition ${
          isPickup
            ? "bg-gradient-to-r from-blue-50 via-white to-white hover:from-blue-100"
            : "bg-gradient-to-r from-rose-50 via-white to-white hover:from-rose-100"
        }`}
      >
        <div className="flex flex-1 items-center gap-4">
          {open ? (
            <ChevronDown className="size-5 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-5 text-muted-foreground" />
          )}
          <div className={`relative grid size-12 place-items-center rounded-xl text-base font-bold text-white shadow-lg ${
            isPickup ? "bg-gradient-to-br from-blue-500 to-blue-700" : "bg-gradient-to-br from-rose-500 to-rose-700"
          }`}>
            {stopIndex + 1}
            <div className="absolute -bottom-1 -right-1 rounded-md bg-white px-1 py-0.5 text-[8px] font-bold uppercase shadow-sm">
              {isPickup ? "PU" : "DR"}
            </div>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-foreground">
                {isPickup ? "Παραλαβή" : "Παράδοση"}
              </span>
              <span className="text-xs text-muted-foreground">
                ({stopIndex + 1} από {total})
              </span>
              {stop.label && (
                <span className="rounded-md bg-white/70 px-2 py-0.5 text-[11px] font-medium text-foreground">
                  {stop.label}
                </span>
              )}
            </div>
            <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="size-3" /> {stop.address}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-base font-bold text-emerald-700">
            {(stopRevenue / 100).toLocaleString("el-GR")}€
          </div>
          <div className="mt-0.5 flex items-center justify-end gap-2 text-[11px] text-muted-foreground">
            <span>{stop.services.length} υπηρ.</span>
            <span>·</span>
            <span className="font-semibold text-emerald-700">{doneTasks}/{totalTasks}</span>
          </div>
        </div>
      </button>

      {open && (
        <div className="border-t border-border bg-slate-50/50 px-4 py-4">
          {stop.services.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-white p-6 text-center">
              <p className="text-xs italic text-muted-foreground">Καμία υπηρεσία ακόμη.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {stop.services.map((svc) => (
                <ServiceBlock
                  key={svc.id}
                  svc={svc}
                  partners={partners}
                  companies={companies}
                  employees={employees}
                  vehicles={vehicles}
                  moveRequestId={moveRequestId}
                  projectId={projectId}
                  projectTasks={projectTasks}
                />
              ))}
            </div>
          )}

          {addingService ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-border bg-white p-3">
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as ServiceType)}
                className="h-9 rounded-lg border border-border bg-white px-3 text-sm font-semibold"
              >
                {SERVICE_OPTIONS.map((s) => (
                  <option key={s} value={s}>{SERVICE_META[s].label}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleAdd}
                disabled={pending}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--color-brand-blue)] px-4 text-sm font-bold text-white shadow-sm disabled:opacity-50"
              >
                {pending && <Loader2 className="size-4 animate-spin" />}
                Προσθήκη
              </button>
              <button
                type="button"
                onClick={() => setAddingService(false)}
                className="inline-flex h-9 items-center rounded-lg border border-border bg-white px-3 text-sm font-medium"
              >
                Άκυρο
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAddingService(true)}
              className="mt-3 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-border bg-white text-sm font-semibold text-muted-foreground transition hover:border-[var(--color-brand-blue)] hover:bg-blue-50 hover:text-[var(--color-brand-blue)]"
            >
              <Plus className="size-4" /> Προσθήκη υπηρεσίας
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────── SERVICE BLOCK (redesigned) ───────────────────────

function ServiceBlock({
  svc, employees, partners, companies, vehicles, moveRequestId, projectId, projectTasks,
}: {
  svc: ServiceRow;
  employees: OptionEmployee[];
  partners: OptionPartner[];
  companies: OptionCompany[];
  vehicles: OptionVehicle[];
  moveRequestId: string;
  projectId: string;
  projectTasks: TaskRow[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskRow | null>(null);
  const [reminderTask, setReminderTask] = useState<TaskRow | null>(null);
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [qty, setQty] = useState(svc.quantity);
  const [unit, setUnit] = useState(
    svc.unitPriceCents != null ? (svc.unitPriceCents / 100).toFixed(2) : "",
  );
  const [partnerId, setPartnerId] = useState(svc.partner?.id ?? "");

  const meta = SERVICE_META[svc.serviceType];
  const Icon = meta.icon;

  const saveService = () => {
    start(async () => {
      const unitCents = unit ? Math.round(parseFloat(unit) * 100) : null;
      const res = await updateProjectService({
        id: svc.id, quantity: qty, unitPriceCents: unitCents, partnerId: partnerId || null,
      });
      if (res.ok) {
        setEditing(false);
        router.refresh();
      } else alert(res.error);
    });
  };

  const removeService = () => {
    if (!confirm(`Διαγραφή της υπηρεσίας "${meta.label}";`)) return;
    start(async () => {
      const res = await deleteProjectService(svc.id);
      if (res.ok) router.refresh(); else alert(res.error);
    });
  };

  const doneCount = svc.tasks.filter((t) => t.status === "DONE").length;

  return (
    <div className={`overflow-hidden rounded-xl border bg-white shadow-sm ring-1 ${meta.ring}`}>
      {/* Service header */}
      <div className="flex items-start justify-between gap-3 border-b border-border p-3">
        <div className="flex flex-1 items-start gap-3">
          <div className={`grid size-10 place-items-center rounded-lg ${meta.tone}`}>
            <Icon className="size-5" />
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold text-foreground">{meta.label}</span>
              {svc.partner && (
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800 ring-1 ring-amber-200">
                  🤝 {svc.partner.name}
                </span>
              )}
              {svc.label && (
                <span className="text-xs text-muted-foreground">· {svc.label}</span>
              )}
            </div>
            {editing ? (
              <div className="mt-2 grid grid-cols-3 gap-2">
                <NumberField label="Ποσότητα" value={qty} onChange={(v) => setQty(v)} />
                <FloatField label="Τιμή / μονάδα (€)" value={unit} onChange={setUnit} />
                <SelectField label="Συνεργάτης" value={partnerId} onChange={setPartnerId}>
                  <option value="">— Εσωτερικά —</option>
                  {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </SelectField>
              </div>
            ) : (
              <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                <span>×{svc.quantity}</span>
                {svc.unitPriceCents != null && (
                  <span>{(svc.unitPriceCents / 100).toLocaleString("el-GR")}€/μον.</span>
                )}
                {svc.totalPriceCents != null && (
                  <span className="rounded-md bg-emerald-50 px-2 py-0.5 font-bold text-emerald-800">
                    = {(svc.totalPriceCents / 100).toLocaleString("el-GR")}€
                  </span>
                )}
                {svc.tasks.length > 0 && (
                  <span className="ml-auto rounded-md bg-secondary px-2 py-0.5 font-semibold">
                    {doneCount}/{svc.tasks.length} εργασίες
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {editing ? (
            <>
              <button onClick={saveService} disabled={pending}
                className="inline-flex h-7 items-center rounded-md bg-emerald-600 px-2.5 text-xs font-bold text-white disabled:opacity-50">
                ✓
              </button>
              <button onClick={() => setEditing(false)}
                className="inline-flex h-7 items-center rounded-md border border-border bg-white px-2.5 text-xs">
                ✕
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setEditing(true)} title="Επεξεργασία"
                className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground">
                <Pencil className="size-3.5" />
              </button>
              <button onClick={removeService} disabled={pending} title="Διαγραφή"
                className="grid size-8 place-items-center rounded-md text-rose-600 hover:bg-rose-50 disabled:opacity-50">
                <Trash2 className="size-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Task list */}
      <div className="space-y-1.5 p-3">
        {svc.tasks.length === 0 && (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-center text-[11px] italic text-muted-foreground">
            Καμία ανάθεση ακόμη.
          </p>
        )}
        {svc.tasks.map((t) => (
          <TaskCard
            key={t.id}
            task={t}
            onEdit={() => setEditingTask(t)}
            onRemind={() => setReminderTask(t)}
            onDelete={() => {
              if (!confirm(`Διαγραφή της εργασίας "${t.title}";`)) return;
              start(async () => {
                const r = await deleteJobTask(t.id);
                if (r.ok) router.refresh(); else alert(r.error);
              });
            }}
          />
        ))}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => { setEditingTask(null); setShowTaskForm(true); }}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-slate-50/50 text-xs font-semibold text-muted-foreground transition hover:border-[var(--color-brand-blue)] hover:bg-blue-50 hover:text-[var(--color-brand-blue)]"
          >
            <Plus className="size-3.5" /> Νέα ανάθεση
          </button>
          <button
            onClick={() => setShowRequestDialog(true)}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-dashed border-amber-300 bg-amber-50/40 text-xs font-semibold text-amber-800 transition hover:border-amber-500 hover:bg-amber-50"
          >
            <Handshake className="size-3.5" /> Request από partners
          </button>
        </div>
      </div>

      {/* Quotes panel */}
      {svc.quoteRequests.length > 0 && (
        <QuotesPanel
          serviceLabel={meta.label}
          quotes={svc.quoteRequests}
        />
      )}

      {(showTaskForm || editingTask) && (
        <TaskAssignDialog
          existing={editingTask}
          serviceLabel={meta.label}
          moveRequestId={moveRequestId}
          employees={employees}
          partners={partners}
          vehicles={vehicles}
          projectTasks={projectTasks}
          onClose={() => { setShowTaskForm(false); setEditingTask(null); }}
          onSaved={() => { setShowTaskForm(false); setEditingTask(null); router.refresh(); }}
        />
      )}

      {reminderTask && (
        <ReminderDialog
          task={reminderTask}
          onClose={() => setReminderTask(null)}
        />
      )}

      {showRequestDialog && (
        <RequestPartnersDialog
          serviceId={svc.id}
          serviceLabel={meta.label}
          partners={partners}
          companies={companies}
          existingQuoteIds={new Set(svc.quoteRequests.map((q) => q.partner?.id).filter(Boolean) as string[])}
          onClose={() => setShowRequestDialog(false)}
          onSent={() => { setShowRequestDialog(false); router.refresh(); }}
        />
      )}
    </div>
  );
}

// ─────────────────────── TASK CARD ───────────────────────

function TaskCard({
  task, onEdit, onDelete, onRemind,
}: {
  task: TaskRow;
  onEdit: () => void;
  onDelete: () => void;
  onRemind: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const statusMeta = TASK_STATUS_META[task.status];
  const StatusIcon = statusMeta.icon;
  const startD = new Date(task.startAt);
  const end = new Date(startD.getTime() + task.durationMinutes * 60_000);
  const fmt = (d: Date) =>
    d.toLocaleString("el-GR", {
      day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
    });
  const allAssigneeNames = collectAllAssigneeNames(task);
  const vehicleLabel = task.vehicle
    ? [task.vehicle.brand, task.vehicle.model].filter(Boolean).join(" ") || task.vehicle.plate
    : null;
  const canRemind = task.assigneeKind !== "UNASSIGNED";

  // Confirmation visual state
  const cs = task.assigneeConfirmationStatus;
  const cardBg =
    cs === "PENDING"   ? "bg-amber-50/60 border-amber-300" :
    cs === "DECLINED"  ? "bg-rose-50/60 border-rose-300"   :
    cs === "CONFIRMED" ? "bg-emerald-50/60 border-emerald-300" :
                         "bg-white";

  const confirm = () => start(async () => {
    const r = await confirmTaskByAdmin(task.id);
    if (r.ok) router.refresh(); else alert(r.error);
  });
  const resend = () => start(async () => {
    const r = await resendTaskConfirmation(task.id);
    if (r.ok) router.refresh(); else alert(r.error);
  });

  return (
    <div className={`group relative flex items-center gap-3 rounded-lg border p-2.5 transition hover:shadow-sm ${cardBg}`}>
      <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l ${statusMeta.accent}`} />
      <StatusIcon className="size-4 shrink-0" style={{ color: "currentColor" }} />
      <div className="flex flex-1 flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-xs font-bold">{task.title}</span>
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <CalendarClock className="size-3" /> {fmt(startD)}–{fmt(end)}
        </span>
        {allAssigneeNames.length > 0 ? (
          <span className="flex items-center gap-1 text-[11px]">
            <User className="size-3" />
            <span className="font-semibold">{allAssigneeNames[0]}</span>
            {allAssigneeNames.length > 1 && (
              <span
                className="ml-0.5 rounded-full bg-[var(--color-brand-blue-soft)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--color-brand-blue-deep)]"
                title={allAssigneeNames.join(" · ")}
              >
                +{allAssigneeNames.length - 1}
              </span>
            )}
          </span>
        ) : (
          <span className="text-[10px] font-bold uppercase text-muted-foreground">
            Χωρίς ανάθεση
          </span>
        )}
        {vehicleLabel && (
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <TruckIcon className="size-3" /> {vehicleLabel}
          </span>
        )}
        <ConfirmationBadge cs={cs} sentAt={task.assigneeConfirmationSentAt} />
        <DependencyBadge blockers={task.blockers} />
      </div>
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
        {cs === "PENDING" && (
          <>
            <button onClick={confirm} disabled={pending} title="Επιβεβαίωση από admin"
              className="grid size-7 place-items-center rounded-md text-emerald-700 hover:bg-emerald-50 disabled:opacity-50">
              <CheckCircle2 className="size-3.5" />
            </button>
            <button onClick={resend} disabled={pending} title="Επαναποστολή"
              className="grid size-7 place-items-center rounded-md text-amber-700 hover:bg-amber-50 disabled:opacity-50">
              <Send className="size-3" />
            </button>
          </>
        )}
        {cs === "DECLINED" && (
          <button onClick={resend} disabled={pending} title="Νέα αποστολή"
            className="grid size-7 place-items-center rounded-md text-amber-700 hover:bg-amber-50 disabled:opacity-50">
            <Send className="size-3" />
          </button>
        )}
        {canRemind && (
          <button onClick={onRemind} title="Αποστολή υπενθύμισης"
            className="grid size-7 place-items-center rounded-md text-amber-700 hover:bg-amber-50">
            <Bell className="size-3.5" />
          </button>
        )}
        <button onClick={onEdit} title="Επεξεργασία"
          className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground">
          <Pencil className="size-3" />
        </button>
        <button onClick={onDelete} title="Διαγραφή"
          className="grid size-7 place-items-center rounded-md text-rose-600 hover:bg-rose-50">
          <Trash2 className="size-3" />
        </button>
      </div>
    </div>
  );
}

function DependencyBadge({ blockers }: { blockers: TaskRow["blockers"] }) {
  if (blockers.length === 0) return null;
  const pending = blockers.filter((b) => b.status !== "DONE" && b.status !== "CANCELLED").length;
  const isBlocked = pending > 0;
  const tip = blockers.map((b) => `${b.title} (${b.status})`).join("\n");
  return (
    <span
      title={`Εξαρτάται από:\n${tip}`}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ring-1 ${
        isBlocked
          ? "bg-rose-100 text-rose-900 ring-rose-300"
          : "bg-emerald-100 text-emerald-900 ring-emerald-300"
      }`}
    >
      🔗 {isBlocked ? `Blocked ${pending}/${blockers.length}` : `${blockers.length} ✓`}
    </span>
  );
}

function ConfirmationBadge({ cs, sentAt }: { cs: ConfirmStatus; sentAt: string | null }) {
  if (cs === "NONE") return null;
  if (cs === "PENDING") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-900 ring-1 ring-amber-300" title={sentAt ? `Στάλθηκε: ${new Date(sentAt).toLocaleString("el-GR")}` : ""}>
        <Clock className="size-3" /> Εκκρεμεί επιβεβ.
      </span>
    );
  }
  if (cs === "CONFIRMED") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-900 ring-1 ring-emerald-300">
        <CheckCircle2 className="size-3" /> Επιβεβαιώθηκε
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold uppercase text-rose-900 ring-1 ring-rose-300">
      <XCircle className="size-3" /> Δεν αναλαμβάνει
    </span>
  );
}

// ─────────────────────── KANBAN VIEW ───────────────────────

function KanbanView({
  tasksByStatus, moveRequestId, projectId, employees, partners, vehicles, projectTasks,
}: {
  tasksByStatus: Record<
    TaskStatus,
    Array<TaskRow & { serviceType: ServiceType; stopAddress: string; stopType: string }>
  >;
  moveRequestId: string;
  projectId: string;
  employees: OptionEmployee[];
  partners: OptionPartner[];
  vehicles: OptionVehicle[];
  projectTasks: TaskRow[];
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const [editingTask, setEditingTask] = useState<TaskRow | null>(null);
  const [reminderTask, setReminderTask] = useState<TaskRow | null>(null);
  const [dragOver, setDragOver] = useState<TaskStatus | null>(null);

  const moveTask = (taskId: string, status: TaskStatus, override = false) => {
    start(async () => {
      const res = await setJobTaskStatus({
        id: taskId, status, overrideBlockers: override,
      });
      if (res.ok) { router.refresh(); return; }
      if ("blockers" in res && res.blockers.length > 0) {
        const ok = confirm(
          `⚠ Εκκρεμούν blockers:\n\n${res.blockers
            .map((b) => `· ${b.title} (${b.status})`)
            .join("\n")}\n\nΘες να προχωρήσεις παρόλα αυτά;`,
        );
        if (ok) moveTask(taskId, status, true);
        return;
      }
      alert(res.error);
    });
  };

  return (
    <>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
        {KANBAN_COLUMNS.map((status) => {
          const meta = TASK_STATUS_META[status];
          const items = tasksByStatus[status];
          const isDragTarget = dragOver === status;
          return (
            <div
              key={status}
              onDragOver={(e) => { e.preventDefault(); setDragOver(status); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => {
                e.preventDefault();
                const taskId = e.dataTransfer.getData("text/plain");
                setDragOver(null);
                if (taskId) moveTask(taskId, status);
              }}
              className={`flex min-h-[320px] flex-col rounded-2xl border-2 bg-card transition ${
                isDragTarget
                  ? "border-[var(--color-brand-blue)] bg-blue-50/50 shadow-md"
                  : "border-border"
              }`}
            >
              <div className={`flex items-center justify-between gap-2 rounded-t-2xl border-b px-3 py-2.5 ${meta.tone}`}>
                <div className="flex items-center gap-2">
                  <span className={`size-2 rounded-full ${meta.accent}`} />
                  <span className="text-xs font-bold uppercase tracking-wide">{meta.label}</span>
                </div>
                <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-bold">
                  {items.length}
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-2 p-2">
                {items.length === 0 ? (
                  <p className="my-auto text-center text-[11px] italic text-muted-foreground">
                    Καμία εργασία
                  </p>
                ) : (
                  items.map((t) => (
                    <KanbanCard
                      key={t.id}
                      task={t}
                      onEdit={() => setEditingTask(t)}
                      onRemind={() => setReminderTask(t)}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {editingTask && (
        <TaskAssignDialog
          existing={editingTask}
          serviceLabel=""
          moveRequestId={moveRequestId}
          employees={employees}
          partners={partners}
          vehicles={vehicles}
          projectTasks={projectTasks}
          onClose={() => setEditingTask(null)}
          onSaved={() => { setEditingTask(null); router.refresh(); }}
        />
      )}
      {reminderTask && (
        <ReminderDialog
          task={reminderTask}
          onClose={() => setReminderTask(null)}
        />
      )}
    </>
  );
}

function KanbanCard({
  task, onEdit, onRemind,
}: {
  task: TaskRow & { serviceType: ServiceType; stopAddress: string; stopType: string };
  onEdit: () => void;
  onRemind: () => void;
}) {
  const meta = SERVICE_META[task.serviceType];
  const Icon = meta.icon;
  const start = new Date(task.startAt);
  const end = new Date(start.getTime() + task.durationMinutes * 60_000);
  const fmt = (d: Date) =>
    d.toLocaleString("el-GR", {
      day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
    });
  const allNames = collectAllAssigneeNames(task);
  const assignee = allNames[0] ?? null;
  const extraCount = Math.max(0, allNames.length - 1);
  const canRemind = task.assigneeKind !== "UNASSIGNED";

  const cs = task.assigneeConfirmationStatus;
  const cardBg =
    cs === "PENDING"   ? "bg-amber-50 border-amber-300" :
    cs === "DECLINED"  ? "bg-rose-50 border-rose-300" :
    cs === "CONFIRMED" ? "bg-emerald-50/40 border-emerald-300" :
                         "bg-white border-border";

  return (
    <div
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/plain", task.id)}
      onClick={onEdit}
      className={`group cursor-grab rounded-xl border-2 p-2.5 shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--color-brand-blue)] hover:shadow-md active:cursor-grabbing ${cardBg}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase ${meta.tone}`}>
          <Icon className="size-3" /> {meta.label}
        </div>
        {canRemind && (
          <button
            onClick={(e) => { e.stopPropagation(); onRemind(); }}
            title="Reminder"
            className="grid size-6 place-items-center rounded-md text-amber-700 opacity-0 transition group-hover:opacity-100 hover:bg-amber-50"
          >
            <Bell className="size-3" />
          </button>
        )}
      </div>
      <div className="mt-1.5 text-xs font-bold leading-tight">{task.title}</div>
      <div className="mt-1 flex items-center gap-1">
        <ConfirmationBadge cs={cs} sentAt={task.assigneeConfirmationSentAt} />
        <DependencyBadge blockers={task.blockers} />
      </div>
      <div className="mt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground">
        <CalendarClock className="size-3" /> {fmt(start)}
      </div>
      <div className="mt-0.5 text-[10px] text-muted-foreground">
        έως {fmt(end)}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-dashed border-border pt-1.5">
        <span
          className={`inline-flex items-center gap-1 text-[10px] ${
            assignee ? "font-bold text-foreground" : "italic text-muted-foreground"
          }`}
          title={allNames.join(" · ")}
        >
          <User className="size-3" /> {assignee ?? "Χωρίς ανάθεση"}
          {extraCount > 0 && (
            <span className="ml-0.5 rounded-full bg-[var(--color-brand-blue-soft)] px-1 text-[8px] font-extrabold text-[var(--color-brand-blue-deep)]">
              +{extraCount}
            </span>
          )}
        </span>
        <span className="truncate text-[9px] text-muted-foreground">
          📍 {task.stopAddress.slice(0, 22)}{task.stopAddress.length > 22 ? "…" : ""}
        </span>
      </div>
    </div>
  );
}

// ─────────────────────── REMINDER DIALOG ───────────────────────

function ReminderDialog({
  task, onClose,
}: {
  task: TaskRow;
  onClose: () => void;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState("");

  const recipient =
    task.assigneeEmployee?.name ?? task.assigneePartner?.name ?? "—";

  const send = () => {
    start(async () => {
      setError(null);
      const res = await sendTaskReminder({
        taskId: task.id,
        customMessage: message || undefined,
      });
      if (res.ok) {
        setSuccess(true);
        setTimeout(onClose, 1500);
      } else {
        setError(res.error);
      }
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-xl">
        <div className="mb-3 flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="grid size-9 place-items-center rounded-xl bg-amber-100 text-amber-700">
              <Bell className="size-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">Αποστολή υπενθύμισης</h3>
              <p className="text-xs text-muted-foreground">μέσω email</p>
            </div>
          </div>
          <button onClick={onClose} className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-secondary">
            <X className="size-4" />
          </button>
        </div>

        <div className="rounded-xl bg-slate-50 p-3 text-xs">
          <div className="font-semibold">Προς:</div>
          <div className="mt-0.5 flex items-center gap-1 text-foreground">
            <Mail className="size-3.5" /> {recipient}
          </div>
          <div className="mt-2 font-semibold">Εργασία:</div>
          <div className="mt-0.5 text-foreground">{task.title}</div>
        </div>

        <label className="mt-3 block text-xs font-semibold text-foreground">
          Προσωπικό μήνυμα (προαιρετικό)
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="π.χ. Μη ξεχάσεις τα έγγραφα του πελάτη"
            rows={3}
            className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
          />
        </label>

        {error && (
          <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800">
            {error}
          </p>
        )}
        {success && (
          <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
            ✓ Στάλθηκε!
          </p>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="h-9 rounded-lg border border-border bg-white px-3 text-sm"
          >
            Άκυρο
          </button>
          <button
            onClick={send}
            disabled={pending || success}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-amber-600 px-4 text-sm font-bold text-white shadow-sm hover:bg-amber-700 disabled:opacity-50"
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            <Bell className="size-4" />
            Αποστολή
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────── TASK DIALOG (with override) ───────────────────────

function TaskAssignDialog({
  existing, serviceLabel, moveRequestId,
  employees, partners, vehicles, projectTasks, onClose, onSaved,
}: {
  existing: TaskRow | null;
  serviceLabel: string;
  moveRequestId: string;
  employees: OptionEmployee[];
  partners: OptionPartner[];
  vehicles: OptionVehicle[];
  projectTasks: Array<{ id: string; title: string; status: string }>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<
    Array<{
      taskId: string;
      resourceKind: string;
      resourceName: string;
      otherStart: string | Date;
      otherEnd: string | Date;
      projectCode: string | null;
      taskTitle: string;
    }>
  >([]);
  const [overrideReason, setOverrideReason] = useState("");
  const [title, setTitle] = useState(existing?.title ?? serviceLabel);
  const [startAt, setStartAt] = useState(() =>
    toLocalInput(existing ? new Date(existing.startAt) : new Date()),
  );
  const [hours, setHours] = useState(
    existing ? (existing.durationMinutes / 60).toString() : "2",
  );
  const [assigneeKind, setAssigneeKind] = useState<"EMPLOYEE" | "PARTNER" | "UNASSIGNED">(
    (existing?.assigneeKind as "EMPLOYEE" | "PARTNER" | "UNASSIGNED") ?? "EMPLOYEE",
  );
  const [employeeId, setEmployeeId] = useState(existing?.assigneeEmployee?.id ?? "");
  const [partnerId, setPartnerId] = useState(existing?.assigneePartner?.id ?? "");
  const [vehicleId, setVehicleId] = useState(existing?.vehicle?.id ?? "");
  const [blockerIds, setBlockerIds] = useState<Set<string>>(
    new Set(existing?.blockerIds ?? []),
  );
  // Co-assignees: everyone in `assignments` that isn't the primary.
  const [coEmployeeIds, setCoEmployeeIds] = useState<Set<string>>(() => {
    const s = new Set<string>();
    for (const a of existing?.assignments ?? []) {
      if (a.isPrimary) continue;
      if (a.employee) s.add(a.employee.id);
    }
    return s;
  });
  const [coPartnerIds, setCoPartnerIds] = useState<Set<string>>(() => {
    const s = new Set<string>();
    for (const a of existing?.assignments ?? []) {
      if (a.isPrimary) continue;
      if (a.partner) s.add(a.partner.id);
    }
    return s;
  });
  const toggleSetItem = (
    setFn: typeof setCoEmployeeIds,
    id: string,
  ) => {
    setFn((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const toggleBlocker = (id: string) => {
    setBlockerIds((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };
  const availableBlockers = projectTasks.filter((t) => t.id !== existing?.id);

  const perform = (overrideConflicts: boolean) => {
    start(async () => {
      const res = await upsertJobTask({
        id: existing?.id,
        moveRequestId,
        title,
        category: "OTHER",
        startAt: new Date(startAt).toISOString(),
        durationMinutes: Math.max(5, Math.round(parseFloat(hours) * 60)),
        assigneeKind,
        assigneeEmployeeId: assigneeKind === "EMPLOYEE" ? employeeId : undefined,
        assigneePartnerId: assigneeKind === "PARTNER" ? partnerId : undefined,
        vehicleId: vehicleId || undefined,
        overrideConflicts,
        overrideReason: overrideConflicts ? overrideReason : undefined,
        blockerIds: Array.from(blockerIds),
        coEmployeeIds: Array.from(coEmployeeIds),
        coPartnerIds: Array.from(coPartnerIds),
      });
      if (res.ok) { onSaved(); return; }
      if ("conflicts" in res && res.conflicts.length > 0) {
        setConflicts(res.conflicts);
        setError(null);
        return;
      }
      setError(res.error);
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-5 shadow-xl">
        <h3 className="text-base font-bold">
          {existing ? "Επεξεργασία ανάθεσης" : `Νέα ανάθεση${serviceLabel ? ` · ${serviceLabel}` : ""}`}
        </h3>

        <div className="mt-3 space-y-3">
          <Field label="Τίτλος">
            <input value={title} onChange={(e) => setTitle(e.target.value)}
              className="h-9 w-full rounded-lg border-2 border-border bg-white px-3 text-sm" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Έναρξη">
              <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)}
                className="h-9 w-full rounded-lg border-2 border-border bg-white px-3 text-sm" />
            </Field>
            <Field label="Διάρκεια (ώρες)">
              <input type="number" step="0.5" min={0.25} value={hours} onChange={(e) => setHours(e.target.value)}
                className="h-9 w-full rounded-lg border-2 border-border bg-white px-3 text-sm" />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {(["EMPLOYEE", "PARTNER", "UNASSIGNED"] as const).map((k) => (
              <button key={k} type="button" onClick={() => setAssigneeKind(k)}
                className={`h-9 rounded-lg border-2 text-xs font-semibold ${
                  assigneeKind === k
                    ? "border-[var(--color-brand-blue)] bg-[var(--color-brand-blue)] text-white"
                    : "border-border bg-white"
                }`}>
                {k === "EMPLOYEE" ? "Υπάλληλος" : k === "PARTNER" ? "Συνεργάτης" : "Χωρίς"}
              </button>
            ))}
          </div>

          {assigneeKind === "EMPLOYEE" && (
            <Field label="Υπάλληλος">
              <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}
                className="h-9 w-full rounded-lg border-2 border-border bg-white px-3 text-sm">
                <option value="">— Επέλεξε —</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.name} ({e.role})</option>)}
              </select>
            </Field>
          )}
          {assigneeKind === "PARTNER" && (
            <Field label="Συνεργάτης">
              <select value={partnerId} onChange={(e) => setPartnerId(e.target.value)}
                className="h-9 w-full rounded-lg border-2 border-border bg-white px-3 text-sm">
                <option value="">— Επέλεξε —</option>
                {partners.length === 0 ? (
                  <option disabled>(Δεν υπάρχουν συνεργάτες — πρόσθεσε από /carrier/partners)</option>
                ) : partners.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.kind})</option>)}
              </select>
            </Field>
          )}

          <Field label="Όχημα (προαιρετικό)">
            <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}
              className="h-9 w-full rounded-lg border-2 border-border bg-white px-3 text-sm">
              <option value="">— Χωρίς —</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {[v.brand, v.model].filter(Boolean).join(" ") || v.plate} · {v.plate}
                </option>
              ))}
            </select>
          </Field>

          {/* Co-assignees: π.χ. οδηγός + βοηθός μαζί */}
          <Field label={`👥 Συμμετέχοντες (extra) ${coEmployeeIds.size + coPartnerIds.size > 0 ? `· ${coEmployeeIds.size + coPartnerIds.size}` : ""}`}>
            <details className="rounded-lg border-2 border-border bg-white">
              <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-muted-foreground">
                {coEmployeeIds.size + coPartnerIds.size === 0
                  ? "— Κανείς extra —"
                  : `${coEmployeeIds.size + coPartnerIds.size} επιπλέον επιλεγμέν${coEmployeeIds.size + coPartnerIds.size === 1 ? "ος" : "οι"}`}
              </summary>
              <div className="border-t border-border p-2">
                <p className="px-1 py-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  Υπάλληλοι
                </p>
                {employees.filter((e) => e.id !== employeeId).length === 0 ? (
                  <p className="px-2 py-1 text-[11px] italic text-muted-foreground">—</p>
                ) : (
                  <ul className="max-h-32 overflow-y-auto">
                    {employees
                      .filter((e) => e.id !== employeeId)
                      .map((e) => (
                        <li key={e.id}>
                          <label
                            className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs transition ${
                              coEmployeeIds.has(e.id)
                                ? "bg-[var(--color-brand-blue-soft)]"
                                : "hover:bg-secondary/50"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={coEmployeeIds.has(e.id)}
                              onChange={() => toggleSetItem(setCoEmployeeIds, e.id)}
                              className="size-3.5 rounded accent-[var(--color-brand-blue)]"
                            />
                            <span className="flex-1 font-semibold">{e.name}</span>
                            <span className="rounded bg-secondary px-1.5 py-0.5 text-[9px] uppercase">{e.role}</span>
                          </label>
                        </li>
                      ))}
                  </ul>
                )}
                <p className="mt-2 px-1 py-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  Συνεργάτες
                </p>
                {partners.filter((p) => p.id !== partnerId).length === 0 ? (
                  <p className="px-2 py-1 text-[11px] italic text-muted-foreground">—</p>
                ) : (
                  <ul className="max-h-32 overflow-y-auto">
                    {partners
                      .filter((p) => p.id !== partnerId)
                      .map((p) => (
                        <li key={p.id}>
                          <label
                            className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs transition ${
                              coPartnerIds.has(p.id)
                                ? "bg-amber-50"
                                : "hover:bg-secondary/50"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={coPartnerIds.has(p.id)}
                              onChange={() => toggleSetItem(setCoPartnerIds, p.id)}
                              className="size-3.5 rounded accent-amber-600"
                            />
                            <span className="flex-1 font-semibold">{p.name}</span>
                            <span className="rounded bg-secondary px-1.5 py-0.5 text-[9px] uppercase">{p.kind}</span>
                          </label>
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            </details>
          </Field>

          {availableBlockers.length > 0 && (
            <Field label={`🔗 Εξαρτάται από (${blockerIds.size})`}>
              <details className="rounded-lg border-2 border-border bg-white">
                <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-muted-foreground">
                  {blockerIds.size === 0
                    ? "— Καμία εξάρτηση —"
                    : `${blockerIds.size} blocker${blockerIds.size === 1 ? "" : "s"} επιλεγμέν${blockerIds.size === 1 ? "ος" : "οι"}`}
                </summary>
                <ul className="max-h-44 overflow-y-auto border-t border-border p-1.5">
                  {availableBlockers.map((t) => (
                    <li key={t.id}>
                      <label className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs transition ${
                        blockerIds.has(t.id) ? "bg-amber-50" : "hover:bg-secondary/50"
                      }`}>
                        <input
                          type="checkbox"
                          checked={blockerIds.has(t.id)}
                          onChange={() => toggleBlocker(t.id)}
                          className="size-3.5 rounded accent-amber-600"
                        />
                        <span className="flex-1 truncate font-semibold">{t.title}</span>
                        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                          t.status === "DONE" ? "bg-emerald-100 text-emerald-800" :
                          t.status === "IN_PROGRESS" ? "bg-amber-100 text-amber-800" :
                          t.status === "CONFIRMED" ? "bg-indigo-100 text-indigo-800" :
                          t.status === "BLOCKED" ? "bg-rose-100 text-rose-800" :
                          "bg-secondary text-muted-foreground"
                        }`}>
                          {t.status}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </details>
            </Field>
          )}
        </div>

        {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800">{error}</p>}

        {conflicts.length > 0 && (
          <div className="mt-3 rounded-lg border-2 border-amber-300 bg-amber-50 p-3">
            <p className="text-sm font-bold text-amber-900">⚠ Σύγκρουση διαθεσιμότητας</p>
            <ul className="mt-2 space-y-1.5">
              {conflicts.map((c) => {
                const s = new Date(c.otherStart);
                const e = new Date(c.otherEnd);
                const fmt = (d: Date) => d.toLocaleString("el-GR", {
                  day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                });
                return (
                  <li key={`${c.taskId}-${c.resourceKind}`}
                    className="rounded bg-white/70 px-2 py-1 text-[11px]">
                    <strong>{c.resourceName}</strong> · {fmt(s)}–{fmt(e)} · {c.taskTitle}
                    {c.projectCode && <span className="ml-1 rounded bg-amber-200 px-1 text-[10px] font-bold">{c.projectCode}</span>}
                  </li>
                );
              })}
            </ul>
            <label className="mt-2 block text-[11px] font-semibold text-amber-900">
              Λόγος override (προαιρετικό)
              <textarea value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)}
                rows={2} className="mt-1 w-full rounded border border-amber-300 bg-white px-2 py-1 text-xs" />
            </label>
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => setConflicts([])}
                className="h-7 rounded border border-amber-300 bg-white px-2 text-[11px]">
                Άλλαξα γνώμη
              </button>
              <button type="button" onClick={() => perform(true)} disabled={pending}
                className="inline-flex h-7 items-center gap-1 rounded bg-amber-600 px-2 text-[11px] font-bold text-white disabled:opacity-50">
                {pending && <Loader2 className="size-3 animate-spin" />}
                Όχι κράτα το έτσι
              </button>
            </div>
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose}
            className="h-9 rounded-lg border border-border bg-white px-3 text-sm">
            Άκυρο
          </button>
          <button type="button"
            onClick={() => { setError(null); setConflicts([]); perform(false); }}
            disabled={pending}
            className="inline-flex h-9 items-center gap-1 rounded-lg bg-[var(--color-brand-blue)] px-4 text-sm font-bold text-white disabled:opacity-50">
            {pending && <Loader2 className="size-4 animate-spin" />}
            {existing ? "Αποθήκευση" : "Δημιουργία"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────── small UI bits ───────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      {label}
      <div className="mt-0.5">{children}</div>
    </label>
  );
}
function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <label className="text-[10px] font-semibold uppercase text-muted-foreground">
      {label}
      <input type="number" min={1} value={value}
        onChange={(e) => onChange(parseInt(e.target.value) || 1)}
        className="mt-0.5 block h-8 w-full rounded border border-border px-2 text-sm" />
    </label>
  );
}
function FloatField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="text-[10px] font-semibold uppercase text-muted-foreground">
      {label}
      <input type="number" step="0.01" min={0} value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-0.5 block h-8 w-full rounded border border-border px-2 text-sm" />
    </label>
  );
}
function SelectField({ label, value, onChange, children }: {
  label: string; value: string; onChange: (v: string) => void; children: React.ReactNode;
}) {
  return (
    <label className="text-[10px] font-semibold uppercase text-muted-foreground">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="mt-0.5 block h-8 w-full rounded border border-border px-2 text-xs">
        {children}
      </select>
    </label>
  );
}

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ─────────────────────── QUOTES PANEL ───────────────────────

const QUOTE_STATUS_META: Record<
  QuoteRow["status"],
  { label: string; tone: string; icon: typeof Clock }
> = {
  PENDING:   { label: "Στάλθηκε",        tone: "bg-amber-50 text-amber-800 ring-amber-200",       icon: Clock },
  QUOTED:    { label: "Έλαβες προσφορά", tone: "bg-emerald-50 text-emerald-800 ring-emerald-200", icon: CheckCircle2 },
  ACCEPTED:  { label: "Επιλέχθηκε",      tone: "bg-indigo-50 text-indigo-800 ring-indigo-200",    icon: CheckCircle2 },
  LOST:      { label: "Δεν επιλέχθηκε",  tone: "bg-zinc-50 text-zinc-600 ring-zinc-200",          icon: XCircle },
  DECLINED:  { label: "Αρνήθηκε",        tone: "bg-rose-50 text-rose-700 ring-rose-200",          icon: XCircle },
  EXPIRED:   { label: "Έληξε",           tone: "bg-zinc-50 text-zinc-600 ring-zinc-200",          icon: Clock },
  CANCELLED: { label: "Ακυρώθηκε",       tone: "bg-zinc-50 text-zinc-600 ring-zinc-200",          icon: XCircle },
};

function QuotesPanel({
  quotes,
}: {
  serviceLabel: string;
  quotes: QuoteRow[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const counts = {
    sent: quotes.filter((q) => q.status === "PENDING").length,
    quoted: quotes.filter((q) => q.status === "QUOTED").length,
    declined: quotes.filter((q) => q.status === "DECLINED").length,
    accepted: quotes.filter((q) => q.status === "ACCEPTED").length,
  };
  const visible = quotes.filter((q) => q.status !== "CANCELLED");

  const accept = (id: string) => {
    if (!confirm("Επιλογή αυτού του partner; (Τα υπόλοιπα pending quotes θα ακυρωθούν με courtesy email)")) return;
    start(async () => {
      const res = await acceptServiceQuote({ quoteRequestId: id });
      if (res.ok) router.refresh(); else alert(res.error);
    });
  };
  const cancel = (id: string) => {
    if (!confirm("Ακύρωση αυτού του quote;")) return;
    start(async () => {
      const res = await cancelServiceQuote(id);
      if (res.ok) router.refresh(); else alert(res.error);
    });
  };

  return (
    <div className="mx-3 mb-3 mt-2 overflow-hidden rounded-lg border border-amber-200 bg-amber-50/40">
      <div className="flex items-center justify-between gap-2 border-b border-amber-200 bg-amber-100/40 px-3 py-2">
        <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
          <Handshake className="size-3.5" />
          Quote campaign · {visible.length} request{visible.length !== 1 ? "s" : ""}
        </div>
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase">
          {counts.accepted > 0 && <span className="rounded bg-indigo-200 px-1.5 py-0.5 text-indigo-900">✓ {counts.accepted} επιλεγμένο</span>}
          {counts.quoted > 0 && <span className="rounded bg-emerald-200 px-1.5 py-0.5 text-emerald-900">{counts.quoted} quoted</span>}
          {counts.sent > 0 && <span className="rounded bg-amber-200 px-1.5 py-0.5 text-amber-900">{counts.sent} pending</span>}
          {counts.declined > 0 && <span className="rounded bg-rose-200 px-1.5 py-0.5 text-rose-900">{counts.declined} declined</span>}
        </div>
      </div>
      <ul className="divide-y divide-amber-100">
        {visible.map((q) => {
          const sm = QUOTE_STATUS_META[q.status];
          const Icon = sm.icon;
          const canAccept = q.status === "QUOTED" || q.status === "PENDING";
          const canCancel = q.status === "PENDING" || q.status === "QUOTED";
          const noAcceptedYet = counts.accepted === 0;
          return (
            <li key={q.id} className="flex items-center gap-2 px-3 py-2 text-xs">
              <Icon className="size-3.5 text-amber-700" />
              <div className="flex-1">
                <div className="font-bold text-foreground">
                  {q.partner?.name ?? q.recipientName ?? q.recipientEmail}
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span className={`rounded px-1.5 py-0.5 font-semibold uppercase ring-1 ${sm.tone}`}>
                    {sm.label}
                  </span>
                  {q.scheduledStartAt && (
                    <span>
                      📅 {new Date(q.scheduledStartAt).toLocaleString("el-GR", {
                        day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                      })}
                    </span>
                  )}
                  {q.estimatedMinutes && <span>⏱ {(q.estimatedMinutes / 60).toFixed(1)}h</span>}
                  {q.quotedPriceCents != null && (
                    <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-bold text-emerald-800">
                      {(q.quotedPriceCents / 100).toLocaleString("el-GR")}€
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {canAccept && noAcceptedYet && (
                  <button
                    onClick={() => accept(q.id)}
                    disabled={pending}
                    className="inline-flex h-6 items-center gap-1 rounded bg-indigo-600 px-2 text-[10px] font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {pending && <Loader2 className="size-3 animate-spin" />}
                    Επιλογή
                  </button>
                )}
                {canCancel && (
                  <button
                    onClick={() => cancel(q.id)}
                    disabled={pending}
                    title="Ακύρωση"
                    className="grid size-6 place-items-center rounded text-rose-600 hover:bg-rose-50"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ─────────────────────── REQUEST PARTNERS DIALOG ───────────────────────

function RequestPartnersDialog({
  serviceId, serviceLabel, partners, companies, existingQuoteIds, onClose, onSent,
}: {
  serviceId: string;
  serviceLabel: string;
  partners: OptionPartner[];
  companies: OptionCompany[];
  existingQuoteIds: Set<string>;
  onClose: () => void;
  onSent: () => void;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedPartners, setSelectedPartners] = useState<Set<string>>(new Set());
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set());
  const [scheduledAt, setScheduledAt] = useState(() => toLocalInput(new Date(Date.now() + 24 * 3600 * 1000)));
  const [hours, setHours] = useState("2");
  const [notes, setNotes] = useState("");
  const [validHours, setValidHours] = useState(72);

  const toggleSet = (setFn: typeof setSelectedPartners, id: string) => {
    setFn((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };
  const totalSelected = selectedPartners.size + selectedCompanies.size;

  const send = () => {
    setError(null);
    start(async () => {
      const res = await sendServiceQuoteCampaign({
        projectStopServiceId: serviceId,
        partnerIds: Array.from(selectedPartners),
        companyIds: Array.from(selectedCompanies),
        scheduledStartAt: new Date(scheduledAt).toISOString(),
        estimatedMinutes: Math.max(15, Math.round(parseFloat(hours) * 60)),
        notes: notes || undefined,
        validHours,
      });
      if (res.ok) {
        const { sent, failed } = res.data!;
        alert(
          `Στάλθηκαν ${sent} request${sent !== 1 ? "s" : ""}` +
            (failed > 0 ? `, απέτυχαν ${failed}.` : "."),
        );
        onSent();
      } else {
        setError(res.error);
      }
    });
  };

  const availablePartners = partners.filter((p) => !existingQuoteIds.has(p.id));
  const availableCompanies = companies.filter((c) => !existingQuoteIds.has(c.id));

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-2xl rounded-2xl border border-border bg-card p-5 shadow-xl">
        <div className="mb-3 flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="grid size-9 place-items-center rounded-xl bg-amber-100 text-amber-700">
              <Handshake className="size-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">Request προσφοράς από partners</h3>
              <p className="text-xs text-muted-foreground">Υπηρεσία: {serviceLabel}</p>
            </div>
          </div>
          <button onClick={onClose} className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-secondary">
            <X className="size-4" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Έναρξη εργασίας">
            <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)}
              className="h-9 w-full rounded-lg border-2 border-border bg-white px-2 text-sm" />
          </Field>
          <Field label="Εκτιμώμενη διάρκεια (h)">
            <input type="number" step="0.5" min={0.25} value={hours} onChange={(e) => setHours(e.target.value)}
              className="h-9 w-full rounded-lg border-2 border-border bg-white px-2 text-sm" />
          </Field>
          <Field label="Ισχύς (ώρες)">
            <input type="number" min={1} max={720} value={validHours}
              onChange={(e) => setValidHours(parseInt(e.target.value) || 72)}
              className="h-9 w-full rounded-lg border-2 border-border bg-white px-2 text-sm" />
          </Field>
        </div>

        <div className="mt-3">
          <Field label="Σημειώσεις (προαιρετικό)">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              placeholder="π.χ. προτιμητέοι όροι, ειδικές απαιτήσεις"
              className="w-full rounded-lg border-2 border-border bg-white p-2 text-sm" />
          </Field>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                👤 Συνεργάτες ({selectedPartners.size})
              </span>
            </div>
            {availablePartners.length === 0 ? (
              <div className="rounded-lg bg-slate-50 p-3 text-center text-[11px] text-muted-foreground">
                {partners.length === 0 ? "Καμία καταχώρηση" : "Όλοι ήδη ενημερωμένοι"}
              </div>
            ) : (
              <ul className="grid max-h-56 gap-1.5 overflow-y-auto rounded-lg border border-border bg-slate-50/30 p-2">
                {availablePartners.map((p) => (
                  <li key={p.id}>
                    <label className={`flex cursor-pointer items-center gap-2 rounded-md border-2 bg-white px-2.5 py-1.5 text-xs transition ${
                      selectedPartners.has(p.id)
                        ? "border-amber-500 bg-amber-50 shadow-sm"
                        : "border-transparent hover:border-border"
                    }`}>
                      <input
                        type="checkbox"
                        checked={selectedPartners.has(p.id)}
                        onChange={() => toggleSet(setSelectedPartners, p.id)}
                        className="size-4 rounded accent-amber-600"
                      />
                      <span className="flex-1 font-semibold">{p.name}</span>
                      <span className="rounded bg-secondary px-1.5 py-0.5 text-[9px] font-bold uppercase text-muted-foreground">{p.kind}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                🏢 Εταιρίες ({selectedCompanies.size})
              </span>
            </div>
            {availableCompanies.length === 0 ? (
              <div className="rounded-lg bg-slate-50 p-3 text-center text-[11px] text-muted-foreground">
                {companies.length === 0 ? "Καμία καταχώρηση" : "Όλες ήδη ενημερωμένες"}
              </div>
            ) : (
              <ul className="grid max-h-56 gap-1.5 overflow-y-auto rounded-lg border border-border bg-slate-50/30 p-2">
                {availableCompanies.map((c) => (
                  <li key={c.id}>
                    <label
                      className={`flex cursor-pointer items-center gap-2 rounded-md border-2 bg-white px-2.5 py-1.5 text-xs transition ${
                        !c.hasEmail
                          ? "border-rose-200 opacity-60"
                          : selectedCompanies.has(c.id)
                            ? "border-amber-500 bg-amber-50 shadow-sm"
                            : "border-transparent hover:border-border"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedCompanies.has(c.id)}
                        disabled={!c.hasEmail}
                        onChange={() => toggleSet(setSelectedCompanies, c.id)}
                        className="size-4 rounded accent-amber-600"
                      />
                      <span className="flex-1 font-semibold">{c.name}</span>
                      {!c.hasEmail && (
                        <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-rose-800">
                          χωρίς email
                        </span>
                      )}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <p className="mt-2 text-[10px] text-muted-foreground">
          💡 Συνολικά: <strong>{totalSelected}</strong> αποδέκτες. Στις εταιρίες, το email στέλνεται στη γενική διεύθυνσή τους.
        </p>

        {error && (
          <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800">
            {error}
          </p>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose}
            className="h-9 rounded-lg border border-border bg-white px-3 text-sm">
            Άκυρο
          </button>
          <button
            onClick={send}
            disabled={pending || totalSelected === 0}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-amber-600 px-4 text-sm font-bold text-white shadow-sm hover:bg-amber-700 disabled:opacity-50"
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            <Send className="size-4" />
            Αποστολή σε {totalSelected}
          </button>
        </div>
      </div>
    </div>
  );
}
