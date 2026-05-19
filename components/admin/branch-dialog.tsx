"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { upsertBranch } from "@/server/actions/tenants.action";
import { AfmLookup } from "./afm-lookup";

export interface BranchFormValues {
  id?: string;
  vat?: string | null;
  legalName?: string;
  commercialName?: string;
  doyCode?: string;
  doyName?: string;
  address?: string;
  addressNo?: string;
  postalZip?: string;
  postalArea?: string;
  email?: string;
  phone?: string;
  isPrimary?: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  initial?: BranchFormValues | null;
}

export function BranchDialog({ open, onOpenChange, tenantId, initial }: Props) {
  const router = useRouter();
  const [vat, setVat] = useState(initial?.vat ?? "");
  const [legalName, setLegalName] = useState(initial?.legalName ?? "");
  const [commercialName, setCommercialName] = useState(
    initial?.commercialName ?? "",
  );
  const [doyCode, setDoyCode] = useState(initial?.doyCode ?? "");
  const [doyName, setDoyName] = useState(initial?.doyName ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [addressNo, setAddressNo] = useState(initial?.addressNo ?? "");
  const [postalZip, setPostalZip] = useState(initial?.postalZip ?? "");
  const [postalArea, setPostalArea] = useState(initial?.postalArea ?? "");
  const [isPrimary, setIsPrimary] = useState(initial?.isPrimary ?? false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const editing = !!initial?.id;

  function applyAade(d: {
    afm: string;
    legalName?: string;
    commercialName?: string;
    doy?: string;
    doyDescription?: string;
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
      tenantId,
      vat: vat || null,
      legalName,
      commercialName,
      doyCode,
      doyName,
      address,
      addressNo,
      postalZip,
      postalArea,
      email: String(fd.get("email") ?? "") || undefined,
      phone: String(fd.get("phone") ?? "") || undefined,
      isPrimary,
    };
    start(async () => {
      const res = await upsertBranch(payload);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Επεξεργασία υποκαταστήματος" : "Νέο υποκατάστημα"}
          </DialogTitle>
          <DialogDescription>
            Κάθε υποκατάστημα μπορεί να έχει δικό του ΑΦΜ. Πληκτρολόγησε για
            αυτόματη συμπλήρωση από ΑΑΔΕ.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="rounded-xl bg-secondary/40 p-3">
            <AfmLookup defaultAfm={vat ?? ""} onResult={applyAade} compact />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Επωνυμία" required>
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
            <Field label="ΔΟΥ Κωδικός">
              <Input
                value={doyCode}
                onChange={(e) => setDoyCode(e.target.value)}
              />
            </Field>
            <Field label="ΔΟΥ Όνομα">
              <Input
                value={doyName}
                onChange={(e) => setDoyName(e.target.value)}
              />
            </Field>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-3">
              <Field label="Οδός">
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </Field>
            </div>
            <Field label="Αρ.">
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
            <div className="col-span-3">
              <Field label="Πόλη / Περιοχή">
                <Input
                  value={postalArea}
                  onChange={(e) => setPostalArea(e.target.value)}
                />
              </Field>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Email">
              <Input
                type="email"
                name="email"
                defaultValue={initial?.email}
              />
            </Field>
            <Field label="Τηλέφωνο">
              <Input
                type="tel"
                name="phone"
                defaultValue={initial?.phone}
              />
            </Field>
          </div>

          <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-secondary/40 p-3 text-sm">
            <input
              type="checkbox"
              checked={isPrimary}
              onChange={(e) => setIsPrimary(e.target.checked)}
              className="size-4 cursor-pointer rounded border-border accent-[var(--color-brand-blue)]"
            />
            <span>Όρισέ το ως κύριο υποκατάστημα</span>
          </label>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
              {error}
            </div>
          )}

          <div className="flex gap-2 border-t border-border pt-3">
            <Button
              type="button"
              variant="outline"
              className="h-10 flex-1"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Άκυρο
            </Button>
            <Button
              type="submit"
              className="h-10 flex-1 shadow-[var(--shadow-cta)]"
              disabled={pending}
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : editing ? (
                "Αποθήκευση"
              ) : (
                "Προσθήκη"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  children,
  required,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold text-foreground">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </span>
      {children}
    </label>
  );
}
