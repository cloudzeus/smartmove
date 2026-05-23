import { Handshake } from "lucide-react";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHero } from "@/components/shared/page-hero";
import { EmptyState } from "@/components/dashboard/empty-state";
import { PartnersClient } from "@/components/carrier/partners-client";

export const metadata = { title: "Συνεργάτες" };
export const dynamic = "force-dynamic";

export default async function CarrierPartnersPage() {
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
        <PageHero title="Συνεργάτες" eyebrow="Δίκτυο" />
        <div className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
          <EmptyState
            icon={Handshake}
            title="Δεν είσαι μέλος εταιρείας"
            description="Πρέπει να ανήκεις σε εταιρεία μεταφορέα."
          />
        </div>
      </>
    );
  }

  const [partners, companies] = await Promise.all([
    db.carrierPartner.findMany({
      where: { tenantId: membership.tenantId, deletedAt: null },
      orderBy: { name: "asc" },
      include: {
        company: {
          select: {
            id: true,
            legalName: true,
            commercialName: true,
            vat: true,
          },
        },
      },
    }),
    db.partnerCompany.findMany({
      where: { tenantId: membership.tenantId, deletedAt: null },
      orderBy: { legalName: "asc" },
      include: {
        _count: { select: { partners: { where: { deletedAt: null } } } },
      },
    }),
  ]);

  return (
    <>
      <PageHero
        eyebrow="Δίκτυο"
        title="Συνεργάτες"
        description="Οι εξωτερικοί συνεργάτες σου — μεταφορείς, γερανοί, packers, συντηρητές. Καταχώρισε ατομικά πρόσωπα ή ολόκληρες εταιρείες με ΑΦΜ."
        crumbs={[
          { href: "/carrier", label: "Επισκόπηση" },
          { label: "Συνεργάτες" },
        ]}
        tone="amber"
        kpis={[
          { label: "Πρόσωπα", value: partners.length },
          { label: "Εταιρείες", value: companies.length },
          {
            label: "Μεταφορείς",
            value: partners.filter((p) => p.kind === "TRANSPORTER").length,
          },
          {
            label: "Άλλες ειδικότητες",
            value: partners.filter((p) => p.kind !== "TRANSPORTER").length,
          },
        ]}
      />
      <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <PartnersClient
          partners={partners.map((p) => ({
            id: p.id,
            name: p.name,
            kind: p.kind,
            phone: p.phone,
            email: p.email,
            notes: p.notes,
            company: p.company
              ? {
                  id: p.company.id,
                  name: p.company.commercialName ?? p.company.legalName,
                  vat: p.company.vat,
                }
              : null,
          }))}
          companies={companies.map((c) => ({
            id: c.id,
            vat: c.vat,
            legalName: c.legalName,
            commercialName: c.commercialName,
            doyName: c.doyName,
            phone: c.phone,
            email: c.email,
            partnersCount: c._count.partners,
          }))}
        />
      </div>
    </>
  );
}
