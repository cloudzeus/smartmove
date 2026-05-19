# 02 — Database (PostgreSQL 16 + PostGIS · Prisma 6)

## Ενοποιημένη βάση

Όλα ζουν σε **ένα PostgreSQL cluster** (Aiven managed) με ενεργό το `postgis` extension. Δεν χρησιμοποιούμε δεύτερη βάση — τα spatial models (`SharedLoad`, `PostalArea`, `HighwayBuffer`) ζουν στο ίδιο schema με τα domain models.

## Aiven setup checklist

1. **Aiven console** → δημιουργία PostgreSQL service (όχι Kafka).
2. **PostgreSQL → Extensions** → ενεργοποίησε `postgis` και `postgis_topology`.
3. **Service overview → Connection information** → αντίγραψε:
   - Host (`*.aivencloud.com`)
   - Port (συνήθως 5-digit, πχ 28125)
   - User (`avnadmin` για admin)
   - Password (αν διέρρευσε, κάνε rotate **τώρα**)
   - Database (default: `defaultdb`)
4. Σύνθεσε: `postgres://USER:PASSWORD@HOST:PORT/defaultdb?sslmode=require`
5. Βάλε το σε `.env.local` ως `DATABASE_URL`.
6. **Δημιουργία dev role με μειωμένα δικαιώματα** (συνιστάται — μην χρησιμοποιείς το `avnadmin` σε εφαρμογή).

```sql
-- Connect ως avnadmin
CREATE ROLE smartmove_app WITH LOGIN PASSWORD 'εδώ νέο strong password';
GRANT CONNECT ON DATABASE defaultdb TO smartmove_app;
GRANT USAGE ON SCHEMA public TO smartmove_app;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO smartmove_app;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO smartmove_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO smartmove_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO smartmove_app;
```

## src/lib/db.ts

```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
```

Όλη η εφαρμογή χρησιμοποιεί `import { db } from "@/lib/db"`. Δεν υπάρχει δεύτερος Prisma client.

## Πρώτο migration (PostGIS enable)

```bash
# 1. Συμπλήρωσε DATABASE_URL στο .env.local
# 2. Generate Prisma client
pnpm prisma generate

# 3. Δημιουργία και εφαρμογή migration
pnpm prisma migrate dev --name init

# 4. Αν το postgis δεν έχει ενεργοποιηθεί από το Aiven dashboard,
#    πρόσθεσε ένα manual SQL step:
pnpm prisma db execute --stdin <<EOF
CREATE EXTENSION IF NOT EXISTS postgis;
EOF
```

Από Prisma 6 με `previewFeatures = ["postgresqlExtensions"]`, μπορείς να το ορίσεις δηλωτικά στο schema (`extensions = [postgis]`) και η `migrate dev` το διαχειρίζεται αυτόματα.

## Spatial indexes (manual)

Prisma 6 δεν υποστηρίζει GIST indexes στα μοντέλα. Πρέπει να τα προσθέσεις χειροκίνητα σε ένα migration:

```bash
# Δημιούργησε empty migration
pnpm prisma migrate dev --create-only --name add_spatial_indexes
```

Edit `prisma/migrations/<timestamp>_add_spatial_indexes/migration.sql`:

```sql
CREATE INDEX IF NOT EXISTS idx_shared_load_route_geom
  ON "SharedLoad"
  USING GIST ("routeGeom");

CREATE INDEX IF NOT EXISTS idx_postal_geom
  ON "PostalArea"
  USING GIST (geom);

CREATE INDEX IF NOT EXISTS idx_highway_geom
  ON "HighwayBuffer"
  USING GIST (geom);
```

Μετά:

```bash
pnpm prisma migrate dev
```

## Spatial queries (raw SQL)

Prisma δεν έχει native PostGIS function support. Χρησιμοποιούμε `$queryRaw` με parameterized queries:

```typescript
// src/server/services/shared-load.service.ts
import { db } from "@/lib/db";

export async function findMatchCandidates(opts: {
  routeStartLat: number; routeStartLng: number;
  routeEndLat:   number; routeEndLng:   number;
  scheduledAt:   Date;
  flexHours:     number;
  bufferKm:      number;
}) {
  const rows = await db.$queryRaw<Array<{
    id: string;
    overlap_m: number;
    distance_m: number;
  }>>`
    WITH new_route AS (
      SELECT ST_MakeLine(
        ST_SetSRID(ST_MakePoint(${opts.routeStartLng}, ${opts.routeStartLat}), 4326)::geography,
        ST_SetSRID(ST_MakePoint(${opts.routeEndLng},   ${opts.routeEndLat}),   4326)::geography
      )::geography AS line
    )
    SELECT
      s.id,
      ST_Length(
        ST_Intersection(
          s."routeGeom"::geometry,
          ST_Buffer(nr.line::geography, ${opts.bufferKm * 1000})::geometry
        )::geography
      ) AS overlap_m,
      ST_Distance(s."routeGeom", nr.line) AS distance_m
    FROM "SharedLoad" s, new_route nr
    WHERE s.status = 'OPEN'
      AND s."scheduledAt" BETWEEN
            ${opts.scheduledAt}::timestamp - INTERVAL '${opts.flexHours} hours'
        AND ${opts.scheduledAt}::timestamp + INTERVAL '${opts.flexHours} hours'
      AND ST_DWithin(s."routeGeom", nr.line, ${opts.bufferKm * 1000})
    ORDER BY overlap_m DESC
    LIMIT 50
  `;

  return rows;
}
```

## Storing geometries (insert)

Όταν δημιουργείς `SharedLoad` με γεωμετρία, χρειάζεσαι raw SQL γιατί το Unsupported type δεν δουλεύει με `.create()`:

```typescript
// src/server/services/shared-load.service.ts
import { db } from "@/lib/db";

export async function publishSharedLoad(opts: {
  carrierId: string;
  startLat: number; startLng: number;
  endLat:   number; endLng:   number;
  scheduledAt: Date;
  capacityFreeCubicM: number;
  routeGeoJson: any;  // από Google Maps Routing API
}) {
  // 1. Δημιουργία row μέσω Prisma (χωρίς geom)
  const sl = await db.sharedLoad.create({
    data: {
      carrierId:          opts.carrierId,
      startLat:           opts.startLat,
      startLng:           opts.startLng,
      endLat:             opts.endLat,
      endLng:             opts.endLng,
      scheduledAt:        opts.scheduledAt,
      capacityFreeCubicM: opts.capacityFreeCubicM,
    },
  });

  // 2. UPDATE το geom μέσω raw SQL
  await db.$executeRaw`
    UPDATE "SharedLoad"
    SET "routeGeom" = ST_GeomFromGeoJSON(${JSON.stringify(opts.routeGeoJson)})::geography
    WHERE id = ${sl.id}
  `;

  return sl;
}
```

## Migration playbook

```bash
# Δημιουργία migration
pnpm prisma migrate dev --name add_carrier_kyc_docs

# Production: εφαρμόζεται από CI/CD πριν το deploy
pnpm prisma migrate deploy

# Reset σε dev (ΠΡΟΣΟΧΗ — drops & re-seeds)
pnpm prisma migrate reset
```

## Common patterns

### Transaction

```typescript
await db.$transaction(async (tx) => {
  const move = await tx.moveRequest.update({ where: { id }, data: { status: "BOOKED" } });
  const booking = await tx.booking.create({ data: { ... } });
  await tx.auction.update({ where: { id: auctionId }, data: { status: "AWARDED", winningBidId: bidId } });
  return booking;
});
```

### Soft delete helper

```typescript
// src/utils/db.ts
export const softDelete = <T>(query: T) =>
  ({ ...query, where: { ...query.where, deletedAt: null } }) as T;
```

### Money formatting

```typescript
// src/utils/format.ts
export const formatEUR = (cents: number) =>
  new Intl.NumberFormat("el-GR", { style: "currency", currency: "EUR" }).format(cents / 100);
```

### Cursor pagination

```typescript
const PAGE_SIZE = 20;
const items = await db.booking.findMany({
  take: PAGE_SIZE + 1,
  ...(cursor && { skip: 1, cursor: { id: cursor } }),
  orderBy: { createdAt: "desc" },
});
const hasNextPage = items.length > PAGE_SIZE;
const data = hasNextPage ? items.slice(0, -1) : items;
const nextCursor = hasNextPage ? items[PAGE_SIZE - 1].id : null;
```

## Performance budgets

| Operation | Target |
|---|---|
| Auth check (middleware) | < 5ms |
| Landing page DB queries | < 30ms |
| Consumer dashboard | < 80ms (parallel) |
| Carrier lead inbox | < 120ms |
| PostGIS Shared-Load matching (50 candidates / 100k rows) | < 250ms |

Όταν query βγαίνει εκτός budget → cache στο Redis ή materialized view.
