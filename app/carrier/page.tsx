import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { CarrierDashboardClient } from "@/components/carrier/dashboard-client";

export const metadata = { title: "Πίνακας μεταφορέα" };
export const dynamic = "force-dynamic";

export default async function CarrierOverviewPage() {
  const session = await auth();
  const userId = session!.user.id;

  const membership = await db.tenantMembership.findFirst({
    where: { userId },
    select: { tenantId: true, role: true },
    orderBy: { createdAt: "asc" },
  });

  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setHours(23, 59, 59, 999);
  const startOfWeek = new Date(startOfDay);
  startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay() + 1); // Monday
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);
  const startOfPrev7d = new Date(now.getTime() - 7 * 86400000);
  const startOfPrev30d = new Date(now.getTime() - 30 * 86400000);
  const startOfPrev60d = new Date(now.getTime() - 60 * 86400000);
  const expiringSoon = new Date(now.getTime() + 48 * 3600 * 1000);
  const tenantId = membership?.tenantId ?? null;

  const [
    openLeadsCount,
    openOffersCount,
    activeProjects,
    completedProjects,
    payments30d,
    paymentsPrev30d,
    paymentsAllTime,
    reviewsAgg,
    expiringOffers,
    recentLeads,
    recentOffers,
    pendingConfirmTasks,
    declinedTasks,
    todaysTasks,
    weekTasks,
    pendingQuoteCampaigns,
    employeeWorkload,
    fleetCount,
    employeesCount,
    partnersCount,
  ] = await Promise.all([
    db.moveRequest.count({
      where: {
        status: "PUBLISHED",
        offers: { none: { carrierUserId: userId } },
      },
    }),
    db.offer.count({ where: { carrierUserId: userId, status: "OPEN" } }),
    tenantId
      ? db.carrierProject.findMany({
          where: {
            tenantId,
            status: { in: ["PLANNED", "IN_PROGRESS", "DRAFT"] },
          },
          orderBy: { scheduledStart: "asc" },
          take: 8,
          select: {
            id: true,
            code: true,
            status: true,
            scheduledStart: true,
            totalPriceCents: true,
            moveRequest: {
              select: {
                fromAddress: true,
                toAddress: true,
                user: { select: { name: true, email: true } },
              },
            },
            stops: { select: { id: true } },
          },
        })
      : Promise.resolve([]),
    tenantId
      ? db.carrierProject.count({
          where: { tenantId, status: "COMPLETED" },
        })
      : Promise.resolve(0),
    db.payment.aggregate({
      _sum: { amountCents: true },
      where: {
        status: "CAPTURED",
        offer: { carrierUserId: userId },
        createdAt: { gte: startOfPrev30d },
      },
    }),
    db.payment.aggregate({
      _sum: { amountCents: true },
      where: {
        status: "CAPTURED",
        offer: { carrierUserId: userId },
        createdAt: { gte: startOfPrev60d, lt: startOfPrev30d },
      },
    }),
    db.payment.aggregate({
      _sum: { amountCents: true },
      where: { status: "CAPTURED", offer: { carrierUserId: userId } },
    }),
    db.review.aggregate({
      _avg: { rating: true },
      _count: { _all: true },
      where: { carrierUserId: userId },
    }),
    db.offer.findMany({
      where: {
        carrierUserId: userId,
        status: "OPEN",
        validUntil: { lte: expiringSoon, gte: now },
      },
      orderBy: { validUntil: "asc" },
      take: 5,
      include: {
        moveRequest: {
          select: { id: true, fromAddress: true, toAddress: true },
        },
      },
    }),
    db.moveRequest.findMany({
      where: {
        status: "PUBLISHED",
        offers: { none: { carrierUserId: userId } },
      },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        fromAddress: true,
        toAddress: true,
        createdAt: true,
        type: true,
        itemsCount: true,
        totalVolumeM3: true,
        preferredDate: true,
        estimatedPriceMinCents: true,
        estimatedPriceMaxCents: true,
      },
    }),
    db.offer.findMany({
      where: { carrierUserId: userId, status: "OPEN" },
      orderBy: { validUntil: "asc" },
      take: 6,
      include: {
        moveRequest: {
          select: { id: true, fromAddress: true, toAddress: true },
        },
      },
    }),
    tenantId
      ? db.jobTask.findMany({
          where: {
            tenantId,
            assigneeConfirmationStatus: "PENDING",
          },
          orderBy: { startAt: "asc" },
          take: 10,
          select: {
            id: true,
            title: true,
            startAt: true,
            durationMinutes: true,
            assigneeConfirmationSentAt: true,
            assigneeEmployee: { select: { name: true } },
            assigneePartner: { select: { name: true } },
            projectStopService: {
              select: {
                projectStop: {
                  select: {
                    project: { select: { id: true, code: true } },
                  },
                },
              },
            },
          },
        })
      : Promise.resolve([]),
    tenantId
      ? db.jobTask.findMany({
          where: {
            tenantId,
            assigneeConfirmationStatus: "DECLINED",
            status: { notIn: ["CANCELLED", "DONE"] },
          },
          orderBy: { startAt: "asc" },
          take: 10,
          select: {
            id: true,
            title: true,
            startAt: true,
            durationMinutes: true,
            assigneeDeclineReason: true,
            assigneeEmployee: { select: { name: true } },
            assigneePartner: { select: { name: true } },
            projectStopService: {
              select: {
                projectStop: {
                  select: {
                    project: { select: { id: true, code: true } },
                  },
                },
              },
            },
          },
        })
      : Promise.resolve([]),
    tenantId
      ? db.jobTask.findMany({
          where: {
            tenantId,
            startAt: { gte: startOfDay, lte: endOfDay },
            status: { notIn: ["CANCELLED"] },
          },
          orderBy: { startAt: "asc" },
          take: 50,
          select: {
            id: true,
            title: true,
            startAt: true,
            durationMinutes: true,
            status: true,
            assigneeKind: true,
            assigneeConfirmationStatus: true,
            assigneeEmployee: { select: { name: true } },
            assigneePartner: { select: { name: true } },
            projectStopService: {
              select: {
                serviceType: true,
                projectStop: {
                  select: {
                    address: true,
                    project: { select: { id: true, code: true } },
                  },
                },
              },
            },
          },
        })
      : Promise.resolve([]),
    tenantId
      ? db.jobTask.findMany({
          where: {
            tenantId,
            startAt: { gte: startOfWeek, lt: endOfWeek },
            status: { notIn: ["CANCELLED"] },
          },
          orderBy: { startAt: "asc" },
          select: {
            id: true,
            title: true,
            startAt: true,
            durationMinutes: true,
            status: true,
            assigneeEmployee: { select: { id: true, name: true } },
            assigneePartner: { select: { id: true, name: true } },
            projectStopService: {
              select: {
                serviceType: true,
                projectStop: {
                  select: { project: { select: { id: true, code: true } } },
                },
              },
            },
          },
        })
      : Promise.resolve([]),
    tenantId
      ? db.partnerQuoteRequest.findMany({
          where: {
            tenantId,
            projectStopServiceId: { not: null },
            status: { in: ["PENDING", "QUOTED"] },
          },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            status: true,
            recipientName: true,
            quotedPriceCents: true,
            createdAt: true,
            scheduledStartAt: true,
            partner: { select: { name: true } },
            projectStopService: {
              select: {
                serviceType: true,
                projectStop: {
                  select: {
                    project: { select: { id: true, code: true } },
                  },
                },
              },
            },
          },
        })
      : Promise.resolve([]),
    tenantId
      ? db.carrierEmployee.findMany({
          where: { tenantId, deletedAt: null, active: true },
          select: {
            id: true,
            name: true,
            role: true,
            _count: {
              select: {
                jobTasks: {
                  where: {
                    startAt: { gte: startOfWeek, lt: endOfWeek },
                    status: { notIn: ["CANCELLED"] },
                  },
                },
              },
            },
          },
        })
      : Promise.resolve([]),
    tenantId
      ? db.vehicle.count({ where: { tenantId, deletedAt: null } })
      : Promise.resolve(0),
    tenantId
      ? db.carrierEmployee.count({
          where: { tenantId, deletedAt: null, active: true },
        })
      : Promise.resolve(0),
    tenantId
      ? db.carrierPartner.count({
          where: { tenantId, deletedAt: null },
        })
      : Promise.resolve(0),
  ]);

  const [recentNotifications, unreadNotifications] = tenantId
    ? await Promise.all([
        db.notification.findMany({
          where: { tenantId, status: { not: "ARCHIVED" } },
          orderBy: { createdAt: "desc" },
          take: 30,
          select: {
            id: true, type: true, severity: true, status: true,
            title: true, body: true, href: true, createdAt: true,
          },
        }),
        db.notification.count({
          where: { tenantId, status: "UNREAD" },
        }),
      ])
    : [[], 0] as const;

  const revenue30d = (payments30d._sum.amountCents ?? 0) / 100;
  const revenuePrev30d = (paymentsPrev30d._sum.amountCents ?? 0) / 100;
  const revenueAllTime = (paymentsAllTime._sum.amountCents ?? 0) / 100;
  const revenueDeltaPct =
    revenuePrev30d > 0
      ? ((revenue30d - revenuePrev30d) / revenuePrev30d) * 100
      : revenue30d > 0
        ? 100
        : 0;
  const avgRating = reviewsAgg._avg.rating ?? 0;
  const reviewCount = reviewsAgg._count._all ?? 0;
  const firstName =
    (session!.user.name ?? session!.user.email ?? "").split(/[\s@]/)[0] || "";

  return (
    <CarrierDashboardClient
      firstName={firstName}
      hasMembership={!!membership}
      kpis={{
        openLeads: openLeadsCount,
        openOffers: openOffersCount,
        activeProjectsCount: activeProjects.length,
        completedProjects,
        revenue30d,
        revenuePrev30d,
        revenueAllTime,
        revenueDeltaPct,
        avgRating,
        reviewCount,
        fleetCount,
        employeesCount,
        partnersCount,
      }}
      pendingConfirmTasks={pendingConfirmTasks.map((t) => ({
        id: t.id,
        title: t.title,
        startAt: t.startAt.toISOString(),
        durationMinutes: t.durationMinutes,
        assigneeName: t.assigneeEmployee?.name ?? t.assigneePartner?.name ?? "—",
        sentAt: t.assigneeConfirmationSentAt?.toISOString() ?? null,
        projectId: t.projectStopService?.projectStop.project.id ?? null,
        projectCode: t.projectStopService?.projectStop.project.code ?? null,
      }))}
      declinedTasks={declinedTasks.map((t) => ({
        id: t.id,
        title: t.title,
        startAt: t.startAt.toISOString(),
        assigneeName: t.assigneeEmployee?.name ?? t.assigneePartner?.name ?? "—",
        reason: t.assigneeDeclineReason,
        projectId: t.projectStopService?.projectStop.project.id ?? null,
        projectCode: t.projectStopService?.projectStop.project.code ?? null,
      }))}
      expiringOffers={expiringOffers.map((o) => ({
        id: o.id,
        moveRequestId: o.moveRequestId,
        priceCents: o.priceCents,
        validUntil: o.validUntil.toISOString(),
        route: `${o.moveRequest.fromAddress} → ${o.moveRequest.toAddress}`,
      }))}
      todaysTasks={todaysTasks.map((t) => ({
        id: t.id,
        title: t.title,
        startAt: t.startAt.toISOString(),
        durationMinutes: t.durationMinutes,
        status: t.status,
        confirmStatus: t.assigneeConfirmationStatus,
        assigneeName: t.assigneeEmployee?.name ?? t.assigneePartner?.name ?? null,
        serviceType: t.projectStopService?.serviceType ?? "OTHER",
        address: t.projectStopService?.projectStop.address ?? "",
        projectId: t.projectStopService?.projectStop.project.id ?? null,
        projectCode: t.projectStopService?.projectStop.project.code ?? null,
      }))}
      weekTasks={weekTasks.map((t) => ({
        id: t.id,
        title: t.title,
        startAt: t.startAt.toISOString(),
        durationMinutes: t.durationMinutes,
        status: t.status,
        assigneeEmployeeId: t.assigneeEmployee?.id ?? null,
        assigneePartnerId: t.assigneePartner?.id ?? null,
        assigneeName: t.assigneeEmployee?.name ?? t.assigneePartner?.name ?? null,
        serviceType: t.projectStopService?.serviceType ?? "OTHER",
        projectId: t.projectStopService?.projectStop.project.id ?? null,
        projectCode: t.projectStopService?.projectStop.project.code ?? null,
      }))}
      activeProjects={activeProjects.map((p) => ({
        id: p.id,
        code: p.code,
        status: p.status,
        scheduledStart: p.scheduledStart.toISOString(),
        totalPriceCents: p.totalPriceCents,
        route: `${p.moveRequest.fromAddress} → ${p.moveRequest.toAddress}`,
        customer: p.moveRequest.user.name ?? p.moveRequest.user.email ?? "—",
        stopsCount: p.stops.length,
      }))}
      pendingQuoteCampaigns={pendingQuoteCampaigns.map((q) => ({
        id: q.id,
        status: q.status as "PENDING" | "QUOTED",
        partnerName: q.partner?.name ?? q.recipientName ?? "—",
        serviceType: q.projectStopService?.serviceType ?? "OTHER",
        quotedPriceCents: q.quotedPriceCents,
        createdAt: q.createdAt.toISOString(),
        scheduledStartAt: q.scheduledStartAt?.toISOString() ?? null,
        projectId: q.projectStopService?.projectStop.project.id ?? null,
        projectCode: q.projectStopService?.projectStop.project.code ?? null,
      }))}
      recentLeads={recentLeads.map((l) => ({
        id: l.id,
        fromAddress: l.fromAddress,
        toAddress: l.toAddress,
        createdAt: l.createdAt.toISOString(),
        type: l.type,
        itemsCount: l.itemsCount,
        volumeM3: l.totalVolumeM3,
        preferredDate: l.preferredDate?.toISOString() ?? null,
        estimatedPriceMinCents: l.estimatedPriceMinCents,
        estimatedPriceMaxCents: l.estimatedPriceMaxCents,
      }))}
      myOpenOffers={recentOffers.map((o) => ({
        id: o.id,
        moveRequestId: o.moveRequestId,
        priceCents: o.priceCents,
        validUntil: o.validUntil.toISOString(),
        route: `${o.moveRequest.fromAddress} → ${o.moveRequest.toAddress}`,
        createdAt: o.createdAt.toISOString(),
      }))}
      employeeWorkload={employeeWorkload.map((e) => ({
        id: e.id,
        name: e.name,
        role: e.role,
        weekTaskCount: e._count.jobTasks,
      }))}
      notifications={recentNotifications.map((n) => ({
        id: n.id,
        type: n.type,
        severity: n.severity,
        status: n.status,
        title: n.title,
        body: n.body,
        href: n.href,
        createdAt: n.createdAt.toISOString(),
      }))}
      unreadNotifications={unreadNotifications}
    />
  );
}
