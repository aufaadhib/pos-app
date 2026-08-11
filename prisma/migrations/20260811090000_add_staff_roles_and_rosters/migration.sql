CREATE TYPE "StaffPositionStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "AttendanceRosterStatus" AS ENUM ('DRAFT', 'PUBLISHED');
CREATE TYPE "AttendanceScheduleMatch" AS ENUM ('SCHEDULED', 'UNSCHEDULED');

ALTER TYPE "AdminAuditEntityType" ADD VALUE 'STAFF_POSITION';
ALTER TYPE "AttendanceAuditAction" ADD VALUE 'SHIFT_TEMPLATE_CREATE';
ALTER TYPE "AttendanceAuditAction" ADD VALUE 'SHIFT_TEMPLATE_UPDATE';
ALTER TYPE "AttendanceAuditAction" ADD VALUE 'SHIFT_TEMPLATE_ARCHIVE';
ALTER TYPE "AttendanceAuditAction" ADD VALUE 'ROSTER_PUBLISH';
ALTER TYPE "AttendanceAuditAction" ADD VALUE 'ROSTER_UPDATE';

ALTER TABLE "user" ADD COLUMN "jobPositionId" TEXT;
ALTER TABLE "outlet" ADD COLUMN "attendanceLateGraceMinutes" INTEGER NOT NULL DEFAULT 15;
ALTER TABLE "outlet" ADD COLUMN "attendanceEarlyLeaveGraceMinutes" INTEGER NOT NULL DEFAULT 15;
ALTER TABLE "attendance_verification" ADD COLUMN "rosterEntryId" TEXT;
ALTER TABLE "attendance_verification" ADD COLUMN "scheduleMatch" "AttendanceScheduleMatch";
ALTER TABLE "attendance_session" ADD COLUMN "rosterEntryId" TEXT;
ALTER TABLE "attendance_session" ADD COLUMN "scheduleMatch" "AttendanceScheduleMatch" NOT NULL DEFAULT 'UNSCHEDULED';

CREATE TABLE "staff_position" (
  "id" TEXT NOT NULL,
  "name" VARCHAR(80) NOT NULL,
  "normalizedName" VARCHAR(80) NOT NULL,
  "status" "StaffPositionStatus" NOT NULL DEFAULT 'ACTIVE',
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "staff_position_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "attendance_shift_template" (
  "id" TEXT NOT NULL,
  "outletId" TEXT NOT NULL,
  "name" VARCHAR(60) NOT NULL,
  "normalizedName" VARCHAR(60) NOT NULL,
  "startMinute" INTEGER NOT NULL,
  "endMinute" INTEGER NOT NULL,
  "status" "StaffPositionStatus" NOT NULL DEFAULT 'ACTIVE',
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "attendance_shift_template_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "attendance_shift_template_minutes_check" CHECK ("startMinute" BETWEEN 0 AND 1439 AND "endMinute" BETWEEN 0 AND 1439 AND "startMinute" <> "endMinute")
);

CREATE TABLE "attendance_roster_week" (
  "id" TEXT NOT NULL,
  "outletId" TEXT NOT NULL,
  "weekStart" DATE NOT NULL,
  "status" "AttendanceRosterStatus" NOT NULL DEFAULT 'DRAFT',
  "publishedAt" TIMESTAMP(3),
  "publishedByUserId" TEXT,
  "publishedByName" TEXT,
  "publishedByEmail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "attendance_roster_week_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "attendance_roster_week_publish_check" CHECK (("status" = 'DRAFT' AND "publishedAt" IS NULL) OR ("status" = 'PUBLISHED' AND "publishedAt" IS NOT NULL AND "publishedByUserId" IS NOT NULL))
);

CREATE TABLE "attendance_roster_entry" (
  "id" TEXT NOT NULL,
  "rosterWeekId" TEXT NOT NULL,
  "shiftTemplateId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "outletId" TEXT NOT NULL,
  "positionId" TEXT NOT NULL,
  "workDate" DATE NOT NULL,
  "scheduledStartAt" TIMESTAMP(3) NOT NULL,
  "scheduledEndAt" TIMESTAMP(3) NOT NULL,
  "timezone" VARCHAR(80) NOT NULL,
  "positionName" VARCHAR(80) NOT NULL,
  "shiftName" VARCHAR(60) NOT NULL,
  "lateGraceMinutes" INTEGER NOT NULL DEFAULT 15,
  "earlyLeaveGraceMinutes" INTEGER NOT NULL DEFAULT 15,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "attendance_roster_entry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "attendance_roster_entry_time_check" CHECK ("scheduledEndAt" > "scheduledStartAt"),
  CONSTRAINT "attendance_roster_entry_grace_check" CHECK ("lateGraceMinutes" BETWEEN 0 AND 120 AND "earlyLeaveGraceMinutes" BETWEEN 0 AND 120)
);

