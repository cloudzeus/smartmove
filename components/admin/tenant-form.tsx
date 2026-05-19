"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { upsertTenant } from "@/server/actions/tenants.action";
import { AfmLookup } from "./afm-lookup";
import { LogoUpload } from "./logo-upload";

export interface TenantFormValues {
  id?: string;
  vat?: string;
  legalName?: string;
  commercialName?: string;
  doyCode?: string;
  doyName?: string;
  legalStatus?: string;
  legalStatusKind?: string;
  vatSystemFlag?: string;
  registeredAt?: string;
  address?: string;
  addressNo?: string;
  postalZip?: string;
  postalArea?: string;
  email?: string;
  phone?: string;
  website?: string;
  status?: string;
  logoUrl?: string | null;
  notes?: string;
}

interface Props {
  initial?: TenantFormValues | null;
}

export function TenantForm({ initial }: Props) {
  const router = useRouter();
  const [vat, setVat] = useState(initial?.vat ?? "");
  const [legalName, setLegalName] = useState(initial?.legalName ?? "");
  const [commercialName, setCommercialName] = useState(initial?.commercialName ?? "");
  const [doyCode, setDoyCode] = useState(initial?.doyCode ?? "");
  const [doyName, setDoyName] = useState(initial?.doyName ?? "");
  const [legalStatus, setLegalStatus] = useState(initial?.legalStatus ?? "");
  const [legalStatusKind, setLegalStatusKind] = useState(
    initial?.legalStatusKind ?? "",
  );
  const [vatSystemFlag, setVatSystemFlag] = useState(
    initial?.vatSystemFlag ?? "",
  );
  const [registeredAt, setRegisteredAt] = useState(
    initial?.registeredAt?.slice(0, 10) ?? "",
  );
  const [address, setAddress] = useState(initial?.address ?? "");
  const [addressNo, setAddressNo] = useState(initial?.addressNo ?? "");
  const [postalZip, setPostalZip] = useState(initial?.postalZip ?? "");
  const [postalArea, setPostalArea] = useState(initial?.postalArea ?? "");
  const [logoUrl, setLogoUrl] = useState<string | null>(initial?.logoUrl ?? null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const editing = !!initial?.id;

  function applyAade(d: {
    afm: string;
    legalName?: string;
    commercialName?: string;
    doy?: string;
    doyDescription?: string;
    legalStatus?: string;
    legalStatusKind?: string;
    vatSystemFlag?: string;
    registDate?: string;
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
    if (d.registDate) setRegisteredAt(d.registDate.slice(0, 10));
    if (d.address) setAddress(d.address);
    if (d.addressNo) setAddressNo(d.addressNo);
    if (d.postalZip) setPostalZip(d.postalZip);
    if (d.postalArea) setPostalArea(d.postalArea);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const payload = {
      id: initial?.id,
      vat,
      legalName,
      commercialName,
      doyCode,
      doyName,
      legalStatus,
      legalStatusKind,
      vatSystemFlag,
      registeredAt: registeredAt || undefined,
      address,
      addressNo,
      postalZip,
      postalArea,
      email: String(fd.get("email") ?? "") || undefined,
      phone: String(fd.get("phone") ?? "") || undefined,
      website: String(fd.get("website") ?? "") || undefined,
      status: String(fd.get("status") ?? "ACTIVE"),
      logoUrl,
      notes: String(fd.get("notes") ?? "") || undefined,
    };
    start(async () => {
      const res = await upsertTenant(payload);
      if (!res.ok) {
        setError(res.error);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      router.push(`/admin/tenants/${res.id}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-5">
        {!editing && (
          <section className="rounded-2xl border border-[var(--color-brand-blue)]/30 bg-gradient-to-br from-[var(--color-brand-blue-light)] to-card p-5">
            <h2 className="font-display text-base font-bold text-foreground">
              Αυτόματη συμπλήρωση από ΑΑΔΕ
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Πληκτρολόγησε τον ΑΦΜ και πάτα <strong>Αναζήτηση</strong>. Τα
              στοιχεία (επωνυμία, ΔΟΥ, διεύθυνση) θα συμπληρωθούν αυτόματα.
            </p>
            <div className="mt-4">
              <AfmLookup defaultAfm={vat} onResult={applyAade} />
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-4 font-display text-base font-bold text-foreground">
            Στοιχεία εταιρείας
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="ΑΦΜ">
              <Input
                value={vat}
                onChange={(e) => setVat(e.target.value.replace(/\D/g, ""))}
                maxLength={9}
                required
                className="font-mono tracking-wider"
              />
            </Field>
            <Field label="Επωνυμία (TRDR.NAME)">
              <Input
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                required
              />
            </Field>
            <Field label="Διακριτικός τίτλος (TRDR.COMMERCIALSTORENAME)">
              <Input
                value={commercialName}
                onChange={(e) => setCommercialName(e.target.value)}
              />
            </Field>
            <Field label="Νομική μορφή">
              <Input
                value={legalStatus}
                onChange={(e) => setLegalStatus(e.target.value)}
              />
            </Field>
            <Field label="ΔΟΥ Κωδικός">
              <Input
                value={doyCode}
                onChange={(e) => setDoyCode(e.target.value)}
              />
            </Field>
            <Field label="ΔΟΥ (TRDR.IRSDATA)">
              <Input
                value={doyName}
                onChange={(e) => setDoyName(e.target.value)}
              />
            </Field>
            <Field label="Φύση (ΦΠ / ΜΗ ΦΠ)">
              <Input
                value={legalStatusKind}
                onChange={(e) => setLegalStatusKind(e.target.value)}
              />
            </Field>
            <Field label="Καθεστώς ΦΠΑ (Y/N)">
              <Input
                value={vatSystemFlag}
                onChange={(e) => setVatSystemFlag(e.target.value)}
                maxLength={1}
              />
            </Field>
            <Field label="Ημερομηνία έναρξης">
              <Input
                type="date"
                value={registeredAt}
                onChange={(e) => setRegisteredAt(e.target.value)}
              />
            </Field>
            <Field label="Κατάσταση">
              <select
                name="status"
                defaultValue={initial?.status ?? "ACTIVE"}
                className="h-11 w-full rounded-lg border border-input bg-card px-3 text-sm font-medium text-foreground focus-visible:border-[var(--color-brand-blue)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
              >
                <option value="ACTIVE">Ενεργός</option>
                <option value="PAUSED">Σε παύση</option>
                <option value="SUSPENDED">Αναστολή</option>
              </select>
            </Field>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-4 font-display text-base font-bold text-foreground">
            Διεύθυνση έδρας
          </h2>
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="sm:col-span-3">
              <Field label="Οδός (TRDR.ADDRESS)">
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
            <Field label="ΤΚ (TRDR.ZIP)">
              <Input
                value={postalZip}
                onChange={(e) => setPostalZip(e.target.value)}
              />
            </Field>
            <div className="sm:col-span-3">
              <Field label="Πόλη / Περιοχή (TRDR.DISTRICT)">
                <Input
                  value={postalArea}
                  onChange={(e) => setPostalArea(e.target.value)}
                />
              </Field>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-4 font-display text-base font-bold text-foreground">
            Επικοινωνία
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Email">
              <Input
                type="email"
                name="email"
                defaultValue={initial?.email}
                placeholder="info@example.gr"
              />
            </Field>
            <Field label="Τηλέφωνο">
              <Input
                type="tel"
                name="phone"
                defaultValue={initial?.phone}
                placeholder="2103000450"
              />
            </Field>
            <Field label="Website">
              <Input
                type="url"
                name="website"
                defaultValue={initial?.website}
                placeholder="https://"
              />
            </Field>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-2 font-display text-base font-bold text-foreground">
            Σημειώσεις (εσωτερικές)
          </h2>
          <Textarea
            name="notes"
            defaultValue={initial?.notes}
            rows={3}
            placeholder="π.χ. επικοινωνία μέσω Γ. Παπαδόπουλου, ειδική τιμολόγηση..."
          />
        </section>
      </div>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
        <section className="rounded-2xl border border-border bg-card p-5">
          <LogoUpload value={logoUrl} onChange={setLogoUrl} />
        </section>

        {error && (
          <div className="flex items-start gap-2 rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-xs text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="rounded-2xl border border-border bg-card p-4">
          <Button
            type="submit"
            disabled={pending}
            className="h-12 w-full text-base shadow-[var(--shadow-cta)]"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : editing ? (
              "Αποθήκευση αλλαγών"
            ) : (
              "Δημιουργία πελάτη"
            )}
          </Button>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Μετά τη δημιουργία θα μπορείς να προσθέσεις υποκαταστήματα,
            οχήματα και συνδρομή.
          </p>
        </div>
      </aside>
    </form>
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
