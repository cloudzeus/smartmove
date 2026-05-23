"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { deleteCarrierMoveRequest } from "@/server/actions/carrier-job-delete.action";

interface Props {
  moveRequestId: string;
  routeLabel: string;
}

export function JobDeleteButton({ moveRequestId, routeLabel }: Props) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const res = await deleteCarrierMoveRequest(moveRequestId);
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
        title="Διαγραφή μεταφοράς"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className="grid size-7 shrink-0 place-items-center rounded-md border border-border bg-card text-muted-foreground cx-transition cx-press hover:border-rose-300 hover:text-rose-700 active:bg-rose-50"
      >
        <Trash2 className="size-3.5" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Διαγραφή μεταφοράς;</DialogTitle>
            <DialogDescription>
              Η μεταφορά «{routeLabel}» θα διαγραφεί οριστικά μαζί με όλα τα
              σχετικά: προσφορές, εργασίες, αναθέσεις προσωπικού, partner quote
              requests, projects. Η ενέργεια δεν αναιρείται.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-800">
              {error}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" disabled={pending} onClick={() => setOpen(false)}>
              Άκυρο
            </Button>
            <Button variant="destructive" disabled={pending} onClick={handleConfirm}>
              {pending ? "Διαγραφή…" : "Διαγραφή"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
