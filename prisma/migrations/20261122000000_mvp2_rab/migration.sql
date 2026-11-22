CREATE TYPE "RabStatus" AS ENUM ('RAB_DRAFT', 'RAB_REVIEW', 'RAB_APPROVED');
CREATE TABLE "Rab" (
  "id" TEXT PRIMARY KEY,
  "jobId" TEXT NOT NULL UNIQUE REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "status" "RabStatus" NOT NULL DEFAULT 'RAB_DRAFT',
  "version" INTEGER NOT NULL DEFAULT 0 CHECK ("version" >= 0),
  "notes" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "RabItem" (
  "rabId" TEXT PRIMARY KEY REFERENCES "Rab"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "fixCost" DECIMAL(18,2) CHECK ("fixCost" >= 0),
  "sppjTransport" DECIMAL(18,2) CHECK ("sppjTransport" >= 0),
  "nidi" DECIMAL(18,2) CHECK ("nidi" >= 0),
  "izinEsdm" DECIMAL(18,2) CHECK ("izinEsdm" >= 0),
  "lhpp" DECIMAL(18,2) CHECK ("lhpp" >= 0),
  "pnbp" DECIMAL(18,2) CHECK ("pnbp" >= 0),
  "verifikator" DECIMAL(18,2) CHECK ("verifikator" >= 0),
  "sewaAlat" DECIMAL(18,2) CHECK ("sewaAlat" >= 0),
  "variabelCost" DECIMAL(18,2) CHECK ("variabelCost" >= 0),
  "ppn" DECIMAL(18,2) CHECK ("ppn" >= 0),
  "jumlahNilaiPekerjaan" DECIMAL(18,2) CHECK ("jumlahNilaiPekerjaan" >= 0),
  "biayaOperasional" DECIMAL(18,2) CHECK ("biayaOperasional" >= 0),
  "rencanaMargin" DECIMAL(18,2) CHECK ("rencanaMargin" >= 0)
);
CREATE TABLE "RabAudit" (
  "id" TEXT PRIMARY KEY,
  "rabId" TEXT NOT NULL REFERENCES "Rab"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "actorId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "fromStatus" "RabStatus",
  "toStatus" "RabStatus" NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "RabAudit_rabId_createdAt_idx" ON "RabAudit"("rabId", "createdAt");
CREATE TRIGGER rab_audit_immutable BEFORE UPDATE OR DELETE ON "RabAudit" FOR EACH ROW EXECUTE FUNCTION prevent_audit_change();
