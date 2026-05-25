-- Carrier partner service area
-- Run manually against the DB (αν δεν τρέχει prisma migrate επειδή ο
-- shadow DB δεν επιτρέπεται).
--
--   psql $DATABASE_URL -f scripts/migrations/2026-05-23-carrier-partner-service-area.sql

BEGIN;

CREATE TYPE "ServiceAreaMode" AS ENUM ('ANY', 'CITIES', 'RADIUS');

ALTER TABLE "CarrierPartner"
  ADD COLUMN "serviceMode"     "ServiceAreaMode" NOT NULL DEFAULT 'ANY',
  ADD COLUMN "serviceCities"   TEXT,
  ADD COLUMN "hqLat"           DOUBLE PRECISION,
  ADD COLUMN "hqLng"           DOUBLE PRECISION,
  ADD COLUMN "hqAddress"       TEXT,
  ADD COLUMN "serviceRadiusKm" INTEGER;

COMMIT;
