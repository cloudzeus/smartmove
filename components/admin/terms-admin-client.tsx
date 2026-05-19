"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Plus, ScrollText, Zap } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  upsertTermsVersion,
  activateTermsVersion,
} from "@/server/actions/terms.action";

interface TermsRow {
  id: string;
  version: string;
  summary: string | null;
  bodyEl: string;
  bodyEn: string;
  isActive: boolean;
  publishedAt: Date;
}

interface Props {
  versions: TermsRow[];
}

export function TermsAdminClient({ versions }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState<TermsRow | "new" | null>(null);
  const [pending, start] = useTransition();
  const [activating, setActivating] = useState<string | null>(null);

  const activate = (id: string) => {
    if (!confirm("Ενεργοποίηση; Όλοι οι μη-staff χρήστες θα αναγκαστούν να αποδεχτούν."))
      return;
    setActivating(id);
    start(async () => {
      const r = await activateTermsVersion(id);
      setActivating(null);
      if (r.ok) router.refresh();
      else alert(r.error);
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-gradient-to-r from-[var(--color-brand-blue)] to-[#3B82F6] px-4 text-sm font-bold text-white shadow-[0_6px_20px_rgba(37,99,235,0.25)]"
        >
          <Plus className="size-4" />
          Νέα έκδοση
        </button>
      </div>

      {versions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
          <ScrollText className="mx-auto size-10 text-muted-foreground" />
          <p className="mt-3 text-sm font-semibold">Δεν υπάρχει καμία έκδοση όρων ακόμα</p>
          <p className="text-xs text-muted-foreground">
            Δημιούργησε την πρώτη έκδοση και ενεργοποίησέ την.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3">
          {versions.map((v) => (
            <li
              key={v.id}
              className={cn(
                "rounded-2xl border bg-card p-4 shadow-[var(--shadow-card)]",
                v.isActive
                  ? "border-emerald-300 bg-gradient-to-br from-emerald-50 to-card"
                  : "border-border",
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-lg font-bold text-foreground">
                      v{v.version}
                    </span>
                    {v.isActive && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-800">
                        <CheckCircle2 className="size-3" />
                        Ενεργή
                      </span>
                    )}
                  </div>
                  {v.summary && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {v.summary}
                    </p>
                  )}
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Δημοσιεύτηκε: {new Date(v.publishedAt).toLocaleDateString("el-GR")}{" "}
                    · ΕΛ: {v.bodyEl.length} χαρ. · EN: {v.bodyEn.length} χαρ.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditing(v)}
                    className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
                  >
                    Επεξεργασία
                  </button>
                  {!v.isActive && (
                    <button
                      type="button"
                      disabled={pending && activating === v.id}
                      onClick={() => activate(v.id)}
                      className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {pending && activating === v.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Zap className="size-3.5" />
                      )}
                      Ενεργοποίηση
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <TermsEditor
          row={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function TermsEditor({
  row,
  onClose,
  onSaved,
}: {
  row: TermsRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [pending, start] = useTransition();
  const [version, setVersion] = useState(row?.version ?? "");
  const [summary, setSummary] = useState(row?.summary ?? "");
  const [bodyEl, setBodyEl] = useState(row?.bodyEl ?? "");
  const [bodyEn, setBodyEn] = useState(row?.bodyEn ?? "");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    start(async () => {
      const r = await upsertTermsVersion({
        id: row?.id,
        version,
        summary,
        bodyEl,
        bodyEn,
      });
      if (r.ok) onSaved();
      else setError(r.error);
    });
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="font-display text-lg font-bold">
            {row ? `Επεξεργασία v${row.version}` : "Νέα έκδοση όρων"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-secondary"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="grid gap-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Έκδοση (semver)">
                <input
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  placeholder="1.0.0"
                  className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-[var(--color-brand-blue)]"
                />
              </Field>
              <Field label="Σύνοψη αλλαγών (προαιρ.)">
                <input
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Π.χ. Ενημέρωση πολιτικής επιστροφών"
                  className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-[var(--color-brand-blue)]"
                />
              </Field>
            </div>

            <Field label="Όροι (Ελληνικά)">
              <textarea
                rows={12}
                value={bodyEl}
                onChange={(e) => setBodyEl(e.target.value)}
                placeholder="Πλήρες κείμενο όρων στα ελληνικά…"
                className="w-full rounded-lg border border-border bg-background p-3 text-sm font-mono outline-none focus:border-[var(--color-brand-blue)]"
              />
              <span className="text-[10px] text-muted-foreground">
                {bodyEl.length} χαρακτήρες · ελάχιστο 50
              </span>
            </Field>

            <Field label="Terms (English)">
              <textarea
                rows={12}
                value={bodyEn}
                onChange={(e) => setBodyEn(e.target.value)}
                placeholder="Full terms in English…"
                className="w-full rounded-lg border border-border bg-background p-3 text-sm font-mono outline-none focus:border-[var(--color-brand-blue)]"
              />
              <span className="text-[10px] text-muted-foreground">
                {bodyEn.length} chars · min 50
              </span>
            </Field>

            {error && (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800">
                {error}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border p-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold hover:bg-secondary"
          >
            Ακύρωση
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={submit}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[var(--color-brand-blue)] to-[#3B82F6] px-5 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            Αποθήκευση
          </button>
        </div>
      </div>
    </div>
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
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
