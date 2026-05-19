import Link from "next/link";
import { Building2, Plus } from "lucide-react";

import { db } from "@/lib/db";
import { AdminPageHero } from "@/components/admin/page-hero";
import { EmptyState } from "@/components/dashboard/empty-state";
import {
  TenantsListClient,
  type AdminTenantRow,
} from "@/components/admin/tenants-list-client";

export const metadata = { title: "Admin · Πελάτες" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

interface PageProps {
  searchParams: Promise<{ q?: string; page?: string }>;
}

export default async function TenantsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const skip = (page - 1) * PAGE_SIZE;

  const where = {
    deletedAt: null,
    ...(q.length > 0
      ? {
          OR: [
            { legalName: { contains: q, mode: "insensitive" as const } },
            { commercialName: { contains: q, mode: "insensitive" as const } },
            { vat: { contains: q } },
            { email: { contains: q, mode: "insensitive" as const } },
            { phone: { contains: q } },
          ],
        }
      : {}),
  };

  const [tenants, total, kpiCounts] = await Promise.all([
    db.tenant.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: PAGE_SIZE,
      include: {
        subscriptions: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { plan: true },
        },
        _count: {
          select: {
            branches: { where: { deletedAt: null } },
            vehicles: { where: { deletedAt: null } },
          },
        },
      },
    }),
    db.tenant.count({ where }),
    db.tenant.groupBy({
      by: ["status"],
      _count: { _all: true },
      where: { deletedAt: null },
    }),
  ]);

  const totalActive =
    kpiCounts.find((k) => k.status === "ACTIVE")?._count._all ?? 0;
  const totalPaused =
    kpiCounts.find((k) => k.status === "PAUSED")?._count._all ?? 0;
  const totalAll = kpiCounts.reduce((s, k) => s + k._count._all, 0);
  const withSubCount = tenants.filter((t) => t.subscriptions[0]).length;

  const rows: AdminTenantRow[] = tenants.map((t) => ({
    id: t.id,
    vat: t.vat,
    legalName: t.legalName,
    commercialName: t.commercialName,
    doyName: t.doyName,
    address: t.address,
    addressNo: t.addressNo,
    postalZip: t.postalZip,
    postalArea: t.postalArea,
    email: t.email,
    phone: t.phone,
    website: t.website,
    status: t.status,
    logoUrl: t.logoUrl,
    createdAt: t.createdAt,
    branchCount: t._count.branches,
    vehicleCount: t._count.vehicles,
    subscription: t.subscriptions[0]
      ? {
          status: t.subscriptions[0].status,
          planName: t.subscriptions[0].plan.name,
          pricePerCycle: t.subscriptions[0].pricePerCycle,
          billingCycle: t.subscriptions[0].billingCycle,
          endsAt: t.subscriptions[0].endsAt,
        }
      : null,
  }));

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <AdminPageHero
        eyebrow="Customer Base"
        title="Πελάτες"
        description="Όλες οι μεταφορικές εταιρείες της πλατφόρμας. Αναζήτηση, προβολή και διαχείριση από ένα μέρος."
        crumbs={[
          { href: "/admin", label: "Admin" },
          { label: "Πελάτες" },
        ]}
        action={
          <Link
            href="/admin/tenants/new"
            className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-gradient-to-r from-[var(--color-brand-blue)] to-[#3B82F6] px-5 text-sm font-bold text-white shadow-[0_6px_20px_rgba(37,99,235,0.25)] hover:from-[var(--color-brand-blue-deep)] hover:to-[var(--color-brand-blue)]"
          >
            <Plus className="size-4" />
            Νέος πελάτης
          </Link>
        }
        kpis={[
          { label: "Σύνολο", value: totalAll },
          {
            label: "Ενεργοί",
            value: totalActive,
            delta: `${Math.round((totalActive / Math.max(1, totalAll)) * 100)}%`,
            deltaTone: "positive",
          },
          { label: "Σε παύση", value: totalPaused, deltaTone: "neutral" },
          {
            label: "Στην σελίδα",
            value: rows.length,
            delta: `${total} matches`,
          },
        ]}
      />
      <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {total === 0 && q.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="Κανένας πελάτης ακόμα"
            description="Πρόσθεσε την πρώτη μεταφορική εταιρεία. Με την αυτόματη αναζήτηση ΑΑΔΕ τα στοιχεία συμπληρώνονται αυτόματα."
            cta={{ label: "Προσθήκη πελάτη", href: "/admin/tenants/new" }}
          />
        ) : (
          <TenantsListClient
            rows={rows}
            page={page}
            totalPages={totalPages}
            total={total}
            initialQuery={q}
            pageSize={PAGE_SIZE}
            withSubCount={withSubCount}
          />
        )}
      </div>
    </>
  );
}
