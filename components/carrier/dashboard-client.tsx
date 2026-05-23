"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Check, ChevronDown, Star, Trash2 } from "lucide-react";

import { NotificationBell } from "./notification-bell";
import { DataTable, type DataTableColumn } from "./data-table";
import { StatusPill } from "./status-pill";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { resendTaskConfirmation, confirmTaskByAdmin } from "@/server/actions/task-confirmation.action";
import { cancelPartnerQuoteRequest } from "@/server/actions/partner-quote-requests.action";

type ActionResult = { ok: true } | { ok: false; error?: string };

// ─────────────────────── TYPES ───────────────────────

type ServiceType =
  | "CRANE" | "PACKING" | "LOADING" | "UNLOADING" | "ASSEMBLY"
  | "DISASSEMBLY" | "STORAGE" | "TRANSIT" | "CLEANUP" | "OTHER";

type TaskStatus = "PLANNED" | "CONFIRMED" | "IN_PROGRESS" | "DONE" | "BLOCKED" | "CANCELLED";
type ConfirmStatus = "NONE" | "PENDING" | "CONFIRMED" | "DECLINED";
type ProjectStatus = "DRAFT" | "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

interface Kpis {
  openLeads: number; openOffers: number;
  activeProjectsCount: number; completedProjects: number;
  revenue30d: number; revenuePrev30d: number; revenueAllTime: number; revenueDeltaPct: number;
  avgRating: number; reviewCount: number;
  fleetCount: number; employeesCount: number; partnersCount: number;
}
interface PendingConfirmTask {
  id: string; title: string; startAt: string; durationMinutes: number;
  assigneeName: string; sentAt: string | null;
  projectId: string | null; projectCode: string | null;
}
interface DeclinedTask {
  id: string; title: string; startAt: string; assigneeName: string;
  reason: string | null; projectId: string | null; projectCode: string | null;
}
interface ExpiringOffer {
  id: string; moveRequestId: string; priceCents: number; validUntil: string; route: string;
}
interface TodayTask {
  id: string; title: string; startAt: string; durationMinutes: number;
  status: TaskStatus; confirmStatus: ConfirmStatus;
  assigneeName: string | null; serviceType: ServiceType; address: string;
  projectId: string | null; projectCode: string | null;
}
interface WeekTask {
  id: string; title: string; startAt: string; durationMinutes: number;
  status: TaskStatus;
  assigneeEmployeeId: string | null; assigneePartnerId: string | null;
  assigneeName: string | null; serviceType: ServiceType;
  projectId: string | null; projectCode: string | null;
}
interface ActiveProject {
  id: string; code: string; status: ProjectStatus;
  scheduledStart: string; totalPriceCents: number;
  route: string; customer: string; stopsCount: number;
}
interface PendingQuote {
  id: string; status: "PENDING" | "QUOTED";
  partnerName: string; serviceType: ServiceType;
  quotedPriceCents: number | null;
  createdAt: string; scheduledStartAt: string | null;
  projectId: string | null; projectCode: string | null;
}
interface Lead {
  id: string; fromAddress: string; toAddress: string; createdAt: string;
  type: string; itemsCount: number; volumeM3: number | null;
  preferredDate: string | null;
  estimatedPriceMinCents: number | null; estimatedPriceMaxCents: number | null;
}
interface OpenOffer {
  id: string; moveRequestId: string; priceCents: number;
  validUntil: string; route: string; createdAt: string;
}
interface EmployeeWorkload {
  id: string; name: string; role: string; weekTaskCount: number;
}

interface Props {
  firstName: string;
  hasMembership: boolean;
  kpis: Kpis;
  pendingConfirmTasks: PendingConfirmTask[];
  declinedTasks: DeclinedTask[];
  expiringOffers: ExpiringOffer[];
  todaysTasks: TodayTask[];
  weekTasks: WeekTask[];
  activeProjects: ActiveProject[];
  pendingQuoteCampaigns: PendingQuote[];
  recentLeads: Lead[];
  myOpenOffers: OpenOffer[];
  employeeWorkload: EmployeeWorkload[];
  notifications: import("./notification-bell").InitialNotification[];
  unreadNotifications: number;
}

const SERVICE_LABEL: Record<ServiceType, string> = {
  CRANE: "Γερανός", PACKING: "Αμπαλάζ", LOADING: "Φόρτωση", UNLOADING: "Εκφόρτωση",
  ASSEMBLY: "Συναρμολ.", DISASSEMBLY: "Αποσυναρμ.", STORAGE: "Αποθήκευση",
  TRANSIT: "Διαδρομή", CLEANUP: "Καθαρισμός", OTHER: "Άλλο",
};

const SERVICE_COLOR: Record<ServiceType, string> = {
  CRANE: "#EA580C", PACKING: "#7C3AED", LOADING: "#2563EB",
  UNLOADING: "#E11D48", ASSEMBLY: "#0D9488", DISASSEMBLY: "#0891B2",
  STORAGE: "#D97706", TRANSIT: "#475569", CLEANUP: "#10B981", OTHER: "#64748B",
};

// ─────────────────────── ROOT ───────────────────────

export function CarrierDashboardClient(props: Props) {
  const urgent = useMemo(() => buildUrgentList(props), [props]);

  if (!props.hasMembership) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="cx-fade-in rounded-md border border-amber-300 bg-amber-50/70 p-5">
          <h1 className="text-[13px] font-semibold text-amber-900">
            Δεν είσαι συνδεδεμένος με εταιρεία
          </h1>
          <p className="mt-1 text-[11px] text-amber-800/80">
            Ζήτησε από admin να σε προσθέσει σε ένα tenant για να δεις τον πίνακα.
          </p>
        </div>
      </div>
    );
  }

  const urgentTotal = urgent.length;

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-4 sm:px-5 lg:py-5">
      <Header
        firstName={props.firstName}
        notifications={props.notifications}
        unreadNotifications={props.unreadNotifications}
      />

      {/* KPI STRIP — μικρά, στην κορυφή */}
      <KpiStrip kpis={props.kpis} />

      {/* HERO #1 — Marketplace leads (full row) */}
      <div className="mt-3">
        <LeadsHero leads={props.recentLeads} openLeadsCount={props.kpis.openLeads} />
      </div>

      {/* HERO #2 — Σήμερα (full row) */}
      <div className="mt-3">
        <TodayHero tasks={props.todaysTasks} weekTasks={props.weekTasks} />
      </div>

      {/* ACCORDIONS — όλα full-width stacked, ΟΛΑ OPEN by default */}
      <div className="mt-3 space-y-2">
        {urgentTotal > 0 && (
          <Accordion id="urgent" title="Εκκρεμότητες" badge={urgentTotal} tone="danger" defaultOpen>
            <UrgentDetails props={props} />
          </Accordion>
        )}

        <Accordion id="projects" title="Ενεργά Projects" badge={props.activeProjects.length} defaultOpen>
          <ActiveProjectsTable projects={props.activeProjects} />
        </Accordion>

        <Accordion id="sales" title="Πωλήσεις" badge={props.recentLeads.length + props.myOpenOffers.length} defaultOpen>
          <SalesGrid leads={props.recentLeads} offers={props.myOpenOffers} />
        </Accordion>

        <Accordion id="team" title="Ομάδα & Φόρτος" badge={props.employeeWorkload.length} defaultOpen>
          <TeamSection
            workload={props.employeeWorkload}
            quotes={props.pendingQuoteCampaigns}
            rating={props.kpis.avgRating}
            reviewCount={props.kpis.reviewCount}
            fleetCount={props.kpis.fleetCount}
            partnersCount={props.kpis.partnersCount}
          />
        </Accordion>
      </div>
    </div>
  );
}

