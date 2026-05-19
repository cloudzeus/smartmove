import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const db = new PrismaClient({ adapter });

  const u = await db.user.findUnique({
    where: { email: "gkozyris@i4ria.com" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      emailVerified: true,
      createdAt: true,
      deletedAt: true,
      passwordHash: true,
    },
  });

  if (!u) {
    console.log("✘ User NOT found");
    process.exit(1);
  }

  const passwordOk = u.passwordHash
    ? await bcrypt.compare("1f1femsk", u.passwordHash)
    : false;

  console.log("─ SUPERADMIN check ──────────");
  console.log("  email          :", u.email);
  console.log("  name           :", u.name);
  console.log("  role           :", u.role);
  console.log("  emailVerified  :", u.emailVerified ? "yes" : "no");
  console.log("  deleted        :", u.deletedAt ? "YES (problem!)" : "no");
  console.log("  password match :", passwordOk ? "✓ '1f1femsk' works" : "✘ password mismatch");
  console.log("  id             :", u.id);
  await db.$disconnect();
}
main();
