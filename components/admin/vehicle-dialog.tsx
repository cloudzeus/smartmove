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
import { Textarea } from "@/components/ui/textarea";
import { ImageUploader } from "@/components/shared/image-uploader";
import { upsertVehicle } from "@/server/actions/vehicles.action";

const VEHICLE_TYPES = [
  { value: "VAN_SMALL", label: "Μικρό βαν" },
  { value: "VAN_LARGE", label: "Μεγάλο βαν" },
  { value: "TRUCK_3_5T", label: "Φορτηγό 3.5T" },
  { value: "TRUCK_5T", label: "Φορτηγό 5T" },
  { value: "TRUCK_7_5T", label: "Φορτηγό 7.5T" },
  { value: "TRUCK_12T", label: "Φορτηγό 12T" },
  { value: "TRAILER", label: "Νταλίκα" },
  { value: "OTHER", label: "Άλλο" },
] as const;

export interface VehicleFormValues {
  id?: string;
  tenantId: string;
  branchId?: string | null;
  plate?: string;
  brand?: string;
  model?: string;
  year?: number;
  vehicleType?: string;
  capacityKg?: number;
  capacityM3?: number;
  fuelType?: string;
  color?: string;
  baseAddress?: string | null;
  baseLat?: number | null;
  baseLng?: number | null;
  costPerKmCents?: number | null;
  minTripCents?: number | null;
  callOutCents?: number | null;
  insuranceExpiresAt?: string | null;
  ktoExpiresAt?: string | null;
  status?: string;
  notes?: string;
  photoUrl?: string | null;
  registrationDocUrl?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  branches: Array<{ id: string; legalName: string }>;
  initial?: VehicleFormValues | null;
}

