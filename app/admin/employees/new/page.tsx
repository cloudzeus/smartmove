import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmployeeCreateForm } from "@/components/admin/employee-create-form";
import { hasPermission } from "@/lib/permissions";

export const metadata = { title: "Admin · Νέος υπάλληλος" };

export default async function NewEmployeePage() {
  const session = await auth();
  if (
    !session?.user ||
    !hasPermission(
      { role: session.user.role, permissions: session.user.permissions },
      "employees:write",
    )
  ) {
    redirect("/admin");
  }

  return (
    <>
      <PageHeader
        title="Νέος υπάλληλος"
        description="Δημιουργία λογαριασμού Employee ή SuperAdmin με συγκεκριμένα δικαιώματα."
        crumbs={[
          { href: "/admin", label: "Admin" },
          { href: "/admin/employees", label: "Υπάλληλοι" },
          { label: "Νέος" },
        ]}
      />
      <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <EmployeeCreateForm actorRole={session.user.role} />
      </div>
    </>
  );
}
