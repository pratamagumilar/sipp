CREATE TABLE "InstallationType" ("code" TEXT PRIMARY KEY, "name" TEXT NOT NULL);
ALTER TABLE "Job"
  ADD COLUMN "agenda" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "applicant" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "installationOwner" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "installationTypeCode" TEXT,
  ADD COLUMN "capacity" DECIMAL(24,6),
  ADD COLUMN "capacityUnit" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "location" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "offerValue" DECIMAL(18,2),
  ADD CONSTRAINT "Job_capacity_nonnegative" CHECK ("capacity" IS NULL OR "capacity" >= 0),
  ADD CONSTRAINT "Job_offer_nonnegative" CHECK ("offerValue" IS NULL OR "offerValue" >= 0),
  ADD CONSTRAINT "Job_installationTypeCode_fkey" FOREIGN KEY ("installationTypeCode") REFERENCES "InstallationType"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Job_installationTypeCode_idx" ON "Job"("installationTypeCode");
