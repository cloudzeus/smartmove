"use client";

import { useEffect, useRef } from "react";
import * as maptiler from "@maptiler/sdk";
import "@maptiler/sdk/dist/maptiler-sdk.css";
import { MapPin } from "lucide-react";

interface Location {
  id: string;
  label: string;
  lat: number | null;
  lng: number | null;
  serviceRadiusKm?: number | null;
  isPrimary?: boolean;
}

interface Props {
  apiKey: string;
  tenant: Location;
  branches: Location[];
}

// Approximate a circle in geographic coordinates as a GeoJSON polygon.
// `radiusKm` in kilometers around [lng, lat].
function circlePolygon(
  lng: number,
  lat: number,
  radiusKm: number,
  points = 64,
): GeoJSON.Feature<GeoJSON.Polygon> {
  const coords: [number, number][] = [];
  const earthRadius = 6371;
  const angularRadius = radiusKm / earthRadius;
  const latRad = (lat * Math.PI) / 180;
  const lngRad = (lng * Math.PI) / 180;
  for (let i = 0; i <= points; i++) {
    const bearing = (i * 2 * Math.PI) / points;
    const sinLat =
      Math.sin(latRad) * Math.cos(angularRadius) +
      Math.cos(latRad) * Math.sin(angularRadius) * Math.cos(bearing);
    const newLat = Math.asin(sinLat);
    const newLng =
      lngRad +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angularRadius) * Math.cos(latRad),
        Math.cos(angularRadius) - Math.sin(latRad) * sinLat,
      );
    coords.push([(newLng * 180) / Math.PI, (newLat * 180) / Math.PI]);
  }
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [coords] },
  };
}

export function TenantMapTab({ apiKey, tenant, branches }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maptiler.Map | null>(null);

  const points = [tenant, ...branches].filter(
    (p): p is Location & { lat: number; lng: number } =>
      p.lat != null && p.lng != null,
  );

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if (points.length === 0) return;

    maptiler.config.apiKey = apiKey;
    const map = new maptiler.Map({
      container: containerRef.current,
      style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${apiKey}`,
      center: [points[0].lng, points[0].lat],
      zoom: 11,
    });
    mapRef.current = map;

    map.on("load", () => {
      const circleFeatures = points
        .filter((p) => p.serviceRadiusKm && p.serviceRadiusKm > 0)
        .map((p) =>
          circlePolygon(p.lng, p.lat, p.serviceRadiusKm as number),
        );

      if (circleFeatures.length > 0) {
        map.addSource("service-radius", {
          type: "geojson",
          data: { type: "FeatureCollection", features: circleFeatures },
        });
        map.addLayer({
          id: "service-radius-fill",
          type: "fill",
          source: "service-radius",
          paint: {
            "fill-color": "#0ea5e9",
            "fill-opacity": 0.12,
          },
        });
        map.addLayer({
          id: "service-radius-line",
          type: "line",
          source: "service-radius",
          paint: {
            "line-color": "#0ea5e9",
            "line-width": 2,
            "line-dasharray": [2, 2],
          },
        });
      }

      for (const p of points) {
        const color = p.id === tenant.id ? "#dc2626" : "#0ea5e9";
        const tag = p.id === tenant.id ? "Έδρα" : "Υποκατάστημα";
        new maptiler.Marker({ color })
          .setLngLat([p.lng, p.lat])
          .setPopup(
            new maptiler.Popup({ offset: 24 }).setHTML(
              `<div style="font-family:system-ui;font-size:13px"><strong>${escapeHtml(p.label)}</strong><br/><span style="color:#64748b">${tag}${p.serviceRadiusKm ? ` · ${p.serviceRadiusKm} km` : ""}</span></div>`,
            ),
          )
          .addTo(map);
      }

      if (points.length > 1) {
        const bounds = new maptiler.LngLatBounds();
        for (const p of points) bounds.extend([p.lng, p.lat]);
        map.fitBounds(bounds, { padding: 60, maxZoom: 13 });
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  if (points.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
        <MapPin className="mx-auto size-10 text-muted-foreground" />
        <p className="mt-3 text-sm text-muted-foreground">
          Δεν υπάρχουν γεωγραφικά δεδομένα για αυτόν τον πελάτη.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Συμπληρώστε διεύθυνση στην έδρα ή σε ένα υποκατάστημα για να εμφανιστεί
          ο χάρτης.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-red-600" /> Έδρα
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-sky-500" /> Υποκαταστήματα
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0 w-4 border-t-2 border-dashed border-sky-500" />
          Ακτίνα εξυπηρέτησης
        </span>
      </div>
      <div
        ref={containerRef}
        className="h-[560px] w-full rounded-2xl border border-border overflow-hidden"
      />
    </div>
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
