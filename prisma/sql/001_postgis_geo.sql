-- =====================================================================
-- SmartMove — PostGIS bootstrap + geography columns + GIST indexes
--
-- Run AFTER `npx prisma db push` so the scalar lat/lng columns exist.
-- Apply via:
--   npx prisma db execute --file prisma/sql/001_postgis_geo.sql
-- Or:
--   psql "$DATABASE_URL" -f prisma/sql/001_postgis_geo.sql
--
-- Strategy:
--   * Prisma owns lat/lng (Float?) as the source of truth.
--   * Each geo table gets a `geom` (or pickup/dropoff for MoveRequest)
--     as a STORED generated column from lat/lng. This means INSERTs and
--     UPDATEs only touch lat/lng and the spatial column stays in sync —
--     no triggers, no double-writes.
--   * GIST indexes on every spatial column for ST_DWithin acceleration.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS postgis;

-- ---------------------------------------------------------------------
-- Tenant HQ
-- ---------------------------------------------------------------------
ALTER TABLE "Tenant"
  ADD COLUMN IF NOT EXISTS geom geography(Point, 4326)
  GENERATED ALWAYS AS (
    CASE
      WHEN "lat" IS NOT NULL AND "lng" IS NOT NULL
      THEN ST_SetSRID(ST_MakePoint("lng", "lat"), 4326)::geography
      ELSE NULL
    END
  ) STORED;

CREATE INDEX IF NOT EXISTS "Tenant_geom_gist" ON "Tenant" USING GIST (geom);

-- ---------------------------------------------------------------------
-- Branch (POP) — main service-radius anchor
-- ---------------------------------------------------------------------
ALTER TABLE "Branch"
  ADD COLUMN IF NOT EXISTS geom geography(Point, 4326)
  GENERATED ALWAYS AS (
    CASE
      WHEN "lat" IS NOT NULL AND "lng" IS NOT NULL
      THEN ST_SetSRID(ST_MakePoint("lng", "lat"), 4326)::geography
      ELSE NULL
    END
  ) STORED;

CREATE INDEX IF NOT EXISTS "Branch_geom_gist" ON "Branch" USING GIST (geom);

-- ---------------------------------------------------------------------
-- MoveRequest — both pickup and dropoff points
-- ---------------------------------------------------------------------
ALTER TABLE "MoveRequest"
  ADD COLUMN IF NOT EXISTS "pickupGeom" geography(Point, 4326)
  GENERATED ALWAYS AS (
    CASE
      WHEN "fromLat" IS NOT NULL AND "fromLng" IS NOT NULL
      THEN ST_SetSRID(ST_MakePoint("fromLng", "fromLat"), 4326)::geography
      ELSE NULL
    END
  ) STORED,
  ADD COLUMN IF NOT EXISTS "dropoffGeom" geography(Point, 4326)
  GENERATED ALWAYS AS (
    CASE
      WHEN "toLat" IS NOT NULL AND "toLng" IS NOT NULL
      THEN ST_SetSRID(ST_MakePoint("toLng", "toLat"), 4326)::geography
      ELSE NULL
    END
  ) STORED;

CREATE INDEX IF NOT EXISTS "MoveRequest_pickupGeom_gist"
  ON "MoveRequest" USING GIST ("pickupGeom");
CREATE INDEX IF NOT EXISTS "MoveRequest_dropoffGeom_gist"
  ON "MoveRequest" USING GIST ("dropoffGeom");

-- ---------------------------------------------------------------------
-- MoveRequestStop — per-stop coordinates
-- ---------------------------------------------------------------------
ALTER TABLE "MoveRequestStop"
  ADD COLUMN IF NOT EXISTS geom geography(Point, 4326)
  GENERATED ALWAYS AS (
    CASE
      WHEN "lat" IS NOT NULL AND "lng" IS NOT NULL
      THEN ST_SetSRID(ST_MakePoint("lng", "lat"), 4326)::geography
      ELSE NULL
    END
  ) STORED;

CREATE INDEX IF NOT EXISTS "MoveRequestStop_geom_gist"
  ON "MoveRequestStop" USING GIST (geom);

-- ---------------------------------------------------------------------
-- SavedLocation — customer favourites
-- ---------------------------------------------------------------------
ALTER TABLE "SavedLocation"
  ADD COLUMN IF NOT EXISTS geom geography(Point, 4326)
  GENERATED ALWAYS AS (
    CASE
      WHEN "lat" IS NOT NULL AND "lng" IS NOT NULL
      THEN ST_SetSRID(ST_MakePoint("lng", "lat"), 4326)::geography
      ELSE NULL
    END
  ) STORED;

CREATE INDEX IF NOT EXISTS "SavedLocation_geom_gist"
  ON "SavedLocation" USING GIST (geom);
