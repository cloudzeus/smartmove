"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function MarketingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex h-[60vh] max-w-[1280px] flex-col items-center justify-center gap-5 px-4 text-center">
      <div className="grid size-14 place-items-center rounded-2xl bg-[var(--color-brand-red-light)] text-[var(--color-brand-red-deep)]">
        <AlertTriangle className="size-7" />
      </div>
      <div className="max-w-md">
        <h1 className="font-display text-2xl font-bold text-foreground">
          Κάτι πήγε στραβά
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Συγγνώμη για την ταλαιπωρία. Δοκίμασε να ξαναφορτώσεις τη σελίδα.
        </p>
      </div>
      <Button onClick={reset} className="h-11 px-5">
        <RotateCcw className="mr-2 size-4" />
        Δοκίμασε ξανά
      </Button>
    </div>
  );
}
