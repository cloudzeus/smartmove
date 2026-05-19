"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateSystemSettings } from "@/server/actions/settings.action";

interface Props {
  initial: {
    retentionFreeMonths: number;
    retentionExtensionMonthlyEur: number;
    retentionExtensionYearlyEur: number;
    freeGeminiCallsPerMonth: number;
    geminiOveragePriceEur: number;
    scanFeeEur: number;
    manualMoveFeeEur: number;
  };
}

export function SettingsForm({ initial }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    const fd = new FormData(e.currentTarget);
    const payload = {
      retentionFreeMonths: fd.get("retentionFreeMonths"),
      retentionExtensionMonthlyEur: fd.get("retentionExtensionMonthlyEur"),
      retentionExtensionYearlyEur: fd.get("retentionExtensionYearlyEur"),
      freeGeminiCallsPerMonth: fd.get("freeGeminiCallsPerMonth"),
      geminiOveragePriceEur: fd.get("geminiOveragePriceEur"),
      scanFeeEur: fd.get("scanFeeEur"),
      manualMoveFeeEur: fd.get("manualMoveFeeEur"),
    };
    start(async () => {
      const res = await updateSystemSettings(payload);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSuccess(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-3">
      <Section
        title="Διατήρηση δεδομένων"
        subtitle="Πόσους μήνες κρατάμε τα δεδομένα δωρεάν, και τι κοστίζει η παράταση όταν λήξει."
      >
        <Field label="Μήνες δωρεάν διατήρησης">
          <Input
            type="number"
            name="retentionFreeMonths"
            defaultValue={initial.retentionFreeMonths}
            min={1}
            max={120}
            required
          />
        </Field>
        <Field label="Παράταση: €/μήνα">
          <Input
            type="number"
            step="0.01"
            min={0}
            name="retentionExtensionMonthlyEur"
            defaultValue={initial.retentionExtensionMonthlyEur}
            required
          />
        </Field>
        <Field label="Παράταση: €/έτος (έκπτωση)">
          <Input
            type="number"
            step="0.01"
            min={0}
            name="retentionExtensionYearlyEur"
            defaultValue={initial.retentionExtensionYearlyEur}
            required
          />
        </Field>
      </Section>

      <Section
        title="Όριο AI Gemini ανά χρήστη"
        subtitle="Πόσες δωρεάν κλήσεις τον μήνα δικαιούται κάθε χρήστης, και τι κοστίζει κάθε επιπλέον."
      >
        <Field label="Δωρεάν κλήσεις/μήνα">
          <Input
            type="number"
            name="freeGeminiCallsPerMonth"
            defaultValue={initial.freeGeminiCallsPerMonth}
            min={0}
            required
          />
        </Field>
        <Field label="Χρέωση επιπλέον κλήσης (€)">
          <Input
            type="number"
            step="0.01"
            min={0}
            name="geminiOveragePriceEur"
            defaultValue={initial.geminiOveragePriceEur}
            required
          />
        </Field>
      </Section>

      <Section
        title="Χρεώσεις ανά αίτημα μεταφοράς"
        subtitle="Τι πληρώνει ο πελάτης ανά νέα δημοσίευση. AI scan vs χειροκίνητη λίστα."
      >
        <Field label="Με AI scan (€)">
          <Input
            type="number"
            step="0.01"
            min={0}
            name="scanFeeEur"
            defaultValue={initial.scanFeeEur}
            required
          />
        </Field>
        <Field label="Χωρίς AI (χειροκίνητο, €)">
          <Input
            type="number"
            step="0.01"
            min={0}
            name="manualMoveFeeEur"
            defaultValue={initial.manualMoveFeeEur}
            required
          />
        </Field>
        <p className="mt-2 rounded-lg bg-secondary/40 px-3 py-2 text-[11px] text-muted-foreground">
          Η χρέωση AI scan καλύπτει το κόστος της Google Gemini API ανά μεταφορά.
        </p>
      </Section>

      <div className="lg:col-span-3 flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          {error && (
            <span className="flex items-center gap-1.5 text-sm text-destructive">
              <AlertCircle className="size-4" />
              {error}
            </span>
          )}
          {success && (
            <span className="flex items-center gap-1.5 text-sm text-emerald-700">
              <CheckCircle2 className="size-4" />
              Οι ρυθμίσεις αποθηκεύτηκαν
            </span>
          )}
        </div>
        <Button
          type="submit"
          disabled={pending}
          className="h-11 px-6 shadow-[var(--shadow-cta)]"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : "Αποθήκευση"}
        </Button>
      </div>
    </form>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="font-display text-base font-bold text-foreground">
        {title}
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
      <div className="mt-4 flex flex-col gap-3">{children}</div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-foreground">{label}</span>
      {children}
    </label>
  );
}
