"use client";

import { useEffect, useRef } from "react";
import * as maptiler from "@maptiler/sdk";
import "@maptiler/sdk/dist/maptiler-sdk.css";
import { MapPin } from "lucide-react";

import type { AdminRequest, StatusConfigMap } from "./requests-client";

interface Props {
  apiKey: string;
  requests: AdminRequest[];
  statusConfig: StatusConfigMap;
}

const STATUS_HEX: Record<keyof StatusConfigMap, string> = {
  DRAFT: "#94a3b8",
  PUBLISHED: "#0ea5e9",
  AWARDED: "#f59e0b",
  COMPLETED: "#10b981",
  CANCELLED: "#f43f5e",
};

function markerEl(color: string): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText = `
    width:18px;height:18px;border-radius:9999px;
    background:${color};
    border:3px solid #fff;
    box-shadow:0 2px 6px rgba(0,0,0,.35);
    cursor:pointer;
  `;
  return el;
}

function escapeHtml(s: string): string {
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

export function RequestsMap({ apiKey, requests, statusConfig }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maptiler.Map | null>(null);

  const withCoords = requests.filter(
    (r): r is AdminRequest & { fromLat: number; fromLng: number } =>
      r.fromLat != null && r.fromLng != null,
  );

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    maptiler.config.apiKey = apiKey;
    const map = new maptiler.Map({
      container: containerRef.current,
      style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${apiKey}`,
      center: [23.7275, 37.9838],
      zoom: 6,
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [apiKey]);

  // Render / re-render markers when requests change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const markers: maptiler.Marker[] = [];

    const draw = () => {
      if (withCoords.length === 0) return;
      for (const r of withCoords) {
        const color = STATUS_HEX[r.status];
        const ref = r.id.slice(-8).toUpperCase();
        const label = statusConfig[r.status].label;
        const m = new maptiler.Marker({ element: markerEl(color) })
          .setLngLat([r.fromLng, r.fromLat])
          .setPopup(
            new maptiler.Popup({ offset: 16 }).setHTML(
              `<div style="font-family:system-ui;font-size:12px;max-width:240px">
                <div style="display:flex;align-items:center;gap:6px;font-size:10px;text-transform:uppercase;font-weight:700;color:${color}">
                  <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color}"></span>
                  ${label} · #${ref}
                </div>
                <div style="margin-top:4px;font-weight:600">${escapeHtml(r.fromAddress)}</div>
                <div style="color:#64748b">→ ${escapeHtml(r.toAddress)}</div>
                <div style="margin-top:4px;color:#64748b;font-size:11px">
                  ${escapeHtml(r.user.name ?? r.user.email)} · ${r.itemsCount} τεμ · ${r.totalVolumeM3.toFixed(1)} m³
                </div>
                <a href="/admin/requests/${r.id}" style="display:inline-block;margin-top:6px;color:#2563eb;font-weight:600;text-decoration:none;font-size:11px">
                  Λεπτομέρειες →
                </a>
              </div>`,
            ),
          )
          .addTo(map);
        markers.push(m);
      }
      if (withCoords.length > 1) {
        const bounds = new maptiler.LngLatBounds();
        for (const r of withCoords) bounds.extend([r.fromLng, r.fromLat]);
        map.fitBounds(bounds, { padding: 60, maxZoom: 11 });
      } else if (withCoords.length === 1) {
        map.setCenter([withCoords[0].fromLng, withCoords[0].fromLat]);
        map.setZoom(11);
      }
    };

    if (map.isStyleLoaded()) draw();
    else map.once("load", draw);

    return () => {
      for (const m of markers) m.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requests]);

  if (withCoords.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
        <MapPin className="mx-auto size-10 text-muted-foreground" />
        <p className="mt-3 text-sm font-semibold text-foreground">
          Κανένα αίτημα με συντεταγμένες
        </p>
        <p className="text-xs text-muted-foreground">
          Δοκίμασε άλλο φίλτρο ή κάνε backfill στις γεωγραφικές συντεταγμένες.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3 text-xs text-muted-foreground">
        {(Object.keys(STATUS_HEX) as Array<keyof StatusConfigMap>).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-full"
              style={{ background: STATUS_HEX[s] }}
            />
            {statusConfig[s].label}
          </span>
        ))}
        <span className="ml-auto">
          {withCoords.length} σημεία στον χάρτη
        </span>
      </div>
      <div
        ref={containerRef}
        className="h-[640px] w-full overflow-hidden rounded-2xl border border-border"
      />
    </div>
  );
}