export function VehicleDialog({
  open,
  onOpenChange,
  tenantId,
  branches,
  initial,
}: Props) {
  const router = useRouter();
  const [vehicleType, setVehicleType] = useState(
    initial?.vehicleType ?? "VAN_LARGE",
  );
  const [branchId, setBranchId] = useState(initial?.branchId ?? "");
  const [photoUrl, setPhotoUrl] = useState<string | null>(
    initial?.photoUrl ?? null,
  );
  const [registrationDocUrl, setRegistrationDocUrl] = useState<string | null>(
    initial?.registrationDocUrl ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const editing = !!initial?.id;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const payload = {
      id: initial?.id,
      tenantId,
      branchId: branchId || null,
      plate: String(fd.get("plate") ?? ""),
      brand: String(fd.get("brand") ?? "") || undefined,
      model: String(fd.get("model") ?? "") || undefined,
      year: fd.get("year") ? Number(fd.get("year")) : undefined,
      vehicleType,
      capacityKg: fd.get("capacityKg") ? Number(fd.get("capacityKg")) : undefined,
      capacityM3: fd.get("capacityM3") ? Number(fd.get("capacityM3")) : undefined,
      fuelType: String(fd.get("fuelType") ?? "") || undefined,
      color: String(fd.get("color") ?? "") || undefined,
      baseAddress: String(fd.get("baseAddress") ?? "") || undefined,
      costPerKmCents: fd.get("costPerKmEur")
        ? Math.round(Number(fd.get("costPerKmEur")) * 100)
        : undefined,
      minTripCents: fd.get("minTripEur")
        ? Math.round(Number(fd.get("minTripEur")) * 100)
        : undefined,
      callOutCents: fd.get("callOutEur")
        ? Math.round(Number(fd.get("callOutEur")) * 100)
        : undefined,
      insuranceExpiresAt: String(fd.get("insuranceExpiresAt") ?? "") || undefined,
      ktoExpiresAt: String(fd.get("ktoExpiresAt") ?? "") || undefined,
      status: String(fd.get("status") ?? "ACTIVE"),
      notes: String(fd.get("notes") ?? "") || undefined,
      photoUrl,
      registrationDocUrl,
    };
    start(async () => {
      const res = await upsertVehicle(payload);
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
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-3xl">
        <DialogHeader className="border-b border-border p-5">
          <DialogTitle>
            {editing ? "Επεξεργασία οχήματος" : "Νέο όχημα στόλου"}
          </DialogTitle>
          <DialogDescription>
            Πινακίδα, στοιχεία και χωρητικότητα.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={onSubmit}
          className="flex min-h-0 flex-1 flex-col"
          id="vehicle-form"
        >
          <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-foreground">
                Πινακίδα *
              </span>
              <Input
                name="plate"
                defaultValue={initial?.plate}
                required
                className="font-mono uppercase tracking-widest"
                placeholder="ΥΑΕ-1234"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-foreground">
                Υποκατάστημα
              </span>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="h-11 rounded-lg border border-input bg-card px-3 text-sm font-medium text-foreground focus-visible:border-[var(--color-brand-blue)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
              >
                <option value="">— Έδρα —</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.legalName}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-foreground">
              Τύπος οχήματος
            </span>
            <select
              value={vehicleType}
              onChange={(e) => setVehicleType(e.target.value)}
              className="h-11 rounded-lg border border-input bg-card px-3 text-sm font-medium text-foreground focus-visible:border-[var(--color-brand-blue)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
            >
              {VEHICLE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-3 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-foreground">
                Μάρκα
              </span>
              <Input name="brand" defaultValue={initial?.brand} placeholder="Mercedes" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-foreground">
                Μοντέλο
              </span>
              <Input name="model" defaultValue={initial?.model} placeholder="Sprinter" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-foreground">
                Έτος
              </span>
              <Input
                type="number"
                min={1990}
                max={2099}
                name="year"
                defaultValue={initial?.year}
                placeholder="2020"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-foreground">
                Χωρητικότητα (kg)
              </span>
              <Input
                type="number"
                step="1"
                name="capacityKg"
                defaultValue={initial?.capacityKg}
                placeholder="3500"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-foreground">
                Χωρητικότητα (m³)
              </span>
              <Input
                type="number"
                step="0.1"
                name="capacityM3"
                defaultValue={initial?.capacityM3}
                placeholder="14"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-foreground">
                Καύσιμο
              </span>
              <Input name="fuelType" defaultValue={initial?.fuelType} placeholder="Diesel" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-foreground">
                Χρώμα
              </span>
              <Input name="color" defaultValue={initial?.color} placeholder="Λευκό" />
            </label>
          </div>

          {/* Pricing & dispatch */}
          <div className="rounded-xl border border-dashed border-border bg-secondary/30 p-3">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              Τιμολόγηση & βάση
            </p>
            <label className="mb-2 flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-foreground">
                Διεύθυνση βάσης (από όπου ξεκινά)
              </span>
              <Input
                name="baseAddress"
                defaultValue={initial?.baseAddress ?? undefined}
                placeholder="Π.χ. Αθήνα, Πειραιάς, Θεσσαλονίκη"
              />
              <span className="text-[10px] text-muted-foreground">
                Αν κενό, χρησιμοποιείται η διεύθυνση του υποκαταστήματος.
              </span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-foreground">
                  €/χλμ
                </span>
                <Input
                  type="number"
                  step="0.01"
                  name="costPerKmEur"
                  defaultValue={
                    initial?.costPerKmCents != null
                      ? initial.costPerKmCents / 100
                      : undefined
                  }
                  placeholder="0.80"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-foreground">
                  Ελάχιστο €
                </span>
                <Input
                  type="number"
                  step="1"
                  name="minTripEur"
                  defaultValue={
                    initial?.minTripCents != null
                      ? initial.minTripCents / 100
                      : undefined
                  }
                  placeholder="50"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-foreground">
                  Πάγιο €
                </span>
                <Input
                  type="number"
                  step="1"
                  name="callOutEur"
                  defaultValue={
                    initial?.callOutCents != null
                      ? initial.callOutCents / 100
                      : undefined
                  }
                  placeholder="20"
                />
              </label>
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">
              Κόστος ταξιδιού ≈ Πάγιο + (βάση → παραλαβή + παραλαβή → παράδοση + παράδοση → βάση) × €/χλμ. Με κάτω όριο το ελάχιστο.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-foreground">
                Λήξη ασφάλισης
              </span>
              <Input
                type="date"
                name="insuranceExpiresAt"
                defaultValue={initial?.insuranceExpiresAt?.slice(0, 10)}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-foreground">
                Λήξη ΚΤΕΟ
              </span>
              <Input
                type="date"
                name="ktoExpiresAt"
                defaultValue={initial?.ktoExpiresAt?.slice(0, 10)}
              />
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-foreground">
              Κατάσταση
            </span>
            <select
              name="status"
              defaultValue={initial?.status ?? "ACTIVE"}
              className="h-11 rounded-lg border border-input bg-card px-3 text-sm font-medium text-foreground"
            >
              <option value="ACTIVE">Ενεργό</option>
              <option value="MAINTENANCE">Συντήρηση</option>
              <option value="INACTIVE">Ανενεργό</option>
            </select>
          </label>

          <div className="grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
            <ImageUploader
              value={photoUrl}
              onChange={setPhotoUrl}
              purpose="vehicle-photo"
              label="Φωτογραφία οχήματος"
              hint="Έως 5MB"
              preview="wide"
            />
            <ImageUploader
              value={registrationDocUrl}
              onChange={setRegistrationDocUrl}
              purpose="vehicle-doc"
              label="Άδεια κυκλοφορίας"
              hint="Φωτογραφία ή scan"
              preview="wide"
            />
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-foreground">
              Σημειώσεις
            </span>
            <Textarea name="notes" defaultValue={initial?.notes} rows={2} />
          </label>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
              {error}
            </div>
          )}
          </div>

          <div className="flex gap-2 border-t border-border bg-card p-4">
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
