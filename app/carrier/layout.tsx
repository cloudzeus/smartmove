import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requireAcceptedTerms } from "@/lib/terms";
import {
  CarrierBottomNav,
  CarrierSidebar,
  type Badges,
} from "@/components/carrier/sidebar";
import { CarrierCommandPalette } from "@/components/carrier/command-palette";

export default async function CarrierLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in?next=/carrier");
  }

  const role = session.user.role;
  const allowed =
    role === "TENANTADMIN" ||
    role === "TENANTEMPLOYEE" ||
    role === "EMPLOYEE" ||
    role === "SUPERADMIN";

  if (!allowed) {
    redirect("/dashboard");
  }

  await requireAcceptedTerms("/carrier");

  const userId = session.user.id;

  const [membership, newLeads, openOffers, activeJobs, pendingReviews] =
    await Promise.all([
      db.tenantMembership.findFirst({
        where: { userId },
        include: { tenant: { select: { legalName: true, commercialName: true } } },
        orderBy: { createdAt: "asc" },
      }),
      // Available leads (PUBLISHED requests where the carrier hasn't offered yet)
      db.moveRequest.count({
        where: {
          status: "PUBLISHED",
          offers: { none: { carrierUserId: userId } },
        },
      }),
      db.offer.count({
        where: { carrierUserId: userId, status: "OPEN" },
      }),
      db.moveRequest.count({
        where: {
          status: "AWARDED",
          offers: { some: { carrierUserId: userId, status: "ACCEPTED" } },
        },
      }),
      // Reviews the carrier hasn't responded to (placeholder: total reviews
      // received — we surface them so the carrier can read them).
      db.review.count({ where: { carrierUserId: userId } }),
    ]);

  const badges: Badges = {
    newLeads,
    openOffers,
    activeJobs,
    pendingReviews,
  };

  return (
    <div className="carrier-shell flex min-h-screen bg-background">
      <CarrierSidebar
        user={{
          name: session.user.name,
          email: session.user.email,
          role,
        }}
        tenantName={
          membership?.tenant
            ? membership.tenant.commercialName ?? membership.tenant.legalName
            : null
        }
        canAccessAdmin={role === "SUPERADMIN" || role === "EMPLOYEE"}
        badges={badges}
      />
      <div className="flex min-w-0 flex-1 flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0">
        {children}
      </div>
      <CarrierBottomNav badges={badges} />
      <CarrierCommandPalette />
    </div>
  );
}
