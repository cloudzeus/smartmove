import { env } from "./env";

export interface GeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
  postcode?: string;
  city?: string;
  country?: string;
}

const BASE = "https://geocode.maps.co";

interface MapsCoResponse {
  lat: string;
  lon: string;
  display_name: string;
  address?: {
    postcode?: string;
    city?: string;
    town?: string;
    village?: string;
    country?: string;
    country_code?: string;
  };
}

/**
 * Forward geocode an address → coordinates. Uses geocode.maps.co (OSM data).
 * Free tier: 1 req/sec.
 */
export async function geocode(query: string): Promise<GeocodeResult | null> {
  const key = env.geocodeApiKey();
  if (!key) throw new Error("Missing GEOCODE_API");
  const url = new URL(`${BASE}/search`);
  url.searchParams.set("q", query);
  url.searchParams.set("api_key", key);

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  const data = (await res.json()) as MapsCoResponse[];
  const hit = data[0];
  if (!hit) return null;
  return {
    lat: Number(hit.lat),
    lng: Number(hit.lon),
    displayName: hit.display_name,
    postcode: hit.address?.postcode?.replace(/\s+/g, ""),
    city: hit.address?.city ?? hit.address?.town ?? hit.address?.village,
    country: hit.address?.country_code?.toUpperCase() ?? hit.address?.country,
  };
}

interface MapsCoReverseResponse {
  display_name: string;
  address?: MapsCoResponse["address"];
}

/**
 * Reverse geocode coordinates → address.
 */
export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<GeocodeResult | null> {
  const key = env.geocodeApiKey();
  if (!key) throw new Error("Missing GEOCODE_API");
  const url = new URL(`${BASE}/reverse`);
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("api_key", key);

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  const hit = (await res.json()) as MapsCoReverseResponse | null;
  if (!hit?.display_name) return null;
  return {
    lat,
    lng,
    displayName: hit.display_name,
    postcode: hit.address?.postcode?.replace(/\s+/g, ""),
    city: hit.address?.city ?? hit.address?.town ?? hit.address?.village,
    country: hit.address?.country_code?.toUpperCase() ?? hit.address?.country,
  };
}
