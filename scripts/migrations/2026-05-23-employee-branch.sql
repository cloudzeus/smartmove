BEGIN;
ALTER TABLE "CarrierEmployee"
  ADD COLUMN "branchId" TEXT;
ALTER TABLE "CarrierEmployee"
  ADD CONSTRAINT "CarrierEmployee_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL;
CREATE INDEX "CarrierEmployee_branchId_idx" ON "CarrierEmployee"("branchId");
COMMIT;
