"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Circle,
  CircleAlert,
  Clock,
  Edit3,
  Loader2,
  Pencil,
  Play,
  Plus,
  Trash2,
  Truck,
  User,
  Users,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  deleteJobTask,
  rescheduleJobTask,
  setJobTaskStatus,
  upsertJobTask,
} from "@/server/actions/carrier-job-tasks.action";
import { StatCell, StatRow } from "@/components/shared/stat-cell";
import { Gantt, type GanttTask, type TaskStatus, type TaskCategory } from "./gantt";
import {
  StopGantt,
  type StopGanttServiceType,
  type StopGanttStop,
} from "./stop-gantt";

const CATEGORY_TO_SERVICE: Record<TaskCategory, StopGanttServiceType> = {
  PREP: "OTHER",
  LOADING: "LOADING",
  TRANSIT: "TRANSIT",
  CRANE: "CRANE",
  UNLOADING: "UNLOADING",
  ASSEMBLY: "ASSEMBLY",
  STORAGE: "STORAGE",
  CLEANUP: "CLEANUP",
  ADMIN: "OTHER",
  OTHER: "OTHER",
};

// ---------------- Types ----------------

export interface PanelTask {
  id: string;
  title: string;
  description: string | null;
  category: TaskCategory;
  status: TaskStatus;
  startAt: Date;
  durationMinutes: number;
  startedAt: Date | null;
  completedAt: Date | null;
  assigneeKind: "EMPLOYEE" | "PARTNER" | "UNASSIGNED";
  assigneeEmployeeId: string | null;
  assigneePartnerId: string | null;
  assigneeName: string | null;
  vehicleId: string | null;
  vehiclePlate: string | null;
  notes: string | null;
}

export interface EmployeeOption {
  id: string;
  name: string;
  role: string;
}
export interface PartnerOption {
  id: string;
  name: string;
  kind: string;
  companyName: string | null;
}
export interface VehicleOption {
  id: string;
  plate: string;
  label: string;
}

interface Props {
  moveRequestId: string;
  tasks: PanelTask[];
  employees: EmployeeOption[];
  partners: PartnerOption[];
  vehicles: VehicleOption[];
}

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

const STATUS_OPTIONS: { value: TaskStatus; label: string; cls: string }[] = [
  { value: "PLANNED", label: "Πλάνο", cls: "bg-secondary text-muted-foreground" },
  { value: "IN_PROGRESS", label: "Σε εξέλιξη", cls: "bg-amber-100 text-amber-800" },
  { value: "DONE", label: "Ολοκληρώθηκε", cls: "bg-emerald-100 text-emerald-800" },
  { value: "BLOCKED", label: "Μπλοκαρισμένο", cls: "bg-rose-100 text-rose-700" },
];

// ---------------- Component ----------------

