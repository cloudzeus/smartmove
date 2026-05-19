import { AdminPageHero } from "@/components/admin/page-hero";
import { SettingsForm } from "@/components/admin/settings-form";
import { getSystemSettings } from "@/server/actions/settings.action";

export const metadata = { title: "Admin · Ρυθμίσεις συστήματος" };
export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const s = await getSystemSettings();

  return (
    <>
      <AdminPageHero
        eyebrow="Platform"
        title="Ρυθμίσεις συστήματος"
        description="Διατήρηση δεδομένων, Gemini AI όρια και χρεώσεις ανά μεταφορά. Ισχύουν για όλους τους χρήστες της πλατφόρμας."
        crumbs={[
          { href: "/admin", label: "Admin" },
          { label: "Ρυθμίσεις" },
        ]}
        tone="red"
        kpis={[
          { label: "Free retention", value: `${s.retentionFreeMonths} μήνες` },
          { label: "Scan fee", value: `${(s.scanFeeCents / 100).toFixed(2)}€` },
          { label: "Free Gemini/μήνα", value: s.freeGeminiCallsPerMonth },
          { label: "Επιπλέον scan", value: `${(s.geminiOveragePriceCents / 100).toFixed(2)}€` },
        ]}
      />
      <div className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
        <SettingsForm
          initial={{
            retentionFreeMonths: s.retentionFreeMonths,
            retentionExtensionMonthlyEur: s.retentionExtensionMonthlyCents / 100,
            retentionExtensionYearlyEur: s.retentionExtensionYearlyCents / 100,
            freeGeminiCallsPerMonth: s.freeGeminiCallsPerMonth,
            geminiOveragePriceEur: s.geminiOveragePriceCents / 100,
            scanFeeEur: s.scanFeeCents / 100,
            manualMoveFeeEur: s.manualMoveFeeCents / 100,
          }}
        />
      </div>
    </>
  );
}