CREATE UNIQUE INDEX "staff_position_normalizedName_key" ON "staff_position"("normalizedName");
CREATE INDEX "staff_position_status_name_idx" ON "staff_position"("status", "name");
CREATE UNIQUE INDEX "attendance_shift_template_outletId_normalizedName_key" ON "attendance_shift_template"("outletId", "normalizedName");
CREATE INDEX "attendance_shift_template_outletId_status_name_idx" ON "attendance_shift_template"("outletId", "status", "name");
CREATE UNIQUE INDEX "attendance_roster_week_outletId_weekStart_key" ON "attendance_roster_week"("outletId", "weekStart");
CREATE INDEX "attendance_roster_week_status_weekStart_idx" ON "attendance_roster_week"("status", "weekStart");
CREATE UNIQUE INDEX "attendance_roster_entry_userId_workDate_key" ON "attendance_roster_entry"("userId", "workDate");
CREATE UNIQUE INDEX "attendance_roster_entry_rosterWeekId_userId_workDate_key" ON "attendance_roster_entry"("rosterWeekId", "userId", "workDate");
CREATE INDEX "attendance_roster_entry_outletId_workDate_idx" ON "attendance_roster_entry"("outletId", "workDate");
CREATE INDEX "attendance_roster_entry_rosterWeekId_workDate_idx" ON "attendance_roster_entry"("rosterWeekId", "workDate");
CREATE INDEX "user_jobPositionId_idx" ON "user"("jobPositionId");
CREATE INDEX "attendance_verification_rosterEntryId_createdAt_idx" ON "attendance_verification"("rosterEntryId", "createdAt");
CREATE UNIQUE INDEX "attendance_session_rosterEntryId_key" ON "attendance_session"("rosterEntryId");

ALTER TABLE "outlet" ADD CONSTRAINT "outlet_attendance_grace_check" CHECK ("attendanceLateGraceMinutes" BETWEEN 0 AND 120 AND "attendanceEarlyLeaveGraceMinutes" BETWEEN 0 AND 120);
ALTER TABLE "user" ADD CONSTRAINT "user_jobPositionId_fkey" FOREIGN KEY ("jobPositionId") REFERENCES "staff_position"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendance_shift_template" ADD CONSTRAINT "attendance_shift_template_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "outlet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendance_roster_week" ADD CONSTRAINT "attendance_roster_week_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "outlet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendance_roster_entry" ADD CONSTRAINT "attendance_roster_entry_rosterWeekId_fkey" FOREIGN KEY ("rosterWeekId") REFERENCES "attendance_roster_week"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attendance_roster_entry" ADD CONSTRAINT "attendance_roster_entry_shiftTemplateId_fkey" FOREIGN KEY ("shiftTemplateId") REFERENCES "attendance_shift_template"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendance_roster_entry" ADD CONSTRAINT "attendance_roster_entry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendance_roster_entry" ADD CONSTRAINT "attendance_roster_entry_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "outlet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendance_roster_entry" ADD CONSTRAINT "attendance_roster_entry_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "staff_position"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendance_verification" ADD CONSTRAINT "attendance_verification_rosterEntryId_fkey" FOREIGN KEY ("rosterEntryId") REFERENCES "attendance_roster_entry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendance_session" ADD CONSTRAINT "attendance_session_rosterEntryId_fkey" FOREIGN KEY ("rosterEntryId") REFERENCES "attendance_roster_entry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "staff_position" ("id", "name", "normalizedName", "updatedAt") VALUES
  ('system-position-manager', 'Manajer', 'manajer', CURRENT_TIMESTAMP),
  ('system-position-cashier', 'Kasir', 'kasir', CURRENT_TIMESTAMP);

UPDATE "user" SET "jobPositionId" = 'system-position-manager' WHERE "role" = 'manager';
UPDATE "user" SET "jobPositionId" = 'system-position-cashier' WHERE "role" = 'cashier';
