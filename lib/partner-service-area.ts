/**
 * Helpers γύρω από την «περιοχή εξυπηρέτησης» ενός CarrierPartner.
 *
 * Πεδία στο DB:
 *   serviceMode      'ANY' | 'CITIES' | 'RADIUS'
 *   serviceCities    JSON array από locality strings (lowercase normalized)
 *   hqLat, hqLng     έδρα partner για RADIUS mode
 *   serviceRadiusKm  ακτίνα γύρω από έδρα σε km
 */

export type ServiceAreaMode = "ANY" | "CITIES" | "RADIUS";

export interface PartnerServiceArea {
  serviceMode: ServiceAreaMode;
  serviceCities: string | null;
  hqLat: number | null;
  hqLng: number | null;
  serviceRadiusKm: number | null;
}

export interface ServiceLocation {
  city?: string | null;
  lat?: number | null;
  lng?: number | null;
}

/** Normalize a locality string for case/accent-insensitive comparison. */
export function normalizeCity(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function parseServiceCities(json: string | null): string[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function serializeServiceCities(cities: string[]): string {
  return JSON.stringify(cities.map((c) => c.trim()).filter(Boolean));
}

/** Haversine distance in km between two points. */
export function distanceKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Returns true if the partner covers the given location.
 *   - ANY    → true πάντα
 *   - CITIES → if location.city matches a configured city (case/accent-ins.)
 *   - RADIUS → if Haversine(hq, location) <= radiusKm
 *
 * Returns false αν λείπουν δεδομένα για τον επιλεγμένο mode.
 */
export function partnerCoversLocation(
  partner: PartnerServiceArea,
  location: ServiceLocation,
): { covered: boolean; reason: string } {
  if (partner.serviceMode === "ANY") {
    return { covered: true, reason: "ANY · χωρίς περιορισμό" };
  }

  if (partner.serviceMode === "CITIES") {
    const cities = parseServiceCities(partner.serviceCities).map(normalizeCity);
    if (cities.length === 0) {
      return { covered: false, reason: "CITIES · δεν έχουν οριστεί πόλεις" };
    }
    if (!location.city) {
      return { covered: false, reason: "δεν δόθηκε πόλη για σύγκριση" };
    }
    const target = normalizeCity(location.city);
    const hit = cities.find((c) => target.includes(c) || c.includes(target));
    return hit
      ? { covered: true, reason: `CITIES · καλύπτει «${hit}»` }
      : { covered: false, reason: `CITIES · η «${location.city}» εκτός λίστας` };
  }

  if (partner.serviceMode === "RADIUS") {
    if (partner.hqLat == null || partner.hqLng == null || partner.serviceRadiusKm == null) {
      return { covered: false, reason: "RADIUS · λείπει έδρα ή ακτίνα" };
    }
    if (location.lat == null || location.lng == null) {
      return { covered: false, reason: "δεν δόθηκαν συντεταγμένες προορισμού" };
    }
    const d = distanceKm(partner.hqLat, partner.hqLng, location.lat, location.lng);
    return d <= partner.serviceRadiusKm
      ? { covered: true, reason: `RADIUS · ${d.toFixed(0)} km από έδρα (≤ ${partner.serviceRadiusKm} km)` }
      : { covered: false, reason: `RADIUS · ${d.toFixed(0)} km > ${partner.serviceRadiusKm} km` };
  }

  return { covered: false, reason: "άγνωστο mode" };
}
