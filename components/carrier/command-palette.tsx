"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Global command palette for carrier admin. ⌘K / Ctrl+K.
 *
 * Power-user navigation: type to filter routes, project codes, lead ids,
 * employee names. Routes are static; entity lookup hits server actions.
 * Subtle 200ms fade-in, single accent, no decorative icons.
 */

interface Command {
  id: string;
  label: string;
  hint?: string;
  group: string;
  run: () => void;
}

const ROUTES: Array<{ href: string; label: string; group: string; hint?: string }> = [
  { href: "/carrier",           label: "Επισκόπηση",          group: "Έργο" },
  { href: "/carrier/leads",     label: "Νέα αιτήματα",         group: "Έργο" },
  { href: "/carrier/offers",    label: "Προσφορές μου",        group: "Έργο" },
  { href: "/carrier/jobs",      label: "Μεταφορές",            group: "Έργο" },
  { href: "/carrier/projects",  label: "Projects",             group: "Έργο" },
  { href: "/carrier/tasks",     label: "Εργασίες",             group: "Έργο" },
  { href: "/carrier/calendar",  label: "Ημερολόγιο",           group: "Έργο" },
  { href: "/carrier/reviews",   label: "Αξιολογήσεις",         group: "Έργο" },
  { href: "/carrier/reports",   label: "Αναφορές",             group: "Έργο" },
  { href: "/carrier/fleet",     label: "Στόλος",               group: "Ομάδα" },
  { href: "/carrier/employees", label: "Υπάλληλοι",            group: "Ομάδα" },
  { href: "/carrier/partners",  label: "Συνεργάτες",           group: "Ομάδα" },
  { href: "/carrier/pricing",   label: "Τιμολόγιο",            group: "Ομάδα" },
  { href: "/carrier/branches",  label: "Υποκαταστήματα",       group: "Εταιρεία" },
  { href: "/carrier/team",      label: "Διαχείριση χρηστών",   group: "Εταιρεία" },
  { href: "/carrier/billing",   label: "Συνδρομή",             group: "Εταιρεία" },
  { href: "/carrier/settings",  label: "Ρυθμίσεις",            group: "Εταιρεία" },
];

export function CarrierCommandPalette() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [focusIdx, setFocusIdx] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  React.useEffect(() => {
    if (open) {
      setQ("");
      setFocusIdx(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const commands: Command[] = React.useMemo(() => {
    return ROUTES.map((r) => ({
      id: r.href,
      label: r.label,
      group: r.group,
      hint: r.hint,
      run: () => router.push(r.href),
    }));
  }, [router]);

  const filtered = React.useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return commands;
    return commands.filter((c) =>
      c.label.toLowerCase().includes(term) ||
      c.group.toLowerCase().includes(term) ||
      c.id.toLowerCase().includes(term),
    );
  }, [q, commands]);

  const groups = React.useMemo(() => {
    const m = new Map<string, Command[]>();
    for (const c of filtered) {
      if (!m.has(c.group)) m.set(c.group, []);
      m.get(c.group)!.push(c);
    }
    return Array.from(m.entries());
  }, [filtered]);

  function runIdx(idx: number) {
    const c = filtered[idx];
    if (!c) return;
    c.run();
    setOpen(false);
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusIdx((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      runIdx(focusIdx);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-foreground/20 pt-[15vh] cx-fade-in"
      onClick={() => setOpen(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[min(560px,calc(100vw-32px))] overflow-hidden rounded-md border border-border bg-popover shadow-lg"
      >
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <span className="text-xs font-medium text-muted-foreground">⌘K</span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => { setQ(e.target.value); setFocusIdx(0); }}
            onKeyDown={handleKey}
            placeholder="Αναζήτηση: σελίδα, ενότητα, ID…"
            className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="max-h-[50vh] overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">
              Καμία αντιστοίχιση
            </div>
          ) : (
            groups.map(([group, items]) => (
              <div key={group} className="py-1">
                <div className="cx-eyebrow px-3 py-1">{group}</div>
                {items.map((c) => {
                  const idx = filtered.indexOf(c);
                  const focused = idx === focusIdx;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onMouseEnter={() => setFocusIdx(idx)}
                      onClick={() => runIdx(idx)}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-[13px] cx-transition",
                        focused ? "bg-[var(--cx-accent-soft)] text-foreground" : "text-muted-foreground",
                      )}
                    >
                      <span className="truncate">{c.label}</span>
                      <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground/70">
                        {c.id}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
        <div className="flex items-center justify-between border-t border-border px-3 py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
          <span>↑↓ μετακίνηση · ↵ άνοιγμα</span>
          <span>esc κλείσιμο</span>
        </div>
      </div>
    </div>
  );
}
