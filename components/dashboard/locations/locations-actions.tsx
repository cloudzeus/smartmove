"use client";

import { useState } from "react";
import { History, Plus } from "lucide-react";

import { LocationDialog } from "./location-dialog";
import { ImportFromHistoryDialog } from "./import-from-history-dialog";

export function LocationsActions() {
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setImporting(true)}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:border-[var(--color-brand-blue)]/40 hover:bg-secondary"
        >
          <History className="size-4" />
          Από προηγούμενα αιτήματα
        </button>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[var(--color-brand-blue)] px-5 text-sm font-bold text-white shadow-[var(--shadow-cta)] hover:bg-[var(--color-brand-blue-deep)]"
        >
          <Plus className="size-4" />
          Νέα διεύθυνση
        </button>
      </div>
      <LocationDialog open={adding} onOpenChange={setAdding} />
      <ImportFromHistoryDialog open={importing} onOpenChange={setImporting} />
    </>
  );
}
