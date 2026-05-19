"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";

export interface FurnitureItem {
  /** Greek-language display name shown in UI labels. */
  name: string;
  /** Optional English internal name (for analytics / future i18n). */
  name_en?: string;
  length_cm: number;
  width_cm: number;
  height_cm: number;
  volume_m3: number;
  /** [ymin, xmin, ymax, xmax] normalized 0-1000 of the supplied image. */
  box_2d: [number, number, number, number];
}

export interface AnalysisResult {
  items: FurnitureItem[];
  error?: string;
}

const PROMPT = `Είσαι ειδικός εκτιμητής όγκου οικοσκευής για ελληνική μεταφορική.

Η εικόνα που λαμβάνεις μπορεί να είναι μία φωτογραφία ή ένας οριζόντιος συνδυασμός
έως 4 φωτογραφιών (panorama / stitch) που δείχνουν τον ίδιο ή διαφορετικούς χώρους.
Αναγνώρισε ΚΑΘΕ διακριτό αντικείμενο (έπιπλα, ηλεκτρικές συσκευές, κουτιά, ογκώδη
αντικείμενα) και επέστρεψε ΜΟΝΟ έγκυρο JSON array — χωρίς markdown, χωρίς code fences,
χωρίς εξηγήσεις.

Για κάθε αντικείμενο επέστρεψε:
- name: ελληνικό όνομα αντικειμένου (π.χ. "τριθέσιος καναπές", "ψυγείο", "κρεβάτι διπλό", "κουτί μετακόμισης")
- name_en: σύντομο αγγλικό όνομα για internal χρήση
- length_cm: μεγαλύτερη οριζόντια διάσταση σε εκατοστά
- width_cm: μικρότερη οριζόντια διάσταση σε εκατοστά
- height_cm: ύψος σε εκατοστά
- volume_m3: όγκος = (length × width × height) / 1.000.000
- box_2d: bounding box ως [ymin, xmin, ymax, xmax] κανονικοποιημένα 0-1000 ως προς τις διαστάσεις της εικόνας που έδωσα

Χρησιμοποίησε reference αντικείμενα για κανονικοποίηση διαστάσεων:
- Πόρτα δωματίου: 80 × 210 cm
- Παράθυρο τυπικό: 100 × 140 cm
- Διακόπτης φωτός: 8.5 × 8.5 cm
- Πρίζα: 7 × 8 cm

Παράδειγμα output:
[
  {
    "name": "τριθέσιος καναπές",
    "name_en": "3-seater sofa",
    "length_cm": 200,
    "width_cm": 90,
    "height_cm": 85,
    "volume_m3": 0.153,
    "box_2d": [320, 110, 780, 920]
  }
]

Αν δεν υπάρχουν έπιπλα ή κουτιά, επέστρεψε άδειο array: [].`;

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

async function runGemini(
  base64: string,
  mimeType: string,
): Promise<AnalysisResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { items: [], error: "Το API key δεν έχει ρυθμιστεί." };
  }
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const result = await model.generateContent([
      PROMPT,
      {
        inlineData: {
          mimeType: mimeType as "image/jpeg" | "image/png" | "image/webp",
          data: base64,
        },
      },
    ]);

    const text = result.response.text().trim();
    const cleaned = text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const items: FurnitureItem[] = JSON.parse(cleaned);
    if (!Array.isArray(items)) {
      return { items: [], error: "Το AI επέστρεψε μη αναμενόμενη μορφή." };
    }
    return { items };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Άγνωστο σφάλμα";
    return { items: [], error: `Η ανάλυση απέτυχε: ${message}` };
  }
}

/**
 * Original path: client sends the stitched image as multipart FormData.
 * Kept for backwards compatibility and for environments where BunnyCDN isn't
 * configured.
 */
export async function analyzeImage(formData: FormData): Promise<AnalysisResult> {
  const file = formData.get("image") as File | null;
  if (!file) return { items: [], error: "Δεν δόθηκε εικόνα." };
  const mimeType = (file.type || "image/jpeg").toLowerCase();
  if (!ALLOWED_MIME.has(mimeType)) {
    return { items: [], error: "Μη υποστηριζόμενος τύπος εικόνας." };
  }
  const bytes = await file.arrayBuffer();
  const base64 = Buffer.from(bytes).toString("base64");
  return runGemini(base64, mimeType);
}

/**
 * Faster, CDN-backed path: client uploads the (possibly stitched) image to
 * BunnyCDN and passes its public URL here. The server pulls bytes from the
 * CDN (cached + close to our region) and forwards to Gemini.
 *
 * Wins vs `analyzeImage`:
 *   - No multi-MB body crossing the Server Action boundary
 *   - The stitched panorama gets a permanent CDN URL we can re-show, share,
 *     or attach to the persisted MoveRequest
 *   - Retrying analysis doesn't re-upload bytes
 */
export async function analyzeImageByUrl(
  imageUrl: string,
): Promise<AnalysisResult> {
  if (!/^https:\/\//.test(imageUrl)) {
    return { items: [], error: "Μη έγκυρο URL εικόνας." };
  }
  try {
    const r = await fetch(imageUrl, { cache: "no-store" });
    if (!r.ok) {
      return {
        items: [],
        error: `Αδύνατη η ανάκτηση εικόνας από το CDN (${r.status}).`,
      };
    }
    const mimeRaw = (r.headers.get("content-type") ?? "image/jpeg")
      .split(";")[0]
      .trim()
      .toLowerCase();
    const mimeType = ALLOWED_MIME.has(mimeRaw) ? mimeRaw : "image/jpeg";
    const buffer = await r.arrayBuffer();
    if (buffer.byteLength === 0) {
      return { items: [], error: "Άδεια εικόνα από το CDN." };
    }
    const base64 = Buffer.from(buffer).toString("base64");
    return runGemini(base64, mimeType);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Άγνωστο σφάλμα";
    return { items: [], error: `Αποτυχία ανάκτησης εικόνας: ${msg}` };
  }
}
