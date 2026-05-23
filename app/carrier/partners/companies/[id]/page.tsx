import { notFound } from "next/navigation";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHero } from "@/components/shared/page-hero";
import { PartnerCompanyDetailClient } from "@/components/carrier/partner-company-detail-client";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PartnerCompanyDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await auth();
  const userId = session!.user.id;
  const membership = await db.tenantMembership.findFirst({
    where: { userId },
    select: { tenantId: true },
    orderBy: { createdAt: "asc" },
  });
  if (!membership) notFound();

  const company = await db.partnerCompany.findFirst({
    where: { id, tenantId: membership.tenantId, deletedAt: null },
    include: {
      contacts: {
        where: { deletedAt: null },
        orderBy: { name: "asc" },
      },
      partners: {
        where: { deletedAt: null },
        orderBy: { name: "asc" },
      },
    },
  });
  if (!company) notFound();

  return (
    <>
      <PageHero
        eyebrow="Εταιρεία συνεργάτη"
        title={company.commercialName ?? company.legalName}
        description={`ΑΦΜ ${company.vat}${company.doyName ? ` · ${company.doyName}` : ""}`}
        crumbs={[
          { href: "/carrier", label: "Επισκόπηση" },
          { href: "/carrier/partners", label: "Συνεργάτες" },
          { label: company.commercialName ?? company.legalName },
        ]}
        tone="amber"
        kpis={[
          { label: "Επαφές", value: company.contacts.length },
          { label: "Συνδεδεμένοι συνεργάτες", value: company.partners.length },
          {
            label: "Τηλέφωνο",
            value: company.phone ?? "—",
          },
          { label: "Email", value: company.email ?? "—" },
        ]}
      />
      <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <PartnerCompanyDetailClient
          company={{
            id: company.id,
            vat: company.vat,
            legalName: company.legalName,
            commercialName: company.commercialName,
            doyName: company.doyName,
            legalStatus: company.legalStatus,
            address: company.address,
            addressNo: company.addressNo,
            postalZip: company.postalZip,
            postalArea: company.postalArea,
            email: company.email,
            phone: company.phone,
            website: company.website,
            notes: company.notes,
          }}
          contacts={company.contacts.map((c) => ({
            id: c.id,
            name: c.name,
            role: c.role,
            phone: c.phone,
            email: c.email,
            notes: c.notes,
          }))}
          partners={company.partners.map((p) => ({
            id: p.id,
            name: p.name,
            kind: p.kind,
          }))}
        />
      </div>
    </>
  );
}
