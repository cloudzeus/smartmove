"use client";

import { useEffect, useRef, useState } from "react";
import * as maptiler from "@maptiler/sdk";
import "@maptiler/sdk/dist/maptiler-sdk.css";

interface Props {
  lat: number | null;
  lng: number | null;
  radiusKm: number;
  apiKey: string | null;
}

const MAP_H = 220;

/**
 * Interactive MapLibre/MapTiler preview with a circle overlay sized to the
 * configured radius. Uses vector tiles (works with free MapTiler keys —
 * static rendered maps require a paid plan).
 */
export function PartnerCoverageMap({ lat, lng, radiusKm, apiKey }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maptiler.Map | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const hasCoords = lat != null && !Number.isNaN(lat) && lng != null && !Number.isNaN(lng);

  // Init the map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current || !apiKey || !hasCoords) return;

    let cancelled = false;
    (async () => {
      try {
        maptiler.config.apiKey = apiKey;

        // Pre-fetch style and inject projection (MapLibre 5 requirement).
        const styleUrl = `https://api.maptiler.com/maps/streets-v2/style.json?key=${apiKey}`;
        let styleSpec: unknown;
        try {
          const r = await fetch(styleUrl);
          styleSpec = await r.json();
        } catch {
          styleSpec = styleUrl;
        }
        if (cancelled || !containerRef.current) return;
        if (styleSpec && typeof styleSpec === "object") {
          const s = styleSpec as { projection?: unknown };
          if (!s.projection) s.projection = { type: "mercator" };
        }

        const map = new maptiler.Map({
          container: containerRef.current,
          style: styleSpec as never,
          center: [lng!, lat!],
          zoom: 8,
          interactive: false, // preview only — no drag/zoom
        });
        mapRef.current = map;

        map.on("load", () => {
          // Circle as GeoJSON polygon (64-sided approx) so we get real geographic scale.
          map.addSource("coverage", {
            type: "geojson",
            data: circleGeoJSON(lat!, lng!, radiusKm),
          });
          map.addLayer({
            id: "coverage-fill",
            type: "fill",
            source: "coverage",
            paint: { "fill-color": "rgb(37,99,235)", "fill-opacity": 0.15 },
          });
          map.addLayer({
            id: "coverage-line",
            type: "line",
            source: "coverage",
            paint: {
              "line-color": "rgb(37,99,235)",
              "line-width": 1.5,
              "line-dasharray": [3, 2],
            },
          });

          // Center marker
          new maptiler.Marker({ color: "#2563eb" })
            .setLngLat([lng!, lat!])
            .addTo(map);

          // Fit to circle bounds with padding
          const bounds = circleBounds(lat!, lng!, radiusKm);
          map.fitBounds(bounds, { padding: 20, animate: false, maxZoom: 13 });
        });

        map.on("error", (e) => {
          console.warn("[partner-coverage-map] map error:", e?.error?.message);
          setErr(e?.error?.message ?? "Σφάλμα χάρτη");
        });
      } catch (e) {
        setErr((e as Error).message ?? "Σφάλμα χάρτη");
      }
    })();

    return () => {
      cancelled = true;
      const m = mapRef.current;
      if (m) { m.remove(); mapRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, hasCoords]);

  // Update circle + recenter when lat/lng/radius change without remounting.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !hasCoords) return;
    const apply = () => {
      const src = map.getSource("coverage") as maptiler.GeoJSONSource | undefined;
      if (src) src.setData(circleGeoJSON(lat!, lng!, radiusKm));
      map.fitBounds(circleBounds(lat!, lng!, radiusKm), {
        padding: 20, animate: true, maxZoom: 13,
      });
    };
    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [lat, lng, radiusKm, hasCoords]);

  if (!apiKey) {
    return (
      <div className="grid h-[140px] place-items-center rounded-md border border-dashed border-border bg-muted/30 px-3 py-4 text-center">
        <p className="text-[11px] text-muted-foreground">Λείπει MAPTILER_API_KEY.</p>
      </div>
    );
  }

  if (!hasCoords) {
    return (
      <div className="grid h-[140px] place-items-center rounded-md border border-dashed border-border bg-muted/30 px-3 py-4 text-center">
        <p className="text-[11px] text-muted-foreground">
          Εισήγαγε διεύθυνση και πάτησε «Εντοπισμός» για να δεις τον χάρτη κάλυψης.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-border bg-muted/30">
      <div className="flex items-center justify-between px-2 py-1.5">
        <span className="cx-eyebrow">Προεπισκόπηση κάλυψης</span>
        <span className="inline-flex items-center gap-2 font-mono text-[10px] tabular-nums text-muted-foreground">
          <span>{lat!.toFixed(4)}, {lng!.toFixed(4)}</span>
          <span className="text-muted-foreground/40">·</span>
          <span>R = {radiusKm} km</span>
        </span>
      </div>
      <div className="relative" style={{ height: MAP_H }}>
        <div ref={containerRef} className="h-full w-full" />
        {err && (
          <div className="absolute inset-0 grid place-items-center bg-muted/80 px-3 text-center text-[11px] text-rose-700">
            {err}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------- helpers ----------------

function circleGeoJSON(lat: number, lng: number, radiusKm: number) {
  const steps = 64;
  const coords: [number, number][] = [];
  const R = 6371;
  for (let i = 0; i <= steps; i++) {
    const bearing = (i / steps) * 2 * Math.PI;
    const lat1 = (lat * Math.PI) / 180;
    const lng1 = (lng * Math.PI) / 180;
    const dByR = radiusKm / R;
    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(dByR) +
      Math.cos(lat1) * Math.sin(dByR) * Math.cos(bearing),
    );
    const lng2 = lng1 + Math.atan2(
      Math.sin(bearing) * Math.sin(dByR) * Math.cos(lat1),
      Math.cos(dByR) - Math.sin(lat1) * Math.sin(lat2),
    );
    coords.push([(lng2 * 180) / Math.PI, (lat2 * 180) / Math.PI]);
  }
  return {
    type: "Feature" as const,
    properties: {},
    geometry: { type: "Polygon" as const, coordinates: [coords] },
  };
}

function circleBounds(lat: number, lng: number, radiusKm: number): maptiler.LngLatBounds {
  // Approx 1° lat ≈ 111 km; lng scaled by cos(lat).
  const dLat = radiusKm / 111;
  const dLng = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
  return new maptiler.LngLatBounds(
    [lng - dLng, lat - dLat],
    [lng + dLng, lat + dLat],
  );
}
