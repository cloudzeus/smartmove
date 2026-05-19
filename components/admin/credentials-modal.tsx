"use client";

import { useState } from "react";
import { Check, Copy, Eye, EyeOff, KeyRound } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string;
  password: string;
  title?: string;
  hint?: string;
}

export function CredentialsModal({
  open,
  onOpenChange,
  email,
  password,
  title = "Νέος κωδικός υπαλλήλου",
  hint = "Αυτός ο κωδικός εμφανίζεται μία και μόνο φορά. Αντίγραψέ τον τώρα και κοινοποίησέ τον με ασφαλή τρόπο.",
}: Props) {
  const [show, setShow] = useState(false);
  const [copiedField, setCopiedField] = useState<"email" | "password" | null>(
    null,
  );

  async function copy(text: string, field: "email" | "password") {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
    } catch {}
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-amber-100 text-amber-700">
              <KeyRound className="size-4" />
            </span>
            {title}
          </DialogTitle>
          <DialogDescription>{hint}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <Field label="Email">
            <div className="flex h-11 items-center justify-between gap-2 rounded-lg border border-border bg-secondary/40 px-3 font-mono text-sm">
              <span className="truncate">{email}</span>
              <button
                type="button"
                onClick={() => copy(email, "email")}
                className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-card hover:text-foreground"
                title="Αντιγραφή"
              >
                {copiedField === "email" ? (
                  <Check className="size-3.5 text-emerald-600" />
                ) : (
                  <Copy className="size-3.5" />
                )}
              </button>
            </div>
          </Field>

          <Field label="Προσωρινός κωδικός">
            <div className="flex h-11 items-center justify-between gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 font-mono text-sm font-bold tracking-widest">
              <span className={cn("truncate", !show && "blur-[6px] select-none")}>
                {password}
              </span>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-card hover:text-foreground"
                  title={show ? "Απόκρυψη" : "Εμφάνιση"}
                >
                  {show ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => copy(password, "password")}
                  className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-card hover:text-foreground"
                  title="Αντιγραφή"
                >
                  {copiedField === "password" ? (
                    <Check className="size-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                </button>
              </div>
            </div>
          </Field>

          <p className="rounded-lg bg-secondary/40 px-3 py-2 text-[11px] text-muted-foreground">
            Ο υπάλληλος μπορεί να αλλάξει αυτόν τον κωδικό από{" "}
            <strong>Λογαριασμός → Αλλαγή κωδικού</strong> μετά τη σύνδεση.
          </p>
        </div>

        <div className="border-t border-border pt-3">
          <Button
            className="h-10 w-full shadow-[var(--shadow-cta)]"
            onClick={() => onOpenChange(false)}
          >
            Κατάλαβα, το έσωσα
          </Button>
        </div>
      </DialogContent>
    </Dialog>
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
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}
