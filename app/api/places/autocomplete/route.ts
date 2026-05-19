import { NextResponse } from "next/server";

export const runtime = "edge";

interface Suggestion {
  placeId: string;
  text: string;
  secondary?: string;
}

interface PlacesPrediction {
  placeId?: string;
  text?: { text?: string };
  structuredFormat?: {
    mainText?: { text?: string };
    secondaryText?: { text?: string };
  };
}

// We rely on `includedRegionCodes: ["gr"]` for filtering to Greece;
// no locationBias needed (Places API caps circle.radius at 50km, which is
// too small to cover the country).

export async function POST(req: Request) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { suggestions: [], error: "missing_api_key" },
      { status: 200 },
    );
  }

  let body: { input?: string };
  try {
    body = (await req.json()) as { input?: string };
  } catch {
    return NextResponse.json({ suggestions: [] }, { status: 400 });
  }

  const input = (body.input ?? "").trim();
  if (input.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  try {
    const r = await fetch(
      "https://places.googleapis.com/v1/places:autocomplete",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask":
            "suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat",
        },
        body: JSON.stringify({
          input,
          languageCode: "el",
          includedRegionCodes: ["gr"],
          includedPrimaryTypes: [
            "street_address",
            "premise",
            "route",
            "postal_code",
            "locality",
          ],
        }),
      },
    );

    if (!r.ok) {
      const text = await r.text();
      console.error(`[places] ${r.status}: ${text.slice(0, 200)}`);
      return NextResponse.json(
        { suggestions: [], error: `places_api_${r.status}` },
        { status: 200 },
      );
    }

    const data = (await r.json()) as {
      suggestions?: Array<{ placePrediction?: PlacesPrediction }>;
    };

    const suggestions: Suggestion[] = (data.suggestions ?? [])
      .map((s) => s.placePrediction)
      .filter((p): p is PlacesPrediction => Boolean(p?.placeId && p?.text?.text))
      .map((p) => ({
        placeId: p.placeId!,
        text:
          p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
        secondary: p.structuredFormat?.secondaryText?.text,
      }))
      .slice(0, 6);

    return NextResponse.json({ suggestions });
  } catch (e) {
    console.error("[places] fetch failed:", e);
    return NextResponse.json(
      { suggestions: [], error: "fetch_failed" },
      { status: 200 },
    );
  }
}
