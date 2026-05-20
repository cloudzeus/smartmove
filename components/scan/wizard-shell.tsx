"use client";

import { useCallback, useRef, useState } from "react";
import { ArrowLeft, MapPin, Repeat } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createMoveRequest } from "@/server/actions/move-request.action";
import { AuthGateDialog } from "./auth-gate-dialog";
import { ContractSummary } from "./contract-summary";
import { ManualItemPicker } from "./manual-item-picker";
import { MethodPicker } from "./method-picker";
import { ScanTool } from "./scan-tool";
import { StopsStep } from "./stops-step";
import { WizardStepper } from "./wizard-stepper";
import {
  DEFAULT_PROPERTY,
  type InventoryMethod,
  type JobItem,
  type MoveStop,
  type PropertyDetails,
  type RouteInfo,
  type WizardStep,
} from "./wizard-types";

export function WizardShell({ isAuthed = false }: { isAuthed?: boolean }) {
  const router = useRouter();
  const params = useSearchParams();

  const route: RouteInfo = {
    from: params.get("from") ?? "",
    to: params.get("to") ?? "",
    when: params.get("when") ?? "",
    flex: Number(params.get("flex") ?? "0") || 0,
    shared: params.get("shared") === "1" || params.get("shared") === "true",
    type: params.get("type") ?? "house",
  };

  const [step, setStep] = useState<WizardStep>("method");
  const [method, setMethod] = useState<InventoryMethod | null>(null);
  const [items, setItems] = useState<JobItem[]>([]);
  const [property, setProperty] = useState<PropertyDetails>(DEFAULT_PROPERTY);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitRef, setSubmitRef] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [multiStop, setMultiStop] = useState(false);
  const [stops, setStops] = useState<MoveStop[]>([]);
  const [authed, setAuthed] = useState(isAuthed);
  const [authOpen, setAuthOpen] = useState(false);
  const [authReason, setAuthReason] = useState<"ai" | "submit">("ai");
  const pendingActionRef = useRef<(() => void) | null>(null);

  const requireAuth = useCallback(
    (reason: "ai" | "submit", action: () => void) => {
      if (authed) {
        action();
        return;
      }
      pendingActionRef.current = action;
      setAuthReason(reason);
      setAuthOpen(true);
    },
    [authed],
  );

  const handleAuthed = useCallback(() => {
    setAuthed(true);
    const next = pendingActionRef.current;
    pendingActionRef.current = null;
    if (next) next();
  }, []);

  const handleMethodSelect = useCallback(
    (m: InventoryMethod) => {
      if (m === "ai") {
        requireAuth("ai", () => {
          setMethod("ai");
          setStep("inventory");
        });
        return;
      }
      setMethod(m);
      setStep("inventory");
    },
    [requireAuth],
  );

  const handleAiContinue = useCallback((aiItems: JobItem[]) => {
    setItems(aiItems);
    setStep("stops");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleManualContinue = useCallback(() => {
    setStep("stops");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleStopsContinue = useCallback(() => {
    setStep("details");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleBackToStops = useCallback(() => {
    setStep("stops");
  }, []);

  const handleBackToMethod = useCallback(() => {
    setStep("method");
    setMethod(null);
  }, []);

  const handleBackToInventory = useCallback(() => {
    setStep("inventory");
  }, []);

  const doSubmit = useCallback(async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await createMoveRequest({
        route: {
          from: route.from,
          to: route.to,
          when: route.when || undefined,
          flex: route.flex,
          shared: route.shared,
          type: route.type as "house" | "furniture" | "business" | "heavy",
        },
        multiStop,
        stops: multiStop
          ? stops.map((s, i) => ({
              type: s.type,
              sequence: i,
              label: s.label,
              address: s.address,
              floor: s.floor,
              elevator: s.elevator,
              notes: s.notes,
              itemIds: s.itemIds,
            }))
          : undefined,
        items,
        property: {
          fromFloor: property.fromFloor,
          toFloor: property.toFloor,
          fromElevator: property.fromElevator,
          toElevator: property.toElevator,
          crane: property.crane,
          packing: property.packing,
          truckAccess: property.truckAccess,
          notes: property.notes,
        },
      });

      if (!result.ok) {
        // If the server rejected because the user isn't authed
        // (e.g. session expired), prompt without losing state.
        if (/συνδεθ/i.test(result.error)) {
          setSubmitting(false);
          setAuthed(false);
          pendingActionRef.current = () => {
            void doSubmit();
          };
          setAuthReason("submit");
          setAuthOpen(true);
          return;
        }
        setSubmitError(result.error);
        setSubmitting(false);
        return;
      }

      setSubmitting(false);
      setSubmitted(true);
      setSubmitRef(result.ref);
      setEmailSent(result.emailSent);
      router.replace(`/scan?submitted=${result.ref}`);
    } catch (e) {
      setSubmitting(false);
      setSubmitError(
        e instanceof Error ? e.message : "Κάτι πήγε στραβά. Δοκίμασε ξανά.",
      );
    }
  }, [items, property, route, router, multiStop, stops]);

  const handleSubmit = useCallback(() => {
    requireAuth("submit", () => {
      void doSubmit();
    });
  }, [requireAuth, doSubmit]);

  return (
    <div className="flex flex-col gap-6">
      {/* Route bar (visible after step 1) */}
      {(route.from || route.to) && (
        <RouteBar route={route} />
      )}

      <WizardStepper current={step} />

      {step === "method" && <MethodPicker onSelect={handleMethodSelect} />}

      {step === "inventory" && method === "ai" && (
        <div className="flex flex-col gap-4">
          <Button
            variant="ghost"
            className="h-9 w-fit text-sm"
            onClick={handleBackToMethod}
          >
            <ArrowLeft className="mr-1 size-4" />
            Αλλαγή μεθόδου
          </Button>
          <ScanTool onContinue={handleAiContinue} onBack={handleBackToMethod} />
        </div>
      )}

      {step === "inventory" && method === "manual" && (
        <ManualItemPicker
          items={items}
          onChange={setItems}
          onContinue={handleManualContinue}
          onBack={handleBackToMethod}
        />
      )}

      {step === "stops" && (
        <StopsStep
          route={route}
          items={items}
          multiStop={multiStop}
          stops={stops}
          onMultiStopChange={setMultiStop}
          onStopsChange={setStops}
          onContinue={handleStopsContinue}
          onBack={handleBackToInventory}
        />
      )}

      {step === "details" && (
        <ContractSummary
          route={route}
          items={items}
          property={property}
          onPropertyChange={setProperty}
          onBack={handleBackToStops}
          onSubmit={handleSubmit}
          submitting={submitting}
          submitted={submitted}
          error={submitError}
          ref={submitRef}
          emailSent={emailSent}
        />
      )}

      <AuthGateDialog
        open={authOpen}
        onOpenChange={(open) => {
          setAuthOpen(open);
          if (!open) pendingActionRef.current = null;
        }}
        onAuthed={handleAuthed}
        title={
          authReason === "ai"
            ? "Σύνδεση για AI σκανάρισμα"
            : "Σύνδεση για να ολοκληρώσεις"
        }
        description={
          authReason === "ai"
            ? "Το AI σκανάρισμα χρειάζεται λογαριασμό για να αποθηκεύσει με ασφάλεια τις φωτογραφίες σου. Τα στοιχεία που έχεις ήδη συμπληρώσει διατηρούνται."
            : "Συνδέσου ή δημιούργησε λογαριασμό για να υποβάλεις το αίτημα. Τα στοιχεία που συμπλήρωσες διατηρούνται."
        }
      />
    </div>
  );
}

function RouteBar({ route }: { route: RouteInfo }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)] sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--color-brand-blue-light)] text-[var(--color-brand-blue-deep)]">
          <MapPin className="size-4" />
        </span>
        <div className="min-w-0">
          <p
            className={cn(
              "text-sm font-semibold leading-tight text-foreground",
              "truncate",
            )}
          >
            {route.from || <span className="text-muted-foreground">— από —</span>}
            <span className="mx-1.5 text-muted-foreground">→</span>
            {route.to || <span className="text-muted-foreground">— προς —</span>}
          </p>
          <p className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
            {route.when ? formatDate(route.when) : "Ημερομηνία αργότερα"}
            {route.flex > 0 && <span>· ±{route.flex} ημέρες</span>}
            {route.shared && (
              <span className="inline-flex items-center gap-1 text-emerald-700">
                · <Repeat className="size-3" /> Shared Load
              </span>
            )}
          </p>
        </div>
      </div>
      <Badge variant="secondary" className="self-start sm:self-center">
        {typeLabel(route.type)}
      </Badge>
    </div>
  );
}

function typeLabel(type: string): string {
  switch (type) {
    case "house":
      return "Μετακόμιση κατοικίας";
    case "furniture":
      return "Μεταφορά επίπλων";
    case "business":
      return "Επαγγελματικός εξοπλισμός";
    case "heavy":
      return "Βαρέα & ογκώδη";
    default:
      return "Μεταφορά";
  }
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("el-GR", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}
