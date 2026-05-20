"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { signInAction, signUpAction } from "@/server/actions/auth.action";

interface AuthGateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAuthed: () => void;
  title?: string;
  description?: string;
}

type Mode = "signin" | "signup";

export function AuthGateDialog({
  open,
  onOpenChange,
  onAuthed,
  title = "Σύνδεση για να συνεχίσεις",
  description = "Χρειάζεται λογαριασμός για το AI σκανάρισμα. Τα στοιχεία που έχεις ήδη συμπληρώσει διατηρούνται.",
}: AuthGateDialogProps) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  async function handleSignIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await signInAction(fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
      onAuthed();
      onOpenChange(false);
    });
  }

  async function handleSignUp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await signUpAction(fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
      onAuthed();
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="mb-2 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 text-sm">
          <button
            type="button"
            onClick={() => {
              setMode("signin");
              setError(null);
            }}
            className={cn(
              "h-9 rounded-md font-semibold transition-colors",
              mode === "signin"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Σύνδεση
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("signup");
              setError(null);
            }}
            className={cn(
              "h-9 rounded-md font-semibold transition-colors",
              mode === "signup"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Εγγραφή
          </button>
        </div>

        {mode === "signin" ? (
          <form onSubmit={handleSignIn} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold">Email</span>
              <Input
                type="email"
                name="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold">Κωδικός</span>
              <Input
                type="password"
                name="password"
                autoComplete="current-password"
                required
                placeholder="••••••••"
              />
            </label>
            {error && <ErrorBanner message={error} />}
            <SubmitButton pending={pending} label="Σύνδεση" />
          </form>
        ) : (
          <form onSubmit={handleSignUp} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold">Όνομα</span>
              <Input
                type="text"
                name="name"
                autoComplete="name"
                required
                placeholder="Π.χ. Γιώργος Παπαδόπουλος"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold">Email</span>
              <Input
                type="email"
                name="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold">Τηλέφωνο (προαιρετικό)</span>
              <Input
                type="tel"
                name="phone"
                autoComplete="tel"
                placeholder="69xxxxxxxx"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold">Κωδικός</span>
              <Input
                type="password"
                name="password"
                autoComplete="new-password"
                required
                placeholder="Τουλάχιστον 8 χαρακτήρες"
              />
            </label>
            <label className="flex items-start gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                name="consent"
                required
                className="mt-0.5 size-4"
              />
              <span>
                Αποδέχομαι τους όρους χρήσης και την πολιτική απορρήτου.
              </span>
            </label>
            {error && <ErrorBanner message={error} />}
            <SubmitButton pending={pending} label="Δημιουργία λογαριασμού" />
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
      <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
      {message}
    </div>
  );
}

function SubmitButton({ pending, label }: { pending: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        "mt-1 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[var(--color-brand-blue)] text-sm font-bold text-white shadow-[var(--shadow-cta)] transition-colors",
        "hover:bg-[var(--color-brand-blue-deep)]",
        "disabled:cursor-not-allowed disabled:opacity-70",
      )}
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : label}
    </button>
  );
}
