"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Loader2,
  Receipt,
  User,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AfmLookup } from "@/components/admin/afm-lookup";
import { upsertBillingProfile } from "@/server/actions/billing-profile.action";

export interface BillingProfileValues {
  type: "PERSON" | "COMPANY";
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  vat?: string | null;
  legalName?: string | null;
  commercialName?: string | null;
  doyCode?: string | null;
  doyName?: string | null;
  legalStatus?: string | null;
  legalStatusKind?: string | null;
  vatSystemFlag?: string | null;
  address?: string | null;
  addressNo?: string | null;
  postalZip?: string | null;
  postalArea?: string | null;
  preferredDocument?: "RECEIPT" | "INVOICE";
}

interface Props {
  initial: BillingProfileValues;
  /** Pre-filled defaults from User (name / email) for first-time setup */
  userDefaults: { name?: string | null; email?: string | null };
}

export function BillingProfileForm({ initial, userDefaults }: Props) {
  const router = useRouter();
  const [type, setType] = useState<"PERSON" | "COMPANY">(initial.type);
  const [vat, setVat] = useState(initial.vat ?? "");
  const [legalName, setLegalName] = useState(initial.legalName ?? "");
  const [commercialName, setCommercialName] = useState(
    initial.commercialName ?? "",
  );
  const [doyCode, setDoyCode] = useState(initial.doyCode ?? "");
  const [doyName, setDoyName] = useState(initial.doyName ?? "");
  const [legalStatus, setLegalStatus] = useState(initial.legalStatus ?? "");
  const [legalStatusKind, setLegalStatusKind] = useState(
    initial.legalStatusKind ?? "",
  );
  const [vatSystemFlag, setVatSystemFlag] = useState(
    initial.vatSystemFlag ?? "",
  );
  const [address, setAddress] = useState(initial.address ?? "");
  const [addressNo, setAddressNo] = useState(initial.addressNo ?? "");
  const [postalZip, setPostalZip] = useState(initial.postalZip ?? "");
  const [postalArea, setPostalArea] = useState(initial.postalArea ?? "");
  const [preferredDocument, setPreferredDocument] = useState<
    "RECEIPT" | "INVOICE"
  >(initial.preferredDocument ?? (initial.type === "COMPANY" ? "INVOICE" : "RECEIPT"));
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, start] = useTransition();

  function applyAade(d: {
    afm: string;
    legalName?: string;
    commercialName?: string;
    doy?: string;
    doyDescription?: string;
    legalStatus?: string;
    legalStatusKind?: string;
    vatSystemFlag?: string;
    address?: string;
    addressNo?: string;
    postalZip?: string;
    postalArea?: string;
  }) {
    setVat(d.afm);
    if (d.legalName) setLegalName(d.legalName);
    if (d.commercialName) setCommercialName(d.commercialName);
    if (d.doy) setDoyCode(d.doy);
    if (d.doyDescription) setDoyName(d.doyDescription);
    if (d.legalStatus) setLegalStatus(d.legalStatus);
    if (d.legalStatusKind) setLegalStatusKind(d.legalStatusKind);
    if (d.vatSystemFlag) setVatSystemFlag(d.vatSystemFlag);
    if (d.address) setAddress(d.address);
    if (d.addressNo) setAddressNo(d.addressNo);
    if (d.postalZip) setPostalZip(d.postalZip);
    if (d.postalArea) setPostalArea(d.postalArea);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    const fd = new FormData(e.currentTarget);
    const payload = {
      type,
      fullName: String(fd.get("fullName") ?? ""),
      email: String(fd.get("email") ?? "") || undefined,
      phone: String(fd.get("phone") ?? "") || undefined,
      vat: type === "COMPANY" ? vat : undefined,
      legalName: type === "COMPANY" ? legalName : undefined,
      commercialName: type === "COMPANY" ? commercialName : undefined,
      doyCode: type === "COMPANY" ? doyCode : undefined,
      doyName: type === "COMPANY" ? doyName : undefined,
      legalStatus: type === "COMPANY" ? legalStatus : undefined,
      legalStatusKind: type === "COMPANY" ? legalStatusKind : undefined,
      vatSystemFlag: type === "COMPANY" ? vatSystemFlag : undefined,
      address,
      addressNo,
      postalZip,
      postalArea,
      preferredDocument,
    };
    start(async () => {
      const res = await upsertBillingProfile(payload);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSuccess(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <section className="rounded-2xl border border-border bg-card p-5">
        <h3 className="font-display text-base font-bold text-foreground">
          Τύπος πελάτη
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Διάλεξε αν εκδίδουμε <strong>απόδειξη</strong> (ιδιώτης) ή{" "}
          <strong>τιμολόγιο</strong> (επιχείρηση).
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <TypeCard
            active={type === "PERSON"}
            onClick={() => {
              setType("PERSON");
              setPreferredDocument("RECEIPT");
            }}
            icon={User}
            title="Ιδιώτης"
            subtitle="Απόδειξη παροχής υπηρεσιών"
          />
          <TypeCard
            active={type === "COMPANY"}
            onClick={() => {
              setType("COMPANY");
              setPreferredDocument("INVOICE");
            }}
            icon={Building2}
            title="Επιχείρηση"
            subtitle="Τιμολόγιο με ΑΦΜ / αυτόματη συμπλήρωση από ΑΑΔΕ"
          />
        </div>
      </section>

      {type === "COMPANY" && (
        <section className="rounded-2xl border border-[var(--color-brand-blue)]/30 bg-gradient-to-br from-[var(--color-brand-blue-light)] to-card p-5">
          <h3 className="font-display text-base font-bold text-foreground">
            Στοιχεία επιχείρησης
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Πληκτρολόγησε ΑΦΜ → τα υπόλοιπα συμπληρώνονται αυτόματα από ΑΑΔΕ.
          </p>
          <div className="mt-4 flex flex-col gap-4">
            <AfmLookup defaultAfm={vat} onResult={applyAade} />

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Επωνυμία">
                <Input
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  required
                />
              </Field>
              <Field label="Διακριτικός τίτλος">
                <Input
                  value={commercialName}
                  onChange={(e) => setCommercialName(e.target.value)}
                />
              </Field>
              <Field label="ΔΟΥ">
                <Input
                  value={doyName}
                  onChange={(e) => setDoyName(e.target.value)}
                />
              </Field>
              <Field label="Νομική μορφή">
                <Input
                  value={legalStatus}
                  onChange={(e) => setLegalStatus(e.target.value)}
                />
              </Field>
            </div>
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-border bg-card p-5">
        <h3 className="font-display text-base font-bold text-foreground">
          Στοιχεία επικοινωνίας
        </h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Ονοματεπώνυμο">
            <Input
              name="fullName"
              defaultValue={initial.fullName ?? userDefaults.name ?? ""}
              required
            />
          </Field>
          <Field label="Email">
            <Input
              type="email"
              name="email"
              defaultValue={initial.email ?? userDefaults.email ?? ""}
            />
          </Field>
          <Field label="Τηλέφωνο">
            <Input
              type="tel"
              name="phone"
              defaultValue={initial.phone ?? ""}
            />
          </Field>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h3 className="font-display text-base font-bold text-foreground">
          Διεύθυνση χρέωσης
        </h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <div className="sm:col-span-3">
            <Field label="Οδός">
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </Field>
          </div>
          <Field label="Αριθμός">
            <Input
              value={addressNo}
              onChange={(e) => setAddressNo(e.target.value)}
            />
          </Field>
          <Field label="ΤΚ">
            <Input
              value={postalZip}
              onChange={(e) => setPostalZip(e.target.value)}
            />
          </Field>
          <div className="sm:col-span-3">
            <Field label="Πόλη / Περιοχή">
              <Input
                value={postalArea}
                onChange={(e) => setPostalArea(e.target.value)}
              />
            </Field>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h3 className="font-display text-base font-bold text-foreground">
          Προτιμώμενο παραστατικό
        </h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <DocCard
            active={preferredDocument === "RECEIPT"}
            onClick={() => setPreferredDocument("RECEIPT")}
            label="Απόδειξη"
            hint="Για χαμηλά ποσά ή ιδιώτες"
          />
          <DocCard
            active={preferredDocument === "INVOICE"}
            onClick={() => setPreferredDocument("INVOICE")}
            label="Τιμολόγιο"
            hint="Για ΦΠΑ έκπτωση"
            disabled={type === "PERSON"}
          />
        </div>
      </section>

      <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 text-sm">
          {error && (
            <span className="flex items-center gap-1.5 text-destructive">
              <AlertCircle className="size-4" />
              {error}
            </span>
          )}
          {success && (
            <span className="flex items-center gap-1.5 text-emerald-700">
              <CheckCircle2 className="size-4" />
              Αποθηκεύτηκε
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
            "Αποθήκευση προφίλ"
          )}
        </Button>
      </div>
    </form>
  );
}

function TypeCard({
  active,
  onClick,
  icon: Icon,
  title,
  subtitle,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof User;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-colors",
        active
          ? "border-[var(--color-brand-blue)] bg-[var(--color-brand-blue-light)]"
          : "border-border bg-card hover:border-[var(--color-brand-blue)]/40",
      )}
    >
      <span
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-xl",
          active
            ? "bg-[var(--color-brand-blue)] text-white"
            : "bg-secondary text-foreground",
        )}
      >
        <Icon className="size-5" />
      </span>
      <span>
        <span
          className={cn(
            "block font-display text-sm font-bold",
            active
              ? "text-[var(--color-brand-blue-deep)]"
              : "text-foreground",
          )}
        >
          {title}
        </span>
        <span className="block text-xs text-muted-foreground">{subtitle}</span>
      </span>
    </button>
  );
}

function DocCard({
  active,
  onClick,
  label,
  hint,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  hint: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center gap-3 rounded-xl border-2 p-3 text-left transition-colors",
        active
          ? "border-[var(--color-brand-blue)] bg-[var(--color-brand-blue-light)]"
          : "border-border bg-card hover:border-[var(--color-brand-blue)]/40",
        disabled && "cursor-not-allowed opacity-40",
      )}
    >
      <Receipt
        className={cn(
          "size-4",
          active
            ? "text-[var(--color-brand-blue)]"
            : "text-muted-foreground",
        )}
      />
      <div>
        <p className="text-sm font-bold text-foreground">{label}</p>
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      </div>
    </button>
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
