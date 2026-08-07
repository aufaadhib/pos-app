-- CreateEnum
CREATE TYPE "OutletStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AdminAuditEntityType" AS ENUM ('OUTLET', 'STAFF', 'STAFF_ASSIGNMENT', 'SESSION');

-- CreateEnum
CREATE TYPE "AdminAuditAction" AS ENUM ('CREATE', 'UPDATE', 'ARCHIVE', 'RESTORE', 'ASSIGN', 'UNASSIGN', 'DEACTIVATE', 'REACTIVATE', 'PASSWORD_RESET', 'PASSWORD_CHANGE', 'ACTIVE_OUTLET_CHANGE');

-- AlterTable
ALTER TABLE "session" ADD COLUMN     "activeOutletId" TEXT;

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "outlet" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Jakarta',
    "addressLine" VARCHAR(240),
    "provinceCode" TEXT NOT NULL,
    "provinceName" TEXT NOT NULL,
    "cityCode" TEXT NOT NULL,
    "cityName" TEXT NOT NULL,
    "status" "OutletStatus" NOT NULL DEFAULT 'ACTIVE',
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outlet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_outlet_assignment" (
    "userId" TEXT NOT NULL,
    "outletId" TEXT NOT NULL,
    "assignedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_outlet_assignment_pkey" PRIMARY KEY ("userId","outletId")
);

-- CreateTable
CREATE TABLE "admin_audit_log" (
    "id" TEXT NOT NULL,
    "entityType" "AdminAuditEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" "AdminAuditAction" NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "actorEmail" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "outlet_code_key" ON "outlet"("code");

-- CreateIndex
CREATE UNIQUE INDEX "outlet_normalizedName_key" ON "outlet"("normalizedName");

-- CreateIndex
CREATE INDEX "outlet_status_name_idx" ON "outlet"("status", "name");

-- CreateIndex
CREATE INDEX "user_outlet_assignment_outletId_userId_idx" ON "user_outlet_assignment"("outletId", "userId");

-- CreateIndex
CREATE INDEX "admin_audit_log_entityType_entityId_createdAt_idx" ON "admin_audit_log"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "admin_audit_log_actorUserId_createdAt_idx" ON "admin_audit_log"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "session_activeOutletId_idx" ON "session"("activeOutletId");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_activeOutletId_fkey" FOREIGN KEY ("activeOutletId") REFERENCES "outlet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_outlet_assignment" ADD CONSTRAINT "user_outlet_assignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_outlet_assignment" ADD CONSTRAINT "user_outlet_assignment_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "outlet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