export function TasksPanel({
  moveRequestId,
  tasks,
  employees,
  partners,
  vehicles,
}: Props) {
  const router = useRouter();
  const [view, setView] = useState<"gantt" | "list">("gantt");
  const [editing, setEditing] = useState<PanelTask | "new" | null>(null);

  const ganttTasks: GanttTask[] = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    category: t.category,
    status: t.status,
    startAt: t.startAt.toISOString(),
    durationMinutes: t.durationMinutes,
    assigneeKind: t.assigneeKind,
    assigneeName: t.assigneeName,
    vehiclePlate: t.vehiclePlate,
  }));

  // Synthesize a stop→service tree from flat tasks. We group tasks by their
  // category (e.g. LOADING, CRANE) — each category becomes a "service" row
  // under a single virtual stop, so the carrier sees the same shape as the
  // formal CarrierProject editor.
  const syntheticStops: StopGanttStop[] = (() => {
    if (tasks.length === 0) return [];
    const byCat = new Map<TaskCategory, typeof tasks>();
    for (const t of tasks) {
      const list = byCat.get(t.category) ?? [];
      list.push(t);
      byCat.set(t.category, list);
    }
    const services = Array.from(byCat.entries()).map(([cat, ts]) => ({
      id: `svc-${cat}`,
      serviceType: CATEGORY_TO_SERVICE[cat],
      label: CATEGORY_LABEL[cat],
      tasks: ts.map((t) => ({
        id: t.id,
        title: t.title,
        startAt: t.startAt.toISOString(),
        durationMinutes: t.durationMinutes,
        status: t.status,
        assigneeKind: t.assigneeKind,
        assigneeEmployeeId: t.assigneeEmployeeId,
        assigneeEmployeeName:
          t.assigneeKind === "EMPLOYEE" ? t.assigneeName : null,
        assigneePartnerName:
          t.assigneeKind === "PARTNER" ? t.assigneeName : null,
        vehiclePlate: t.vehiclePlate,
      })),
    }));
    return [
      {
        id: "stop-virtual",
        sequence: 1,
        type: "WAYPOINT",
        label: "Πλάνο μεταφοράς",
        address: "Όλες οι εργασίες",
        services,
      },
    ];
  })();

  const totalHours =
    tasks.reduce((s, t) => s + t.durationMinutes, 0) / 60;
  const completedHours =
    tasks
      .filter((t) => t.status === "DONE")
      .reduce((s, t) => s + t.durationMinutes, 0) / 60;
  const completion =
    totalHours > 0 ? Math.round((completedHours / totalHours) * 100) : 0;

  return (
    <>
      <section className="cx-card">
        <header className="flex flex-col gap-2 border-b border-border px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="cx-h2">Πλάνο εργασιών</h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Σπάσε τη μεταφορά σε εργασίες, ανάθεσε ώρες & άτομα, παρακολούθησε σε Gantt.
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex items-center rounded-md border border-border bg-card p-0.5">
              <ViewBtn active={view === "gantt"} onClick={() => setView("gantt")}>
                Gantt
              </ViewBtn>
              <ViewBtn active={view === "list"} onClick={() => setView("list")}>
                Λίστα
              </ViewBtn>
            </div>
            <button
              type="button"
              onClick={() => setEditing("new")}
              className="inline-flex h-7 items-center gap-1 rounded-md bg-[var(--cx-accent)] px-2.5 text-[11px] font-semibold text-primary-foreground cx-transition cx-press hover:opacity-90"
            >
              <Plus className="size-3" />
              Νέα εργασία
            </button>
          </div>
        </header>

        {tasks.length > 0 && (
          <div className="border-b border-border p-2">
            <StatRow cols={4}>
              <StatCell label="Σύνολο" value={tasks.length} sublabel="εργασίες" />
              <StatCell label="Ώρες" value={totalHours.toFixed(1)} sublabel="προγραμματισμένες" />
              <StatCell
                label="Ολοκληρωμένες"
                value={`${completedHours.toFixed(1)}h`}
                sublabel={`${tasks.filter((t) => t.status === "DONE").length} εργασίες`}
                tone="success"
              />
              <StatCell
                label="Πρόοδος"
                value={`${completion}%`}
                sublabel={completion === 100 ? "Τέλειωσε" : "σε εξέλιξη"}
                progress={completion}
                tone={completion === 100 ? "success" : "info"}
              />
            </StatRow>
          </div>
        )}

        {tasks.length === 0 ? (
          <EmptyState onAdd={() => setEditing("new")} />
        ) : view === "gantt" ? (
          <div className="p-3 sm:p-4">
            <StopGantt
              stops={syntheticStops}
              onTaskClick={(id) => {
                const t = tasks.find((x) => x.id === id);
                if (t) setEditing(t);
              }}
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
          </div>
        ) : (
          <TaskList
            tasks={tasks}
            onEdit={(t) => setEditing(t)}
          />
        )}
      </section>

      {editing && (
        <TaskDialog
          moveRequestId={moveRequestId}
          task={editing === "new" ? null : editing}
          employees={employees}
          partners={partners}
          vehicles={vehicles}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

// ---------------- View toggle ----------------

function ViewBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-6 items-center rounded px-2 text-[11px] font-semibold cx-transition",
        active
          ? "bg-[var(--cx-accent)] text-primary-foreground"
          : "text-muted-foreground hover:bg-[var(--cx-hover)] hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function Metric({
  label,
  value,
  hint,
  progress,
}: {
  label: string;
  value: string;
  hint?: string;
  progress?: number;
}) {
  return (
    <div className="bg-card p-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 font-display text-lg font-extrabold tabular-nums text-foreground">
        {value}
      </p>
      {progress != null && (
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
      {hint && (
        <p className="mt-1 text-[10px] text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 p-10 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-secondary text-muted-foreground">
        <Clock className="size-6" />
      </span>
      <div>
        <p className="text-sm font-semibold text-foreground">
          Καμία εργασία ακόμη για αυτή τη μεταφορά
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Σπάσε τη δουλειά σε βήματα (φόρτωση, διαδρομή, γερανός…) και ανάθεσε
          σε υπαλλήλους ή συνεργάτες με συγκεκριμένες ώρες.
        </p>
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-foreground px-4 text-sm font-bold text-background"
      >
        <Plus className="size-4" />
        Δημιούργησε την πρώτη εργασία
      </button>
    </div>
  );
}

// ---------------- Task list view ----------------

function TaskList({
  tasks,
  onEdit,
}: {
  tasks: PanelTask[];
  onEdit: (t: PanelTask) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const onStatus = (id: string, status: TaskStatus) => {
    start(async () => {
      const res = await setJobTaskStatus({ id, status });
      if (res.ok) router.refresh();
    });
  };

  return (
    <ul className="divide-y divide-border">
      {tasks
        .slice()
        .sort((a, b) => +a.startAt - +b.startAt)
        .map((t) => {
          const StatusIcon =
            t.status === "DONE"
              ? CheckCircle2
              : t.status === "IN_PROGRESS"
                ? Play
                : t.status === "BLOCKED"
                  ? CircleAlert
                  : Circle;
          const AssigneeIcon =
            t.assigneeKind === "EMPLOYEE"
              ? User
              : t.assigneeKind === "PARTNER"
                ? Users
                : Clock;
          const hours = t.durationMinutes / 60;
          return (
            <li key={t.id} className="flex items-start gap-3 p-4">
              {/* Status quick toggle */}
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  onStatus(
                    t.id,
                    t.status === "DONE"
                      ? "PLANNED"
                      : t.status === "IN_PROGRESS"
                        ? "DONE"
                        : t.status === "PLANNED"
                          ? "IN_PROGRESS"
                          : t.status,
                  )
                }
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-lg transition-colors",
                  t.status === "DONE"
                    ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                    : t.status === "IN_PROGRESS"
                      ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
                      : t.status === "BLOCKED"
                        ? "bg-rose-100 text-rose-700"
                        : "bg-secondary text-muted-foreground hover:bg-foreground/10",
                )}
                title="Click για αλλαγή κατάστασης"
              >
                <StatusIcon className="size-4" />
              </button>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p
                    className={cn(
                      "text-sm font-bold text-foreground",
                      t.status === "CANCELLED" && "line-through opacity-60",
                    )}
                  >
                    {t.title}
                  </p>
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase",
                      STATUS_OPTIONS.find((s) => s.value === t.status)?.cls,
                    )}
                  >
                    {STATUS_OPTIONS.find((s) => s.value === t.status)?.label ??
                      t.status}
                  </span>
                </div>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
                  <span>{CATEGORY_LABEL[t.category]}</span>
                  <span>·</span>
                  <span>{formatDt(t.startAt)}</span>
                  <span>·</span>
                  <span className="font-semibold tabular-nums text-foreground">
                    {hours.toFixed(1)}h
                  </span>
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
                  <AssigneeIcon className="size-3" />
                  <span>{t.assigneeName ?? "Χωρίς ανάθεση"}</span>
                  {t.vehiclePlate && (
                    <>
                      <span>·</span>
                      <Truck className="size-3" />
                      <span>{t.vehiclePlate}</span>
                    </>
                  )}
                </p>
              </div>

              <button
                type="button"
                onClick={() => onEdit(t)}
                className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <Pencil className="size-3.5" />
              </button>
            </li>
          );
        })}
    </ul>
  );
}

// ---------------- Task dialog ----------------

function TaskDialog({
  moveRequestId,
  task,
  employees,
  partners,
  vehicles,
  onClose,
}: {
  moveRequestId: string;
  task: PanelTask | null;
  employees: EmployeeOption[];
  partners: PartnerOption[];
  vehicles: VehicleOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<
    Array<{
      taskId: string;
      resourceKind: "EMPLOYEE" | "VEHICLE";
      resourceName: string;
      otherStart: string | Date;
      otherEnd: string | Date;
      projectCode: string | null;
      taskTitle: string;
    }>
  >([]);
  const [overrideReason, setOverrideReason] = useState("");

  const [title, setTitle] = useState(task?.title ?? "");
  const [category, setCategory] = useState<TaskCategory>(
    task?.category ?? "OTHER",
  );
  const [startAt, setStartAt] = useState<string>(() => {
    const d = task?.startAt ?? roundedNow();
    return toLocalInput(d);
  });
  const [hours, setHours] = useState<string>(
    task ? (task.durationMinutes / 60).toString() : "2",
  );
  const [assigneeKind, setAssigneeKind] = useState<
    "EMPLOYEE" | "PARTNER" | "UNASSIGNED"
  >(task?.assigneeKind ?? "UNASSIGNED");
  const [employeeId, setEmployeeId] = useState(task?.assigneeEmployeeId ?? "");
  const [partnerId, setPartnerId] = useState(task?.assigneePartnerId ?? "");
  const [vehicleId, setVehicleId] = useState(task?.vehicleId ?? "");
  const [notes, setNotes] = useState(task?.notes ?? "");
  const [description, setDescription] = useState(task?.description ?? "");

  const performUpsert = (override: boolean) => {
    start(async () => {
      const res = await upsertJobTask({
        id: task?.id,
        moveRequestId,
        title,
        description: description || undefined,
        category,
        startAt: new Date(startAt).toISOString(),
        durationMinutes: Math.max(5, Math.round(Number(hours) * 60)),
        assigneeKind,
        assigneeEmployeeId: assigneeKind === "EMPLOYEE" ? employeeId : undefined,
        assigneePartnerId: assigneeKind === "PARTNER" ? partnerId : undefined,
        vehicleId: vehicleId || undefined,
        notes: notes || undefined,
        overrideConflicts: override,
        overrideReason: override ? overrideReason : undefined,
      });
      if (res.ok) {
        router.refresh();
        onClose();
        return;
      }
      if ("conflicts" in res && res.conflicts.length > 0) {
        setConflicts(
          res.conflicts.map((c) => ({
            taskId: c.taskId,
            resourceKind: c.resourceKind,
            resourceName: c.resourceName,
            otherStart: c.otherStart,
            otherEnd: c.otherEnd,
            projectCode: c.projectCode,
            taskTitle: c.taskTitle,
          })),
        );
        setError(null);
        return;
      }
      setError(res.error);
    });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setConflicts([]);
    performUpsert(false);
  };

  const confirmOverride = () => {
    performUpsert(true);
  };

  const cancelOverride = () => {
    setConflicts([]);
    setOverrideReason("");
  };

  const remove = () => {
    if (!task) return;
    if (!confirm(`Διαγραφή της εργασίας "${task.title}";`)) return;
    start(async () => {
      const res = await deleteJobTask(task.id);
      if (res.ok) {
        router.refresh();
        onClose();
      } else setError(res.error);
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={submit}
        className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h3 className="font-display text-base font-bold text-foreground">
            {task ? "Επεξεργασία εργασίας" : "Νέα εργασία"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-secondary"
          >
            <X className="size-4" />
          </button>
        </div>

        <Field label="Τίτλος εργασίας">
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="π.χ. Φόρτωση από Κυψέλη"
            className="h-10 w-full rounded-lg border-2 border-border bg-white px-3 text-sm font-medium outline-none focus:border-[var(--color-brand-blue)]"
          />
        </Field>

        <Field label="Κατηγορία" className="mt-3">
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
            {(Object.keys(CATEGORY_LABEL) as TaskCategory[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={cn(
                  "h-9 rounded-md border px-2 text-[11px] font-semibold transition-colors",
                  category === c
                    ? "border-[var(--color-brand-blue)] bg-[var(--color-brand-blue-light)] text-[var(--color-brand-blue-deep)]"
                    : "border-border bg-background text-muted-foreground hover:text-foreground",
                )}
              >
                {CATEGORY_LABEL[c]}
              </button>
            ))}
          </div>
        </Field>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Έναρξη">
            <input
              type="datetime-local"
              required
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              className="h-10 w-full rounded-lg border-2 border-border bg-white px-3 text-sm font-medium outline-none focus:border-[var(--color-brand-blue)]"
            />
          </Field>
          <Field label="Διάρκεια (ώρες)">
            <input
              type="number"
              min={0.25}
              step={0.25}
              required
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              className="h-10 w-full rounded-lg border-2 border-border bg-white px-3 text-sm font-bold tabular-nums outline-none focus:border-[var(--color-brand-blue)]"
            />
          </Field>
        </div>

        {/* Quick-pick durations */}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {[0.5, 1, 2, 3, 4, 6, 8].map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => setHours(String(h))}
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-[10px] font-semibold transition-colors",
                hours === String(h)
                  ? "border-[var(--color-brand-blue)] bg-[var(--color-brand-blue-light)] text-[var(--color-brand-blue-deep)]"
                  : "border-border bg-background text-muted-foreground hover:text-foreground",
              )}
            >
              {h}h
            </button>
          ))}
        </div>

        {/* Assignee */}
        <div className="mt-4 rounded-xl border border-border bg-secondary/30 p-3">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Ανάθεση σε
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            <AssigneeToggle
              active={assigneeKind === "EMPLOYEE"}
              onClick={() => setAssigneeKind("EMPLOYEE")}
              icon={User}
              label="Υπάλληλος"
            />
            <AssigneeToggle
              active={assigneeKind === "PARTNER"}
              onClick={() => setAssigneeKind("PARTNER")}
              icon={Users}
              label="Συνεργάτης"
            />
            <AssigneeToggle
              active={assigneeKind === "UNASSIGNED"}
              onClick={() => setAssigneeKind("UNASSIGNED")}
              icon={Clock}
              label="Χωρίς ανάθεση"
            />
          </div>

          {assigneeKind === "EMPLOYEE" && (
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              required
              className="mt-2 h-10 w-full rounded-lg border-2 border-border bg-white px-3 text-sm font-medium outline-none focus:border-[var(--color-brand-blue)]"
            >
              <option value="">— Επέλεξε υπάλληλο —</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} · {roleLabel(e.role)}
                </option>
              ))}
            </select>
          )}
          {assigneeKind === "PARTNER" && (
            <select
              value={partnerId}
              onChange={(e) => setPartnerId(e.target.value)}
              required
              className="mt-2 h-10 w-full rounded-lg border-2 border-border bg-white px-3 text-sm font-medium outline-none focus:border-[var(--color-brand-blue)]"
            >
              <option value="">— Επέλεξε συνεργάτη —</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.companyName ? ` · ${p.companyName}` : ""}
                </option>
              ))}
            </select>
          )}
        </div>

        <Field label="Όχημα (προαιρετικό)" className="mt-3">
          <select
            value={vehicleId}
            onChange={(e) => setVehicleId(e.target.value)}
            className="h-10 w-full rounded-lg border-2 border-border bg-white px-3 text-sm font-medium outline-none focus:border-[var(--color-brand-blue)]"
          >
            <option value="">— Κανένα —</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Σημειώσεις" className="mt-3">
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Λεπτομέρειες εκτέλεσης, οδηγίες, υπενθυμίσεις..."
            className="w-full rounded-lg border-2 border-border bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-brand-blue)]"
          />
        </Field>

        {error && (
          <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800">
            {error}
          </p>
        )}

        {conflicts.length > 0 && (
          <div className="mt-3 rounded-lg border-2 border-amber-300 bg-amber-50 p-3">
            <p className="text-sm font-bold text-amber-900">
              ⚠ Σύγκρουση διαθεσιμότητας
            </p>
            <p className="mt-1 text-xs text-amber-900">
              Ο πόρος είναι ήδη απασχολημένος στις εξής εργασίες:
            </p>
            <ul className="mt-2 space-y-1.5">
              {conflicts.map((c) => {
                const start = new Date(c.otherStart);
                const end = new Date(c.otherEnd);
                const fmt = (d: Date) =>
                  d.toLocaleString("el-GR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                return (
                  <li
                    key={`${c.taskId}-${c.resourceKind}`}
                    className="rounded-md bg-white/70 px-2 py-1.5 text-xs text-amber-950"
                  >
                    <strong>{c.resourceName}</strong>
                    {" · "}
                    {fmt(start)} – {fmt(end)}
                    {" · "}
                    <span className="text-amber-800">{c.taskTitle}</span>
                    {c.projectCode && (
                      <span className="ml-1 rounded bg-amber-200 px-1 text-[10px] font-bold">
                        {c.projectCode}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
            <label className="mt-3 block text-xs font-semibold text-amber-900">
              Λόγος override (προαιρετικό)
              <textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="π.χ. ο πελάτης το θέλει επειγόντως"
                rows={2}
                className="mt-1 w-full rounded-md border border-amber-300 bg-white px-2 py-1 text-xs"
              />
            </label>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={cancelOverride}
                className="inline-flex h-8 items-center rounded-md border border-amber-300 bg-white px-3 text-xs font-semibold text-amber-900 hover:bg-amber-100"
              >
                Άλλαξα γνώμη
              </button>
              <button
                type="button"
                onClick={confirmOverride}
                disabled={pending}
                className="inline-flex h-8 items-center gap-1 rounded-md bg-amber-600 px-3 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {pending && <Loader2 className="size-3.5 animate-spin" />}
                Όχι κράτα το έτσι
              </button>
            </div>
          </div>
        )}

        <div className="mt-4 flex justify-between gap-2">
          {task ? (
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
            >
              <Trash2 className="size-3.5" />
              Διαγραφή
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 items-center rounded-lg border border-border bg-card px-3 text-sm font-medium hover:bg-secondary"
            >
              Άκυρο
            </button>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--color-brand-blue)] px-4 text-sm font-bold text-white hover:bg-[var(--color-brand-blue-deep)] disabled:opacity-50"
            >
              {pending && <Loader2 className="size-4 animate-spin" />}
              {task ? "Αποθήκευση" : "Δημιουργία"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function AssigneeToggle({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof User;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border px-2 text-xs font-semibold transition-colors",
        active
          ? "border-[var(--color-brand-blue)] bg-[var(--color-brand-blue-light)] text-[var(--color-brand-blue-deep)]"
          : "border-border bg-background text-muted-foreground hover:bg-secondary hover:text-foreground",
      )}
    >
      <Icon className="size-3.5" />
      {label}
    </button>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-1", className)}>
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

// ---------------- Helpers ----------------

function roundedNow(): Date {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
}

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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

function roleLabel(r: string): string {
  switch (r) {
    case "DRIVER":
      return "Οδηγός";
    case "ASSISTANT":
      return "Βοηθός";
    case "PACKER":
      return "Packer";
    case "OPERATIONS":
      return "Συντονισμός";
    case "ADMIN":
      return "Διοίκηση";
    default:
      return r;
  }
}
