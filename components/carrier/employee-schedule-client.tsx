"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarClock, ChevronLeft, ChevronRight, MapPin } from "lucide-react";

interface ScheduleTask {
  id: string;
  title: string;
  startAt: string;
  durationMinutes: number;
  status: string;
  confirmStatus: string | null;
  serviceType: string;
  address: string;
  projectId: string | null;
  projectCode: string | null;
}

interface OtherProject {
  id: string;
  code: string;
  route: string;
}

interface Props {
  employeeId: string;
  employeeName: string;
  initialAnchor: string;
  tasks: ScheduleTask[];
  otherProjects: OtherProject[];
}

function formatDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("el-GR", { hour: "2-digit", minute: "2-digit" });
}

export function EmployeeScheduleClient({
  employeeName,
  initialAnchor,
  tasks,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const anchor = useMemo(() => new Date(initialAnchor), [initialAnchor]);

  const days = useMemo(() => {
    const arr: Date[] = [];
    for (let offset = -3; offset <= 3; offset++) {
      const d = new Date(anchor);
      d.setDate(anchor.getDate() + offset);
      arr.push(d);
    }
    return arr;
  }, [anchor]);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, ScheduleTask[]>();
    for (const t of tasks) {
      const key = formatDayKey(new Date(t.startAt));
      const list = map.get(key) ?? [];
      list.push(t);
      map.set(key, list);
    }
    return map;
  }, [tasks]);

  function shiftDay(delta: number) {
    const next = new Date(anchor);
    next.setDate(anchor.getDate() + delta);
    const params = new URLSearchParams(searchParams.toString());
    params.set("day", formatDayKey(next));
    router.push(`?${params.toString()}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold">
          <CalendarClock className="size-5 text-[var(--color-brand-blue)]" />
          Πρόγραμμα {employeeName}
        </h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => shiftDay(-7)}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
          >
            <ChevronLeft className="size-3.5" /> Προηγ. εβδομάδα
          </button>
          <button
            type="button"
            onClick={() => shiftDay(7)}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
          >
            Επόμενη εβδομάδα <ChevronRight className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {days.map((d) => {
          const key = formatDayKey(d);
          const list = tasksByDay.get(key) ?? [];
          const isAnchor = key === formatDayKey(anchor);
          return (
            <div
              key={key}
              className={`rounded-xl border p-3 ${
                isAnchor
                  ? "border-[var(--color-brand-blue)] bg-[var(--color-brand-blue-light)]"
                  : "border-border bg-card"
              }`}
            >
              <div className="mb-2 flex items-baseline justify-between">
                <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  {d.toLocaleDateString("el-GR", { weekday: "short", day: "2-digit", month: "2-digit" })}
                </div>
                <div className="text-[10px] font-semibold text-muted-foreground">
                  {list.length} εργασίες
                </div>
              </div>
              {list.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">—</p>
              ) : (
                <ul className="space-y-2">
                  {list.map((t) => (
                    <li
                      key={t.id}
                      className="rounded-lg border border-border bg-background p-2 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold tabular-nums">{formatTime(t.startAt)}</span>
                        <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-semibold uppercase">
                          {t.status}
                        </span>
                      </div>
                      <div className="mt-1 font-semibold text-foreground">{t.title}</div>
                      {t.address && (
                        <div className="mt-1 flex items-start gap-1 text-[11px] text-muted-foreground">
                          <MapPin className="mt-0.5 size-3 shrink-0" />
                          <span className="line-clamp-2">{t.address}</span>
                        </div>
                      )}
                      {t.projectId && t.projectCode && (
                        <Link
                          href={`/carrier/projects/${t.projectId}`}
                          className="mt-1 inline-block text-[11px] font-semibold text-[var(--color-brand-blue)] hover:underline"
                        >
                          {t.projectCode}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