// ─────────────────────── HEADER ───────────────────────

function Header({
  firstName, notifications, unreadNotifications,
}: {
  firstName: string;
  notifications: import("./notification-bell").InitialNotification[];
  unreadNotifications: number;
}) {
  const now = new Date();
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <p className="cx-eyebrow">Carrier</p>
        <h1 className="cx-h1 mt-1">
          {greeting(now)}{firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {now.toLocaleDateString("el-GR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <NotificationBell initial={notifications} initialUnread={unreadNotifications} />
        <Link
          href="/carrier/pricing"
          className="inline-flex h-9 items-center rounded-md bg-[var(--cx-accent)] px-3.5 text-[11px] font-semibold text-primary-foreground cx-transition cx-press hover:opacity-90"
        >
          Τιμολόγιο
        </Link>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-[11px] font-medium text-muted-foreground cx-transition cx-press hover:bg-[var(--cx-hover)] hover:text-foreground active:bg-[var(--cx-accent-soft)]"
        >
          <kbd className="font-sans">⌘K</kbd>
        </button>
      </div>
    </div>
  );
}

// ─────────────────────── HERO #1 — MARKETPLACE LEADS ───────────────────────

function LeadsHero({ leads, openLeadsCount }: { leads: Lead[]; openLeadsCount: number }) {
  const isEmpty = openLeadsCount === 0 && leads.length === 0;

  // Compact empty banner — μια γραμμή, όχι δύο κενές στήλες
  if (isEmpty) {
    return (
      <section className="cx-fade-in cx-card relative overflow-hidden ring-1 ring-[var(--cx-accent)]/30">
        <div className="absolute inset-x-0 top-0 h-0.5 bg-[var(--cx-accent)]" />
        <Link
          href="/carrier/leads"
          className="flex items-center gap-3 px-3.5 py-3 cx-transition hover:bg-[var(--cx-hover)] active:bg-[var(--cx-accent-soft)]"
        >
          <span aria-hidden className="inline-block size-2 rounded-full bg-[var(--cx-accent)]/40" />
          <div className="min-w-0 flex-1">
            <p className="cx-eyebrow text-[var(--cx-accent)]">Αγορά · νέα αιτήματα</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Καμία ενεργή ζήτηση που να περιμένει την προσφορά σου. Δες την αγορά →
            </p>
          </div>
          <span className="shrink-0 text-[20px] font-semibold tabular-nums text-muted-foreground/60">0</span>
        </Link>
      </section>
    );
  }

  const typePulse = leads.reduce<Record<string, number>>((acc, l) => {
    acc[l.type] = (acc[l.type] ?? 0) + 1;
    return acc;
  }, {});
  const topTypes = Object.entries(typePulse).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const totalEstHigh = leads.reduce((sum, l) => sum + (l.estimatedPriceMaxCents ?? 0), 0) / 100;

  return (
    <section className="cx-fade-in cx-card relative overflow-hidden ring-1 ring-[var(--cx-accent)]/30">
      <div className="absolute inset-x-0 top-0 h-0.5 bg-[var(--cx-accent)]" />

      <div className="grid gap-0 md:grid-cols-[1fr_auto]">
        {/* Left */}
        <div className="border-b border-border px-3.5 py-3 md:border-b-0 md:border-r">
          <div className="flex items-center gap-2">
            <span aria-hidden className="inline-block size-2 rounded-full bg-[var(--cx-accent)] smartmove-pulse" />
            <p className="cx-eyebrow text-[var(--cx-accent)]">Αγορά · νέα αιτήματα</p>
          </div>
          <p className="mt-1.5">
            <span className="cx-kpi-num text-[var(--cx-accent)]">{openLeadsCount}</span>
            <span className="ml-2 text-[11px] text-muted-foreground">αιτήματα χωρίς προσφορά σου</span>
          </p>
          {totalEstHigh > 0 && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              Δυνητική αξία (max):{" "}
              <span className="font-semibold text-emerald-700 tabular-nums">
                {totalEstHigh.toLocaleString("el-GR", { maximumFractionDigits: 0 })}€
              </span>
            </p>
          )}

          {topTypes.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {topTypes.map(([type, n]) => (
                <span
                  key={type}
                  className="inline-flex items-center gap-1 rounded-full bg-[var(--cx-accent-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--cx-accent)]"
                >
                  <span>{type}</span>
                  <span className="tabular-nums opacity-70">{n}</span>
                </span>
              ))}
            </div>
          )}

          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <Link
              href="/carrier/leads"
              className="inline-flex h-8 items-center rounded-md bg-[var(--cx-accent)] px-3 text-[11px] font-semibold text-primary-foreground cx-transition cx-press hover:opacity-90"
            >
              Δες όλα →
            </Link>
            <Link
              href="/carrier/leads?filter=high-value"
              className="inline-flex h-8 items-center rounded-md border border-border bg-card px-2.5 text-[11px] font-medium cx-transition cx-press hover:bg-[var(--cx-hover)] active:bg-[var(--cx-accent-soft)]"
            >
              Υψηλής αξίας
            </Link>
          </div>
        </div>

        {/* Right */}
        <div className="min-w-0 px-3.5 py-3 md:w-[380px]">
          <p className="cx-eyebrow mb-1.5">Τελευταία αιτήματα</p>
          {leads.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">Δεν υπάρχουν τρέχοντα leads.</p>
          ) : (
            <ul className="divide-y divide-[var(--cx-divider)]">
              {leads.slice(0, 3).map((l) => (
                <li key={l.id}>
                  <Link
                    href={`/carrier/leads/${l.id}`}
                    className="flex items-start gap-2.5 py-2 cx-transition hover:bg-[var(--cx-hover)] active:bg-[var(--cx-accent-soft)] -mx-3.5 px-3.5"
                  >
                    <div className="grid size-7 shrink-0 place-items-center rounded-md bg-[var(--cx-accent-soft)] text-[10px] font-bold uppercase tracking-wide text-[var(--cx-accent)]">
                      {l.type.slice(0, 3)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-semibold">
                        {l.fromAddress} → {l.toAddress}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] text-muted-foreground">
                        {l.volumeM3 != null && <span>{l.volumeM3.toFixed(1)} m³</span>}
                        <span>{l.itemsCount} αντικ.</span>
                        <span>· {relativeTime(new Date(l.createdAt))}</span>
                      </div>
                    </div>
                    {(l.estimatedPriceMinCents || l.estimatedPriceMaxCents) && (
                      <span className="shrink-0 text-right text-[11px] font-semibold tabular-nums text-emerald-700">
                        {l.estimatedPriceMinCents ? Math.round(l.estimatedPriceMinCents / 100) : "—"}–
                        {l.estimatedPriceMaxCents ? Math.round(l.estimatedPriceMaxCents / 100) : "—"}€
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────── HERO #2 — TODAY TIMELINE ───────────────────────

function TodayHero({ tasks, weekTasks }: { tasks: TodayTask[]; weekTasks: WeekTask[] }) {
  const now = new Date();
  const dayStart = new Date(now); dayStart.setHours(7, 0, 0, 0);
  const dayEnd   = new Date(now); dayEnd.setHours(20, 0, 0, 0);
  const span = dayEnd.getTime() - dayStart.getTime();

  const next = tasks
    .map((t) => ({ t, start: new Date(t.startAt) }))
    .filter((x) => x.start > now)
    .sort((a, b) => a.start.getTime() - b.start.getTime())[0];

  const live = tasks.filter((t) => {
    const s = new Date(t.startAt);
    const e = new Date(s.getTime() + t.durationMinutes * 60_000);
    return s <= now && now <= e;
  });

  const nowPct = clampPct(((now.getTime() - dayStart.getTime()) / span) * 100);

  // Week context for empty state — μόνο μελλοντικά (όχι παρελθόντα)
  const tomorrowStart = new Date(now); tomorrowStart.setHours(0, 0, 0, 0); tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const tomorrowEnd   = new Date(tomorrowStart); tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
  const futureWeekTasks = weekTasks
    .map((t) => ({ t, d: new Date(t.startAt) }))
    .filter((x) => x.d > now)
    .sort((a, b) => a.d.getTime() - b.d.getTime());
  const tomorrowCount = futureWeekTasks.filter((x) => x.d >= tomorrowStart && x.d < tomorrowEnd).length;
  const weekRemainingCount = futureWeekTasks.length;
  const nextInWeek = futureWeekTasks[0];

  const isEmpty = tasks.length === 0;

  return (
    <section className="cx-fade-in cx-card relative overflow-hidden">
      <div className="flex flex-wrap items-end justify-between gap-3 px-3.5 pb-2.5 pt-3.5">
        <div>
          <p className="cx-eyebrow">Σήμερα</p>
          <p className="mt-1">
            <span className={cn("cx-kpi-num", isEmpty && "text-muted-foreground/60")}>{tasks.length}</span>
            <span className="ml-2 text-[11px] text-muted-foreground">
              εργασί{tasks.length === 1 ? "α" : "ες"}
            </span>
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {live.length > 0 ? (
              <>
                <span className="font-semibold text-amber-700">{live.length} live τώρα</span>
                {next && ` · επόμενη ${formatRelativeFuture(next.start, now)}`}
              </>
            ) : next ? (
              <>Επόμενη {formatRelativeFuture(next.start, now)} — {SERVICE_LABEL[next.t.serviceType]}</>
            ) : isEmpty ? (
              "Καμία προγραμματισμένη εργασία σήμερα"
            ) : (
              "Όλες οι σημερινές εργασίες έχουν ολοκληρωθεί"
            )}
          </p>
        </div>
        <Link
          href="/carrier/tasks"
          className="inline-flex h-9 items-center rounded-md border border-border bg-card px-3 text-[11px] font-medium cx-transition cx-press hover:bg-[var(--cx-hover)] active:bg-[var(--cx-accent-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
        >
          Δες όλες →
        </Link>
      </div>

      {isEmpty ? (
        <EmptyTodayPanel
          tomorrowCount={tomorrowCount}
          weekRemainingCount={weekRemainingCount}
          nextInWeek={nextInWeek ? { d: nextInWeek.d, serviceType: nextInWeek.t.serviceType, title: nextInWeek.t.title, projectId: nextInWeek.t.projectId } : null}
        />
      ) : (
        <div className="px-5 pb-5 sm:px-6 sm:pb-6">
          <div className="relative h-12 select-none">
            <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" />
            {[8, 10, 12, 14, 16, 18].map((h) => {
              const pct = ((h - 7) / 13) * 100;
              return (
                <div key={h} className="absolute top-0 -translate-x-1/2" style={{ left: `${pct}%` }}>
                  <div className="h-2 w-px bg-border" />
                  <div className="mt-1 text-[10px] tabular-nums text-muted-foreground">{h}:00</div>
                </div>
              );
            })}
            {tasks.map((t) => {
              const start = new Date(t.startAt);
              const end = new Date(start.getTime() + t.durationMinutes * 60_000);
              const sPct = clampPct(((start.getTime() - dayStart.getTime()) / span) * 100);
              const ePct = clampPct(((end.getTime()   - dayStart.getTime()) / span) * 100);
              const width = Math.max(2, ePct - sPct);
              const isLive = start <= now && now <= end;
              return (
                <Link
                  key={t.id}
                  href={t.projectId ? `/carrier/projects/${t.projectId}` : "/carrier/tasks"}
                  title={`${start.toLocaleTimeString("el-GR", { hour: "2-digit", minute: "2-digit" })} · ${t.title}`}
                  className="absolute top-1/2 h-5 -translate-y-1/2 rounded-sm cx-transition hover:z-10 hover:h-6 hover:ring-2 hover:ring-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  style={{
                    left: `${sPct}%`,
                    width: `${width}%`,
                    background: SERVICE_COLOR[t.serviceType],
                    opacity: isLive ? 1 : 0.85,
                  }}
                />
              );
            })}
            <div aria-hidden className="absolute top-0 bottom-0 w-px bg-foreground" style={{ left: `${nowPct}%` }} />
            <div
              aria-hidden
              className="absolute -top-1 -translate-x-1/2 rounded-full bg-foreground px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-background"
              style={{ left: `${nowPct}%` }}
            >
              τώρα
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5">
            {uniqueServices(tasks).map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span aria-hidden className="size-2 rounded-sm" style={{ background: SERVICE_COLOR[s] }} />
                {SERVICE_LABEL[s]}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function EmptyTodayPanel({
  tomorrowCount, weekRemainingCount, nextInWeek,
}: {
  tomorrowCount: number;
  weekRemainingCount: number;
  nextInWeek: { d: Date; serviceType: ServiceType; title: string; projectId: string | null } | null;
}) {
  return (
    <div className="border-t border-border bg-muted/30 px-3.5 py-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Αύριο" count={tomorrowCount} unit={`εργασί${tomorrowCount === 1 ? "α" : "ες"}`} />
        <Metric label="Υπόλοιπο εβδομάδας" count={weekRemainingCount} unit={`εργασί${weekRemainingCount === 1 ? "α" : "ες"}`} />
        <div className="min-w-0">
          <p className="cx-eyebrow">Επόμενη</p>
          {nextInWeek ? (
            <Link
              href={nextInWeek.projectId ? `/carrier/projects/${nextInWeek.projectId}` : "/carrier/tasks"}
              className="mt-0.5 block cx-transition hover:opacity-80"
            >
              <p className="text-[11px] font-semibold">
                {nextInWeek.d.toLocaleDateString("el-GR", { weekday: "short", day: "2-digit", month: "short" })}
                {" · "}
                <span className="font-mono tabular-nums text-muted-foreground">
                  {nextInWeek.d.toLocaleTimeString("el-GR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {SERVICE_LABEL[nextInWeek.serviceType]} · {nextInWeek.title}
              </p>
            </Link>
          ) : (
            <p className="mt-0.5 text-[11px] text-muted-foreground">— καμία —</p>
          )}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Link
          href="/carrier/calendar"
          className="inline-flex h-7 items-center rounded-md bg-[var(--cx-accent)] px-2.5 text-[11px] font-semibold text-primary-foreground cx-transition cx-press hover:opacity-90"
        >
          Ημερολόγιο →
        </Link>
        <Link
          href="/carrier/leads"
          className="inline-flex h-7 items-center rounded-md border border-border bg-card px-2.5 text-[11px] font-medium cx-transition cx-press hover:bg-[var(--cx-hover)] active:bg-[var(--cx-accent-soft)]"
        >
          Πιάσε νέα αιτήματα
        </Link>
      </div>
    </div>
  );
}

function Metric({ label, count, unit }: { label: string; count: number; unit: string }) {
  return (
    <div className="min-w-0">
      <p className="cx-eyebrow truncate">{label}</p>
      <p className="mt-0.5 text-[11px]">
        <span className="text-[18px] font-semibold tabular-nums text-foreground">{count}</span>
        <span className="ml-1.5 text-[11px] text-muted-foreground">{unit}</span>
      </p>
    </div>
  );
}

function uniqueServices(tasks: TodayTask[]): ServiceType[] {
  const set = new Set<ServiceType>();
  for (const t of tasks) set.add(t.serviceType);
  return [...set];
}

// ─────────────────────── KPI STRIP ───────────────────────

function KpiStrip({ kpis }: { kpis: Kpis }) {
  return (
    <section className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      <KpiCell label="Ανοιχτές προσφορές" value={kpis.openOffers} sublabel="ενεργές" href="/carrier/offers" accent="amber" />
      <KpiCell
        label="Ενεργά projects"
        value={kpis.activeProjectsCount}
        sublabel={`${kpis.completedProjects} ολοκληρωμένα`}
        href="/carrier/projects"
        accent="info"
      />
      <KpiCell
        label="Έσοδα 30 ημερών"
        value={`${kpis.revenue30d.toLocaleString("el-GR", { maximumFractionDigits: 0 })}€`}
        delta={kpis.revenuePrev30d > 0 ? kpis.revenueDeltaPct : null}
        sublabel={kpis.revenueAllTime > 0 ? `lifetime ${kpis.revenueAllTime.toLocaleString("el-GR", { maximumFractionDigits: 0 })}€` : "—"}
        href="/carrier/billing"
        accent="success"
      />
      <KpiCell
        label="Αξιολόγηση"
        value={kpis.avgRating > 0 ? kpis.avgRating.toFixed(1) : "—"}
        sublabel={`${kpis.reviewCount} αξιολογήσε${kpis.reviewCount === 1 ? "ι" : "ις"}`}
        href="/carrier/reviews"
        accent="warning"
      />
    </section>
  );
}

const KPI_ACCENT: Record<NonNullable<KpiCellProps["accent"]>, { num: string; rail: string }> = {
  success: { num: "text-emerald-700", rail: "bg-emerald-500" },
  info:    { num: "text-sky-700",     rail: "bg-sky-500" },
  warning: { num: "text-amber-700",   rail: "bg-amber-500" },
  amber:   { num: "text-amber-700",   rail: "bg-amber-500" },
  danger:  { num: "text-rose-700",    rail: "bg-rose-500" },
  neutral: { num: "text-foreground",  rail: "bg-muted-foreground/40" },
};

interface KpiCellProps {
  label: string;
  value: string | number;
  sublabel?: string;
  href: string;
  delta?: number | null;
  accent?: "success" | "info" | "warning" | "amber" | "danger" | "neutral";
}

function KpiCell({ label, value, sublabel, href, delta, accent = "neutral" }: KpiCellProps) {
  const a = KPI_ACCENT[accent];
  return (
    <Link
      href={href}
      className="group cx-fade-in cx-card relative flex items-center gap-2.5 overflow-hidden px-2.5 py-2 cx-transition hover:bg-[var(--cx-hover)] active:bg-[var(--cx-accent-soft)]"
    >
      <span aria-hidden className={cn("absolute left-0 top-0 h-full w-0.5", a.rail)} />
      <div className="min-w-0 flex-1">
        <p className="cx-eyebrow truncate text-[10px]">{label}</p>
        {sublabel && <p className="truncate text-[10px] text-muted-foreground">{sublabel}</p>}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={cn("font-display text-[20px] font-semibold leading-none tabular-nums tracking-tight", a.num)}>
          {value}
        </span>
        {delta != null && (
          <span
            className={cn(
              "text-[10px] font-semibold tabular-nums",
              delta >= 0 ? "text-emerald-700" : "text-rose-700",
            )}
          >
            {delta >= 0 ? "↑" : "↓"}{Math.abs(delta).toFixed(0)}%
          </span>
        )}
      </div>
    </Link>
  );
}

// ─────────────────────── ACCORDION ───────────────────────

function Accordion({
  id, title, badge, tone, defaultOpen, children,
}: {
  id: string;
  title: string;
  badge?: number;
  tone?: "danger" | "warning" | "default";
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const toneCls =
    tone === "danger"  ? "ring-rose-200"  :
    tone === "warning" ? "ring-amber-200" : "";
  return (
    <details
      id={id}
      open={defaultOpen}
      className={cn("cx-card group/acc", toneCls && "ring-1 ring-inset", toneCls)}
    >
      <summary
        className="flex h-10 cursor-pointer list-none items-center gap-2.5 px-3 select-none cx-transition hover:bg-[var(--cx-hover)] active:bg-[var(--cx-accent-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring group-open/acc:bg-muted/40 [&::-webkit-details-marker]:hidden"
      >
        <ChevronDown className="size-4 shrink-0 text-muted-foreground cx-transition group-open/acc:rotate-0 -rotate-90" />
        <span className="cx-h2 flex-1">{title}</span>
        {badge !== undefined && badge > 0 && (
          <span
            className={cn(
              "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
              tone === "danger"  ? "bg-rose-100  text-rose-800"  :
              tone === "warning" ? "bg-amber-100 text-amber-800" :
              "bg-muted text-muted-foreground",
            )}
          >
            {badge}
          </span>
        )}
      </summary>
      <div className="border-t border-border px-3 py-3">
        {children}
      </div>
    </details>
  );
}

// ─────────────────────── URGENT LIST ───────────────────────

interface UrgentItem {
  severity: "critical" | "warning" | "info";
  title: string;
  hint: string;
  href: string;
}

function buildUrgentList(p: Props): UrgentItem[] {
  const out: UrgentItem[] = [];
  const now = Date.now();
  const DAY = 86_400_000;

  // ── ΚΕΝΤΡΙΚΟ: partner quote requests όχι επιβεβαιωμένα + ημερομηνία πλησιάζει
  // (PENDING = δεν έχει απαντήσει ο partner ακόμη)
  const partnerRequestsApproaching = p.pendingQuoteCampaigns
    .filter((q) => q.status === "PENDING" && q.scheduledStartAt)
    .map((q) => ({ q, days: (new Date(q.scheduledStartAt!).getTime() - now) / DAY }))
    .filter((x) => x.days <= 7 && x.days >= -1)
    .sort((a, b) => a.days - b.days);

  if (partnerRequestsApproaching.length > 0) {
    const critical = partnerRequestsApproaching.filter((x) => x.days <= 2).length;
    out.push({
      severity: critical > 0 ? "critical" : "warning",
      title: `${partnerRequestsApproaching.length} request${partnerRequestsApproaching.length === 1 ? "" : "s"} σε συνεργάτες χωρίς επιβεβαίωση`,
      hint: critical > 0
        ? `${critical} με ημερομηνία ≤2 ημέρες — χρειάζεται follow-up τώρα.`
        : "Η ημερομηνία πλησιάζει. Στείλε υπενθύμιση.",
      href: "/carrier/partners",
    });
  }

  // Pending confirm από δικούς μας υπαλλήλους
  if (p.pendingConfirmTasks.length > 0) {
    const soonest = p.pendingConfirmTasks
      .map((t) => (new Date(t.startAt).getTime() - now) / DAY)
      .sort((a, b) => a - b)[0];
    out.push({
      severity: soonest <= 2 ? "critical" : "warning",
      title: `${p.pendingConfirmTasks.length} ανάθεση${p.pendingConfirmTasks.length === 1 ? "" : "ες"} χωρίς επιβεβαίωση υπαλλήλου`,
      hint: soonest <= 2 ? "Η εργασία είναι σε ≤2 ημέρες." : "Στείλε υπενθύμιση.",
      href: "/carrier/tasks?filter=pending",
    });
  }

  // Declined — πάντα κρίσιμο
  if (p.declinedTasks.length > 0) {
    out.push({
      severity: "critical",
      title: `${p.declinedTasks.length} ανάθεση${p.declinedTasks.length === 1 ? "" : "εις"} απορρίφθηκ${p.declinedTasks.length === 1 ? "ε" : "αν"}`,
      hint: "Χρειάζεται επανάθεση.",
      href: "/carrier/tasks?filter=declined",
    });
  }

  // Expiring offers
  if (p.expiringOffers.length > 0) {
    out.push({
      severity: "warning",
      title: `${p.expiringOffers.length} προσφορά${p.expiringOffers.length === 1 ? "" : "ές"} λήγ${p.expiringOffers.length === 1 ? "ει" : "ουν"} σε <48ω`,
      hint: "Παράτεινε ή αναθεώρησε.",
      href: "/carrier/offers?filter=expiring",
    });
  }

  // Setup gaps — δευτερεύοντα, info
  if (p.kpis.fleetCount === 0) {
    out.push({
      severity: "info",
      title: "Δεν έχεις δηλώσει όχημα",
      hint: "Χωρίς όχημα δεν υπολογίζονται προσφορές.",
      href: "/carrier/fleet",
    });
  }
  if (p.kpis.employeesCount === 0 && p.kpis.fleetCount > 0) {
    out.push({
      severity: "info",
      title: "Δεν έχεις υπαλλήλους",
      hint: "Καταχώρισε ομάδα για να αναθέτεις εργασίες.",
      href: "/carrier/employees",
    });
  }
  return out;
}

const SEVERITY: Record<UrgentItem["severity"], { dot: string; label: string }> = {
  critical: { dot: "bg-rose-500",  label: "κρίσιμο" },
  warning:  { dot: "bg-amber-500", label: "προσοχή" },
  info:     { dot: "bg-sky-500",   label: "info" },
};

// Ονομαστική λίστα εκκρεμοτήτων με grouping + vertical scroller
function UrgentDetails({ props: p }: { props: Props }) {
  const now = Date.now();
  const DAY = 86_400_000;

  // Partner quotes — pending + ημερομηνία σε ≤7d
  const partnerPending = p.pendingQuoteCampaigns
    .filter((q) => q.status === "PENDING" && q.scheduledStartAt)
    .map((q) => ({ q, days: (new Date(q.scheduledStartAt!).getTime() - now) / DAY }))
    .filter((x) => x.days <= 7 && x.days >= -1)
    .sort((a, b) => a.days - b.days);

  // Employee task assignments waiting confirmation, sorted by startAt
  const empPending = [...p.pendingConfirmTasks]
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

  const declined = p.declinedTasks;
  const expiring = p.expiringOffers;

  const setupGaps: Array<{ label: string; hint: string; href: string }> = [];
  if (p.kpis.fleetCount === 0) {
    setupGaps.push({ label: "Δεν έχεις δηλώσει όχημα", hint: "Χωρίς όχημα δεν υπολογίζονται προσφορές.", href: "/carrier/fleet" });
  }
  if (p.kpis.employeesCount === 0 && p.kpis.fleetCount > 0) {
    setupGaps.push({ label: "Δεν έχεις υπαλλήλους", hint: "Καταχώρισε ομάδα για να αναθέτεις εργασίες.", href: "/carrier/employees" });
  }

  return (
    <div className="-mx-4 -my-4 max-h-[60vh] overflow-y-auto sm:-mx-5 sm:-my-5">
      <div className="divide-y divide-border">
        {partnerPending.length > 0 && (
          <UrgentGroup
            title="Συνεργάτες χωρίς επιβεβαίωση"
            count={partnerPending.length}
            severity={partnerPending.some((x) => x.days <= 2) ? "critical" : "warning"}
            hint="PENDING quote requests όπου πλησιάζει η ημερομηνία εργασίας."
          >
            {partnerPending.map(({ q, days }) => (
              <UrgentItemRow
                key={q.id}
                href={q.projectId ? `/carrier/projects/${q.projectId}` : "/carrier/partners"}
                primary={q.partnerName}
                secondary={`${SERVICE_LABEL[q.serviceType]}${q.projectCode ? ` · ${q.projectCode}` : ""}`}
                meta={
                  q.scheduledStartAt
                    ? `${new Date(q.scheduledStartAt).toLocaleDateString("el-GR", { weekday: "short", day: "2-digit", month: "short" })}`
                    : "—"
                }
                badge={daysBadge(days)}
                badgeTone={days <= 2 ? "danger" : "warning"}
                price={q.quotedPriceCents != null ? `${(q.quotedPriceCents / 100).toLocaleString("el-GR")}€` : undefined}
                actions={[
                  {
                    icon: Trash2,
                    tone: "danger",
                    title: "Ακύρωση request",
                    description: `Θες να ακυρώσεις το request προς ${q.partnerName}; Ο συνεργάτης δεν θα μπορεί να καταχωρήσει προσφορά.`,
                    confirmLabel: "Ακύρωση request",
                    run: () => cancelPartnerQuoteRequest(q.id),
                  },
                ]}
              />
            ))}
          </UrgentGroup>
        )}

        {empPending.length > 0 && (
          <UrgentGroup
            title="Αναθέσεις χωρίς επιβεβαίωση υπαλλήλου"
            count={empPending.length}
            severity={empPending.some((t) => daysUntil(t.startAt) <= 2) ? "critical" : "warning"}
            hint="Ο υπάλληλος δεν έχει επιβεβαιώσει ακόμη την ανάθεση."
          >
            {empPending.map((t) => {
              const d = daysUntil(t.startAt);
              return (
                <UrgentItemRow
                  key={t.id}
                  href={t.projectId ? `/carrier/projects/${t.projectId}` : "/carrier/tasks"}
                  primary={t.assigneeName}
                  secondary={`${t.title}${t.projectCode ? ` · ${t.projectCode}` : ""}`}
                  meta={`${new Date(t.startAt).toLocaleDateString("el-GR", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}`}
                  badge={daysBadge(d)}
                  badgeTone={d <= 2 ? "danger" : "warning"}
                  actions={[
                    {
                      icon: Bell,
                      title: "Επαναποστολή επιβεβαίωσης",
                      description: `Αποστολή νέου email επιβεβαίωσης στον/στην ${t.assigneeName} για την εργασία «${t.title}».`,
                      confirmLabel: "Αποστολή",
                      run: () => resendTaskConfirmation(t.id),
                    },
                    {
                      icon: Check,
                      title: "Επιβεβαίωση χειροκίνητα",
                      description: `Θες να επιβεβαιώσεις χειροκίνητα την ανάθεση στον/στην ${t.assigneeName}; Δεν θα σταλεί email.`,
                      confirmLabel: "Επιβεβαίωση",
                      run: () => confirmTaskByAdmin(t.id),
                    },
                  ]}
                />
              );
            })}
          </UrgentGroup>
        )}

        {declined.length > 0 && (
          <UrgentGroup
            title="Απορριφθείσες αναθέσεις"
            count={declined.length}
            severity="critical"
            hint="Χρειάζεται επανάθεση σε άλλον υπάλληλο."
          >
            {declined.map((d) => (
              <UrgentItemRow
                key={d.id}
                href={d.projectId ? `/carrier/projects/${d.projectId}` : "/carrier/tasks"}
                primary={d.assigneeName}
                secondary={`${d.title}${d.projectCode ? ` · ${d.projectCode}` : ""}`}
                meta={d.reason ? `«${d.reason}»` : new Date(d.startAt).toLocaleDateString("el-GR", { day: "2-digit", month: "short" })}
                badge="declined"
                badgeTone="danger"
              />
            ))}
          </UrgentGroup>
        )}

        {expiring.length > 0 && (
          <UrgentGroup
            title="Προσφορές που λήγουν"
            count={expiring.length}
            severity="warning"
            hint="<48ω. Παράτεινε ή αναθεώρησε."
          >
            {expiring.map((o) => {
              const validUntil = new Date(o.validUntil);
              const hours = Math.max(0, Math.round((validUntil.getTime() - now) / 3_600_000));
              return (
                <UrgentItemRow
                  key={o.id}
                  href={`/carrier/leads/${o.moveRequestId}`}
                  primary={o.route}
                  secondary={`Ισχύει έως ${validUntil.toLocaleDateString("el-GR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}`}
                  badge={`${hours}h`}
                  badgeTone={hours < 12 ? "danger" : "warning"}
                  price={`${(o.priceCents / 100).toLocaleString("el-GR")}€`}
                />
              );
            })}
          </UrgentGroup>
        )}

        {setupGaps.length > 0 && (
          <UrgentGroup
            title="Στήσιμο εταιρείας"
            count={setupGaps.length}
            severity="info"
            hint="Λείπει βασική παραμετροποίηση."
          >
            {setupGaps.map((g, i) => (
              <UrgentItemRow
                key={i}
                href={g.href}
                primary={g.label}
                secondary={g.hint}
                badge="setup"
                badgeTone="info"
              />
            ))}
          </UrgentGroup>
        )}
      </div>
    </div>
  );
}

const URGENT_BADGE_TONE: Record<"critical" | "warning" | "info" | "danger", string> = {
  critical: "bg-rose-100 text-rose-800 ring-rose-200",
  danger:   "bg-rose-100 text-rose-800 ring-rose-200",
  warning:  "bg-amber-100 text-amber-800 ring-amber-200",
  info:     "bg-sky-100 text-sky-800 ring-sky-200",
};

function UrgentGroup({
  title, count, severity, hint, children,
}: {
  title: string;
  count: number;
  severity: "critical" | "warning" | "info";
  hint?: string;
  children: React.ReactNode;
}) {
  const dot =
    severity === "critical" ? "bg-rose-500" :
    severity === "warning"  ? "bg-amber-500" :
    "bg-sky-500";
  return (
    <section>
      <header className="sticky top-0 z-[1] flex items-center gap-2 border-b border-border bg-card/95 px-4 py-2 backdrop-blur sm:px-5">
        <span aria-hidden className={cn("cx-dot", dot)} />
        <h4 className="text-[11px] font-semibold text-foreground">{title}</h4>
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">{count}</span>
        {hint && <span className="ml-2 hidden truncate text-[11px] text-muted-foreground sm:inline">— {hint}</span>}
      </header>
      <ul className="divide-y divide-[var(--cx-divider)]">{children}</ul>
    </section>
  );
}

interface QuickActionSpec {
  icon: typeof Bell;
  title: string;
  description: string;
  confirmLabel: string;
  tone?: "default" | "danger";
  run: () => Promise<ActionResult>;
}

function UrgentItemRow({
  href, primary, secondary, meta, badge, badgeTone, price, actions,
}: {
  href: string;
  primary: string;
  secondary?: string;
  meta?: string;
  badge?: string;
  badgeTone?: "critical" | "warning" | "info" | "danger";
  price?: string;
  actions?: QuickActionSpec[];
}) {
  return (
    <li className="group/row relative">
      <Link
        href={href}
        className="flex items-center gap-3 px-4 py-2.5 cx-transition hover:bg-[var(--cx-hover)] active:bg-[var(--cx-accent-soft)] sm:px-5"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-semibold text-foreground">{primary}</p>
          {secondary && <p className="truncate text-[11px] text-muted-foreground">{secondary}</p>}
          {meta && <p className="mt-0.5 truncate text-[11px] text-muted-foreground/80">{meta}</p>}
        </div>
        {price && (
          <span className="shrink-0 text-right text-[11px] font-semibold tabular-nums text-emerald-700">
            {price}
          </span>
        )}
        {badge && badgeTone && (
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset tabular-nums",
              URGENT_BADGE_TONE[badgeTone],
            )}
          >
            {badge}
          </span>
        )}
        {actions && actions.length > 0 && (
          <span aria-hidden className="shrink-0" style={{ width: `${actions.length * 32}px` }} />
        )}
      </Link>
      {actions && actions.length > 0 && (
        <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center gap-1 opacity-0 cx-transition group-hover/row:pointer-events-auto group-hover/row:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100 sm:right-4">
          {actions.map((a, i) => (
            <QuickActionButton key={i} spec={a} />
          ))}
        </div>
      )}
    </li>
  );
}

function QuickActionButton({ spec }: { spec: QuickActionSpec }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const Icon = spec.icon;

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const res = await spec.run();
      if (res.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setError(res.error ?? "Κάτι πήγε στραβά.");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        title={spec.title}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
        className={cn(
          "grid size-7 place-items-center rounded-md border border-border bg-card text-muted-foreground cx-transition cx-press hover:text-foreground active:bg-[var(--cx-accent-soft)]",
          spec.tone === "danger" && "hover:border-rose-300 hover:text-rose-700",
        )}
      >
        <Icon className="size-3.5" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{spec.title}</DialogTitle>
            <DialogDescription>{spec.description}</DialogDescription>
          </DialogHeader>
          {error && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-800">
              {error}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" disabled={pending} onClick={() => setOpen(false)}>
              Άκυρο
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={pending}
              variant={spec.tone === "danger" ? "destructive" : "default"}
            >
              {pending ? "Παρακαλώ…" : spec.confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function daysUntil(iso: string): number {
  return (new Date(iso).getTime() - Date.now()) / 86_400_000;
}

function daysBadge(days: number): string {
  if (days < 0) return "ληγμένο";
  if (days < 1) return "σήμερα";
  if (days < 2) return "αύριο";
  return `${Math.round(days)}d`;
}

// (legacy aggregate list — kept for fallback / not used by default)
function UrgentList({ items }: { items: UrgentItem[] }) {
  return (
    <ul className="divide-y divide-[var(--cx-divider)]">
      {items.map((item, i) => (
        <li key={i}>
          <Link
            href={item.href}
            className="group/u flex items-center gap-3 py-3 cx-transition hover:bg-[var(--cx-hover)] -mx-4 px-4 sm:-mx-5 sm:px-5"
          >
            <span aria-hidden className={cn("cx-dot", SEVERITY[item.severity].dot)} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-semibold text-foreground">{item.title}</p>
              <p className="truncate text-[11px] text-muted-foreground">{item.hint}</p>
            </div>
            <span className="text-[11px] font-medium text-muted-foreground cx-transition group-hover/u:text-foreground">→</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

// ─────────────────────── ACTIVE PROJECTS ───────────────────────

function ActiveProjectsTable({ projects }: { projects: ActiveProject[] }) {
  const cols: DataTableColumn<ActiveProject>[] = [
    { key: "code", header: "Code", width: "12%",
      cell: (p) => <span className="font-mono text-[11px] font-semibold">{p.code}</span> },
    { key: "customer", header: "Πελάτης", width: "22%",
      cell: (p) => <span className="font-medium">{p.customer}</span> },
    { key: "route", header: "Διαδρομή", width: "30%",
      cell: (p) => <span className="text-muted-foreground">{p.route}</span> },
    { key: "start", header: "Έναρξη", width: "12%",
      cell: (p) => (
        <span className="text-muted-foreground tabular-nums">
          {new Date(p.scheduledStart).toLocaleDateString("el-GR", { day: "2-digit", month: "short" })}
        </span>
      ) },
    { key: "status", header: "Κατάσταση", width: "14%",
      cell: (p) => <StatusPill status={p.status} size="xs" /> },
    { key: "price", header: "Αξία", width: "10%", numeric: true,
      cell: (p) => <span className="font-semibold tabular-nums">{(p.totalPriceCents / 100).toLocaleString("el-GR")}€</span> },
  ];
  return (
    <DataTable
      rows={projects}
      columns={cols}
      getRowId={(p) => p.id}
      onOpen={() => { /* navigation via row click handled below */ }}
      emptyState={<EmptyRow href="/carrier/projects" cta="Δες όλα">Δεν υπάρχουν ενεργά projects.</EmptyRow>}
      rowActions={(p) => (
        <Link
          href={`/carrier/projects/${p.id}`}
          onClick={(e) => e.stopPropagation()}
          className="text-[11px] font-semibold text-muted-foreground hover:text-foreground"
        >
          Άνοιγμα →
        </Link>
      )}
      className="border-0 shadow-none"
    />
  );
}

// ─────────────────────── SALES ───────────────────────

function SalesGrid({ leads, offers }: { leads: Lead[]; offers: OpenOffer[] }) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <SubSection title="Νέα αιτήματα" count={leads.length} href="/carrier/leads">
        {leads.length === 0 ? (
          <EmptyRow href="/carrier/leads" cta="Δες όλα">Δεν υπάρχουν νέα αιτήματα.</EmptyRow>
        ) : (
          <ul className="divide-y divide-[var(--cx-divider)]">
            {leads.slice(0, 5).map((l) => (
              <li key={l.id}>
                <Link
                  href={`/carrier/leads/${l.id}`}
                  className="group/lead block py-2.5 cx-transition hover:bg-[var(--cx-hover)] -mx-4 px-4 sm:-mx-5 sm:px-5"
                >
                  <p className="truncate text-[11px] font-semibold">{l.fromAddress} → {l.toAddress}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                    <span className="rounded-sm bg-muted px-1.5 py-0.5 font-semibold uppercase tracking-wide text-foreground/70">
                      {l.type}
                    </span>
                    {l.volumeM3 != null && <span>{l.volumeM3.toFixed(1)} m³</span>}
                    <span>{l.itemsCount} αντικ.</span>
                    <span>· {relativeTime(new Date(l.createdAt))}</span>
                    {(l.estimatedPriceMinCents || l.estimatedPriceMaxCents) && (
                      <span className="ml-auto font-semibold text-emerald-700 tabular-nums">
                        {l.estimatedPriceMinCents ? Math.round(l.estimatedPriceMinCents / 100) : "—"}–
                        {l.estimatedPriceMaxCents ? Math.round(l.estimatedPriceMaxCents / 100) : "—"}€
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </SubSection>

      <SubSection title="Οι προσφορές μου" count={offers.length} href="/carrier/offers">
        {offers.length === 0 ? (
          <EmptyRow href="/carrier/offers" cta="Δες όλες">Δεν έχεις ανοιχτές προσφορές.</EmptyRow>
        ) : (
          <ul className="divide-y divide-[var(--cx-divider)]">
            {offers.slice(0, 5).map((o) => {
              const v = new Date(o.validUntil);
              const expiring = v.getTime() - Date.now() < 48 * 3600 * 1000;
              return (
                <li key={o.id}>
                  <Link
                    href={`/carrier/leads/${o.moveRequestId}`}
                    className="flex items-center gap-3 py-2.5 cx-transition hover:bg-[var(--cx-hover)] -mx-4 px-4 sm:-mx-5 sm:px-5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-semibold">{o.route}</p>
                      <p className={cn("text-[11px]", expiring ? "font-semibold text-amber-700" : "text-muted-foreground")}>
                        {expiring ? "⏰ Λήγει " : "Ισχύει έως "}
                        <span className="tabular-nums">{v.toLocaleDateString("el-GR", { day: "2-digit", month: "short" })}</span>
                      </p>
                    </div>
                    <span className="font-display text-[15px] font-semibold tabular-nums text-emerald-700">
                      {(o.priceCents / 100).toLocaleString("el-GR")}€
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </SubSection>
    </div>
  );
}

// ─────────────────────── TEAM ───────────────────────

function TeamSection({
  workload, quotes, rating, reviewCount, fleetCount, partnersCount,
}: {
  workload: EmployeeWorkload[];
  quotes: PendingQuote[];
  rating: number;
  reviewCount: number;
  fleetCount: number;
  partnersCount: number;
}) {
  const maxLoad = Math.max(1, ...workload.map((e) => e.weekTaskCount));
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <SubSection title="Φόρτος υπαλλήλων" count={workload.length} className="lg:col-span-2">
        {workload.length === 0 ? (
          <EmptyRow href="/carrier/employees" cta="Προσθήκη">Δεν υπάρχουν ενεργοί υπάλληλοι.</EmptyRow>
        ) : (
          <ul className="space-y-2">
            {[...workload].sort((a, b) => b.weekTaskCount - a.weekTaskCount).map((e) => {
              const pct = (e.weekTaskCount / maxLoad) * 100;
              const tone = pct >= 80 ? "bg-rose-500" : pct >= 50 ? "bg-amber-500" : "bg-emerald-500";
              return (
                <li key={e.id} className="flex items-center gap-3">
                  <div className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-[11px] font-semibold text-foreground">
                    {e.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-[11px] font-semibold">{e.name}</p>
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{e.role}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div className={cn("h-full cx-transition", tone)} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-6 text-right text-[11px] font-semibold tabular-nums">{e.weekTaskCount}</span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SubSection>

      <div className="space-y-3">
        <div className="cx-card p-4">
          <p className="cx-eyebrow">Αξιολόγηση</p>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="cx-kpi-num">{rating > 0 ? rating.toFixed(1) : "—"}</span>
            <span className="text-[11px] text-muted-foreground">/ 5</span>
            <Star className="size-3.5 text-amber-500" fill="currentColor" />
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {reviewCount} αξιολογήσε{reviewCount === 1 ? "ι" : "ις"}
          </p>
        </div>

        <ul className="cx-card divide-y divide-[var(--cx-divider)]">
          <ResourceItem label="Οχήματα" count={fleetCount} href="/carrier/fleet" />
          <ResourceItem label="Συνεργάτες" count={partnersCount} href="/carrier/partners" />
        </ul>

        {quotes.length > 0 && (
          <div className="cx-card overflow-hidden">
            <div className="border-b border-border px-3 py-2">
              <span className="cx-eyebrow">Quotes σε partners</span>
              <span className="ml-2 text-[11px] tabular-nums text-muted-foreground">{quotes.length}</span>
            </div>
            <ul className="divide-y divide-[var(--cx-divider)]">
              {quotes.slice(0, 4).map((q) => (
                <li key={q.id}>
                  <Link
                    href={q.projectId ? `/carrier/projects/${q.projectId}` : "#"}
                    className="block px-3 py-2 cx-transition hover:bg-[var(--cx-hover)] active:bg-[var(--cx-accent-soft)]"
                  >
                    <p className="truncate text-[11px] font-semibold">{q.partnerName}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {SERVICE_LABEL[q.serviceType]} · {q.projectCode ?? "—"}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function ResourceItem({ label, count, href }: { label: string; count: number; href: string }) {
  const empty = count === 0;
  return (
    <li>
      <Link
        href={href}
        className="flex h-10 items-center justify-between gap-2 px-3 text-[11px] cx-transition hover:bg-[var(--cx-hover)] active:bg-[var(--cx-accent-soft)]"
      >
        <span className="flex items-center gap-2">
          <span aria-hidden className={cn("cx-dot", empty ? "bg-rose-500" : "bg-muted-foreground/40")} />
          <span className={cn("font-semibold", empty && "text-rose-700")}>{label}</span>
        </span>
        <span className="tabular-nums font-semibold">{count}</span>
      </Link>
    </li>
  );
}

// ─────────────────────── WEEK AGENDA ───────────────────────

function WeekAgenda({ tasks }: { tasks: WeekTask[] }) {
  const days: Array<{ date: Date; tasks: WeekTask[] }> = [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay() + 1); // Monday
  for (let i = 0; i < 7; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    days.push({ date: d, tasks: [] });
  }
  for (const t of tasks) {
    const td = new Date(t.startAt);
    const idx = Math.floor((td.getTime() - start.getTime()) / 86400000);
    if (idx >= 0 && idx < 7) days[idx].tasks.push(t);
  }
  const maxCount = Math.max(1, ...days.map((d) => d.tasks.length));

  return (
    <ul className="space-y-1.5">
      {days.map((d) => {
        const isToday = isSameDate(d.date, new Date());
        const pct = (d.tasks.length / maxCount) * 100;
        return (
          <li key={d.date.toISOString()} className="flex items-center gap-3">
            <div className={cn("w-20 shrink-0 text-[11px]", isToday ? "font-semibold text-[var(--cx-accent)]" : "text-muted-foreground")}>
              <span className="uppercase tracking-wide">{d.date.toLocaleDateString("el-GR", { weekday: "short" })}</span>
              <span className="ml-1 tabular-nums">{d.date.getDate()}</span>
            </div>
            <div className="relative h-6 flex-1 overflow-hidden rounded-sm bg-muted">
              <div
                className={cn("h-full cx-transition", isToday ? "bg-[var(--cx-accent)]" : "bg-foreground/40")}
                style={{ width: `${Math.max(2, pct)}%` }}
              />
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-background mix-blend-difference">
                {d.tasks.length || ""}
              </span>
            </div>
            <span className="w-10 text-right text-[11px] tabular-nums text-muted-foreground">
              {d.tasks.length === 0 ? "—" : `${d.tasks.length}`}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

// ─────────────────────── SHARED ───────────────────────

function SubSection({
  title, count, href, children, className,
}: {
  title: string;
  count?: number;
  href?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <h3 className="cx-h2">{title}</h3>
          {count !== undefined && (
            <span className="text-[11px] tabular-nums text-muted-foreground">{count}</span>
          )}
        </div>
        {href && (
          <Link href={href} className="text-[11px] font-semibold text-[var(--cx-accent)] hover:underline">
            Όλα →
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}

function EmptyRow({
  children, href, cta,
}: {
  children: React.ReactNode;
  href?: string;
  cta?: string;
}) {
  return (
    <div className="rounded-md border border-dashed border-border bg-muted/30 px-4 py-6 text-center">
      <p className="text-[11px] text-muted-foreground">{children}</p>
      {href && cta && (
        <Link
          href={href}
          className="mt-2 inline-flex h-7 items-center rounded-sm border border-border bg-card px-2.5 text-[11px] font-semibold cx-transition hover:bg-[var(--cx-hover)] active:bg-[var(--cx-accent-soft)]"
        >
          {cta}
        </Link>
      )}
    </div>
  );
}

// ─────────────────────── HELPERS ───────────────────────

function greeting(d: Date): string {
  const h = d.getHours();
  if (h < 12) return "Καλημέρα";
  if (h < 18) return "Καλό μεσημέρι";
  return "Καλό απόγευμα";
}

function isSameDate(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function relativeTime(d: Date): string {
  const diff = Date.now() - d.getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "τώρα";
  if (m < 60) return `${m}′`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const days = Math.round(h / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString("el-GR", { day: "2-digit", month: "short" });
}

function formatRelativeFuture(d: Date, now: Date): string {
  const diff = Math.max(0, d.getTime() - now.getTime());
  const m = Math.round(diff / 60000);
  if (m < 1) return "σε λίγο";
  if (m < 60) return `σε ${m}′`;
  const h = Math.round(m / 60);
  if (h < 24) return `σε ${h}ω`;
  return d.toLocaleDateString("el-GR", { day: "2-digit", month: "short" });
}

function clampPct(n: number): number {
  return Math.max(0, Math.min(100, n));
}
