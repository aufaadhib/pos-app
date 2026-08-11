CREATE TYPE "AttendanceScheduleMode" AS ENUM ('WEEKLY', 'FIXED');
CREATE TYPE "AttendanceRosterSource" AS ENUM ('MANUAL', 'FIXED');

ALTER TYPE "AttendanceAuditAction" ADD VALUE 'SCHEDULE_MODE_UPDATE';
ALTER TYPE "AttendanceAuditAction" ADD VALUE 'FIXED_SCHEDULE_UPDATE';
ALTER TYPE "AttendanceAuditAction" ADD VALUE 'FIXED_ROSTER_MATERIALIZE';

ALTER TABLE "outlet"
ADD COLUMN "attendanceScheduleMode" "AttendanceScheduleMode" NOT NULL DEFAULT 'WEEKLY',
ADD COLUMN "attendanceScheduleEffectiveFrom" DATE;

ALTER TABLE "attendance_roster_week"
ADD COLUMN "source" "AttendanceRosterSource" NOT NULL DEFAULT 'MANUAL';

CREATE TABLE "attendance_fixed_schedule" (
  "id" TEXT NOT NULL,
  "outletId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "weekday" INTEGER NOT NULL,
  "shiftTemplateId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "attendance_fixed_schedule_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "attendance_fixed_schedule_weekday_check" CHECK ("weekday" BETWEEN 1 AND 7)
);

CREATE TABLE "attendance_schedule_override" (
  "id" TEXT NOT NULL,
  "outletId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "workDate" DATE NOT NULL,
  "shiftTemplateId" TEXT,
  "reason" VARCHAR(240) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "attendance_schedule_override_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "attendance_fixed_schedule_outletId_userId_weekday_key" ON "attendance_fixed_schedule"("outletId", "userId", "weekday");
CREATE INDEX "attendance_fixed_schedule_userId_weekday_idx" ON "attendance_fixed_schedule"("userId", "weekday");
CREATE UNIQUE INDEX "attendance_schedule_override_userId_workDate_key" ON "attendance_schedule_override"("userId", "workDate");
CREATE INDEX "attendance_schedule_override_outletId_workDate_idx" ON "attendance_schedule_override"("outletId", "workDate");

ALTER TABLE "attendance_fixed_schedule" ADD CONSTRAINT "attendance_fixed_schedule_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "outlet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attendance_fixed_schedule" ADD CONSTRAINT "attendance_fixed_schedule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attendance_fixed_schedule" ADD CONSTRAINT "attendance_fixed_schedule_shiftTemplateId_fkey" FOREIGN KEY ("shiftTemplateId") REFERENCES "attendance_shift_template"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendance_schedule_override" ADD CONSTRAINT "attendance_schedule_override_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "outlet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attendance_schedule_override" ADD CONSTRAINT "attendance_schedule_override_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attendance_schedule_override" ADD CONSTRAINT "attendance_schedule_override_shiftTemplateId_fkey" FOREIGN KEY ("shiftTemplateId") REFERENCES "attendance_shift_template"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
