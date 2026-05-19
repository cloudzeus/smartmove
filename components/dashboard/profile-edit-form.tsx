"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Globe,
  Loader2,
  Phone,
  User,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateUserDetails } from "@/server/actions/user.action";

interface Props {
  initial: {
    name: string | null;
    phone: string | null;
    image: string | null;
    locale: string;
    timezone: string;
    marketingConsent: boolean;
  };
}

const LOCALES = [
  { value: "el", label: "Ελληνικά" },
  { value: "en", label: "English" },
] as const;

export function ProfileEditForm({ initial }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initial.name ?? "");
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [locale, setLocale] = useState<string>(initial.locale ?? "el");
  const [marketingConsent, setMarketingConsent] = useState(
    initial.marketingConsent,
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  const phoneInvalid = phone.trim().length < 8;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    if (phoneInvalid) {
      setError("Συμπλήρωσε έγκυρο τηλέφωνο (υποχρεωτικό).");
      return;
    }
    start(async () => {
      const res = await updateUserDetails({
        name,
        phone,
        locale,
        timezone: initial.timezone,
        marketingConsent,
        image: initial.image,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          icon={User}
          label="Ονοματεπώνυμο"
          required
        >
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={2}
            placeholder="π.χ. Γιώργος Παπαδόπουλος"
          />
        </Field>
        <Field
          icon={Phone}
          label="Τηλέφωνο"
          required
          hint="Υποχρεωτικό · για επικοινωνία με μεταφορείς"
          error={phoneInvalid && phone.length > 0 ? "Τουλάχιστον 8 ψηφία" : undefined}
        >
          <Input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            placeholder="69 1234 5678"
            className={cn(
              phoneInvalid && phone.length > 0 && "border-destructive",
            )}
          />
        </Field>
        <Field icon={Globe} label="Γλώσσα">
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value)}
            className="h-11 w-full rounded-lg border border-input bg-card px-3 text-sm font-medium text-foreground focus-visible:border-[var(--color-brand-blue)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          >
            {LOCALES.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </Field>
        <Field icon={User} label="Email" hint="Προς το παρόν δεν αλλάζει χωρίς επαλήθευση">
          <Input value={initial.image ? "" : ""} placeholder="" disabled className="bg-secondary/40 text-muted-foreground" defaultValue={""} aria-readonly />
        </Field>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-secondary/40 p-4">
        <input
          type="checkbox"
          checked={marketingConsent}
          onChange={(e) => setMarketingConsent(e.target.checked)}
          className="mt-0.5 size-4 cursor-pointer rounded border-border accent-[var(--color-brand-blue)]"
        />
        <span className="flex flex-col">
          <span className="text-sm font-semibold text-foreground">
            Θέλω να λαμβάνω νέα και προσφορές
          </span>
          <span className="text-xs text-muted-foreground">
            Άσχετο με τα emails για τα δικά μου αιτήματα (αυτά πάντα έρχονται).
          </span>
        </span>
      </label>

      <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 text-sm">
          {error && (
            <span className="flex items-center gap-1.5 text-destructive">
              <AlertCircle className="size-4" />
              {error}
            </span>
          )}
          {saved && (
            <span className="flex items-center gap-1.5 text-emerald-700">
              <CheckCircle2 className="size-4" />
              Τα στοιχεία ενημερώθηκαν
            </span>
          )}
        </div>
        <Button
          type="submit"
          disabled={pending}
          className="h-11 px-6 shadow-[var(--shadow-cta)]"
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            "Αποθήκευση"
          )}
        </Button>
      </div>
    </form>
  );
}

function Field({
  icon: Icon,
  label,
  required,
  hint,
  error,
  children,
}: {
  icon: typeof User;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
        <Icon className="size-3.5 text-muted-foreground" />
        {label}
        {required && <span className="text-destructive">*</span>}
      </span>
      {children}
      {error && <span className="text-[11px] text-destructive">{error}</span>}
      {!error && hint && (
        <span className="text-[11px] text-muted-foreground">{hint}</span>
      )}
    </label>
  );
}
