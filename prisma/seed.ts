import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL missing — cannot seed.");
  }

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const db = new PrismaClient({ adapter });

  const superadminEmail = "gkozyris@i4ria.com";
  const superadminPassword = "1f1femsk";
  const passwordHash = await bcrypt.hash(superadminPassword, 12);

  const superadmin = await db.user.upsert({
    where: { email: superadminEmail },
    update: {
      role: "SUPERADMIN",
      passwordHash,
      name: "Γιώργος Κοζύρης",
      emailVerified: new Date(),
      dataConsent: true,
      consentAt: new Date(),
      deletedAt: null,
    },
    create: {
      email: superadminEmail,
      name: "Γιώργος Κοζύρης",
      role: "SUPERADMIN",
      passwordHash,
      emailVerified: new Date(),
      dataConsent: true,
      consentAt: new Date(),
      locale: "el",
      timezone: "Europe/Athens",
    },
  });

  console.log(
    `✔ Seeded SUPERADMIN: ${superadmin.email} (id=${superadmin.id}, role=${superadmin.role})`,
  );

  // Default subscription plans
  const plans = [
    {
      slug: "starter",
      name: "Starter",
      description: "Για μικρές μεταφορικές που μόλις ξεκινούν.",
      maxBranches: 1,
      maxEmployees: 3,
      maxVehicles: 2,
      maxMonthlyJobs: 30,
      crmEnabled: false,
      privateScanEnabled: false,
      apiAccessEnabled: false,
      prioritySupport: false,
      pricePerMonthCents: 4900,
      pricePerYearCents: 49000,
      commissionPct: 8,
      sortOrder: 1,
    },
    {
      slug: "pro",
      name: "Pro",
      description: "Για ενεργές μεταφορικές με 2-3 υποκαταστήματα.",
      maxBranches: 3,
      maxEmployees: 12,
      maxVehicles: 8,
      maxMonthlyJobs: 150,
      crmEnabled: true,
      privateScanEnabled: true,
      apiAccessEnabled: false,
      prioritySupport: false,
      pricePerMonthCents: 14900,
      pricePerYearCents: 149000,
      commissionPct: 5,
      sortOrder: 2,
    },
    {
      slug: "enterprise",
      name: "Enterprise",
      description: "Για μεγάλους ομίλους με πανελλαδική παρουσία.",
      maxBranches: 20,
      maxEmployees: 100,
      maxVehicles: 50,
      maxMonthlyJobs: 1000,
      crmEnabled: true,
      privateScanEnabled: true,
      apiAccessEnabled: true,
      prioritySupport: true,
      pricePerMonthCents: 49900,
      pricePerYearCents: 499000,
      commissionPct: 3,
      sortOrder: 3,
    },
  ] as const;

  for (const p of plans) {
    await db.subscriptionPlan.upsert({
      where: { slug: p.slug },
      update: p,
      create: p,
    });
  }
  console.log(`✔ Seeded ${plans.length} subscription plans (Starter, Pro, Enterprise)`);

  // Singleton SystemSettings row
  await db.systemSettings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });
  console.log("✔ Ensured SystemSettings singleton (defaults)");

  // Default billing profile for the superadmin (PERSON / receipt)
  await db.billingProfile.upsert({
    where: { userId: superadmin.id },
    update: {},
    create: {
      userId: superadmin.id,
      type: "PERSON",
      fullName: superadmin.name,
      email: superadmin.email,
      preferredDocument: "RECEIPT",
    },
  });
  console.log("✔ Ensured BillingProfile for SUPERADMIN");

  await db.$disconnect();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
