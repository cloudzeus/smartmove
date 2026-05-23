import { Users } from "lucide-react";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHero } from "@/components/shared/page-hero";
import { EmptyState } from "@/components/dashboard/empty-state";
import { EmployeesClient } from "@/components/carrier/employees-client";

export const metadata = { title: "Υπάλληλοι" };
export const dynamic = "force-dynamic";

export default async function CarrierEmployeesPage() {
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
        <PageHero title="Υπάλληλοι" eyebrow="Ομάδα" />
        <div className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
          <EmptyState
            icon={Users}
            title="Δεν είσαι μέλος εταιρείας"
            description="Πρέπει να ανήκεις σε εταιρεία μεταφορέα για να διαχειριστείς υπαλλήλους."
          />
        </div>
      </>
    );
  }

  const employees = await db.carrierEmployee.findMany({
    where: { tenantId: membership.tenantId, deletedAt: null },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });

  const counts = {
    total: employees.length,
    active: employees.filter((e) => e.active).length,
    drivers: employees.filter((e) => e.role === "DRIVER").length,
  };

  return (
    <>
      <PageHero
        eyebrow="Ομάδα"
        title="Υπάλληλοι"
        description="Καταχώρισε τους υπαλλήλους της εταιρείας σου — οδηγούς, βοηθούς, packers — με στοιχεία επικοινωνίας."
        crumbs={[
          { href: "/carrier", label: "Επισκόπηση" },
          { label: "Υπάλληλοι" },
        ]}
        tone="blue"
        kpis={[
          { label: "Σύνολο", value: counts.total },
          { label: "Ενεργοί", value: counts.active, deltaTone: "positive" },
          { label: "Οδηγοί", value: counts.drivers },
          {
            label: "Άλλες ειδικότητες",
            value: counts.total - counts.drivers,
          },
        ]}
      />
      <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <EmployeesClient employees={employees} />
      </div>
    </>
  );
}
