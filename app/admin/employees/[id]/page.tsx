import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmployeeDetailClient } from "@/components/admin/employee-detail-client";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EmployeeDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await auth();
  if (
    !session?.user ||
    !hasPermission(
      { role: session.user.role, permissions: session.user.permissions },
      "employees:read",
    )
  ) {
    // employees:read isn't strictly required here for SUPERADMIN, but let
    // hasPermission do the lift (returns true for SUPERADMIN automatically)
    redirect("/admin");
  }

  const employee = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      role: true,
      active: true,
      permissions: true,
      createdAt: true,
      updatedAt: true,
      invitedAt: true,
      invitedById: true,
    },
  });

  if (
    !employee ||
    (employee.role !== "EMPLOYEE" && employee.role !== "SUPERADMIN")
  ) {
    notFound();
  }

  const inviter = employee.invitedById
    ? await db.user.findUnique({
        where: { id: employee.invitedById },
        select: { name: true, email: true },
      })
    : null;

  return (
    <>
      <PageHeader
        title={employee.name ?? employee.email}
        description={`${employee.email} · ${employee.role}`}
        crumbs={[
          { href: "/admin", label: "Admin" },
          { href: "/admin/employees", label: "Υπάλληλοι" },
          { label: employee.name ?? "Υπάλληλος" },
        ]}
        action={
          <Link
            href="/admin/employees"
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-secondary"
          >
            <ArrowLeft className="size-4" />
            Επιστροφή
          </Link>
        }
      />
      <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <EmployeeDetailClient
          employee={employee}
          actorRole={session.user.role}
          actorId={session.user.id}
          inviter={inviter}
        />
      </div>
    </>
  );
}
