"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Building,
  History,
  Home,
  Loader2,
  MapPin,
  Package,
  Search,
  Sparkles,
  Trees,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  getAddressesFromHistory,
  importLocationFromAddress,
  type HistoryAddress,
} from "@/server/actions/locations.action";

const TYPES = [
  { value: "HOME", label: "Κατοικία", icon: Home },
  { value: "OFFICE", label: "Γραφείο", icon: Building },
  { value: "STORAGE", label: "Αποθήκη", icon: Package },
  { value: "COUNTRY_HOUSE", label: "Εξοχικό", icon: Trees },
  { value: "OTHER", label: "Άλλο", icon: Sparkles },
] as const;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportFromHistoryDialog({ open, onOpenChange }: Props) {
  const router = useRouter();
  const [addresses, setAddresses] = useState<HistoryAddress[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<HistoryAddress | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<string>("HOME");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    setPicked(null);
    setName("");
    getAddressesFromHistory()
      .then((list) => setAddresses(list))
      .catch(() => setAddresses([]))
      .finally(() => setLoading(false));
  }, [open]);

  const filtered = addresses?.filter((a) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      a.address.toLowerCase().includes(q) ||
      (a.city ?? "").toLowerCase().includes(q) ||
      (a.postalZip ?? "").includes(q)
    );
  });

  function submit() {
    if (!picked || !name.trim()) {
      setError("Διάλεξε μια διεύθυνση και δώσε ένα όνομα.");
      return;
    }
    setError(null);
    start(async () => {
      const res = await importLocationFromAddress({
        address: picked.address,
        name,
        type,
        city: picked.city ?? undefined,
        postal: picked.postalZip ?? undefined,
      });
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="size-4 text-[var(--color-brand-blue)]" />
            Εισαγωγή από προηγούμενα αιτήματα
          </DialogTitle>
          <DialogDescription>
            Διάλεξε μια διεύθυνση που έχεις ήδη χρησιμοποιήσει και δώσε της ένα
            ξεχωριστό όνομα.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : !addresses || addresses.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-secondary/30 p-8 text-center">
            <p className="text-sm font-semibold text-foreground">
              Δεν βρέθηκαν διευθύνσεις
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Δημιούργησε πρώτα κάποιο αίτημα μεταφοράς και επέστρεψε εδώ.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
            {/* List */}
            <div className="flex max-h-[440px] flex-col gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Αναζήτηση…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <ul className="flex-1 space-y-1.5 overflow-y-auto rounded-xl border border-border bg-secondary/20 p-1.5">
                {filtered?.length === 0 ? (
                  <li className="px-3 py-4 text-center text-xs text-muted-foreground">
                    Δεν ταιριάζει κάποια διεύθυνση
                  </li>
                ) : (
                  filtered?.map((a) => {
                    const active = picked?.address === a.address;
                    return (
                      <li key={a.address}>
                        <button
                          type="button"
                          onClick={() => {
                            setPicked(a);
                            if (!name) {
                              // Pre-fill with a best-guess from city
                              setName(a.city ?? a.address.split(",")[0] ?? "");
                            }
                          }}
                          className={cn(
                            "flex w-full items-start gap-3 rounded-lg border-2 px-3 py-2.5 text-left transition-colors",
                            active
                              ? "border-[var(--color-brand-blue)] bg-[var(--color-brand-blue-light)]"
                              : "border-transparent bg-card hover:border-[var(--color-brand-blue)]/30",
                          )}
                        >
                          <span
                            className={cn(
                              "grid size-8 shrink-0 place-items-center rounded-lg",
                              active
                                ? "bg-[var(--color-brand-blue)] text-white"
                                : "bg-[var(--color-brand-blue-light)] text-[var(--color-brand-blue-deep)]",
                            )}
                          >
                            <MapPin className="size-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-foreground">
                              {a.address}
                            </span>
                            {(a.city || a.postalZip) && (
                              <span className="block text-[11px] text-muted-foreground">
                                {a.postalZip} {a.city}
                              </span>
                            )}
                            <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                              {a.usedCount} {a.usedCount === 1 ? "χρήση" : "χρήσεις"}{" "}
                              · τελευταία{" "}
                              {new Intl.DateTimeFormat("el-GR", {
                                day: "2-digit",
                                month: "short",
                              }).format(a.lastUsedAt)}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            </div>

            {/* Save panel */}
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Νέα τοποθεσία
              </p>
              {picked ? (
                <>
                  <div className="rounded-xl border border-border bg-secondary/40 p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Διεύθυνση
                    </p>
                    <p className="text-sm font-semibold text-foreground">
                      {picked.address}
                    </p>
                    {(picked.city || picked.postalZip) && (
                      <p className="text-[11px] text-muted-foreground">
                        {picked.postalZip} {picked.city}
                      </p>
                    )}
                  </div>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-semibold text-foreground">
                      Όνομα
                    </span>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="π.χ. Σπίτι Αθήνα"
                      autoFocus
                    />
                  </label>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-semibold text-foreground">
                      Τύπος
                    </span>
                    <div className="grid grid-cols-5 gap-1">
                      {TYPES.map((t) => {
                        const active = type === t.value;
                        return (
                          <button
                            key={t.value}
                            type="button"
                            onClick={() => setType(t.value)}
                            className={cn(
                              "flex flex-col items-center gap-0.5 rounded-lg border-2 px-1 py-1.5 text-[10px] font-medium",
                              active
                                ? "border-[var(--color-brand-blue)] bg-[var(--color-brand-blue-light)] text-[var(--color-brand-blue-deep)]"
                                : "border-border bg-card text-muted-foreground",
                            )}
                          >
                            <t.icon className="size-3.5" />
                            {t.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-xl border border-dashed border-border bg-card px-3 py-8 text-center text-xs text-muted-foreground">
                  Διάλεξε μία διεύθυνση από τη λίστα →
                </div>
              )}

              {error && (
                <p className="flex items-start gap-1.5 text-xs text-destructive">
                  <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                  {error}
                </p>
              )}
            </div>
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
            type="button"
            className="h-10 flex-1 shadow-[var(--shadow-cta)]"
            onClick={submit}
            disabled={pending || !picked || !name.trim()}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              "Αποθήκευση τοποθεσίας"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
