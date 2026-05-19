"use client";

import * as React from "react";
import { DayPicker } from "react-day-picker";
import { el } from "react-day-picker/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

export function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      locale={el}
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col gap-4 sm:flex-row sm:gap-6",
        month: "flex flex-col gap-3",
        month_caption: "flex items-center justify-center pt-1 relative",
        caption_label: "text-sm font-semibold text-foreground capitalize",
        nav: "flex items-center gap-1 absolute inset-x-0 top-1 justify-between px-1",
        button_previous: cn(
          "size-7 grid place-items-center rounded-md border border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors",
        ),
        button_next: cn(
          "size-7 grid place-items-center rounded-md border border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors",
        ),
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday:
          "text-muted-foreground w-9 text-[10px] font-bold uppercase tracking-wide",
        week: "flex w-full mt-1",
        day: "relative size-9 p-0 text-center text-sm focus-within:relative focus-within:z-20",
        day_button: cn(
          "size-9 rounded-md font-medium text-foreground hover:bg-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-blue)]/50 aria-selected:bg-[var(--color-brand-blue)] aria-selected:text-white aria-selected:hover:bg-[var(--color-brand-blue-deep)] transition-colors",
        ),
        today: "ring-1 ring-inset ring-[var(--color-brand-blue)]/40 rounded-md",
        outside: "text-muted-foreground/40",
        disabled: "text-muted-foreground/30 cursor-not-allowed",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: cls }) => {
          const Icon = orientation === "left" ? ChevronLeft : ChevronRight;
          return <Icon className={cn("size-4", cls)} />;
        },
      }}
      {...props}
    />
  );
}
