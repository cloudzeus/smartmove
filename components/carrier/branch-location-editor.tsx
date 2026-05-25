"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Locate, Loader2, Star, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { upsertCarrierBranch, deleteCarrierBranch } from "@/server/actions/carrier-branches.action";
import { geocodeAddress } from "@/server/actions/geocode.action";
import { PartnerCoverageMap } from "./partner-coverage-map";
import { cn } from "@/lib/utils";

interface BranchData {
  id?: string;
  legalName: string;
  commercialName: string | null;
  address: string | null;
  addressNo: string | null;
  postalZip: string | null;
  postalArea: string | null;
  phone: string | null;
  email: string | null;
  lat: number | null;
  lng: number | null;
  serviceRadiusKm: number;
  isPrimary: boolean;
}

interface Props {
  branch?: BranchData;
  mapApiKey?: string | null;
  triggerLabel?: string;
  isCreate?: boolean;
}

export function BranchLocationEditor({
  branch, mapApiKey, triggerLabel, isCreate,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [deleting, startDelete] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Form state
  const [legalName, setLegalName] = useState(branch?.legalName ?? "");
  const [commercialName, setCommercialName] = useState(branch?.commercialName ?? "");
  const [address, setAddress] = useState(branch?.address ?? "");
  const [addressNo, setAddressNo] = useState(branch?.addressNo ?? "");
  const [postalZip, setPostalZip] = useState(branch?.postalZip ?? "");
  const [postalArea, setPostalArea] = useState(branch?.postalArea ?? "");
  const [phone, setPhone] = useState(branch?.phone ?? "");
  const [email, setEmail] = useState(branch?.email ?? "");
  const [lat, setLat] = useState(branch?.lat?.toString() ?? "");
  const [lng, setLng] = useState(branch?.lng?.toString() ?? "");
  const [radius, setRadius] = useState((branch?.serviceRadiusKm ?? 50).toString());
  const [isPrimary, setIsPrimary] = useState(branch?.isPrimary ?? false);

  async function handleGeocode() {
    const fullAddr = [
      [address, addressNo].filter(Boolean).join(" "),
      [postalZip, postalArea].filter(Boolean).join(" "),
    ].filter(Boolean).join(", ");
    if (!fullAddr.trim()) {
      setError("Συμπλήρωσε διεύθυνση πρώτα.");
      return;
    }
    setError(null);
    setGeocoding(true);
    try {
      const res = await geocodeAddress(fullAddr);
      if (res.ok) {
        setLat(res.lat.toFixed(6));
        setLng(res.lng.toFixed(6));
      } else {
        setError(res.error);
      }
    } finally {
      setGeocoding(false);
    }
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const res = await upsertCarrierBranch({
        id: branch?.id,
        legalName,
        commercialName,
        address,
        addressNo,
        postalZip,
        postalArea,
        phone,
        email,
        lat: lat ? Number(lat) : undefined,
        lng: lng ? Number(lng) : undefined,
        serviceRadiusKm: Number(radius),
        isPrimary,
      });
      if (res.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  function handleDelete() {
    if (!branch?.id) return;
    startDelete(async () => {
      const res = await deleteCarrierBranch(branch.id!);
      if (res.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-[11px] font-semibold cx-transition cx-press",
          isCreate
            ? "bg-[var(--cx-accent)] text-primary-foreground hover:opacity-90"
            : "border border-border bg-card text-foreground hover:bg-[var(--cx-hover)]",
        )}
      >
        {triggerLabel ?? (isCreate ? "+ Νέο υποκατάστημα" : "Επεξεργασία")}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isCreate ? "Νέο υποκατάστημα" : `Επεξεργασία · ${branch?.commercialName ?? branch?.legalName}`}
            </DialogTitle>
            <DialogDescription>
              Στοιχεία, συντεταγμένες έδρας και ακτίνα κάλυψης για το matching engine.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {/* Names */}
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Επωνυμία *" required>
                <input
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  required
                  placeholder="π.χ. SmartMove Athens IKE"
                  className="h-8 w-full rounded-md border border-border bg-background px-2.5 text-[12px] outline-none focus:border-[var(--cx-accent)] focus:ring-1 focus:ring-[var(--cx-accent)]"
                />
              </Field>
              <Field label="Διακριτικός τίτλος">
                <input
                  value={commercialName}
                  onChange={(e) => setCommercialName(e.target.value)}
                  placeholder="π.χ. SmartMove HQ"
                  className="h-8 w-full rounded-md border border-border bg-background px-2.5 text-[12px] outline-none focus:border-[var(--cx-accent)] focus:ring-1 focus:ring-[var(--cx-accent)]"
                />
              </Field>
            </div>

            {/* Address */}
            <div className="grid gap-2 sm:grid-cols-[1fr_80px_100px_1fr]">
              <Field label="Οδός">
                <input value={address} onChange={(e) => setAddress(e.target.value)}
                  placeholder="Λεωφ. Συγγρού"
                  className="h-8 w-full rounded-md border border-border bg-background px-2.5 text-[12px] outline-none focus:border-[var(--cx-accent)] focus:ring-1 focus:ring-[var(--cx-accent)]" />
              </Field>
              <Field label="Αριθμός">
                <input value={addressNo} onChange={(e) => setAddressNo(e.target.value)}
                  placeholder="100"
                  className="h-8 w-full rounded-md border border-border bg-background px-2.5 text-[12px] outline-none focus:border-[var(--cx-accent)] focus:ring-1 focus:ring-[var(--cx-accent)]" />
              </Field>
              <Field label="ΤΚ">
                <input value={postalZip} onChange={(e) => setPostalZip(e.target.value)}
                  placeholder="11741"
                  className="h-8 w-full rounded-md border border-border bg-background px-2.5 text-[12px] outline-none focus:border-[var(--cx-accent)] focus:ring-1 focus:ring-[var(--cx-accent)]" />
              </Field>
              <Field label="Περιοχή">
                <input value={postalArea} onChange={(e) => setPostalArea(e.target.value)}
                  placeholder="Αθήνα"
                  className="h-8 w-full rounded-md border border-border bg-background px-2.5 text-[12px] outline-none focus:border-[var(--cx-accent)] focus:ring-1 focus:ring-[var(--cx-accent)]" />
              </Field>
            </div>

            {/* Contact */}
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Τηλέφωνο">
                <input value={phone} onChange={(e) => setPhone(e.target.value)}
                  className="h-8 w-full rounded-md border border-border bg-background px-2.5 text-[12px] outline-none focus:border-[var(--cx-accent)] focus:ring-1 focus:ring-[var(--cx-accent)]" />
              </Field>
              <Field label="Email">
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  className="h-8 w-full rounded-md border border-border bg-background px-2.5 text-[12px] outline-none focus:border-[var(--cx-accent)] focus:ring-1 focus:ring-[var(--cx-accent)]" />
              </Field>
            </div>

            {/* Coordinates */}
            <div className="space-y-2 rounded-md border border-border bg-muted/30 p-2">
              <div className="flex items-center justify-between">
                <span className="cx-eyebrow">Συντεταγμένες έδρας</span>
                <button
                  type="button"
                  onClick={handleGeocode}
                  disabled={geocoding}
                  className="inline-flex h-6 items-center gap-1 rounded-md border border-border bg-card px-2 text-[11px] font-semibold cx-transition cx-press hover:bg-[var(--cx-hover)] disabled:opacity-40"
                >
                  {geocoding ? <Loader2 className="size-3 animate-spin" /> : <Locate className="size-3" />}
                  Εντοπισμός από διεύθυνση
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <Field label="Lat">
                  <input value={lat} onChange={(e) => setLat(e.target.value)}
                    placeholder="37.9838"
                    className="h-7 w-full rounded-md border border-border bg-background px-2.5 font-mono text-[11px] outline-none focus:border-[var(--cx-accent)] focus:ring-1 focus:ring-[var(--cx-accent)]" />
                </Field>
                <Field label="Lng">
                  <input value={lng} onChange={(e) => setLng(e.target.value)}
                    placeholder="23.7275"
                    className="h-7 w-full rounded-md border border-border bg-background px-2.5 font-mono text-[11px] outline-none focus:border-[var(--cx-accent)] focus:ring-1 focus:ring-[var(--cx-accent)]" />
                </Field>
              </div>
              <Field label={`Ακτίνα κάλυψης · ${radius} km`}>
                <input
                  type="range"
                  min={5} max={500} step={5}
                  value={radius}
                  onChange={(e) => setRadius(e.target.value)}
                  className="w-full accent-[var(--cx-accent)]"
                />
              </Field>

              {/* Map preview */}
              <PartnerCoverageMap
                lat={lat ? Number(lat) : null}
                lng={lng ? Number(lng) : null}
                radiusKm={Number(radius) || 0}
                apiKey={mapApiKey ?? null}
              />
            </div>

            {/* Primary toggle */}
            <label className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-2.5 py-1.5">
              <input
                type="checkbox"
                checked={isPrimary}
                onChange={(e) => setIsPrimary(e.target.checked)}
                className="size-4 accent-[var(--cx-accent)]"
              />
              <Star className={cn("size-3.5", isPrimary ? "text-amber-500" : "text-muted-foreground")} fill={isPrimary ? "currentColor" : "none"} />
              <span className="text-[12px] font-semibold">Κεντρική έδρα (HQ)</span>
              <span className="text-[10px] text-muted-foreground">
                — μόνο ένα branch ορίζεται ως κεντρικό
              </span>
            </label>

            {error && (
              <div className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] text-rose-800">
                {error}
              </div>
            )}
          </div>

          <DialogFooter>
            {!isCreate && branch?.id && (
              <Button
                variant="destructive"
                size="sm"
                disabled={pending || deleting}
                onClick={() => setConfirmDelete(true)}
                className="mr-auto"
              >
                <Trash2 className="size-3.5" />
                Διαγραφή
              </Button>
            )}
            <Button variant="outline" disabled={pending} onClick={() => setOpen(false)}>
              Άκυρο
            </Button>
            <Button onClick={handleSave} disabled={pending || !legalName.trim()}>
              {pending ? "Αποθήκευση…" : "Αποθήκευση"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation dialog for delete */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Διαγραφή υποκαταστήματος;</DialogTitle>
            <DialogDescription>
              Το «{branch?.commercialName ?? branch?.legalName}» θα διαγραφεί. Όχηματα/υπάλληλοι που σχετίζονται θα αποσυνδεθούν.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={deleting} onClick={() => setConfirmDelete(false)}>
              Άκυρο
            </Button>
            <Button variant="destructive" disabled={deleting} onClick={handleDelete}>
              {deleting ? "Διαγραφή…" : "Διαγραφή"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({
  label, children, required,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="cx-eyebrow">
        {label}{required && <span className="text-rose-600">*</span>}
      </span>
      {children}
    </label>
  );
}
