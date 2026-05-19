import { Settings } from "lucide-react";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/dashboard/page-header";
import { BillingProfileForm } from "@/components/dashboard/billing-profile-form";
import { RetentionBanner } from "@/components/dashboard/retention-banner";
import { SettingsTabs } from "@/components/dashboard/settings-tabs";
import {
  ensureRetentionInitialized,
} from "@/server/actions/retention.action";
import { getSystemSettings } from "@/server/actions/settings.action";

export const metadata = { title: "Ρυθμίσεις" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function SettingsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const tab = params.tab ?? "profile";
  const session = await auth();
  await ensureRetentionInitialized(session!.user.id);

  const [user, settings] = await Promise.all([
    db.user.findUnique({
      where: { id: session!.user.id },
      select: {
        name: true,
        email: true,
        phone: true,
        role: true,
        locale: true,
        timezone: true,
        marketingConsent: true,
        createdAt: true,
        dataRetentionUntil: true,
        retentionExtendedUntil: true,
        retentionConsentAt: true,
        billingProfile: true,
      },
    }),
    getSystemSettings(),
  ]);
  if (!user) return null;

  const effectiveRetention =
    user.retentionExtendedUntil ?? user.dataRetentionUntil;
  const retentionDaysLeft = effectiveRetention
    ? Math.ceil((effectiveRetention.getTime() - Date.now()) / 86_400_000)
    : settings.retentionFreeMonths * 30;

  return (
    <>
      <PageHeader
        title="Ρυθμίσεις"
        description="Προφίλ, στοιχεία χρέωσης, διατήρηση δεδομένων και ειδοποιήσεις."
        crumbs={[
          { href: "/dashboard", label: "Επισκόπηση" },
          { label: "Ρυθμίσεις" },
        ]}
      />
      <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <SettingsTabs current={tab} />

        <div className="mt-6">
          {tab === "profile" && (
            <section className="rounded-2xl border border-border bg-card p-6">
              <h2 className="font-display text-lg font-bold text-foreground">
                Στοιχεία προφίλ
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Αυτά τα στοιχεία χρησιμοποιούνται σε κάθε αίτημα μεταφοράς.
              </p>
              <dl className="mt-5 grid gap-3 sm:grid-cols-2">
                <Row label="Ονοματεπώνυμο" value={user.name ?? "—"} />
                <Row label="Email" value={user.email} />
                <Row label="Τηλέφωνο" value={user.phone ?? "—"} />
                <Row label="Ρόλος" value={user.role} />
                <Row label="Γλώσσα" value={user.locale} />
                <Row label="Ζώνη ώρας" value={user.timezone} />
                <Row
                  label="Εγγραφή"
                  value={new Intl.DateTimeFormat("el-GR").format(user.createdAt)}
                />
              </dl>
            </section>
          )}

          {tab === "billing" && (
            <BillingProfileForm
              initial={{
                type: (user.billingProfile?.type as "PERSON" | "COMPANY") ?? "PERSON",
                fullName: user.billingProfile?.fullName,
                email: user.billingProfile?.email,
                phone: user.billingProfile?.phone,
                vat: user.billingProfile?.vat,
                legalName: user.billingProfile?.legalName,
                commercialName: user.billingProfile?.commercialName,
                doyCode: user.billingProfile?.doyCode,
                doyName: user.billingProfile?.doyName,
                legalStatus: user.billingProfile?.legalStatus,
                legalStatusKind: user.billingProfile?.legalStatusKind,
                vatSystemFlag: user.billingProfile?.vatSystemFlag,
                address: user.billingProfile?.address,
                addressNo: user.billingProfile?.addressNo,
                postalZip: user.billingProfile?.postalZip,
                postalArea: user.billingProfile?.postalArea,
                preferredDocument:
                  (user.billingProfile?.preferredDocument as
                    | "RECEIPT"
                    | "INVOICE"
                    | undefined) ?? "RECEIPT",
              }}
              userDefaults={{ name: user.name, email: user.email }}
            />
          )}

          {tab === "retention" && (
            <div className="flex flex-col gap-4">
              <RetentionBanner
                daysLeft={retentionDaysLeft}
                expiresAt={effectiveRetention}
                monthlyPriceEur={settings.retentionExtensionMonthlyCents / 100}
                yearlyPriceEur={settings.retentionExtensionYearlyCents / 100}
              />
              <section className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
                <p>
                  Όλοι οι νέοι λογαριασμοί έχουν{" "}
                  <strong className="text-foreground">
                    {settings.retentionFreeMonths} μήνες
                  </strong>{" "}
                  δωρεάν διατήρηση από την εγγραφή. Μετά τη λήξη, χρειάζεται
                  νέα συναίνεση ή παράταση επί πληρωμή για να παραμείνουν
                  διαθέσιμα τα δεδομένα σου.
                </p>
                <p className="mt-3 text-xs">
                  Τιμολόγηση παράτασης:{" "}
                  <strong className="text-foreground">
                    {(settings.retentionExtensionMonthlyCents / 100).toFixed(2)}€/μήνα
                  </strong>{" "}
                  ή{" "}
                  <strong className="text-foreground">
                    {(settings.retentionExtensionYearlyCents / 100).toFixed(2)}€/έτος
                  </strong>{" "}
                  (έκπτωση).
                </p>
              </section>
            </div>
          )}

          {tab === "notifications" && (
            <section className="rounded-2xl border border-border bg-card p-6">
              <h2 className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
                <Settings className="size-5 text-[var(--color-brand-blue)]" />
                Ειδοποιήσεις
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Διάλεξε πώς θες να σε ενημερώνουμε.
              </p>
              <ul className="mt-5 flex flex-col gap-2 text-sm">
                <Toggle
                  title="Email για νέες προσφορές"
                  hint="Μόλις φτάνει νέα προσφορά μεταφορέα"
                  checked
                />
                <Toggle
                  title="Email για ενημερώσεις παράδοσης"
                  hint="Όταν αλλάζει η κατάσταση του αιτήματος"
                  checked
                />
                <Toggle
                  title="Marketing & ενημερώσεις"
                  hint="Νέα features, προσφορές, blog posts"
                  checked={user.marketingConsent}
                />
              </ul>
            </section>
          )}
        </div>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

function Toggle({
  title,
  hint,
  checked,
}: {
  title: string;
  hint: string;
  checked?: boolean;
}) {
  return (
    <li className="flex items-start justify-between gap-3 rounded-xl bg-secondary/40 p-3">
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <span
        className={`mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full px-0.5 transition-colors ${checked ? "bg-[var(--color-brand-blue)]" : "bg-border"}`}
      >
        <span
          className={`size-5 rounded-full bg-white shadow-sm transition-transform ${checked ? "translate-x-5" : "translate-x-0"}`}
        />
      </span>
    </li>
  );
}
