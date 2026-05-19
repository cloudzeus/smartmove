"use client";

import { useId, useState } from "react";
import {
  ArrowRight,
  Armchair,
  Building2,
  Calendar,
  Home,
  MapPin,
  PackageOpen,
  Sparkles,
  Star,
  Wallet,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { PlacesInput } from "./places-input";

const CATEGORY_TABS = [
  { key: "house", label: "Μετακόμιση κατοικίας", short: "Κατοικία", icon: Home },
  { key: "furniture", label: "Μεταφορά επίπλων", short: "Έπιπλα", icon: Armchair },
  { key: "business", label: "Επαγγελματικός εξοπλισμός", short: "Επαγγελματικά", icon: Building2 },
  { key: "heavy", label: "Βαρέα & ογκώδη", short: "Βαρέα", icon: PackageOpen },
] as const;

const FLEX_OPTIONS = [
  { value: "0", label: "Σταθερή" },
  { value: "1", label: "±1 ημέρα" },
  { value: "3", label: "±3 ημέρες" },
  { value: "7", label: "±1 εβδομάδα" },
] as const;

export function QuoteWidget() {
  const [activeTab, setActiveTab] =
    useState<(typeof CATEGORY_TABS)[number]["key"]>("house");
  const [flex, setFlex] = useState<string>("0");
  const [shared, setShared] = useState(false);
  const sharedId = useId();

  return (
    <div className="rounded-3xl border border-border bg-card p-2 shadow-[var(--shadow-pop)]">
      {/* Tabs — wraps, no horizontal scroll */}
      <div className="flex flex-wrap gap-1 rounded-2xl bg-secondary/60 p-1.5">
        {CATEGORY_TABS.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "group relative flex flex-1 min-w-[120px] items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                active
                  ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                  : "text-muted-foreground hover:bg-card/70 hover:text-foreground",
              )}
            >
              <tab.icon className="size-4 shrink-0" />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.short}</span>
              {tab.key === "house" && (
                <span className="ml-0.5 hidden rounded-full bg-[var(--color-brand-blue-light)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-brand-blue-deep)] lg:inline">
                  Δημοφιλές
                </span>
              )}
            </button>
          );
        })}
      </div>

      <form
        action="/scan"
        method="get"
        className="mt-2 flex flex-col gap-2.5 rounded-2xl bg-card p-4"
      >
        <input type="hidden" name="type" value={activeTab} />

        {/* Row 1: Από + Προς */}
        <div className="grid gap-2.5 sm:grid-cols-2">
          <PlacesInput
            name="from"
            label="Από"
            placeholder="π.χ. Πατησίων 60, Αθήνα"
            icon={<MapPin className="size-4 text-[var(--color-brand-blue)]" />}
          />
          <PlacesInput
            name="to"
            label="Προς"
            placeholder="π.χ. Λαδάδικα, Θεσσαλονίκη"
            icon={<MapPin className="size-4 text-[var(--color-brand-red)]" />}
          />
        </div>

        {/* Row 2: Πότε + Ευελιξία + Submit */}
        <div className="grid gap-2.5 sm:grid-cols-12">
          {/* Date */}
          <label className="group flex items-center gap-3 rounded-xl border border-input bg-background px-3 py-2.5 transition-colors focus-within:border-[var(--color-brand-blue)] focus-within:ring-2 focus-within:ring-ring/30 sm:col-span-4">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary/70">
              <Calendar className="size-4 text-[var(--color-brand-blue)]" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Πότε
              </span>
              <input
                name="when"
                type="date"
                className="w-full border-0 bg-transparent p-0 text-sm font-medium text-foreground outline-none"
              />
            </span>
          </label>

          {/* Flex */}
          <label className="group flex items-center gap-3 rounded-xl border border-input bg-background px-3 py-2.5 transition-colors focus-within:border-[var(--color-brand-blue)] focus-within:ring-2 focus-within:ring-ring/30 sm:col-span-4">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary/70">
              <Sparkles className="size-4 text-[var(--color-brand-blue)]" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Ευελιξία ημερομηνίας
              </span>
              <select
                name="flex"
                value={flex}
                onChange={(e) => setFlex(e.target.value)}
                className="w-full appearance-none border-0 bg-transparent p-0 text-sm font-medium text-foreground outline-none"
              >
                {FLEX_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </span>
          </label>

          {/* Submit — visible text, full padding, gradient shadow */}
          <button
            type="submit"
            className="inline-flex h-[60px] items-center justify-center gap-2 rounded-xl bg-[var(--color-brand-blue)] px-5 text-base font-bold text-white shadow-[var(--shadow-cta)] transition-colors hover:bg-[var(--color-brand-blue-deep)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 sm:col-span-4"
          >
            Δες προσφορές
            <ArrowRight className="size-4" />
          </button>
        </div>

        {/* Row 3: Shared-Load toggle */}
        <div
          className={cn(
            "flex flex-col gap-2 rounded-xl border p-3.5 transition-colors sm:flex-row sm:items-center sm:gap-4",
            shared
              ? "border-[var(--color-brand-blue)]/50 bg-[var(--color-brand-blue-light)]"
              : "border-border bg-secondary/30",
          )}
        >
          <label
            htmlFor={sharedId}
            className="flex flex-1 cursor-pointer items-start gap-3"
          >
            <input
              id={sharedId}
              type="checkbox"
              name="shared"
              checked={shared}
              onChange={(e) => setShared(e.target.checked)}
              className="mt-0.5 size-5 shrink-0 cursor-pointer rounded border-border accent-[var(--color-brand-blue)]"
            />
            <span className="flex flex-col leading-tight">
              <span className="text-sm font-semibold text-foreground">
                Συνδυάστε τη μεταφορά μου με άλλη
                <span className="ml-2 inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                  −έως 50%
                </span>
              </span>
              <span className="mt-1 text-xs text-muted-foreground">
                Αν η διαδρομή μου ταιριάζει με ήδη προγραμματισμένη μεταφορά,
                μοιραζόμαστε όχημα και πληρώνω έως 50% λιγότερα.
              </span>
            </span>
          </label>
        </div>
      </form>

      {/* Footer micro-meta */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-3 pt-1 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <Wallet className="size-3.5" />
          Δωρεάν δημοσίευση · καμία υποχρέωση
        </div>
        <div className="flex items-center gap-1.5">
          <Star className="size-3.5 fill-amber-400 stroke-amber-400" />
          <span className="font-semibold text-foreground">4.8/5</span>
          <span>·</span>
          <span>12.500+ αξιολογήσεις πελατών</span>
        </div>
      </div>
    </div>
  );
}
