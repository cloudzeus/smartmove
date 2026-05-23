"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Receipt,
  Truck,
} from "lucide-react";

import { cn } from "@/lib/utils";

export type EventKind = "job" | "offer-expiry" | "opportunity";

export interface CalendarEvent {
  id: string;
  kind: EventKind;
  title: string;
  subtitle: string;
  /** ISO string */
  date: string;
  flexDays?: number;
  priceCents: number | null;
  itemsCount: number | null;
  volumeM3: number | null;
  href: string;
  /** For showing status pill on the event card */
  stageHint?: string;
}

type View = "month" | "week" | "day";

interface Props {
  initialView: View;
  /** YYYY-MM-DD */
  initialDate: string;
  events: CalendarEvent[];
}

// ---------------- Constants ----------------

const WEEKDAY_LABELS = ["Δευ", "Τρι", "Τετ", "Πεμ", "Παρ", "Σαβ", "Κυρ"];
const MONTHS_GENITIVE = [
  "Ιανουαρίου",
  "Φεβρουαρίου",
  "Μαρτίου",
  "Απριλίου",
  "Μαΐου",
  "Ιουνίου",
  "Ιουλίου",
  "Αυγούστου",
  "Σεπτεμβρίου",
  "Οκτωβρίου",
  "Νοεμβρίου",
  "Δεκεμβρίου",
];

const KIND_META: Record<
  EventKind,
  { label: string; color: string; ring: string; chip: string }
> = {
  job: {
    label: "Μεταφορά",
    color: "bg-emerald-500",
    ring: "ring-emerald-500/30",
    chip: "bg-emerald-50 text-emerald-800",
  },
  "offer-expiry": {
    label: "Λήξη προσφοράς",
    color: "bg-amber-500",
    ring: "ring-amber-500/30",
    chip: "bg-amber-50 text-amber-800",
  },
  opportunity: {
    label: "Ευκαιρία",
    color: "bg-[var(--color-brand-blue)]",
    ring: "ring-[var(--color-brand-blue)]/30",
    chip: "bg-[var(--color-brand-blue-light)] text-[var(--color-brand-blue-deep)]",
  },
};

const KIND_ICON = {
  job: Truck,
  "offer-expiry": Receipt,
  opportunity: CircleDot,
} as const;

// ---------------- Component ----------------

export function CarrierCalendar({ initialView, initialDate, events }: Props) {
  const [view, setView] = useState<View>(initialView);
  const [anchor, setAnchor] = useState<Date>(
    () => new Date(initialDate + "T00:00:00"),
  );
  const [enabledKinds, setEnabledKinds] = useState<Record<EventKind, boolean>>({
    job: true,
    "offer-expiry": true,
    opportunity: true,
  });

  const filtered = useMemo(
    () => events.filter((e) => enabledKinds[e.kind]),
    [events, enabledKinds],
  );

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of filtered) {
      const key = isoDay(new Date(e.date));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    // sort each day
    for (const list of map.values()) {
      list.sort((a, b) => +new Date(a.date) - +new Date(b.date));
    }
    return map;
  }, [filtered]);

  const goPrev = () => setAnchor(shiftAnchor(anchor, view, -1));
  const goNext = () => setAnchor(shiftAnchor(anchor, view, 1));
  const goToday = () => setAnchor(new Date());

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goToday}
            className="inline-flex h-9 items-center rounded-lg border border-border bg-card px-3 text-sm font-semibold text-foreground hover:bg-secondary"
          >
            Σήμερα
          </button>
          <div className="flex items-center rounded-lg border border-border bg-card">
            <button
              type="button"
              onClick={goPrev}
              className="grid size-9 place-items-center text-muted-foreground hover:bg-secondary hover:text-foreground"
              aria-label="Προηγούμενο"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={goNext}
              className="grid size-9 place-items-center border-l border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
              aria-label="Επόμενο"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
          <h2 className="font-display text-lg font-bold text-foreground">
            {periodLabel(anchor, view)}
          </h2>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
          {(["month", "week", "day"] as View[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={cn(
                "inline-flex h-7 items-center rounded-md px-3 text-xs font-semibold transition-colors",
                view === v
                  ? "bg-[var(--color-brand-blue)] text-white"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              {v === "month" ? "Μήνας" : v === "week" ? "Εβδομάδα" : "Ημέρα"}
            </button>
          ))}
        </div>
      </div>

      {/* Legend / filters */}
      <div className="flex flex-wrap items-center gap-2">
        {(["job", "offer-expiry", "opportunity"] as EventKind[]).map((k) => {
          const meta = KIND_META[k];
          const enabled = enabledKinds[k];
          const Icon = KIND_ICON[k];
          const count = events.filter((e) => e.kind === k).length;
          return (
            <button
              key={k}
              type="button"
              onClick={() =>
                setEnabledKinds((m) => ({ ...m, [k]: !m[k] }))
              }
              className={cn(
                "inline-flex h-8 items-center gap-2 rounded-full border px-3 text-xs font-semibold transition-all",
                enabled
                  ? "border-foreground/10 bg-white text-foreground shadow-sm"
                  : "border-border bg-secondary/50 text-muted-foreground opacity-60",
              )}
            >
              <span
                className={cn("size-2.5 rounded-full", meta.color)}
                aria-hidden
              />
              <Icon className="size-3.5" />
              {meta.label}
              <span className="tabular-nums opacity-70">({count})</span>
            </button>
          );
        })}
      </div>

      {/* View */}
      {view === "month" && (
        <MonthView anchor={anchor} eventsByDay={eventsByDay} onDayClick={(d) => { setAnchor(d); setView("day"); }} />
      )}
      {view === "week" && (
        <WeekView anchor={anchor} eventsByDay={eventsByDay} onDayClick={(d) => { setAnchor(d); setView("day"); }} />
      )}
      {view === "day" && <DayView anchor={anchor} eventsByDay={eventsByDay} />}
    </div>
  );
}

