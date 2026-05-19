import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
  type PutObjectCommandInput,
} from "@aws-sdk/client-s3";

import { env, flags } from "./env";

/**
 * BunnyCDN Storage S3-compatible client.
 *
 * Env (set in .env):
 *   BUNNY_S3_REGION_ENDPOINT   — e.g. https://storage.bunnycdn.com or
 *                                 https://<region>.storage.bunnycdn.com
 *   BUNNY_ACCESS_KEY           — S3 access key (= Storage Zone HMAC key)
 *   BUNNY_S3_REGION_SECRET_KEY — S3 secret key
 *   BUNNY_STORAGE_ZONE         — bucket / Storage Zone name
 *   BUNNY_CDN_HOSTNAME         — public CDN hostname e.g. smartmove.b-cdn.net
 *                                (with or without `https://`)
 *
 * Files are uploaded to `<bucket>/<key>` and served from
 * `https://<cdn-hostname>/<key>`.
 */

let _client: S3Client | null = null;

function getClient(): S3Client {
  if (_client) return _client;
  if (!flags.hasBunnyStorage()) {
    throw new Error(
      "BunnyCDN δεν έχει ρυθμιστεί. Συμπλήρωσε BUNNY_S3_REGION_ENDPOINT / BUNNY_ACCESS_KEY / BUNNY_S3_REGION_SECRET_KEY / BUNNY_STORAGE_ZONE στο .env.",
    );
  }
  _client = new S3Client({
    endpoint: env.bunnyS3Endpoint(),
    region: "auto", // BunnyCDN ignores AWS regions; supply any.
    credentials: {
      accessKeyId: env.bunnyS3AccessKey()!,
      secretAccessKey: env.bunnyS3SecretKey()!,
    },
    forcePathStyle: true, // required for BunnyCDN's S3 surface
  });
  return _client;
}

export interface UploadOptions {
  /** Object key within the bucket. Don't start with `/`. */
  key: string;
  /** Raw bytes. */
  body: Buffer | Uint8Array;
  /** MIME, e.g. "image/jpeg". */
  contentType: string;
  /** Cache-Control header (defaults to 1y immutable). */
  cacheControl?: string;
}

export async function putObject(opts: UploadOptions): Promise<void> {
  const client = getClient();
  const params: PutObjectCommandInput = {
    Bucket: env.bunnyStorageZone(),
    Key: opts.key.replace(/^\/+/, ""),
    Body: opts.body,
    ContentType: opts.contentType,
    CacheControl: opts.cacheControl ?? "public, max-age=31536000, immutable",
  };
  await client.send(new PutObjectCommand(params));
}

export async function deleteObject(key: string): Promise<void> {
  if (!flags.hasBunnyStorage()) return;
  const client = getClient();
  try {
    await client.send(
      new DeleteObjectCommand({
        Bucket: env.bunnyStorageZone(),
        Key: key.replace(/^\/+/, ""),
      }),
    );
  } catch (e) {
    console.warn("[bunny] delete failed:", e);
  }
}

/**
 * Public URL for a given storage key. Strips protocol from CDN hostname and
 * re-adds https:// so the env value can be `cdn.example.com` or
 * `https://cdn.example.com/` interchangeably.
 */
export function publicUrl(key: string): string {
  const host = env.bunnyCdnHostname();
  if (!host) {
    throw new Error("BUNNY_CDN_HOSTNAME λείπει — δεν μπορώ να φτιάξω public URL.");
  }
  const clean = host
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "")
    .trim();
  const cleanKey = key.replace(/^\/+/, "");
  return `https://${clean}/${cleanKey}`;
}

/**
 * Parse a public CDN URL back to its storage key. Used when we want to delete
 * an old object given the URL stored in the DB.
 */
export function urlToKey(url: string): string | null {
  const host = env.bunnyCdnHostname();
  if (!host) return null;
  const clean = host.replace(/^https?:\/\//, "").replace(/\/+$/, "").trim();
  try {
    const u = new URL(url);
    if (u.hostname !== clean) return null;
    return u.pathname.replace(/^\/+/, "");
  } catch {
    return null;
  }
}
