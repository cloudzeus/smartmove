/**
 * AADE / vat.wwa.gr lookup client.
 *
 * Endpoint: https://vat.wwa.gr/afm2info  (POST { afm })
 *
 * Returns the full Greek tax registry record. We only use the `basic_rec`
 * section (and just up to `normal_vat_system_flag`).
 *
 * TRDR (SoftOne) field mapping for downstream sync:
 *   afm                       → TRDR.AFM
 *   onomasia                  → TRDR.NAME
 *   commer_title              → TRDR.COMMERCIALSTORENAME
 *   doy                       → TRDR.IRSDATA (the DOY code; doy_descr is the name)
 *   postal_address            → TRDR.ADDRESS
 *   postal_address_no         → appended to ADDRESS (no separate TRDR slot)
 *   postal_zip_code           → TRDR.ZIP
 *   postal_area_description   → TRDR.DISTRICT
 *   regist_date               → TRDR.REGISTRATIONDATE / TRDR.UPDDATE seed
 *   legal_status_descr        → free-form note (no TRDR slot)
 *   normal_vat_system_flag    → TRDR.VAT_SYSTEM_FLAG (custom: Y/N)
 */

const AADE_ENDPOINT = "https://vat.wwa.gr/afm2info";
const TIMEOUT_MS = 8000;

export interface AadeBasicRecord {
  afm: string;
  doy?: string;
  doyDescription?: string;
  legalStatusKind?: string; // i_ni_flag_descr (ΦΠ / ΜΗ ΦΠ)
  isActive: boolean; // deactivation_flag === "1"
  isActiveDescription?: string;
  firmFlagDescription?: string;
  legalName?: string; // onomasia
  commercialName?: string; // commer_title
  legalStatus?: string; // legal_status_descr
  address?: string;
  addressNo?: string;
  postalZip?: string;
  postalArea?: string;
  registDate?: string; // ISO date string
  vatSystemFlag?: string; // Y/N
}

export type AadeLookupResult =
  | { ok: true; data: AadeBasicRecord }
  | { ok: false; error: string; code?: string };

interface RawAadeResponse {
  basic_rec?: {
    afm?: string;
    doy?: string;
    doy_descr?: string;
    i_ni_flag_descr?: string;
    deactivation_flag?: string;
    deactivation_flag_descr?: string;
    firm_flag_descr?: string;
    onomasia?: string;
    commer_title?: string;
    legal_status_descr?: string;
    postal_address?: string;
    postal_address_no?: string;
    postal_zip_code?: string;
    postal_area_description?: string;
    regist_date?: string;
    normal_vat_system_flag?: string;
  };
  error?: string;
}

export function validateAfm(afm: string): { valid: boolean; reason?: string } {
  const cleaned = afm.replace(/\D/g, "");
  if (cleaned.length !== 9) {
    return { valid: false, reason: "Ο ΑΦΜ πρέπει να έχει 9 ψηφία." };
  }
  // Greek AFM mod-11 check
  const digits = cleaned.split("").map(Number);
  const check = digits[8];
  const sum = digits
    .slice(0, 8)
    .reduce((acc, d, i) => acc + d * Math.pow(2, 8 - i), 0);
  const computed = (sum % 11) % 10;
  if (computed !== check) {
    return { valid: false, reason: "Μη έγκυρος ΑΦΜ (αποτυχία check digit)." };
  }
  return { valid: true };
}

export async function lookupAfm(rawAfm: string): Promise<AadeLookupResult> {
  const afm = rawAfm.replace(/\D/g, "");
  const validation = validateAfm(afm);
  if (!validation.valid) {
    return { ok: false, error: validation.reason ?? "Μη έγκυρος ΑΦΜ", code: "invalid_afm" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const r = await fetch(AADE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ afm }),
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timer);
    if (!r.ok) {
      const body = await r.text().catch(() => "");
      console.error(`[aade] HTTP ${r.status}: ${body.slice(0, 200)}`);
      return {
        ok: false,
        error: `Σφάλμα από το ΑΑΔΕ API (${r.status})`,
        code: `http_${r.status}`,
      };
    }
    const json = (await r.json()) as RawAadeResponse;
    const basic = json.basic_rec;
    if (!basic || !basic.afm) {
      return {
        ok: false,
        error: "Δεν βρέθηκαν στοιχεία για αυτόν τον ΑΦΜ.",
        code: "not_found",
      };
    }

    // AADE returns nil fields as `{"$":{"xsi:nil":"true"}}` instead of null.
    // Coerce every field down to a clean string|undefined before we hand it
    // to the UI — otherwise objects leak into form state and Zod rejects them.
    const s = (v: unknown): string | undefined => {
      if (v == null) return undefined;
      if (typeof v === "string") return v.trim() || undefined;
      if (typeof v === "number") return String(v);
      // The xsi:nil pattern and any other object → treat as missing
      return undefined;
    };

    const data: AadeBasicRecord = {
      afm: s(basic.afm) ?? "",
      doy: s(basic.doy),
      doyDescription: s(basic.doy_descr),
      legalStatusKind: s(basic.i_ni_flag_descr),
      isActive: s(basic.deactivation_flag) === "1",
      isActiveDescription: s(basic.deactivation_flag_descr),
      firmFlagDescription: s(basic.firm_flag_descr),
      legalName: s(basic.onomasia),
      commercialName: s(basic.commer_title),
      legalStatus: s(basic.legal_status_descr),
      address: s(basic.postal_address),
      addressNo: s(basic.postal_address_no),
      postalZip: s(basic.postal_zip_code),
      postalArea: s(basic.postal_area_description),
      registDate: s(basic.regist_date),
      vatSystemFlag: s(basic.normal_vat_system_flag),
    };

    return { ok: true, data };
  } catch (e) {
    clearTimeout(timer);
    const aborted = e instanceof Error && e.name === "AbortError";
    console.error("[aade] fetch failed:", e);
    return {
      ok: false,
      error: aborted
        ? "Timeout — η ΑΑΔΕ καθυστερεί να απαντήσει. Δοκιμάστε ξανά."
        : "Σύνδεση στο ΑΑΔΕ απέτυχε. Προσπαθήστε σε λίγο.",
      code: aborted ? "timeout" : "fetch_failed",
    };
  }
}
