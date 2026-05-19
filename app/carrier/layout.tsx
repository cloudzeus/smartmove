import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requireAcceptedTerms } from "@/lib/terms";
import { CarrierSidebar } from "@/components/carrier/sidebar";

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

  const membership = await db.tenantMembership.findFirst({
    where: { userId: session.user.id },
    include: { tenant: { select: { legalName: true, commercialName: true } } },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="flex min-h-screen bg-background">
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
      />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