// ---------------- Month view ----------------

function MonthView({
  anchor,
  eventsByDay,
  onDayClick,
}: {
  anchor: Date;
  eventsByDay: Map<string, CalendarEvent[]>;
  onDayClick: (d: Date) => void;
}) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  // Monday-first
  const offset = (first.getDay() + 6) % 7;
  const startDate = new Date(first);
  startDate.setDate(1 - offset);

  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    cells.push(d);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
      <div className="grid grid-cols-7 border-b border-border bg-secondary/30">
        {WEEKDAY_LABELS.map((w) => (
          <div
            key={w}
            className="px-2 py-2 text-center text-[10px] font-bold uppercase tracking-wide text-muted-foreground"
          >
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 grid-rows-6">
        {cells.map((d, i) => {
          const key = isoDay(d);
          const list = eventsByDay.get(key) ?? [];
          const isCurMonth = d.getMonth() === anchor.getMonth();
          const isToday = isSameDay(d, new Date());
          return (
            <button
              key={i}
              type="button"
              onClick={() => onDayClick(d)}
              className={cn(
                "relative min-h-[96px] border-b border-r border-border p-1.5 text-left transition-colors hover:bg-secondary/40",
                !isCurMonth && "bg-secondary/10",
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "inline-flex size-6 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums",
                    isToday
                      ? "bg-[var(--color-brand-blue)] text-white"
                      : isCurMonth
                        ? "text-foreground"
                        : "text-muted-foreground/50",
                  )}
                >
                  {d.getDate()}
                </span>
                {list.length > 3 && (
                  <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">
                    +{list.length - 3}
                  </span>
                )}
              </div>
              <ul className="mt-1 flex flex-col gap-0.5">
                {list.slice(0, 3).map((e) => (
                  <li key={e.id}>
                    <span
                      className={cn(
                        "block truncate rounded px-1.5 py-0.5 text-[10px] font-semibold",
                        KIND_META[e.kind].chip,
                      )}
                      title={`${KIND_META[e.kind].label} · ${e.title}`}
                    >
                      <span
                        className={cn("mr-1 inline-block size-1.5 rounded-full align-middle", KIND_META[e.kind].color)}
                        aria-hidden
                      />
                      {e.title}
                    </span>
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------- Week view ----------------

function WeekView({
  anchor,
  eventsByDay,
  onDayClick,
}: {
  anchor: Date;
  eventsByDay: Map<string, CalendarEvent[]>;
  onDayClick: (d: Date) => void;
}) {
  // Monday-start
  const monday = new Date(anchor);
  const offset = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - offset);
  const days: Date[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
      <div className="grid grid-cols-7 border-b border-border bg-secondary/30">
        {days.map((d) => {
          const today = isSameDay(d, new Date());
          return (
            <button
              key={d.toISOString()}
              type="button"
              onClick={() => onDayClick(d)}
              className="flex flex-col items-center gap-1 border-r border-border px-2 py-2.5 last:border-r-0 hover:bg-secondary/40"
            >
              <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                {WEEKDAY_LABELS[(d.getDay() + 6) % 7]}
              </span>
              <span
                className={cn(
                  "grid size-7 place-items-center rounded-full text-sm font-bold tabular-nums",
                  today
                    ? "bg-[var(--color-brand-blue)] text-white"
                    : "text-foreground",
                )}
              >
                {d.getDate()}
              </span>
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const key = isoDay(d);
          const list = eventsByDay.get(key) ?? [];
          return (
            <div
              key={key}
              className="flex min-h-[260px] flex-col gap-1.5 border-r border-border bg-card p-2 last:border-r-0"
            >
              {list.length === 0 ? (
                <p className="mt-4 text-center text-[10px] text-muted-foreground/60">
                  —
                </p>
              ) : (
                list.map((e) => <EventCard key={e.id} event={e} compact />)
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------- Day view ----------------

function DayView({
  anchor,
  eventsByDay,
}: {
  anchor: Date;
  eventsByDay: Map<string, CalendarEvent[]>;
}) {
  const list = eventsByDay.get(isoDay(anchor)) ?? [];

  const byKind: Record<EventKind, CalendarEvent[]> = {
    job: [],
    "offer-expiry": [],
    opportunity: [],
  };
  for (const e of list) byKind[e.kind].push(e);

  if (list.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
        <CalendarDays className="mx-auto size-10 text-muted-foreground" />
        <p className="mt-3 text-sm font-semibold text-foreground">
          Καθαρή μέρα
        </p>
        <p className="text-xs text-muted-foreground">
          Δεν υπάρχουν προγραμματισμένες ενέργειες για αυτή την ημέρα.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {(["job", "offer-expiry", "opportunity"] as EventKind[]).map((k) => {
        const meta = KIND_META[k];
        const items = byKind[k];
        return (
          <section
            key={k}
            className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]"
          >
            <header className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={cn("size-2.5 rounded-full", meta.color)} />
                <h3 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">
                  {meta.label}
                </h3>
              </div>
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold tabular-nums text-muted-foreground">
                {items.length}
              </span>
            </header>
            {items.length === 0 ? (
              <p className="py-4 text-center text-[11px] text-muted-foreground">
                —
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {items.map((e) => (
                  <li key={e.id}>
                    <EventCard event={e} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

// ---------------- Event card ----------------

function EventCard({
  event,
  compact,
}: {
  event: CalendarEvent;
  compact?: boolean;
}) {
  const meta = KIND_META[event.kind];
  const Icon = KIND_ICON[event.kind];
  const time = new Date(event.date);
  return (
    <Link
      href={event.href}
      className={cn(
        "group block rounded-lg border bg-white p-2 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-pop)]",
        meta.ring,
        "ring-1 border-transparent",
      )}
    >
      <div className="flex items-start gap-2">
        <span
          className={cn(
            "mt-0.5 grid size-6 shrink-0 place-items-center rounded-md text-white",
            meta.color,
          )}
        >
          <Icon className="size-3" />
        </span>
        <div className="min-w-0 flex-1">
          <p className={cn("truncate font-semibold text-foreground", compact ? "text-[11px]" : "text-sm")}>
            {event.title}
          </p>
          <p className={cn("truncate text-muted-foreground", compact ? "text-[10px]" : "text-[11px]")}>
            {event.subtitle}
          </p>
          {!compact && (
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <CalendarClock className="size-3" />
                {formatTime(time)}
              </span>
              {event.priceCents != null && (
                <span className="font-semibold text-foreground tabular-nums">
                  {(event.priceCents / 100).toFixed(0)}€
                </span>
              )}
              {event.itemsCount != null && (
                <span>{event.itemsCount} τεμ</span>
              )}
              {event.volumeM3 != null && (
                <span>{event.volumeM3.toFixed(1)} m³</span>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

// ---------------- Helpers ----------------

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function shiftAnchor(anchor: Date, view: View, dir: -1 | 1): Date {
  const d = new Date(anchor);
  if (view === "month") d.setMonth(d.getMonth() + dir);
  else if (view === "week") d.setDate(d.getDate() + 7 * dir);
  else d.setDate(d.getDate() + dir);
  return d;
}

function periodLabel(d: Date, view: View): string {
  if (view === "month") {
    return `${MONTHS_GENITIVE[d.getMonth()]} ${d.getFullYear()}`;
  }
  if (view === "week") {
    const monday = new Date(d);
    const offset = (monday.getDay() + 6) % 7;
    monday.setDate(monday.getDate() - offset);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const sameMonth = monday.getMonth() === sunday.getMonth();
    if (sameMonth) {
      return `${monday.getDate()}–${sunday.getDate()} ${MONTHS_GENITIVE[monday.getMonth()]}`;
    }
    return `${monday.getDate()} ${MONTHS_GENITIVE[monday.getMonth()].slice(0, 3)} – ${sunday.getDate()} ${MONTHS_GENITIVE[sunday.getMonth()].slice(0, 3)}`;
  }
  return new Intl.DateTimeFormat("el-GR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(d);
}

function formatTime(d: Date): string {
  return new Intl.DateTimeFormat("el-GR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}
