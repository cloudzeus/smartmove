"use client";

import { useMemo, useState } from "react";
import { CheckSquare, Square } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  PERMISSIONS,
  PERMISSION_GROUPS,
  type Permission,
} from "@/lib/permissions";

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
  /** Hide superadmin-only checkboxes when the actor itself isn't superadmin. */
  actorIsSuperadmin?: boolean;
  /** Disable everything (used when the target is SUPERADMIN — they have all). */
  disabled?: boolean;
}

export function PermissionsMatrix({
  value,
  onChange,
  actorIsSuperadmin = true,
  disabled = false,
}: Props) {
  const set = useMemo(() => new Set(value), [value]);

  function toggle(key: Permission) {
    if (disabled) return;
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange(Array.from(next));
  }

  function toggleGroup(group: string, on: boolean) {
    if (disabled) return;
    const next = new Set(set);
    for (const p of PERMISSIONS) {
      if (p.group !== group) continue;
      if (p.superadminOnly && !actorIsSuperadmin) continue;
      if (on) next.add(p.key);
      else next.delete(p.key);
    }
    onChange(Array.from(next));
  }

  return (
    <div className="flex flex-col gap-4">
      {disabled && (
        <div className="rounded-xl border border-[var(--color-brand-blue)]/30 bg-[var(--color-brand-blue-light)] px-4 py-3 text-xs text-[var(--color-brand-blue-deep)]">
          Οι SUPERADMIN έχουν αυτόματα όλα τα δικαιώματα. Δεν χρειάζονται
          ξεχωριστή ρύθμιση εδώ.
        </div>
      )}

      {PERMISSION_GROUPS.map((group) => {
        const items = PERMISSIONS.filter((p) => p.group === group);
        const visible = items.filter(
          (p) => actorIsSuperadmin || !p.superadminOnly,
        );
        const grantedInGroup = items.filter((p) => set.has(p.key)).length;
        const allSelected = visible.length > 0 && visible.every((p) => set.has(p.key));

        return (
          <section
            key={group}
            className={cn(
              "rounded-2xl border border-border bg-card",
              disabled && "opacity-60",
            )}
          >
            <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <div>
                <h3 className="font-display text-sm font-bold text-foreground">
                  {group}
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  {grantedInGroup} από {items.length} ενεργά
                </p>
              </div>
              <button
                type="button"
                onClick={() => toggleGroup(group, !allSelected)}
                disabled={disabled || visible.length === 0}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
              >
                {allSelected ? (
                  <CheckSquare className="size-3.5 text-[var(--color-brand-blue)]" />
                ) : (
                  <Square className="size-3.5" />
                )}
                {allSelected ? "Καθαρισμός" : "Επιλογή όλων"}
              </button>
            </header>

            <ul className="divide-y divide-border">
              {items.map((p) => {
                const granted = set.has(p.key);
                const hidden = p.superadminOnly && !actorIsSuperadmin;
                return (
                  <li
                    key={p.key}
                    className={cn(
                      "flex items-start gap-3 px-4 py-3",
                      hidden && "opacity-50",
                    )}
                  >
                    <label className="flex flex-1 cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        checked={granted}
                        onChange={() => toggle(p.key)}
                        disabled={disabled || hidden}
                        className="mt-0.5 size-4 cursor-pointer rounded border-border accent-[var(--color-brand-blue)] disabled:cursor-not-allowed"
                      />
                      <span className="flex min-w-0 flex-col">
                        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                          {p.label}
                          {p.superadminOnly && (
                            <span className="rounded-full bg-[var(--color-brand-red)]/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--color-brand-red-deep)]">
                              SuperAdmin
                            </span>
                          )}
                          <span className="ml-auto rounded-md bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                            {p.key}
                          </span>
                        </span>
                        <span className="mt-0.5 text-xs text-muted-foreground">
                          {p.description}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
