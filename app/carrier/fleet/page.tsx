import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHero } from "@/components/shared/page-hero";
import { CarrierFleetClient } from "@/components/carrier/fleet-client";

export const metadata = { title: "Στόλος" };
export const dynamic = "force-dynamic";

export default async function CarrierFleetPage() {
  const session = await auth();
  const userId = session!.user.id;

  const adminMembership = await db.tenantMembership.findFirst({
    where: { userId },
    select: { tenantId: true, role: true },
    orderBy: { createdAt: "asc" },
  });
  if (!adminMembership) redirect("/carrier");

  const [tenant, vehicles, branches, sub] = await Promise.all([
    db.tenant.findUnique({
      where: { id: adminMembership.tenantId },
      select: { id: true, legalName: true, commercialName: true },
    }),
    db.vehicle.findMany({
      where: {
        tenantId: adminMembership.tenantId,
        deletedAt: null,
      },
      orderBy: [{ status: "asc" }, { plate: "asc" }],
      include: {
        branch: { select: { id: true, legalName: true } },
      },
    }),
    db.branch.findMany({
      where: { tenantId: adminMembership.tenantId, deletedAt: null },
      orderBy: [{ isPrimary: "desc" }, { legalName: "asc" }],
      select: { id: true, legalName: true },
    }),
    db.subscription.findFirst({
      where: {
        tenantId: adminMembership.tenantId,
        status: { in: ["TRIAL", "ACTIVE"] },
      },
      orderBy: { startsAt: "desc" },
      select: {
        maxVehicles: true,
        plan: { select: { maxVehicles: true } },
      },
    }),
  ]);

  if (!tenant) redirect("/carrier");

  const maxVehicles = sub?.maxVehicles ?? sub?.plan.maxVehicles ?? null;
  const canEdit =
    adminMembership.role === "OWNER" || adminMembership.role === "ADMIN";
  const activeCount = vehicles.filter((v) => v.status === "ACTIVE").length;
  const withPricing = vehicles.filter((v) => v.costPerKmCents > 0).length;

  const items = vehicles.map((v) => ({
    id: v.id,
    plate: v.plate,
    brand: v.brand,
    model: v.model,
    year: v.year,
    vehicleType: v.vehicleType,
    capacityKg: v.capacityKg,
    capacityM3: v.capacityM3,
    fuelType: v.fuelType,
    color: v.color,
    branchId: v.branchId,
    branchName: v.branch?.legalName ?? null,
    status: v.status,
    insuranceExpiresAt: v.insuranceExpiresAt
      ? v.insuranceExpiresAt.toISOString()
      : null,
    ktoExpiresAt: v.ktoExpiresAt ? v.ktoExpiresAt.toISOString() : null,
    photoUrl: v.photoUrl,
    registrationDocUrl: v.registrationDocUrl,
    baseAddress: v.baseAddress,
    baseLat: v.baseLat,
    baseLng: v.baseLng,
    costPerKmCents: v.costPerKmCents,
    minTripCents: v.minTripCents,
    callOutCents: v.callOutCents,
  }));

  return (
    <>
      <PageHero
        eyebrow="Carrier"
        title="Στόλος"
        description="Διαχείριση οχημάτων. Όρισε βάση και κόστος/χλμ ώστε να υπολογίζονται αυτόματα οι προτεινόμενες τιμές προσφοράς."
        crumbs={[
          { href: "/carrier", label: "Επισκόπηση" },
          { label: "Στόλος" },
        ]}
        kpis={[
          { label: "Σύνολο", value: items.length },
          { label: "Ενεργά", value: activeCount, deltaTone: "positive" },
          {
            label: "Με τιμολόγηση",
            value: withPricing,
            delta: `${Math.round((withPricing / Math.max(1, items.length)) * 100)}%`,
            deltaTone: withPricing === items.length ? "positive" : "neutral",
          },
          {
            label: "Όριο πακέτου",
            value: maxVehicles ?? "∞",
            deltaTone:
              maxVehicles != null && items.length >= maxVehicles
                ? "negative"
                : "positive",
          },
        ]}
      />
      <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <CarrierFleetClient
          tenantId={tenant.id}
          vehicles={items}
          branches={branches}
          canEdit={canEdit}
          atCap={maxVehicles != null && items.length >= maxVehicles}
          maxVehicles={maxVehicles}
        />
      </div>
    </>
  );
}
