import { notFound } from "next/navigation";
import { CalendarClock, CheckCircle2, MapPin, XCircle } from "lucide-react";

import { db } from "@/lib/db";
import { TaskConfirmClient } from "./client";

export const dynamic = "force-dynamic";
export const metadata = { title: "SmartMove · Επιβεβαίωση εργασίας" };

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function TaskConfirmPage({ params }: PageProps) {
  const { token } = await params;

  const task = await db.jobTask.findFirst({
    where: { assigneeConfirmationToken: token },
    select: {
      id: true,
      title: true,
      description: true,
      startAt: true,
      durationMinutes: true,
      assigneeKind: true,
      assigneeConfirmationStatus: true,
      assigneeConfirmedAt: true,
      assigneeDeclinedAt: true,
      assigneeDeclineReason: true,
      assigneeEmployee: { select: { name: true } },
      assigneePartner: { select: { name: true } },
      projectStopService: {
        select: {
          label: true, serviceType: true,
          projectStop: {
            select: {
              address: true, type: true,
              project: {
                select: {
                  code: true,
                  moveRequest: {
                    select: { fromAddress: true, toAddress: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!task) notFound();

  const recipientName =
    task.assigneeEmployee?.name ?? task.assigneePartner?.name ?? "Συνεργάτη";
  const start = task.startAt;
  const end = new Date(start.getTime() + task.durationMinutes * 60_000);
  const fmt = (d: Date) =>
    d.toLocaleString("el-GR", {
      weekday: "long", day: "2-digit", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  const project = task.projectStopService?.projectStop.project ?? null;
  const stopAddress = task.projectStopService?.projectStop.address ?? null;

  const alreadyDecided =
    task.assigneeConfirmationStatus === "CONFIRMED" ||
    task.assigneeConfirmationStatus === "DECLINED";

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
        <div className="text-[11px] font-extrabold uppercase tracking-widest text-[var(--color-brand-blue)]">
          SmartMove · Ανάθεση εργασίας
        </div>
        <h1 className="mt-1 font-display text-2xl font-bold">
          Γεια σου {recipientName} 👋
        </h1>

        <p className="mt-3 text-sm text-muted-foreground">
          Σου ανατέθηκε η παρακάτω εργασία:
        </p>

        <div className="mt-4 rounded-2xl bg-slate-50 p-4">
          <div className="text-base font-bold text-foreground">{task.title}</div>
          {project?.code && (
            <div className="mt-1 font-mono text-[11px] text-muted-foreground">
              {project.code}
            </div>
          )}
          <div className="mt-3 flex items-center gap-2 text-sm">
            <CalendarClock className="size-4 text-muted-foreground" />
            <span>{fmt(start)} – {end.toLocaleTimeString("el-GR", { hour: "2-digit", minute: "2-digit" })}</span>
          </div>
          {stopAddress && (
            <div className="mt-1 flex items-center gap-2 text-sm">
              <MapPin className="size-4 text-muted-foreground" />
              <span>{stopAddress}</span>
            </div>
          )}
          {task.description && (
            <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
              {task.description}
            </p>
          )}
        </div>

        {alreadyDecided ? (
          <div className={`mt-5 rounded-2xl border-2 p-4 ${
            task.assigneeConfirmationStatus === "CONFIRMED"
              ? "border-emerald-300 bg-emerald-50"
              : "border-rose-300 bg-rose-50"
          }`}>
            {task.assigneeConfirmationStatus === "CONFIRMED" ? (
              <>
                <CheckCircle2 className="size-6 text-emerald-700" />
                <h2 className="mt-2 text-base font-bold text-emerald-900">
                  Έχεις ήδη επιβεβαιώσει την εργασία
                </h2>
                <p className="mt-1 text-xs text-emerald-800">
                  {task.assigneeConfirmedAt &&
                    `Επιβεβαιώθηκε στις ${task.assigneeConfirmedAt.toLocaleString("el-GR")}.`}
                </p>
              </>
            ) : (
              <>
                <XCircle className="size-6 text-rose-700" />
                <h2 className="mt-2 text-base font-bold text-rose-900">
                  Δήλωσες ότι δεν μπορείς να αναλάβεις
                </h2>
                {task.assigneeDeclineReason && (
                  <p className="mt-1 text-xs text-rose-800">
                    Λόγος: {task.assigneeDeclineReason}
                  </p>
                )}
              </>
            )}
          </div>
        ) : (
          <TaskConfirmClient token={token} />
        )}
      </div>
    </div>
  );
}
