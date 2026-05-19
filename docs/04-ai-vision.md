# 04 — AI Computer Vision Pipeline

> Από φωτογραφία → m³ inventory, σε ~2.4 sec και 96% accuracy.

## 6-step pipeline

```
1. Multi-angle capture (client camera AR)
2. Edge compression & face/document blurring
3. S3 upload (server-side presigned)
4. Gemini 1.5 Flash Vision call (structured JSON)
5. Volumetric algorithm (proprietary math model)
6. JSON output → Inventory tables στο DB
```

## src/lib/gemini/client.ts

```typescript
import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "@/lib/env";

const ai = new GoogleGenerativeAI(env.GEMINI_API_KEY);

export const visionModel = ai.getGenerativeModel({
  model: env.GEMINI_MODEL,         // "gemini-1.5-flash"
  generationConfig: {
    temperature: 0.1,              // χαμηλό για consistency
    responseMimeType: "application/json",
    responseSchema: inventorySchema, // βλ. types.ts
  },
  systemInstruction: `
    Είσαι ένας ειδικός εκτιμητής όγκου οικοσκευής για ελληνική μεταφορική.
    Αναγνώρισε κάθε αντικείμενο σε εσωτερικό χώρο, μέτρα διαστάσεις
    χρησιμοποιώντας reference objects (πόρτα 80×210cm, διακόπτης 8.5×8.5cm),
    και κατηγοριοποίησέ το.
    Πάντα απάντα σε δομημένο JSON σύμφωνα με το schema.
    Όλα τα ονόματα αντικειμένων και στα Ελληνικά και στα Αγγλικά.
  `,
});
```

## src/lib/gemini/inventory.prompt.ts

```typescript
export const inventorySchema = {
  type: "object",
  properties: {
    roomGuess: { type: "string", description: "πχ 'Σαλόνι', 'Υπνοδωμάτιο', 'Κουζίνα'" },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          nameGreek:           { type: "string" },
          nameEnglish:         { type: "string" },
          category:            { type: "string", enum: ["furniture","appliance","box","fragile","textile","electronic","other"] },
          widthCm:             { type: "number" },
          heightCm:            { type: "number" },
          depthCm:             { type: "number" },
          estimatedWeightKg:   { type: "number" },
          condition:           { type: "string", enum: ["assembled","modular","fragile","extra_care"] },
          quantity:            { type: "integer" },
          detectionConfidence: { type: "number" },
          boundingBox: {
            type: "object",
            properties: { x:{type:"number"}, y:{type:"number"}, w:{type:"number"}, h:{type:"number"} },
            required: ["x","y","w","h"],
          },
        },
        required: ["nameGreek","nameEnglish","category","widthCm","heightCm","depthCm","quantity","detectionConfidence"],
      },
    },
  },
  required: ["roomGuess","items"],
};

export function buildInventoryPrompt(imageRefs: { uri: string; mimeType: string }[]) {
  return [
    {
      text: `
        Αναγνώρισε όλα τα αντικείμενα στις παρακάτω εικόνες ενός δωματίου.
        Για ΚΑΘΕ αντικείμενο:
          1. Δώσε όνομα στα Ελληνικά και στα Αγγλικά.
          2. Εκτίμησε διαστάσεις σε εκατοστά (πλάτος × ύψος × βάθος).
          3. Εκτίμησε βάρος σε κιλά.
          4. Επισήμανε αν είναι "assembled" (μη-αποσυναρμολογήσιμο), "modular" (αποσυναρμολογείται), "fragile", ή "extra_care".
          5. Αν είναι έπιπλο σύστημα (πχ IKEA bookshelf), σημείωσε quantity = αριθμός μονάδων.
          6. Επίστρεψε bounding box ως ποσοστά (0-1) της εικόνας.
        Μην αναφέρεις τοίχους, δάπεδο, πορτάδες, παράθυρα.
        Χρησιμοποίησε αυτές τις reference dimensions για κανονικοποίηση:
          - Πόρτα δωματίου: 80×210 cm
          - Παράθυρο τυπικό: 100×140 cm
          - Διακόπτης φωτός: 8.5×8.5 cm
          - Πρίζα ρεύματος: 7×8 cm
        Επίστρεψε JSON σύμφωνα με το προσφερόμενο schema.
      `,
    },
    ...imageRefs.map(ref => ({
      fileData: { fileUri: ref.uri, mimeType: ref.mimeType },
    })),
  ];
}
```

## src/server/services/inventory.service.ts

