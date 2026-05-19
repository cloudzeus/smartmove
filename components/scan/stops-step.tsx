"use client";

import { useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  CheckCircle2,
  MapPin,
  PackageOpen,
  Plus,
  Trash2,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PlacesInput } from "@/components/marketing/places-input";
import type {
  ElevatorSize,
  JobItem,
  MoveStop,
  RouteInfo,
  StopType,
} from "./wizard-types";

interface StopsStepProps {
  route: RouteInfo;
  items: JobItem[];
  multiStop: boolean;
  stops: MoveStop[];
  onMultiStopChange: (multi: boolean) => void;
  onStopsChange: (stops: MoveStop[]) => void;
  onContinue: () => void;
  onBack: () => void;
}

const ELEVATORS: Array<{ value: ElevatorSize; label: string }> = [
  { value: "none", label: "Όχι" },
  { value: "small", label: "Μικρό" },
  { value: "medium", label: "Μεσαίο" },
  { value: "large", label: "Μεγάλο" },
];

function newStop(type: StopType, address = ""): MoveStop {
  return {
    id: `${type.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    label: "",
    address,
    floor: 0,
    elevator: "none",
    notes: "",
    itemIds: [],
  };
}

export function StopsStep({
  route,
  items,
  multiStop,
  stops,
  onMultiStopChange,
  onStopsChange,
  onContinue,
  onBack,
}: StopsStepProps) {
  const pickupStops = stops.filter((s) => s.type === "PICKUP");
  const deliveryStops = stops.filter((s) => s.type === "DELIVERY");

  // If switching to multi-stop and stops are empty, seed with the single route.
  function enableMulti() {
    if (stops.length === 0) {
      onStopsChange([
        { ...newStop("PICKUP", route.from), itemIds: items.map((i) => i.id) },
        { ...newStop("DELIVERY", route.to), itemIds: items.map((i) => i.id) },
      ]);
    }
    onMultiStopChange(true);
  }

  function update(id: string, patch: Partial<MoveStop>) {
    onStopsChange(stops.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function add(type: StopType) {
    onStopsChange([...stops, newStop(type)]);
  }

  function remove(id: string) {
    onStopsChange(stops.filter((s) => s.id !== id));
  }

  function moveOrder(id: string, dir: -1 | 1) {
    const stop = stops.find((s) => s.id === id);
    if (!stop) return;
    const sameType = stops.filter((s) => s.type === stop.type);
    const idx = sameType.findIndex((s) => s.id === id);
    const swapWith = sameType[idx + dir];
    if (!swapWith) return;
    const swapped = stops.map((s) => {
      if (s.id === id) return { ...s };
      if (s.id === swapWith.id) return { ...s };
      return s;
    });
    const a = swapped.findIndex((s) => s.id === id);
    const b = swapped.findIndex((s) => s.id === swapWith.id);
    [swapped[a], swapped[b]] = [swapped[b], swapped[a]];
    onStopsChange(swapped);
  }

  function toggleItem(stopId: string, itemId: string) {
    const stop = stops.find((s) => s.id === stopId);
    if (!stop) return;
    const set = new Set(stop.itemIds);
    if (set.has(itemId)) set.delete(itemId);
    else set.add(itemId);
    update(stopId, { itemIds: Array.from(set) });
  }

  const canContinue = multiStop
    ? pickupStops.length >= 1 &&
      deliveryStops.length >= 1 &&
      stops.every((s) => s.address.trim().length > 1)
    : true;

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Σημεία διαδρομής</CardTitle>
          <CardDescription>
            Επίλεξε αν η μεταφορά γίνεται από ένα σημείο σε ένα άλλο, ή
            περιλαμβάνει πολλά σημεία παραλαβής / παράδοσης.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            <ModeCard
              active={!multiStop}
              title="Απλή διαδρομή"
              desc="Ένα σημείο παραλαβής, ένα παράδοσης"
              icon={ArrowRight}
              onClick={() => onMultiStopChange(false)}
            />
            <ModeCard
              active={multiStop}
              title="Πολλαπλά σημεία"
              desc="π.χ. παραλαβή από 2 σπίτια, παράδοση σε αποθήκη + εξοχικό"
              icon={MapPin}
              onClick={enableMulti}
            />
          </div>
        </CardContent>
      </Card>

      {!multiStop ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-3">
              <SummaryLine
                label="Παραλαβή από"
                value={route.from || "—"}
                color="blue"
              />
              <SummaryLine
                label="Παράδοση σε"
                value={route.to || "—"}
                color="red"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Όλα τα <strong className="text-foreground">{items.length}</strong>{" "}
                αντικείμενα θα μεταφερθούν από το πρώτο στο δεύτερο σημείο.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <StopGroup
            title="Σημεία παραλαβής"
            subtitle="Από πού περνά το όχημα για να φορτώσει"
            type="PICKUP"
            stops={pickupStops}
            allStops={stops}
            items={items}
            onUpdate={update}
            onAdd={() => add("PICKUP")}
            onRemove={remove}
            onMoveUp={(id) => moveOrder(id, -1)}
            onMoveDown={(id) => moveOrder(id, 1)}
            onToggleItem={toggleItem}
            color="blue"
          />
          <StopGroup
            title="Σημεία παράδοσης"
            subtitle="Πού πηγαίνει το όχημα να ξεφορτώσει"
            type="DELIVERY"
            stops={deliveryStops}
            allStops={stops}
            items={items}
            onUpdate={update}
            onAdd={() => add("DELIVERY")}
            onRemove={remove}
            onMoveUp={(id) => moveOrder(id, -1)}
            onMoveDown={(id) => moveOrder(id, 1)}
            onToggleItem={toggleItem}
            color="red"
          />
        </>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
        <Button variant="ghost" className="h-11" onClick={onBack}>
          <ArrowLeft className="mr-1 size-4" />
          Πίσω στα αντικείμενα
        </Button>
        <Button
          className="h-11 shadow-[var(--shadow-cta)] sm:px-6"
          onClick={onContinue}
          disabled={!canContinue}
        >
          Συνέχεια στα στοιχεία χώρου
          <ArrowRight className="ml-1 size-4" />
        </Button>
      </div>
    </div>
  );
}

function ModeCard({
  active,
  title,
  desc,
  icon: Icon,
  onClick,
}: {
  active: boolean;
  title: string;
  desc: string;
  icon: typeof ArrowRight;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex flex-col gap-2 rounded-2xl border-2 p-5 text-left transition-all",
        active
          ? "border-[var(--color-brand-blue)] bg-[var(--color-brand-blue-light)]"
          : "border-border bg-card hover:border-[var(--color-brand-blue)]/40",
      )}
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "grid size-10 place-items-center rounded-xl",
            active
              ? "bg-[var(--color-brand-blue)] text-white"
              : "bg-secondary text-foreground",
          )}
        >
          <Icon className="size-5" />
        </span>
        {active && (
          <CheckCircle2 className="size-5 text-[var(--color-brand-blue)]" />
        )}
      </div>
      <div>
        <h3 className="font-display text-sm font-bold text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
    </button>
  );
}

function SummaryLine({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: "blue" | "red";
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-secondary/40 px-4 py-3">
      <span
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-lg text-white",
          color === "blue"
            ? "bg-[var(--color-brand-blue)]"
            : "bg-[var(--color-brand-red)]",
        )}
      >
        <MapPin className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="truncate text-sm font-bold text-foreground">{value}</p>
      </div>
    </div>
  );
}

interface StopGroupProps {
  title: string;
  subtitle: string;
  type: StopType;
  stops: MoveStop[];
  allStops: MoveStop[];
  items: JobItem[];
  onUpdate: (id: string, patch: Partial<MoveStop>) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onToggleItem: (stopId: string, itemId: string) => void;
  color: "blue" | "red";
}

function StopGroup({
  title,
  subtitle,
  type,
  stops,
  items,
  onUpdate,
  onAdd,
  onRemove,
  onMoveUp,
  onMoveDown,
  onToggleItem,
  color,
}: StopGroupProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <span
                className={cn(
                  "grid size-7 place-items-center rounded-lg text-white",
                  color === "blue"
                    ? "bg-[var(--color-brand-blue)]"
                    : "bg-[var(--color-brand-red)]",
                )}
              >
                <MapPin className="size-4" />
              </span>
              {title}
            </CardTitle>
            <CardDescription>{subtitle}</CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onAdd}
            className="h-9"
          >
            <Plus className="mr-1 size-3.5" />
            Σημείο
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {stops.length === 0 && (
          <p className="rounded-xl border border-dashed border-border bg-secondary/30 p-4 text-center text-xs text-muted-foreground">
            Πάτα <span className="font-semibold">+ Σημείο</span> για να
            προσθέσεις {type === "PICKUP" ? "παραλαβή" : "παράδοση"}.
          </p>
        )}
        {stops.map((stop, idx) => (
          <StopEditor
            key={stop.id}
            stop={stop}
            index={idx}
            total={stops.length}
            items={items}
            onUpdate={onUpdate}
            onRemove={onRemove}
            onMoveUp={() => onMoveUp(stop.id)}
            onMoveDown={() => onMoveDown(stop.id)}
            onToggleItem={onToggleItem}
            color={color}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function StopEditor({
  stop,
  index,
  total,
  items,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
  onToggleItem,
  color,
}: {
  stop: MoveStop;
  index: number;
  total: number;
  items: JobItem[];
  onUpdate: (id: string, patch: Partial<MoveStop>) => void;
  onRemove: (id: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggleItem: (stopId: string, itemId: string) => void;
  color: "blue" | "red";
}) {
  const [showItems, setShowItems] = useState(false);
  const includedCount = stop.itemIds.length;
  const selectedItems = items.filter((i) => stop.itemIds.includes(i.id));
  const selectedVolume = selectedItems.reduce(
    (s, i) => s + i.volume_m3 * i.quantity,
    0,
  );

  return (
    <div className="rounded-2xl border border-border bg-secondary/20 p-4">
      <div className="mb-3 flex items-center gap-2">
        <span
          className={cn(
            "grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold text-white",
            color === "blue"
              ? "bg-[var(--color-brand-blue)]"
              : "bg-[var(--color-brand-red)]",
          )}
        >
          {index + 1}
        </span>
        <Input
          value={stop.label ?? ""}
          onChange={(e) => onUpdate(stop.id, { label: e.target.value })}
          placeholder="Όνομα σημείου (π.χ. Σπίτι γονιών)"
          className="h-9 text-sm font-medium"
        />
        <div className="ml-auto flex gap-1">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={index === 0}
            className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-card hover:text-foreground disabled:opacity-30"
            title="Πάνω"
          >
            <ArrowUp className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={index === total - 1}
            className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-card hover:text-foreground disabled:opacity-30"
            title="Κάτω"
          >
            <ArrowDown className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onRemove(stop.id)}
            className="grid size-7 place-items-center rounded-md text-destructive hover:bg-destructive/10"
            title="Αφαίρεση"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      <PlacesInput
        name={`address-${stop.id}`}
        label="Διεύθυνση"
        placeholder="π.χ. Πατησίων 60, Αθήνα"
        defaultValue={stop.address}
        onChange={(value) => onUpdate(stop.id, { address: value })}
        icon={
          <MapPin
            className={cn(
              "size-4",
              color === "blue"
                ? "text-[var(--color-brand-blue)]"
                : "text-[var(--color-brand-red)]",
            )}
          />
        }
      />

      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-foreground">
            Όροφος
          </span>
          <input
            type="number"
            min={-2}
            max={30}
            value={stop.floor}
            onChange={(e) =>
              onUpdate(stop.id, {
                floor: Math.max(-2, Math.min(30, Number(e.target.value) || 0)),
              })
            }
            className="h-10 rounded-lg border border-input bg-card px-3 text-sm font-semibold text-foreground focus-visible:border-[var(--color-brand-blue)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          />
        </label>
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-foreground">
            Ασανσέρ
          </span>
          <div className="grid grid-cols-4 gap-1">
            {ELEVATORS.map((e) => {
              const active = stop.elevator === e.value;
              return (
                <button
                  key={e.value}
                  type="button"
                  onClick={() => onUpdate(stop.id, { elevator: e.value })}
                  className={cn(
                    "h-10 rounded-md border text-xs font-semibold transition-colors",
                    active
                      ? "border-[var(--color-brand-blue)] bg-[var(--color-brand-blue-light)] text-[var(--color-brand-blue-deep)]"
                      : "border-border bg-card text-muted-foreground hover:border-[var(--color-brand-blue)]/40",
                  )}
                >
                  {e.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-3">
        <button
          type="button"
          onClick={() => setShowItems((v) => !v)}
          className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-sm transition-colors hover:bg-secondary"
        >
          <span className="flex items-center gap-2 font-medium text-foreground">
            <PackageOpen className="size-4 text-[var(--color-brand-blue)]" />
            Αντικείμενα σε αυτό το σημείο
          </span>
          <span className="text-xs text-muted-foreground">
            {includedCount} επιλεγμένα · {selectedVolume.toFixed(2)} m³
          </span>
        </button>
        {showItems && (
          <ul className="mt-2 max-h-[200px] space-y-1 overflow-y-auto rounded-lg border border-border bg-card p-2">
            {items.length === 0 ? (
              <li className="px-2 py-3 text-center text-xs text-muted-foreground">
                Δεν υπάρχουν αντικείμενα
              </li>
            ) : (
              items.map((it) => {
                const checked = stop.itemIds.includes(it.id);
                return (
                  <li key={it.id}>
                    <label
                      className={cn(
                        "flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                        checked && "bg-[var(--color-brand-blue-light)]",
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => onToggleItem(stop.id, it.id)}
                          className="size-4 cursor-pointer rounded border-border accent-[var(--color-brand-blue)]"
                        />
                        <span className="font-medium text-foreground">
                          {it.quantity}× {it.name}
                        </span>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {(it.volume_m3 * it.quantity).toFixed(2)} m³
                      </span>
                    </label>
                  </li>
                );
              })
            )}
          </ul>
        )}
      </div>

      <Textarea
        value={stop.notes ?? ""}
        onChange={(e) => onUpdate(stop.id, { notes: e.target.value })}
        rows={1}
        placeholder="Σημειώσεις (π.χ. στενός δρόμος)"
        className="mt-3 min-h-[40px]"
      />
    </div>
  );
}
