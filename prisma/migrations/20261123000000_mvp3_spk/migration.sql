ALTER TYPE "Role" ADD VALUE 'FINANCE';
CREATE TYPE "SpkTrigger" AS ENUM ('AFTER_RAB_APPROVED', 'MANUAL_FINANCE');
CREATE TYPE "SpkStatus" AS ENUM ('PENDING', 'ISSUED');
ALTER TABLE "Rab" ADD COLUMN "spkTrigger" "SpkTrigger";
UPDATE "Rab" SET "spkTrigger" = 'MANUAL_FINANCE' WHERE "status" = 'RAB_APPROVED';
CREATE TABLE "Setting" ("id" TEXT PRIMARY KEY, "spkTrigger" "SpkTrigger" NOT NULL DEFAULT 'MANUAL_FINANCE', "version" INTEGER NOT NULL DEFAULT 0);
INSERT INTO "Setting" ("id") VALUES ('spk');
CREATE TABLE "SettingAudit" ("id" TEXT PRIMARY KEY, "settingId" TEXT NOT NULL REFERENCES "Setting"("id") ON DELETE RESTRICT, "actorId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT, "fromTrigger" "SpkTrigger" NOT NULL, "toTrigger" "SpkTrigger" NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX "SettingAudit_settingId_createdAt_idx" ON "SettingAudit"("settingId", "createdAt");
CREATE TABLE "Spk" (
  "id" TEXT PRIMARY KEY, "rabId" TEXT NOT NULL UNIQUE REFERENCES "Rab"("id") ON DELETE RESTRICT,
  "status" "SpkStatus" NOT NULL DEFAULT 'PENDING', "number" TEXT UNIQUE, "amount" DECIMAL(18,2),
  "acknowledgedById" TEXT REFERENCES "User"("id") ON DELETE RESTRICT, "acknowledgedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Spk_issued_fields" CHECK (("status" = 'PENDING' AND "number" IS NULL AND "amount" IS NULL AND "acknowledgedAt" IS NULL AND "acknowledgedById" IS NULL) OR ("status" = 'ISSUED' AND "number" IS NOT NULL AND length(trim("number")) > 0 AND "amount" IS NOT NULL AND "amount" <> 'NaN'::numeric AND "amount" >= 0 AND (("acknowledgedAt" IS NULL) = ("acknowledgedById" IS NULL))))
);
CREATE TABLE "SpkAudit" ("id" TEXT PRIMARY KEY, "spkId" TEXT NOT NULL REFERENCES "Spk"("id") ON DELETE RESTRICT, "actorId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT, "event" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX "SpkAudit_spkId_createdAt_idx" ON "SpkAudit"("spkId", "createdAt");
CREATE FUNCTION "prevent_spk_audit_change"() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'SPK audit is immutable'; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "SpkAudit_immutable" BEFORE UPDATE OR DELETE ON "SpkAudit" FOR EACH ROW EXECUTE FUNCTION "prevent_spk_audit_change"();
CREATE TRIGGER "SettingAudit_immutable" BEFORE UPDATE OR DELETE ON "SettingAudit" FOR EACH ROW EXECUTE FUNCTION "prevent_spk_audit_change"();
