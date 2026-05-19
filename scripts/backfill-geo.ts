/**
 * Backfill lat/lng for any MoveRequest / MoveRequestStop / SavedLocation /
 * Branch / Tenant rows that have an address but no coordinates.
 *
 * Usage: npx tsx scripts/backfill-geo.ts
 */
import "dotenv/config";
import { db } from "../lib/db";
import { geocode } from "../lib/geocoding";

const SLEEP_MS = 1100; // geocode.maps.co free tier: ~1 req/sec
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function geocodeAddress(q: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const r = await geocode(q);
    await sleep(SLEEP_MS);
    if (!r) {
      console.warn(`  ✗ no result: ${q}`);
      return null;
    }
    console.log(`  ✓ ${q} → ${r.lat.toFixed(5)}, ${r.lng.toFixed(5)}`);
    return { lat: r.lat, lng: r.lng };
  } catch (e) {
    console.error(`  ✗ error for "${q}":`, e);
    await sleep(SLEEP_MS);
    return null;
  }
}

async function backfillTenant() {
  const rows = await db.tenant.findMany({
    where: { OR: [{ lat: null }, { lng: null }], address: { not: null } },
    select: { id: true, address: true, addressNo: true, postalZip: true, postalArea: true, country: true },
  });
  console.log(`\n[Tenant] ${rows.length} rows to backfill`);
  for (const t of rows) {
    const q = [t.address, t.addressNo, t.postalZip, t.postalArea, t.country].filter(Boolean).join(", ");
    const g = await geocodeAddress(q);
    if (g) await db.tenant.update({ where: { id: t.id }, data: g });
  }
}

async function backfillBranch() {
  const rows = await db.branch.findMany({
    where: { OR: [{ lat: null }, { lng: null }], address: { not: null } },
    select: { id: true, address: true, addressNo: true, postalZip: true, postalArea: true, country: true },
  });
  console.log(`\n[Branch] ${rows.length} rows to backfill`);
  for (const b of rows) {
    const q = [b.address, b.addressNo, b.postalZip, b.postalArea, b.country].filter(Boolean).join(", ");
    const g = await geocodeAddress(q);
    if (g) await db.branch.update({ where: { id: b.id }, data: g });
  }
}

async function backfillSavedLocation() {
  const rows = await db.savedLocation.findMany({
    where: { OR: [{ lat: null }, { lng: null }] },
    select: { id: true, address: true, postal: true, city: true, country: true },
  });
  console.log(`\n[SavedLocation] ${rows.length} rows to backfill`);
  for (const s of rows) {
    const q = [s.address, s.postal, s.city, s.country].filter(Boolean).join(", ");
    const g = await geocodeAddress(q);
    if (g) await db.savedLocation.update({ where: { id: s.id }, data: g });
  }
}

async function backfillMoveRequest() {
  const rows = await db.moveRequest.findMany({
    where: {
      OR: [{ fromLat: null }, { fromLng: null }, { toLat: null }, { toLng: null }],
    },
    select: { id: true, fromAddress: true, toAddress: true, fromLat: true, fromLng: true, toLat: true, toLng: true },
  });
  console.log(`\n[MoveRequest] ${rows.length} rows to backfill`);
  for (const r of rows) {
    const patch: Record<string, number> = {};
    if (r.fromLat == null || r.fromLng == null) {
      const g = await geocodeAddress(r.fromAddress);
      if (g) {
        patch.fromLat = g.lat;
        patch.fromLng = g.lng;
      }
    }
    if (r.toLat == null || r.toLng == null) {
      const g = await geocodeAddress(r.toAddress);
      if (g) {
        patch.toLat = g.lat;
        patch.toLng = g.lng;
      }
    }
    if (Object.keys(patch).length > 0) {
      await db.moveRequest.update({ where: { id: r.id }, data: patch });
    }
  }
}

async function backfillMoveRequestStop() {
  const rows = await db.moveRequestStop.findMany({
    where: { OR: [{ lat: null }, { lng: null }] },
    select: { id: true, address: true },
  });
  console.log(`\n[MoveRequestStop] ${rows.length} rows to backfill`);
  for (const s of rows) {
    const g = await geocodeAddress(s.address);
    if (g) await db.moveRequestStop.update({ where: { id: s.id }, data: g });
  }
}

async function main() {
  console.log("=== Geocoding backfill ===");
  await backfillTenant();
  await backfillBranch();
  await backfillSavedLocation();
  await backfillMoveRequest();
  await backfillMoveRequestStop();
  console.log("\n✓ Done.");
  await db.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
