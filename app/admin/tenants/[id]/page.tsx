import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2 } from "lucide-react";

import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { PageHeader } from "@/components/dashboard/page-header";
import { TenantDetailClient } from "@/components/admin/tenant-detail-client";
import { SetPasswordButton } from "@/components/admin/set-password-button";
import { SendOtpButton } from "@/components/admin/send-otp-button";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TenantDetailPage({ params }: PageProps) {
  const { id } = await params;
  const tenant = await db.tenant.findUnique({
    where: { id },
    include: {
      branches: {
        where: { deletedAt: null },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      },
      vehicles: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
      },
      subscriptions: {
        orderBy: { createdAt: "desc" },
        include: { plan: true },
      },
    },
  });

  if (!tenant || tenant.deletedAt) notFound();

  const plans = await db.subscriptionPlan.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return (
    <>
      <PageHeader
        title={tenant.commercialName ?? tenant.legalName}
        description={`ΑΦΜ ${tenant.vat} · ${tenant.doyName ?? "—"}`}
        crumbs={[
          { href: "/admin", label: "Admin" },
          { href: "/admin/tenants", label: "Πελάτες" },
          { label: tenant.legalName },
        ]}
        action={
          <div className="flex items-center gap-3">
            {tenant.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={tenant.logoUrl}
                alt={tenant.legalName}
                className="size-12 rounded-xl border border-border bg-card object-contain p-1"
              />
            ) : (
              <span className="grid size-12 place-items-center rounded-xl bg-[var(--color-brand-blue-light)] text-[var(--color-brand-blue-deep)]">
                <Building2 className="size-6" />
              </span>
            )}
            <SendOtpButton tenantId={tenant.id} size="md" />
            <SetPasswordButton tenantId={tenant.id} size="md" />
            <Link
              href={`/admin/tenants/${tenant.id}/edit`}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-foreground px-4 text-sm font-bold text-background hover:bg-foreground/90"
            >
              Επεξεργασία
            </Link>
            <Link
              href="/admin/tenants"
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-secondary"
            >
              <ArrowLeft className="size-4" />
              Επιστροφή
            </Link>
          </div>
        }
      />
      <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <TenantDetailClient
          tenant={tenant}
          branches={tenant.branches}
          vehicles={tenant.vehicles}
          subscriptions={tenant.subscriptions}
          plans={plans}
          maptilerApiKey={env.maptilerApiKey()}
        />
      </div>
    </>
  );
}
