import { db } from "@/lib/db";
import { AdminPageHero } from "@/components/admin/page-hero";
import { TermsAdminClient } from "@/components/admin/terms-admin-client";

export const metadata = { title: "Admin · Όροι Χρήσης" };
export const dynamic = "force-dynamic";

export default async function AdminTermsPage() {
  const versions = await db.termsVersion.findMany({
    orderBy: { publishedAt: "desc" },
  });

  const totalAccepted = await db.user.count({
    where: { termsAcceptedVersion: { not: null } },
  });
  const active = versions.find((v) => v.isActive);

  const acceptedActive = active
    ? await db.user.count({
        where: { termsAcceptedVersion: active.version },
      })
    : 0;

  return (
    <>
      <AdminPageHero
        eyebrow="Compliance"
        title="Όροι Χρήσης"
        description="Διαχείριση εκδόσεων όρων χρήσης. Όταν ενεργοποιείς νέα έκδοση, όλοι οι χρήστες αναγκάζονται να την αποδεχτούν στην επόμενη σύνδεση."
        crumbs={[
          { href: "/admin", label: "Admin" },
          { label: "Όροι" },
        ]}
        kpis={[
          { label: "Εκδόσεις", value: versions.length },
          {
            label: "Ενεργή",
            value: active?.version ?? "—",
            deltaTone: active ? "positive" : "negative",
          },
          { label: "Έχουν αποδεχτεί", value: acceptedActive },
          { label: "Σύνολο αποδοχών", value: totalAccepted },
        ]}
      />
      <div className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <TermsAdminClient versions={versions} />
      </div>
    </>
  );
}