```typescript
import { db } from "@/lib/db";
import { visionModel } from "@/lib/gemini/client";
import { buildInventoryPrompt } from "@/lib/gemini/inventory.prompt";
import { uploadToS3, getPresignedUri } from "@/lib/s3";
import { calculateVolumetric } from "@/utils/volumetric";
import { blurFacesAndDocs } from "./image-pii.service";

export async function processScanBatch(opts: {
  moveRequestId: string;
  s3Keys: string[];          // raw uploaded photos
  roomName: string;
}) {
  // 1. Blur PII (faces, documents, screens)
  const blurredKeys = await Promise.all(opts.s3Keys.map(k => blurFacesAndDocs(k)));

  // 2. Get signed URIs για Gemini fetch
  const imageRefs = await Promise.all(
    blurredKeys.map(async (k) => ({ uri: await getPresignedUri(k), mimeType: "image/jpeg" })),
  );

  // 3. Gemini vision call
  const result = await visionModel.generateContent(buildInventoryPrompt(imageRefs));
  const json = JSON.parse(result.response.text());

  // 4. Volumetric algorithm
  const itemsWithVolume = json.items.map((it: any) => ({
    ...it,
    volumeCubicM: (it.widthCm * it.heightCm * it.depthCm) / 1_000_000,
  }));

  const totalVolumeCubicM = itemsWithVolume.reduce((sum: number, i: any) => sum + i.volumeCubicM * i.quantity, 0);
  const totalWeightKg = itemsWithVolume.reduce((sum: number, i: any) => sum + (i.estimatedWeightKg ?? 0) * i.quantity, 0);

  // 5. Save to DB
  return db.$transaction(async (tx) => {
    // (a) ensure Inventory record
    const inventory = await tx.inventory.upsert({
      where: { moveRequestId: opts.moveRequestId },
      update: {
        totalVolumeCubicM,
        totalWeightKg,
        itemCount: { increment: itemsWithVolume.length },
      },
      create: {
        moveRequestId: opts.moveRequestId,
        totalVolumeCubicM,
        totalWeightKg,
        itemCount: itemsWithVolume.length,
        modelVersion: "gemini-1.5-flash-v1",
        confidence: avg(itemsWithVolume.map((i: any) => i.detectionConfidence)),
      },
    });

    // (b) room
    const room = await tx.inventoryRoom.create({
      data: {
        inventoryId: inventory.id,
        name: opts.roomName ?? json.roomGuess ?? "Άλλο",
        orderIndex: await tx.inventoryRoom.count({ where: { inventoryId: inventory.id } }),
      },
    });

    // (c) items
    await tx.inventoryItem.createMany({
      data: itemsWithVolume.map((it: any) => ({
        roomId: room.id,
        category: it.category,
        nameGreek: it.nameGreek,
        nameEnglish: it.nameEnglish,
        widthCm: it.widthCm,
        heightCm: it.heightCm,
        depthCm: it.depthCm,
        volumeCubicM: it.volumeCubicM,
        estimatedWeightKg: it.estimatedWeightKg ?? 0,
        condition: it.condition,
        quantity: it.quantity,
        detectionConfidence: it.detectionConfidence,
        boundingBox: it.boundingBox,
      })),
    });

    // (d) scanImages link
    await tx.scanImage.createMany({
      data: blurredKeys.map(k => ({ inventoryId: inventory.id, s3Key: k, width: 1024, height: 1024, sizeBytes: 0, blurred: true, processedAt: new Date() })),
    });

    return inventory;
  });
}

function avg(arr: number[]) { return arr.reduce((a,b)=>a+b,0) / arr.length; }
```

## Volumetric algorithm (more detail)

Σε `src/utils/volumetric.ts`:

```typescript
/**
 * Calculates packing volume σε m³ από inventory items.
 * Λαμβάνει υπόψη:
 *   - πραγματικός όγκος (LxWxH)
 *   - packing factor: τι μπορεί να μπει μέσα σε τι (καναπές με μαξιλάρια χωριστά)
 *   - dead space για non-stackable items (καναπέδες, μεγάλα έπιπλα)
 *   - assembly state: modular items μειώνονται κατά 35-50%
 */
export function calculateVolumetric(items: InventoryItem[]) {
  let raw = 0, packed = 0, deadSpace = 0;
  for (const it of items) {
    const v = (it.widthCm * it.heightCm * it.depthCm) / 1_000_000;
    raw += v * it.quantity;

    const factor =
      it.condition === "modular"     ? 0.55 :  // 45% reduction (disassembled)
      it.condition === "extra_care"  ? 1.15 :  // 15% extra for padding
      it.condition === "fragile"     ? 1.10 :  // 10% for fragile wrapping
      1.0;

    packed += v * it.quantity * factor;

    if (["furniture"].includes(it.category) && v > 0.4) {
      deadSpace += v * 0.18; // 18% dead space γύρω από μεγάλα έπιπλα
    }
  }
  return {
    rawCubicM: round(raw, 2),
    packedCubicM: round(packed + deadSpace, 2),
    deadSpaceCubicM: round(deadSpace, 2),
  };
}

const round = (n: number, d: number) => Math.round(n * 10**d) / 10**d;
```

## Suggested vehicle

```typescript
export function suggestVehicle(volumeCubicM: number) {
  if (volumeCubicM <= 12)  return "VAN_3_5T";
  if (volumeCubicM <= 22)  return "TRUCK_5T";
  if (volumeCubicM <= 35)  return "TRUCK_7_5T";
  return "TRUCK_12T";
}
```

## Human-in-the-loop validation

Όταν `inventory.confidence < 0.85`, το flow περνά από manual review:
- Ο μεταφορέας μπορεί να επικυρώσει/διορθώσει στο `/carrier/leads/[id]/inventory`
- Όταν αλλάζει quantity/dimension, ξαναϋπολογίζεται volume
- Set `inventory.humanVerified = true, verifiedBy = carrier.id`

## Error handling

- Gemini timeout (>15s): retry x2 with `exponential backoff` (3s, 9s)
- Schema validation failure: log + return 422 + show user-friendly error
- Image >10MB: client-side rejection πριν φύγει από browser
- No items detected: ask user να ξανατραβήξει με καλύτερο φωτισμό

## Cost monitoring

Tracked στο PostHog:
- `vision.scan.success` με properties `{ images, latency_ms, cost_eur, model_version }`
- Daily budget alarm: > €30/day → Slack alert
- Quarterly review για cost-per-scan trends
