"use client";

import { useEffect, useRef } from "react";
import * as maptiler from "@maptiler/sdk";
import "@maptiler/sdk/dist/maptiler-sdk.css";

export interface MapMarker {
  lat: number;
  lng: number;
  label?: string;
  color?: string;
}

interface AdminMapProps {
  apiKey: string;
  center?: { lat: number; lng: number };
  zoom?: number;
  markers?: MapMarker[];
  style?: "streets-v2" | "hybrid" | "satellite" | "basic-v2";
  className?: string;
}

export function AdminMap({
  apiKey,
  center = { lat: 37.9838, lng: 23.7275 }, // Athens fallback
  zoom = 11,
  markers = [],
  style = "streets-v2",
  className,
}: AdminMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maptiler.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    maptiler.config.apiKey = apiKey;
    const map = new maptiler.Map({
      container: containerRef.current,
      style: `https://api.maptiler.com/maps/${style}/style.json?key=${apiKey}`,
      center: [center.lng, center.lat],
      zoom,
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [apiKey, style, center.lat, center.lng, zoom]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const handles: maptiler.Marker[] = [];
    const addMarkers = () => {
      for (const m of markers) {
        const mk = new maptiler.Marker({ color: m.color ?? "#0ea5e9" })
          .setLngLat([m.lng, m.lat])
          .addTo(map);
        if (m.label) {
          mk.setPopup(new maptiler.Popup({ offset: 24 }).setText(m.label));
        }
        handles.push(mk);
      }
    };
    if (map.isStyleLoaded()) addMarkers();
    else map.once("load", addMarkers);
    return () => {
      for (const h of handles) h.remove();
    };
  }, [markers]);

  return (
    <div
      ref={containerRef}
      className={className ?? "h-[400px] w-full rounded-lg overflow-hidden"}
    />
  );
}
