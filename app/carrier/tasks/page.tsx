import Link from "next/link";
import { ClipboardList, ExternalLink } from "lucide-react";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHero } from "@/components/shared/page-hero";
import { EmptyState } from "@/components/dashboard/empty-state";
import { TasksMasterClient } from "@/components/carrier/tasks-master-client";

export const metadata = { title: "Εργασίες" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ mode?: string; assignee?: string }>;
}

export default async function CarrierTasksPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const groupMode =
    (params.mode as "byProject" | "byAssignee" | "flat") ?? "byAssignee";

  const session = await auth();
  const userId = session!.user.id;
  const membership = await db.tenantMembership.findFirst({
    where: { userId },
    select: { tenantId: true },
    orderBy: { createdAt: "asc" },
  });

  if (!membership) {
    return (
      <>
        <PageHero title="Εργασίες" eyebrow="Operations" />
        <div className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
          <EmptyState
            icon={ClipboardList}
            title="Δεν είσαι μέλος εταιρείας"
            description="Πρέπει να ανήκεις σε εταιρεία μεταφορέα."
          />
        </div>
      </>
    );
  }

  // 30-day window (today − 7 ↔ today + 23)
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const windowStart = new Date(now);
  windowStart.setDate(now.getDate() - 7);
  const windowEnd = new Date(now);
  windowEnd.setDate(now.getDate() + 23);

  const tasks = await db.jobTask.findMany({
    where: {
      tenantId: membership.tenantId,
      startAt: { gte: windowStart, lte: windowEnd },
    },
    orderBy: { startAt: "asc" },
    include: {
      assigneeEmployee: { select: { id: true, name: true, role: true } },
      assigneePartner: {
        select: {
          id: true,
          name: true,
          company: { select: { commercialName: true, legalName: true } },
        },
      },
      vehicle: { select: { plate: true } },
      moveRequest: {
        select: { id: true, fromAddress: true, toAddress: true },
      },
    },
  });

  const stats = {
    total: tasks.length,
    planned: tasks.filter((t) => t.status === "PLANNED").length,
    inProgress: tasks.filter((t) => t.status === "IN_PROGRESS").length,
    done: tasks.filter((t) => t.status === "DONE").length,
    totalHours: tasks.reduce((s, t) => s + t.durationMinutes, 0) / 60,
  };

  return (
    <>
      <PageHero
        eyebrow="Operations"
        title="Όλες οι εργασίες"
        description="Όλες οι αναθέσεις σε υπαλλήλους και συνεργάτες, με Gantt και φίλτρα ανά project / ανά πρόσωπο."
        crumbs={[
          { href: "/carrier", label: "Επισκόπηση" },
          { label: "Εργασίες" },
        ]}
        tone="emerald"
        kpis={[
          { label: "Σύνολο", value: stats.total },
          {
            label: "Σε εξέλιξη",
            value: stats.inProgress,
            deltaTone: stats.inProgress > 0 ? "neutral" : "positive",
          },
          { label: "Ολοκληρωμένες", value: stats.done, deltaTone: "positive" },
          { label: "Σύνολο ωρών", value: `${stats.totalHours.toFixed(0)}h` },
        ]}
      />

      <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {tasks.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="Καμία εργασία στο 30ήμερο παράθυρο"
            description="Δημιούργησε εργασίες από τη σελίδα κάθε μεταφοράς και θα εμφανίζονται εδώ συγκεντρωμένες."
            cta={{ label: "Δες μεταφορές", href: "/carrier/jobs" }}
          />
        ) : (
          <TasksMasterClient
            initialMode={groupMode}
            tasks={tasks.map((t) => ({
              id: t.id,
              title: t.title,
              category: t.category,
              status: t.status,
              startAt: t.startAt.toISOString(),
              durationMinutes: t.durationMinutes,
              assigneeKind: t.assigneeKind,
              assigneeName:
                t.assigneeEmployee?.name ??
                (t.assigneePartner
                  ? t.assigneePartner.name +
                    (t.assigneePartner.company
                      ? ` (${t.assigneePartner.company.commercialName ?? t.assigneePartner.company.legalName})`
                      : "")
                  : null),
              vehiclePlate: t.vehicle?.plate ?? null,
              moveRequestId: t.moveRequestId,
              projectLabel: shortRoute(
                t.moveRequest.fromAddress,
                t.moveRequest.toAddress,
              ),
            }))}
          />
        )}
      </div>
    </>
  );
}

function shortRoute(from: string, to: string): string {
  const a = from.split(",").map((s) => s.trim()).filter(Boolean)[1] ?? from;
  const b = to.split(",").map((s) => s.trim()).filter(Boolean)[1] ?? to;
  return `${a} → ${b}`;
}
