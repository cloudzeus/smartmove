import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { AdminPageHero } from "@/components/admin/page-hero";
import {
  TenantForm,
  type TenantFormValues,
} from "@/components/admin/tenant-form";

export const metadata = { title: "Admin · Επεξεργασία πελάτη" };
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditTenantPage({ params }: PageProps) {
  const { id } = await params;
  const t = await db.tenant.findUnique({ where: { id } });
  if (!t || t.deletedAt) notFound();

  const initial: TenantFormValues = {
    id: t.id,
    vat: t.vat,
    legalName: t.legalName,
    commercialName: t.commercialName ?? undefined,
    doyCode: t.doyCode ?? undefined,
    doyName: t.doyName ?? undefined,
    legalStatus: t.legalStatus ?? undefined,
    legalStatusKind: t.legalStatusKind ?? undefined,
    vatSystemFlag: t.vatSystemFlag ?? undefined,
    registeredAt: t.registeredAt ? t.registeredAt.toISOString() : undefined,
    address: t.address ?? undefined,
    addressNo: t.addressNo ?? undefined,
    postalZip: t.postalZip ?? undefined,
    postalArea: t.postalArea ?? undefined,
    email: t.email ?? undefined,
    phone: t.phone ?? undefined,
    website: t.website ?? undefined,
    status: t.status,
    logoUrl: t.logoUrl ?? null,
    notes: t.notes ?? undefined,
  };

  return (
    <>
      <AdminPageHero
        eyebrow="Edit"
        title={t.commercialName ?? t.legalName}
        description="Επεξεργασία στοιχείων πελάτη. Οι αλλαγές αποθηκεύονται αμέσως."
        crumbs={[
          { href: "/admin", label: "Admin" },
          { href: "/admin/tenants", label: "Πελάτες" },
          { href: `/admin/tenants/${t.id}`, label: t.legalName },
          { label: "Επεξεργασία" },
        ]}
      />
      <div className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
        <TenantForm initial={initial} />
      </div>
    </>
  );
}
