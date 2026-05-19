"use client";

import { useEffect, useRef, useState } from "react";
import * as maptiler from "@maptiler/sdk";
import "@maptiler/sdk/dist/maptiler-sdk.css";
import { Loader2, MapPin, Route } from "lucide-react";

export interface RouteStop {
  id: string;
  sequence: number;
  type: "PICKUP" | "DELIVERY";
  label?: string | null;
  address: string;
  lat: number | null;
  lng: number | null;
}

interface Props {
  apiKey: string;
  stops: RouteStop[];
}

interface RouteData {
  geometry: GeoJSON.LineString;
  distanceKm: number;
  durationMin: number;
}

const OSRM = "https://router.project-osrm.org/route/v1/driving";

async function fetchRoute(stops: RouteStop[]): Promise<RouteData | null> {
  const pts = stops
    .filter((s): s is RouteStop & { lat: number; lng: number } =>
      s.lat != null && s.lng != null,
    )
    .map((s) => `${s.lng},${s.lat}`)
    .join(";");
  if (!pts.includes(";")) return null;
  const res = await fetch(
    `${OSRM}/${pts}?overview=full&geometries=geojson`,
    { cache: "no-store" },
  );
  if (!res.ok) return null;
  const data = (await res.json()) as {
    routes?: Array<{
      geometry: GeoJSON.LineString;
      distance: number;
      duration: number;
    }>;
  };
  const r = data.routes?.[0];
  if (!r) return null;
  return {
    geometry: r.geometry,
    distanceKm: r.distance / 1000,
    durationMin: r.duration / 60,
  };
}

function markerEl(n: number, type: "PICKUP" | "DELIVERY"): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText = `
    display:grid;place-items:center;
    width:34px;height:34px;border-radius:9999px;
    background:${type === "PICKUP" ? "#1d4ed8" : "#dc2626"};
    color:#fff;font-weight:700;font-size:14px;
    border:3px solid #fff;
    box-shadow:0 2px 8px rgba(0,0,0,.3);
    cursor:pointer;
    font-family:system-ui;
  `;
  el.textContent = String(n);
  return el;
}

export function RequestMap({ apiKey, stops }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maptiler.Map | null>(null);
  const [route, setRoute] = useState<RouteData | null>(null);
  const [showRoute, setShowRoute] = useState(true);
  const [loadingRoute, setLoadingRoute] = useState(false);

  const validStops = stops.filter(
    (s): s is RouteStop & { lat: number; lng: number } =>
      s.lat != null && s.lng != null,
  );

  useEffect(() => {
    if (!containerRef.current || mapRef.current || validStops.length === 0)
      return;

    maptiler.config.apiKey = apiKey;
    const map = new maptiler.Map({
      container: containerRef.current,
      style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${apiKey}`,
      center: [validStops[0].lng, validStops[0].lat],
      zoom: 12,
    });
    mapRef.current = map;

    map.on("load", async () => {
      for (const s of validStops) {
        new maptiler.Marker({ element: markerEl(s.sequence, s.type) })
          .setLngLat([s.lng, s.lat])
          .setPopup(
            new maptiler.Popup({ offset: 24 }).setHTML(
              `<div style="font-family:system-ui;font-size:13px;max-width:240px">
                <div style="font-size:10px;text-transform:uppercase;color:#64748b;font-weight:600">
                  ${s.type === "PICKUP" ? "Παραλαβή" : "Παράδοση"}${s.label ? ` · ${escapeHtml(s.label)}` : ""}
                </div>
                <div style="font-weight:600;margin-top:2px">${escapeHtml(s.address)}</div>
              </div>`,
            ),
          )
          .addTo(map);
      }

      // Empty source + layers — populated once OSRM responds.
      map.addSource("route", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "route-line-casing",
        type: "line",
        source: "route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#ffffff", "line-width": 8 },
      });
      map.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#1d4ed8", "line-width": 5 },
      });

      setLoadingRoute(true);
      try {
        const r = await fetchRoute(validStops);
        if (r) {
          setRoute(r);
          const src = map.getSource("route") as maptiler.GeoJSONSource | undefined;
          src?.setData({
            type: "Feature",
            properties: {},
            geometry: r.geometry,
          });
          // Refit to route bbox for nicer framing.
          const bounds = new maptiler.LngLatBounds();
          for (const c of r.geometry.coordinates)
            bounds.extend(c as [number, number]);
          map.fitBounds(bounds, { padding: 80, maxZoom: 14 });
        } else if (validStops.length > 1) {
          const bounds = new maptiler.LngLatBounds();
          for (const s of validStops) bounds.extend([s.lng, s.lat]);
          map.fitBounds(bounds, { padding: 80, maxZoom: 14 });
        }
      } catch (e) {
        console.error("[request-map] route fetch failed:", e);
      } finally {
        setLoadingRoute(false);
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  // Toggle route visibility (just hide/show the layers, keep source).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const vis = showRoute ? "visible" : "none";
      if (map.getLayer("route-line"))
        map.setLayoutProperty("route-line", "visibility", vis);
      if (map.getLayer("route-line-casing"))
        map.setLayoutProperty("route-line-casing", "visibility", vis);
    };
    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [showRoute]);

  if (validStops.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
        <MapPin className="mx-auto size-8 text-muted-foreground" />
        <p className="mt-2 text-sm text-muted-foreground">
          Δεν υπάρχουν συντεταγμένες για τα σημεία της διαδρομής.
        </p>
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-base font-bold text-foreground">
          <Route className="size-4 text-[var(--color-brand-blue)]" />
          Χάρτης διαδρομής
        </h2>
        <div className="flex items-center gap-3 text-xs">
          {route && (
            <>
              <span className="font-semibold text-foreground">
                {route.distanceKm.toFixed(1)} km
              </span>
              <span className="text-muted-foreground">
                ≈ {Math.round(route.durationMin)} λεπτά
              </span>
            </>
          )}
          {loadingRoute && (
            <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
          )}
          {route && (
            <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={showRoute}
                onChange={(e) => setShowRoute(e.target.checked)}
                className="size-3.5 accent-[var(--color-brand-blue)]"
              />
              Διαδρομή
            </label>
          )}
        </div>
      </div>
      <div
        ref={containerRef}
        className="h-[420px] w-full overflow-hidden rounded-xl border border-border"
      />
      <p className="mt-2 text-[10px] text-muted-foreground">
        Routing: OpenStreetMap / OSRM. Tiles: MapTiler.
      </p>
    </section>
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&"
      ? "&amp;"
      : c === "<"
        ? "&lt;"
        : c === ">"
          ? "&gt;"
          : c === '"'
            ? "&quot;"
            : "&#39;",
  );
}
