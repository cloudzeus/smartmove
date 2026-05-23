"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Compact data table for the carrier admin (density 9/10).
 * - 32px row height, tabular-nums, sticky header.
 * - Keyboard: j/k or ↑/↓ to move, Enter to open, e for primary edit.
 * - Hover-revealed actions on the right.
 *
 * Generic over the row type. Columns describe rendering + alignment.
 */

export interface DataTableColumn<T> {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  align?: "left" | "right" | "center";
  width?: string;
  /** Sets `tabular-nums` and right-align by default. */
  numeric?: boolean;
}

export interface DataTableProps<T> {
  rows: T[];
  columns: DataTableColumn<T>[];
  getRowId: (row: T) => string;
  onOpen?: (row: T) => void;
  /** Right-side hover actions per row. */
  rowActions?: (row: T) => React.ReactNode;
  emptyState?: React.ReactNode;
  className?: string;
  /** Compact (28px) vs default (32px) row height. */
  compact?: boolean;
}

export function DataTable<T>({
  rows,
  columns,
  getRowId,
  onOpen,
  rowActions,
  emptyState,
  className,
  compact = false,
}: DataTableProps<T>) {
  const [focusIdx, setFocusIdx] = React.useState<number | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  function move(delta: number) {
    if (rows.length === 0) return;
    setFocusIdx((cur) => {
      const next = cur === null ? 0 : Math.max(0, Math.min(rows.length - 1, cur + delta));
      const el = containerRef.current?.querySelector<HTMLTableRowElement>(
        `tr[data-row-idx="${next}"]`,
      );
      el?.focus();
      return next;
    });
  }

  function handleKey(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.key === "j" || e.key === "ArrowDown") { e.preventDefault(); move(1); }
    else if (e.key === "k" || e.key === "ArrowUp") { e.preventDefault(); move(-1); }
    else if (e.key === "Enter" && focusIdx !== null && onOpen) {
      e.preventDefault();
      onOpen(rows[focusIdx]);
    }
  }

  if (rows.length === 0 && emptyState) {
    return <div className={cn("cx-fade-in", className)}>{emptyState}</div>;
  }

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label="Πίνακας δεδομένων"
      tabIndex={0}
      onKeyDown={handleKey}
      className={cn("cx-fade-in cx-card relative outline-none focus-visible:ring-1 focus-visible:ring-ring", className)}
    >
      <table
        className="cx-table table-fixed w-full"
        style={{ ["--cx-row-h" as string]: compact ? "var(--cx-row-h-sm)" : undefined }}
      >
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                style={{ width: c.width, textAlign: c.numeric ? "right" : c.align ?? "left" }}
              >
                {c.header}
              </th>
            ))}
            {rowActions && <th style={{ width: 1 }} aria-label="" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const id = getRowId(row);
            const focused = focusIdx === idx;
            return (
              <tr
                key={id}
                data-row-idx={idx}
                tabIndex={-1}
                onClick={() => onOpen?.(row)}
                onFocus={() => setFocusIdx(idx)}
                className={cn(
                  "group/row outline-none",
                  onOpen && "cursor-pointer",
                  focused && "bg-[var(--cx-hover)]",
                )}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn(c.numeric && "cx-num")}
                    style={{ textAlign: c.numeric ? "right" : c.align ?? "left" }}
                  >
                    {c.cell(row)}
                  </td>
                ))}
                {rowActions && (
                  <td className="!overflow-visible">
                    <div className="flex items-center justify-end gap-1 opacity-0 cx-transition group-hover/row:opacity-100 group-focus-within/row:opacity-100">
                      {rowActions(row)}
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Minimal section header used above tables. */
export function SectionHeader({
  title,
  count,
  right,
}: {
  title: string;
  count?: number;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-2 flex items-end justify-between gap-3">
      <div className="flex items-baseline gap-2">
        <h3 className="cx-eyebrow">{title}</h3>
        {count !== undefined && (
          <span className="text-[11px] tabular-nums text-muted-foreground/70">{count}</span>
        )}
      </div>
      {right}
    </div>
  );
}

/** Compact inline action button for tables (hover-revealed by parent). */
export function RowAction({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={(e) => { e.stopPropagation(); onClick?.(e); }}
      className="grid h-6 min-w-6 place-items-center rounded-sm px-1.5 text-[11px] font-medium text-muted-foreground cx-transition cx-press hover:bg-[var(--cx-hover)] hover:text-foreground"
    >
      {children}
    </button>
  );
}
