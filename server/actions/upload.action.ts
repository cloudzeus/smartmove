"use server";

import { randomUUID } from "node:crypto";

import sharp from "sharp";

import { auth } from "@/lib/auth";
import { flags } from "@/lib/env";
import { deleteObject, publicUrl, putObject, urlToKey } from "@/lib/bunny-storage";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB raw input — we re-encode to WebP
const MAX_DIMENSION = 1920;
const WEBP_QUALITY = 85;

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
  "image/svg+xml",
]);

export type UploadResult =
  | { ok: true; url: string; key: string }
  | { ok: false; error: string };

export type UploadPurpose =
  | "tenant-logo"
  | "vehicle-photo"
  | "vehicle-doc"
  | "saved-item"
  | "scan-item"
  | "scan-stitched"
  | "user-avatar";

const PREFIX_BY_PURPOSE: Record<UploadPurpose, string> = {
  "tenant-logo": "tenants/logos",
  "vehicle-photo": "vehicles/photos",
  "vehicle-doc": "vehicles/docs",
  "saved-item": "items/saved",
  "scan-item": "items/scan",
  "scan-stitched": "scans/stitched",
  "user-avatar": "users/avatars",
};

interface ProcessedImage {
  buffer: Buffer;
  contentType: string;
  ext: "webp" | "svg";
}

/**
 * Re-encode raster images to WebP at max 1920×1920 (preserving aspect ratio),
 * honoring EXIF orientation. SVG passes through unmodified to keep vectors.
 */
async function processForStorage(file: File): Promise<ProcessedImage> {
  if (file.type === "image/svg+xml") {
    return {
      buffer: Buffer.from(await file.arrayBuffer()),
      contentType: "image/svg+xml",
      ext: "svg",
    };
  }
  const input = Buffer.from(await file.arrayBuffer());
  const webp = await sharp(input, { failOn: "none" })
    .rotate() // honor EXIF orientation, then strip metadata by default
    .resize({
      width: MAX_DIMENSION,
      height: MAX_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: WEBP_QUALITY, effort: 4 })
    .toBuffer();
  return { buffer: webp, contentType: "image/webp", ext: "webp" };
}

/**
 * Upload an image to BunnyCDN Storage and return the public CDN URL.
 *
 * The client sends FormData with:
 *   file:        File
 *   purpose:     UploadPurpose
 *   replaceUrl?: string  (optional — delete the previous object from storage)
 *
 * Server-side processing pipeline:
 *   raster  → sharp.rotate() → resize fit:"inside" to 1920×1920 → webp q85
 *   svg     → passes through unchanged (keep the vector)
 */
export async function uploadImage(formData: FormData): Promise<UploadResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Πρέπει να συνδεθείς πρώτα." };
  }
  if (!flags.hasBunnyStorage()) {
    return {
      ok: false,
      error: "Η αποθήκευση δεν είναι ρυθμισμένη (BunnyCDN).",
    };
  }

  const file = formData.get("file") as File | null;
  const purposeRaw = String(formData.get("purpose") ?? "");
  const replaceUrl = String(formData.get("replaceUrl") ?? "");

  if (!file) return { ok: false, error: "Δεν δόθηκε αρχείο." };
  if (file.size === 0) return { ok: false, error: "Άδειο αρχείο." };
  if (file.size > MAX_BYTES) {
    return { ok: false, error: `Μέγιστο μέγεθος ${MAX_BYTES / 1024 / 1024}MB.` };
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return {
      ok: false,
      error: "Επιτρέπονται μόνο εικόνες (JPG, PNG, WebP, AVIF, GIF, SVG).",
    };
  }
  const prefix = PREFIX_BY_PURPOSE[purposeRaw as UploadPurpose];
  if (!prefix) {
    return { ok: false, error: "Άκυρος σκοπός." };
  }

  let processed: ProcessedImage;
  try {
    processed = await processForStorage(file);
  } catch (e) {
    console.error("[upload] image processing failed:", e);
    return { ok: false, error: "Επεξεργασία εικόνας απέτυχε." };
  }

  const id = randomUUID();
  // Group avatars / items by user id so cleanup queries can scope by user
  const key =
    purposeRaw === "user-avatar" || purposeRaw === "saved-item"
      ? `${prefix}/${session.user.id}/${id}.${processed.ext}`
      : `${prefix}/${id}.${processed.ext}`;

  try {
    await putObject({
      key,
      body: processed.buffer,
      contentType: processed.contentType,
    });
  } catch (e) {
    console.error("[upload] putObject failed:", e);
    return { ok: false, error: "Αποτυχία upload στο BunnyCDN." };
  }

  // Best-effort delete of the replaced object
  if (replaceUrl) {
    const oldKey = urlToKey(replaceUrl);
    if (oldKey) {
      void deleteObject(oldKey);
    }
  }

  return { ok: true, url: publicUrl(key), key };
}

/**
 * Delete an image by its public URL (used when the user removes a logo etc).
 */
export async function deleteImageByUrl(url: string): Promise<UploadResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Δεν είσαι συνδεδεμένος." };
  }
  const key = urlToKey(url);
  if (!key) return { ok: false, error: "Μη έγκυρο URL." };
  try {
    await deleteObject(key);
    return { ok: true, url, key };
  } catch (e) {
    console.error("[deleteImageByUrl] failed:", e);
    return { ok: false, error: "Αποτυχία διαγραφής." };
  }
}
