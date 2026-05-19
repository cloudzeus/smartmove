"use client";

import * as React from "react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { format } from "date-fns";
import { el } from "date-fns/locale";

import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";

interface DatePickerProps {
  value?: Date | null;
  onChange?: (date: Date | null) => void;
  /** Name of a hidden input (yyyy-MM-dd) so it can be picked up by FormData. */
  name?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Bound min date for the calendar (e.g. start of trial when picking end). */
  fromDate?: Date;
  toDate?: Date;
  clearable?: boolean;
}

export function DatePicker({
  value,
  onChange,
  name,
  placeholder = "Επίλεξε ημερομηνία",
  disabled,
  className,
  fromDate,
  toDate,
  clearable = true,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [internal, setInternal] = React.useState<Date | null>(value ?? null);
  const isControlled = value !== undefined;
  const current = isControlled ? value ?? null : internal;

  function set(d: Date | null) {
    if (!isControlled) setInternal(d);
    onChange?.(d);
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger
        disabled={disabled}
        className={cn(
          "group inline-flex h-11 w-full items-center gap-2 rounded-lg border border-input bg-card px-3 text-sm font-medium text-foreground transition-colors hover:border-[var(--color-brand-blue)]/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-blue)]/40 disabled:cursor-not-allowed disabled:opacity-60",
          !current && "text-muted-foreground",
          className,
        )}
      >
        <CalendarIcon className="size-4 shrink-0 text-muted-foreground group-hover:text-[var(--color-brand-blue)]" />
        <span className="flex-1 truncate text-left">
          {current ? format(current, "d MMM yyyy", { locale: el }) : placeholder}
        </span>
        {clearable && current && !disabled && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              set(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                set(null);
              }
            }}
            className="grid size-5 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X className="size-3" />
          </span>
        )}
      </PopoverPrimitive.Trigger>

      {name && (
        <input
          type="hidden"
          name={name}
          value={current ? format(current, "yyyy-MM-dd") : ""}
        />
      )}

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner sideOffset={6} className="z-[70]">
          <PopoverPrimitive.Popup
            className={cn(
              "z-[70] rounded-xl border border-border bg-popover text-popover-foreground shadow-[0_10px_40px_rgba(15,23,42,0.12)] outline-none",
              "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0",
            )}
          >
            <Calendar
              mode="single"
              selected={current ?? undefined}
              onSelect={(d) => {
                set(d ?? null);
                setOpen(false);
              }}
              disabled={
                fromDate || toDate
                  ? { before: fromDate, after: toDate } as never
                  : undefined
              }
              defaultMonth={current ?? undefined}
            />
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
