"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Globe2, X, Locate, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { updatePartnerServiceArea } from "@/server/actions/partner-service-area.action";
import { geocodeAddress } from "@/server/actions/geocode.action";
import { parseServiceCities, type ServiceAreaMode } from "@/lib/partner-service-area";
import { cn } from "@/lib/utils";
import { PartnerCoverageMap } from "./partner-coverage-map";

interface Props {
  partner: {
    id: string;
    name: string;
    serviceMode: ServiceAreaMode;
    serviceCities: string | null;
    hqAddress: string | null;
    hqLat: number | null;
    hqLng: number | null;
    serviceRadiusKm: number | null;
  };
  mapApiKey?: string | null;
}

const MODE_LABEL: Record<ServiceAreaMode, { label: string; hint: string }> = {
  ANY:    { label: "Παντού",   hint: "Χωρίς περιορισμό περιοχής." },
  CITIES: { label: "Περιοχές", hint: "Καλύπτει συγκεκριμένες πόλεις (Αθήνα, Θεσσαλονίκη…)." },
  RADIUS: { label: "Ακτίνα",   hint: "Καλύπτει ό,τι είναι σε ακτίνα N km γύρω από την έδρα." },
};

export function PartnerServiceAreaEditor({ partner, mapApiKey }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [mode, setMode] = useState<ServiceAreaMode>(partner.serviceMode);
  const [cities, setCities] = useState<string[]>(parseServiceCities(partner.serviceCities));
  const [cityInput, setCityInput] = useState("");
  const [hqAddress, setHqAddress] = useState(partner.hqAddress ?? "");
  const [hqLat, setHqLat] = useState<string>(partner.hqLat?.toString() ?? "");
  const [hqLng, setHqLng] = useState<string>(partner.hqLng?.toString() ?? "");
  const [radius, setRadius] = useState<string>(partner.serviceRadiusKm?.toString() ?? "50");
  const [geocoding, setGeocoding] = useState(false);

  async function handleGeocode() {
    if (!hqAddress.trim()) {
      setError("Συμπλήρωσε διεύθυνση πρώτα.");
      return;
    }
    setError(null);
    setGeocoding(true);
    try {
      const res = await geocodeAddress(hqAddress);
      if (res.ok) {
        setHqLat(res.lat.toFixed(6));
        setHqLng(res.lng.toFixed(6));
      } else {
        setError(res.error);
      }
    } finally {
      setGeocoding(false);
    }
  }

  function addCity() {
    const v = cityInput.trim();
    if (!v) return;
    if (cities.find((c) => c.toLowerCase() === v.toLowerCase())) {
      setCityInput("");
      return;
    }
    setCities([...cities, v]);
    setCityInput("");
  }

  function removeCity(c: string) {
    setCities(cities.filter((x) => x !== c));
  }

  function handleSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await updatePartnerServiceArea({
        partnerId: partner.id,
        serviceMode: mode,
        cities: mode === "CITIES" ? cities : undefined,
        hqAddress: mode === "RADIUS" ? hqAddress : undefined,
        hqLat: mode === "RADIUS" && hqLat ? Number(hqLat) : undefined,
        hqLng: mode === "RADIUS" && hqLng ? Number(hqLng) : undefined,
        serviceRadiusKm: mode === "RADIUS" ? Number(radius) : undefined,
      });
      if (res.ok) {
        setSaved(true);
        router.refresh();
        setTimeout(() => setSaved(false), 2000);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="cx-card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border bg-[var(--cx-accent-soft)] px-3 py-1.5">
        <Globe2 className="size-3.5 text-[var(--cx-accent)]" />
        <span className="cx-eyebrow text-foreground">Περιοχή εξυπηρέτησης</span>
        <span className="ml-auto text-[10px] text-muted-foreground">{partner.name}</span>
      </div>

      <div className="space-y-3 p-3">
        {/* Mode selector */}
        <div>
          <div className="flex gap-1">
            {(["ANY", "CITIES", "RADIUS"] as ServiceAreaMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn(
                  "inline-flex h-7 flex-1 items-center justify-center rounded-md px-2 text-[11px] font-semibold cx-transition cx-press",
                  mode === m
                    ? "bg-foreground text-background"
                    : "border border-border bg-card text-muted-foreground hover:bg-[var(--cx-hover)] hover:text-foreground",
                )}
              >
                {MODE_LABEL[m].label}
              </button>
            ))}
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">{MODE_LABEL[mode].hint}</p>
        </div>

        {/* CITIES mode */}
        {mode === "CITIES" && (
          <div className="space-y-1.5">
            <label className="cx-eyebrow">Πόλεις</label>
            <div className="flex gap-1.5">
              <input
                value={cityInput}
                onChange={(e) => setCityInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); addCity(); }
                }}
                placeholder="π.χ. Αθήνα, Θεσσαλονίκη, Πειραιάς…"
                className="h-7 flex-1 rounded-md border border-border bg-background px-2.5 text-[12px] outline-none focus:border-[var(--cx-accent)] focus:ring-1 focus:ring-[var(--cx-accent)]"
              />
              <button
                type="button"
                onClick={addCity}
                disabled={!cityInput.trim()}
                className="inline-flex h-7 items-center rounded-md border border-border bg-card px-2.5 text-[11px] font-semibold text-foreground cx-transition cx-press hover:bg-[var(--cx-hover)] disabled:opacity-40"
              >
                +
              </button>
            </div>
            {cities.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {cities.map((c) => (
                  <span
                    key={c}
                    className="inline-flex items-center gap-1 rounded-full bg-[var(--cx-accent-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--cx-accent)]"
                  >
                    <MapPin className="size-2.5" />
                    {c}
                    <button
                      type="button"
                      onClick={() => removeCity(c)}
                      className="ml-0.5 grid size-3.5 place-items-center rounded-full hover:bg-[var(--cx-accent)]/15"
                      title="Αφαίρεση"
                    >
                      <X className="size-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* RADIUS mode */}
        {mode === "RADIUS" && (
          <div className="space-y-2">
            <div className="space-y-1">
              <label className="cx-eyebrow">Έδρα (διεύθυνση)</label>
              <div className="flex gap-1.5">
                <input
                  value={hqAddress}
                  onChange={(e) => setHqAddress(e.target.value)}
                  placeholder="π.χ. Λεωφ. Συγγρού 100, Αθήνα"
                  className="h-7 flex-1 rounded-md border border-border bg-background px-2.5 text-[12px] outline-none focus:border-[var(--cx-accent)] focus:ring-1 focus:ring-[var(--cx-accent)]"
                />
                <button
                  type="button"
                  onClick={handleGeocode}
                  disabled={geocoding || !hqAddress.trim()}
                  title="Εύρεση συντεταγμένων από διεύθυνση"
                  className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-card px-2 text-[11px] font-semibold cx-transition cx-press hover:bg-[var(--cx-hover)] disabled:opacity-40"
                >
                  {geocoding ? <Loader2 className="size-3 animate-spin" /> : <Locate className="size-3" />}
                  Εντοπισμός
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <label className="cx-eyebrow">Lat</label>
                <input
                  value={hqLat}
                  onChange={(e) => setHqLat(e.target.value)}
                  placeholder="37.9838"
                  className="mt-0.5 h-7 w-full rounded-md border border-border bg-background px-2.5 font-mono text-[11px] outline-none focus:border-[var(--cx-accent)] focus:ring-1 focus:ring-[var(--cx-accent)]"
                />
              </div>
              <div>
                <label className="cx-eyebrow">Lng</label>
                <input
                  value={hqLng}
                  onChange={(e) => setHqLng(e.target.value)}
                  placeholder="23.7275"
                  className="mt-0.5 h-7 w-full rounded-md border border-border bg-background px-2.5 font-mono text-[11px] outline-none focus:border-[var(--cx-accent)] focus:ring-1 focus:ring-[var(--cx-accent)]"
                />
              </div>
            </div>
            <div>
              <label className="cx-eyebrow flex items-center justify-between">
                <span>Ακτίνα (km)</span>
                <span className="font-mono text-[11px] tabular-nums text-foreground">{radius} km</span>
              </label>
              <input
                type="range"
                min={5}
                max={500}
                step={5}
                value={radius}
                onChange={(e) => setRadius(e.target.value)}
                className="mt-1 w-full accent-[var(--cx-accent)]"
              />
            </div>

            {/* Interactive MapLibre preview — uses vector tiles (free MapTiler key) */}
            <PartnerCoverageMap
              lat={hqLat ? Number(hqLat) : null}
              lng={hqLng ? Number(hqLng) : null}
              radiusKm={Number(radius) || 0}
              apiKey={mapApiKey ?? null}
            />
          </div>
        )}

        {error && (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] text-rose-800">
            {error}
          </div>
        )}
        {saved && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] text-emerald-800">
            ✓ Αποθηκεύτηκε
          </div>
        )}

        <div className="flex items-center justify-end gap-1.5 border-t border-border pt-2">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={pending || (mode === "CITIES" && cities.length === 0) || (mode === "RADIUS" && (!hqLat || !hqLng || !radius))}
          >
            {pending ? "Αποθήκευση…" : "Αποθήκευση"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Coverage map preview is provided by `PartnerCoverageMap` (interactive
// MapLibre w/ vector tiles — works with free MapTiler keys, unlike the
// static raster endpoint which requires a paid plan).
