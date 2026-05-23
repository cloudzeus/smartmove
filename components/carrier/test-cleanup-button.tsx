"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eraser } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { cleanupCarrierTestData } from "@/server/actions/carrier-test-cleanup.action";

export function TestCleanupButton() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleConfirm() {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await cleanupCarrierTestData();
      if (res.ok) {
        const r = res.report;
        setSuccess(
          `Διαγράφηκαν ${r.jobTasksDeleted} εργασίες, ${r.partnerQuoteRequestsDeleted} partner quotes, ${r.carrierProjectsDeleted} projects. ` +
          `Ghost: ${r.ghostJobTasksWithMissingMove} χωρίς move, ${r.ghostJobTasksWithMissingEmployee} stale employee, ${r.ghostJobTasksWithMissingPartner} stale partner, ${r.ghostJobTasksWithMissingProjectService} stale project-service.`,
        );
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
        onClick={() => { setOpen(true); setError(null); setSuccess(null); }}
        className="inline-flex h-7 items-center gap-1.5 rounded-md border border-rose-200 bg-rose-50 px-2.5 text-[11px] font-semibold text-rose-800 cx-transition cx-press hover:bg-rose-100"
      >
        <Eraser className="size-3" />
        Καθαρισμός δοκιμαστικών δεδομένων
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Καθαρισμός δοκιμαστικών δεδομένων;</DialogTitle>
            <DialogDescription>
              Θα διαγραφούν όλες οι εργασίες (JobTasks), τα partner quote
              requests και τα carrier projects της εταιρείας σου. Επίσης θα
              αποσυνδεθούν τυχόν ghost references σε διαγραμμένους υπαλλήλους/συνεργάτες.
              Οι MoveRequests (αιτήματα πελατών) δεν θα διαγραφούν.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-800">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-800">
              {success}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" disabled={pending} onClick={() => setOpen(false)}>
              {success ? "Κλείσιμο" : "Άκυρο"}
            </Button>
            {!success && (
              <Button variant="destructive" disabled={pending} onClick={handleConfirm}>
                {pending ? "Καθαρισμός…" : "Καθαρισμός"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
