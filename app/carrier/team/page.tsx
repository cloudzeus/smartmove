import { redirect } from "next/navigation";
import { Users } from "lucide-react";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHero } from "@/components/shared/page-hero";
import { CarrierTeamClient } from "@/components/carrier/team-client";

export const metadata = { title: "Ομάδα" };
export const dynamic = "force-dynamic";

export default async function CarrierTeamPage() {
  const session = await auth();
  const userId = session!.user.id;

  // Find the tenant where the user is OWNER/ADMIN.
  const adminMembership = await db.tenantMembership.findFirst({
    where: { userId, role: { in: ["OWNER", "ADMIN"] } },
    select: { tenantId: true, role: true },
  });

  if (!adminMembership) {
    redirect("/carrier");
  }

  const [tenant, memberships, sub] = await Promise.all([
    db.tenant.findUnique({
      where: { id: adminMembership.tenantId },
      select: { id: true, legalName: true, commercialName: true },
    }),
    db.tenantMembership.findMany({
      where: { tenantId: adminMembership.tenantId },
      orderBy: { createdAt: "asc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            active: true,
            createdAt: true,
            invitedAt: true,
          },
        },
        branch: { select: { id: true, legalName: true } },
      },
    }),
    db.subscription.findFirst({
      where: {
        tenantId: adminMembership.tenantId,
        status: { in: ["TRIAL", "ACTIVE"] },
      },
      orderBy: { startsAt: "desc" },
      select: {
        maxEmployees: true,
        plan: { select: { maxEmployees: true, name: true } },
      },
    }),
  ]);

  if (!tenant) redirect("/carrier");

  const maxEmployees =
    sub?.maxEmployees ?? sub?.plan.maxEmployees ?? null;
  const planName = sub?.plan.name ?? null;

  const items = memberships.map((m) => ({
    membershipId: m.id,
    userId: m.user.id,
    name: m.user.name,
    email: m.user.email,
    role: m.role,
    userRole: m.user.role,
    active: m.user.active,
    branchName: m.branch?.legalName ?? null,
    invitedAt: m.user.invitedAt,
    isSelf: m.user.id === userId,
  }));

  return (
    <>
      <PageHero
        eyebrow="Carrier"
        title="Ομάδα"
        description="Διαχείριση χρηστών της εταιρείας σου. Πρόσκληση νέων μελών και αποστολή νέου OTP."
        crumbs={[
          { href: "/carrier", label: "Επισκόπηση" },
          { label: "Ομάδα" },
        ]}
        kpis={[
          { label: "Μέλη", value: items.length },
          {
            label: "Όριο πακέτου",
            value: maxEmployees ?? "∞",
            delta: planName ?? undefined,
          },
          {
            label: "Διαθέσιμες θέσεις",
            value:
              maxEmployees != null
                ? Math.max(0, maxEmployees - items.length)
                : "∞",
            deltaTone:
              maxEmployees != null && items.length >= maxEmployees
                ? "negative"
                : "positive",
          },
        ]}
      />
      <div className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <CarrierTeamClient
          items={items}
          maxEmployees={maxEmployees}
        />
      </div>
    </>
  );
}
