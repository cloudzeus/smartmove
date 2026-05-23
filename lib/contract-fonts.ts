import { promises as fs } from "node:fs";
import path from "node:path";

import { decompress } from "wawoff2";

/**
 * Loads Inter font files from @fontsource/inter (greek subset, supports
 * ελληνικούς χαρακτήρες fully), decompresses WOFF2 → TTF using wawoff2 once,
 * and caches the TTF buffers in memory for the lifetime of the Node process.
 *
 * PDFKit only accepts TTF/OTF; we use these buffers via `doc.registerFont`.
 */
interface InterFonts {
  regular: Buffer;
  semibold: Buffer;
  bold: Buffer;
}

let cache: InterFonts | null = null;
let inflight: Promise<InterFonts> | null = null;

async function decode(filename: string): Promise<Buffer> {
  const filePath = path.join(
    process.cwd(),
    "node_modules/@fontsource/inter/files",
    filename,
  );
  const woff2 = await fs.readFile(filePath);
  const ttf = await decompress(new Uint8Array(woff2));
  return Buffer.from(ttf);
}

export async function loadInterFonts(): Promise<InterFonts> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    const [regular, semibold, bold] = await Promise.all([
      decode("inter-greek-400-normal.woff2"),
      decode("inter-greek-600-normal.woff2"),
      decode("inter-greek-700-normal.woff2"),
    ]);
    cache = { regular, semibold, bold };
    return cache;
  })();
  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}
