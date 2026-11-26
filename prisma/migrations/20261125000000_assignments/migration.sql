-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('ASSIGNED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "AssignmentRole" AS ENUM ('Ketua', 'Anggota');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'PEKERJA';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "occupation" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "spkId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "consideration" TEXT NOT NULL,
    "basis" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "installationType" TEXT NOT NULL,
    "start" DATE NOT NULL,
    "end" DATE NOT NULL,
    "owner" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "capacity" TEXT NOT NULL,
    "issuePlace" TEXT NOT NULL,
    "issueDate" DATE NOT NULL,
    "signatory" TEXT NOT NULL,
    "signatoryTitle" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
    "progressPercent" INTEGER NOT NULL DEFAULT 0,
    "progressNotes" TEXT NOT NULL DEFAULT '',
    "progressUpdatedAt" TIMESTAMP(3),
    "progressUpdatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignmentMember" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "occupation" TEXT NOT NULL,
    "role" "AssignmentRole" NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "AssignmentMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignmentAudit" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "fromStatus" "AssignmentStatus",
    "toStatus" "AssignmentStatus" NOT NULL,
    "snapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssignmentAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Assignment_spkId_key" ON "Assignment"("spkId");

-- CreateIndex
CREATE UNIQUE INDEX "Assignment_number_key" ON "Assignment"("number");

-- CreateIndex
CREATE INDEX "AssignmentMember_userId_idx" ON "AssignmentMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AssignmentMember_assignmentId_userId_key" ON "AssignmentMember"("assignmentId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "AssignmentMember_assignmentId_position_key" ON "AssignmentMember"("assignmentId", "position");

-- CreateIndex
CREATE INDEX "AssignmentAudit_assignmentId_createdAt_idx" ON "AssignmentAudit"("assignmentId", "createdAt");

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_spkId_fkey" FOREIGN KEY ("spkId") REFERENCES "Spk"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_progressUpdatedById_fkey" FOREIGN KEY ("progressUpdatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentMember" ADD CONSTRAINT "AssignmentMember_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentMember" ADD CONSTRAINT "AssignmentMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentAudit" ADD CONSTRAINT "AssignmentAudit_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentAudit" ADD CONSTRAINT "AssignmentAudit_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Existing users remain active; no existing job, RAB or SPK records are rewritten.
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_version_valid" CHECK ("version" >= 0),
  ADD CONSTRAINT "Assignment_dates_valid" CHECK ("end" >= "start"),
  ADD CONSTRAINT "Assignment_progress_valid" CHECK ("progressPercent" BETWEEN 0 AND 100 AND
    (("progressPercent" = 0 AND "status" = 'ASSIGNED') OR ("progressPercent" BETWEEN 1 AND 99 AND "status" = 'IN_PROGRESS') OR ("progressPercent" = 100 AND "status" = 'COMPLETED'))),
  ADD CONSTRAINT "Assignment_number_valid" CHECK (length(trim("number")) BETWEEN 1 AND 200),
  ADD CONSTRAINT "Assignment_notes_valid" CHECK (length("progressNotes") <= 2000);
ALTER TABLE "AssignmentMember" ADD CONSTRAINT "AssignmentMember_fields_valid" CHECK ("position" >= 0 AND length(trim("name")) BETWEEN 1 AND 200 AND length(trim("occupation")) BETWEEN 1 AND 200);
CREATE UNIQUE INDEX "Assignment_one_chair" ON "AssignmentMember" ("assignmentId") WHERE "role" = 'Ketua';
CREATE TRIGGER "AssignmentAudit_immutable" BEFORE UPDATE OR DELETE ON "AssignmentAudit" FOR EACH ROW EXECUTE FUNCTION prevent_audit_change();

CREATE FUNCTION check_assignment_team() RETURNS trigger AS $$
DECLARE target TEXT; total INTEGER; chairs INTEGER;
BEGIN
  IF TG_TABLE_NAME = 'Assignment' THEN target := NEW."id";
  ELSIF TG_OP = 'DELETE' THEN target := OLD."assignmentId";
  ELSE target := NEW."assignmentId"; END IF;
  IF EXISTS (SELECT 1 FROM "Assignment" WHERE "id" = target) THEN
    SELECT count(*), count(*) FILTER (WHERE "role" = 'Ketua') INTO total, chairs FROM "AssignmentMember" WHERE "assignmentId" = target;
    IF total < 1 OR total > 50 OR chairs <> 1 THEN RAISE EXCEPTION 'Assignment requires 1-50 members and exactly one chair'; END IF;
  END IF;
  RETURN NULL;
END; $$ LANGUAGE plpgsql;
CREATE CONSTRAINT TRIGGER "Assignment_team_required" AFTER INSERT ON "Assignment" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_assignment_team();
CREATE CONSTRAINT TRIGGER "AssignmentMember_team_valid" AFTER INSERT OR UPDATE OR DELETE ON "AssignmentMember" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_assignment_team();
