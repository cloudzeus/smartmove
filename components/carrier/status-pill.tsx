import { cn } from "@/lib/utils";

/**
 * Unified status pill: dot + label. One ring, no background fill.
 * Density 9/10 — compact, neutral, status carried by the dot color only.
 */

type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "amber";

const TONE_CLS: Record<Tone, { dot: string; bg: string; text: string; ring: string }> = {
  neutral: { dot: "bg-muted-foreground/60", bg: "bg-muted",          text: "text-foreground/80",  ring: "ring-border" },
  info:    { dot: "bg-sky-500",             bg: "bg-sky-50",         text: "text-sky-900",        ring: "ring-sky-200" },
  success: { dot: "bg-emerald-500",         bg: "bg-emerald-50",     text: "text-emerald-900",    ring: "ring-emerald-200" },
  warning: { dot: "bg-amber-500",           bg: "bg-amber-50",       text: "text-amber-900",      ring: "ring-amber-200" },
  amber:   { dot: "bg-amber-500",           bg: "bg-amber-50",       text: "text-amber-900",      ring: "ring-amber-200" },
  danger:  { dot: "bg-rose-500",            bg: "bg-rose-50",        text: "text-rose-900",       ring: "ring-rose-200" },
};

const ENTRIES: Record<string, { label: string; tone: Tone }> = {
  // MoveRequest
  DRAFT:      { label: "Πρόχειρο",         tone: "neutral" },
  PUBLISHED:  { label: "Δέχεται προσφορές", tone: "info" },
  AWARDED:    { label: "Ανατέθηκε",         tone: "amber" },
  COMPLETED:  { label: "Ολοκληρώθηκε",      tone: "success" },
  CANCELLED:  { label: "Ακυρώθηκε",         tone: "danger" },

  // Offer
  OPEN:       { label: "Σε αναμονή",        tone: "info" },
  ACCEPTED:   { label: "Αποδεκτή",          tone: "success" },
  REJECTED:   { label: "Απορρίφθηκε",       tone: "danger" },
  EXPIRED:    { label: "Έληξε",             tone: "neutral" },
  WITHDRAWN:  { label: "Αποσύρθηκε",        tone: "neutral" },

  // Payment
  PENDING:    { label: "Σε εκκρεμότητα",    tone: "warning" },
  AUTHORIZED: { label: "Δεσμευμένο",        tone: "info" },
  CAPTURED:   { label: "Καταβλήθηκε",       tone: "success" },
  PAID:       { label: "Πληρώθηκε",         tone: "success" },
  FAILED:     { label: "Απέτυχε",           tone: "danger" },
  REFUNDED:   { label: "Επιστροφή",         tone: "neutral" },
  WAIVED:     { label: "Παραιτήθηκε",       tone: "neutral" },

  // Jobs / tasks
  SCHEDULED:  { label: "Προγραμματισμένη",  tone: "info" },
  PLANNED:    { label: "Προγραμματισμένη",  tone: "info" },
  CONFIRMED:  { label: "Επιβεβαιωμένη",     tone: "success" },
  IN_PROGRESS:{ label: "Σε εξέλιξη",        tone: "amber" },
  IN_TRANSIT: { label: "Σε εξέλιξη",        tone: "amber" },
  DONE:       { label: "Ολοκληρώθηκε",      tone: "success" },
  DELIVERED:  { label: "Παραδόθηκε",        tone: "success" },
  BLOCKED:    { label: "Μπλοκαρισμένη",     tone: "danger" },
};

export function StatusPill({
  status,
  size = "sm",
  className,
}: {
  status: string;
  size?: "xs" | "sm" | "md";
  className?: string;
}) {
  const entry = ENTRIES[status] ?? { label: status, tone: "neutral" as Tone };
  const t = TONE_CLS[entry.tone];
  const sizeCls =
    size === "xs"
      ? "h-5 gap-1.5 px-1.5 text-[10px]"
      : size === "md"
        ? "h-7 gap-2 px-2.5 text-xs"
        : "h-[22px] gap-1.5 px-2 text-[11px]";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full font-semibold ring-1 ring-inset",
        sizeCls,
        t.bg,
        t.text,
        t.ring,
        className,
      )}
    >
      <span aria-hidden className={cn("cx-dot", t.dot)} />
      {entry.label}
    </span>
  );
}

export function statusLabel(status: string): string {
  return ENTRIES[status]?.label ?? status;
}

export function statusTone(status: string): Tone {
  return ENTRIES[status]?.tone ?? "neutral";
}
