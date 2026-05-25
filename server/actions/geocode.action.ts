"use server";

import { env } from "@/lib/env";

type GeocodeResult =
  | { ok: true; lat: number; lng: number; placeName: string }
  | { ok: false; error: string };

/**
 * Forward geocode μέσω MapTiler. Επιστρέφει την πρώτη αντιστοίχιση.
 * Δουλεύει εξ ίσου με «Αθήνα» όσο και με «Λεωφ. Συγγρού 100».
 */
export async function geocodeAddress(query: string): Promise<GeocodeResult> {
  const q = query.trim();
  if (!q) return { ok: false, error: "Άδεια διεύθυνση." };
  const apiKey = env.maptilerApiKey();
  if (!apiKey) return { ok: false, error: "Λείπει MAPTILER_API_KEY." };

  try {
    const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(q)}.json?key=${apiKey}&limit=1&language=el&country=gr`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) {
      return { ok: false, error: `Geocoding failed (${res.status}).` };
    }
    const data = (await res.json()) as { features?: Array<{ center?: [number, number]; place_name?: string }> };
    const first = data.features?.[0];
    if (!first || !first.center) {
      return { ok: false, error: "Δεν βρέθηκε αποτέλεσμα." };
    }
    const [lng, lat] = first.center;
    return { ok: true, lat, lng, placeName: first.place_name ?? q };
  } catch (e) {
    return { ok: false, error: (e as Error).message ?? "Geocoding error" };
  }
}
