import type { ScanImage } from "./image-thumbnail";

interface PreparedImage {
  img: HTMLImageElement;
  rotation: number;
  /** Scaled source width (image's natural width × scale factor). */
  sourceW: number;
  /** Scaled source height (image's natural height × scale factor). */
  sourceH: number;
  /** Width of the cell in the output canvas (rotated bounding box × scale). */
  cellW: number;
  /** Always equal to targetHeight. */
  cellH: number;
}

/**
 * Stitch up to 4 photos into a single horizontal panorama, applying each image's
 * rotation. Output is normalized to a single row with constant height.
 *
 * Returns both the stitched data URL (for client preview / zoom viewer) and a
 * File ready to upload to the Gemini-backed analyzeImage Server Action.
 */
export async function stitchImages(
  images: ScanImage[],
  opts: { targetHeight?: number; quality?: number; maxWidth?: number } = {},
): Promise<{ dataUrl: string; file: File; width: number; height: number }> {
  if (images.length === 0) throw new Error("Δεν υπάρχουν εικόνες προς ένωση");

  const targetHeight = opts.targetHeight ?? 1024;
  const quality = opts.quality ?? 0.88;
  const maxWidth = opts.maxWidth ?? 4096;

  const prepared = await Promise.all(
    images.map((i) => prepare(i, targetHeight)),
  );

  let totalWidth = prepared.reduce((s, p) => s + p.cellW, 0);
  let height = targetHeight;

  // If we exceed maxWidth, scale everything down uniformly
  if (totalWidth > maxWidth) {
    const k = maxWidth / totalWidth;
    for (const p of prepared) {
      p.sourceW *= k;
      p.sourceH *= k;
      p.cellW *= k;
      p.cellH *= k;
    }
    totalWidth = maxWidth;
    height = Math.round(prepared[0].cellH);
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(totalWidth);
  canvas.height = Math.round(height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context μη διαθέσιμο");

  // Fill background (avoid transparent edges from rotation)
  ctx.fillStyle = "#0F172A";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let x = 0;
  for (const p of prepared) {
    ctx.save();
    // Translate to cell center
    ctx.translate(x + p.cellW / 2, height / 2);
    ctx.rotate((p.rotation * Math.PI) / 180);
    // Draw the scaled source centered at origin
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(p.img, -p.sourceW / 2, -p.sourceH / 2, p.sourceW, p.sourceH);
    ctx.restore();
    x += p.cellW;
  }

  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Αποτυχία toBlob"))),
      "image/jpeg",
      quality,
    );
  });

  const file = new File([blob], `stitched-${Date.now()}.jpg`, {
    type: "image/jpeg",
  });

  return { dataUrl, file, width: canvas.width, height: canvas.height };
}

async function prepare(
  scanImg: ScanImage,
  targetHeight: number,
): Promise<PreparedImage> {
  const img = new Image();
  img.src = scanImg.dataUrl;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Αποτυχία φόρτωσης εικόνας"));
  });

  const r = scanImg.rotation;
  const nW = img.naturalWidth;
  const nH = img.naturalHeight;

  // Rotated bounding box (visible shape after rotation)
  const rW = r % 180 === 0 ? nW : nH;
  const rH = r % 180 === 0 ? nH : nW;

  // Scale factor: make rotated height = targetHeight
  const scale = targetHeight / rH;

  return {
    img,
    rotation: r,
    sourceW: nW * scale,
    sourceH: nH * scale,
    cellW: rW * scale,
    cellH: rH * scale,
  };
}
