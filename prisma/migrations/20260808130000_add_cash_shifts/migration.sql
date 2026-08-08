CREATE TYPE "CashShiftStatus" AS ENUM ('OPEN', 'CLOSED');
CREATE TYPE "CashShiftCloseMode" AS ENUM ('SELF', 'FORCED');
CREATE TYPE "CashMovementDirection" AS ENUM ('IN', 'OUT');
CREATE TYPE "CashMovementCategory" AS ENUM ('ADDITIONAL_FLOAT', 'CASH_DROP', 'OPERATING_EXPENSE', 'OTHER');
CREATE TYPE "CashShiftAuditAction" AS ENUM ('OPEN', 'CASH_IN', 'CASH_OUT', 'CLOSE', 'FORCE_CLOSE');

CREATE TABLE "cash_shift" (
  "id" TEXT NOT NULL,
  "outletId" TEXT NOT NULL,
  "businessDate" DATE NOT NULL,
  "status" "CashShiftStatus" NOT NULL DEFAULT 'OPEN',
  "openUserKey" TEXT,
  "openToken" TEXT NOT NULL,
  "openingCash" DECIMAL(14,2) NOT NULL,
  "openedByUserId" TEXT NOT NULL,
  "openedByName" TEXT NOT NULL,
  "openedByEmail" TEXT NOT NULL,
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closeMode" "CashShiftCloseMode",
  "closeToken" TEXT,
  "closedByUserId" TEXT,
  "closedByName" TEXT,
  "closedByEmail" TEXT,
  "expectedCash" DECIMAL(14,2),
  "actualCash" DECIMAL(14,2),
  "cashDifference" DECIMAL(14,2),
  "closeReason" VARCHAR(240),
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "cash_shift_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "cash_shift_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "outlet"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "cash_shift_openedByUserId_fkey" FOREIGN KEY ("openedByUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "cash_shift_closedByUserId_fkey" FOREIGN KEY ("closedByUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "cash_shift_amounts_nonnegative" CHECK ("openingCash" >= 0 AND ("expectedCash" IS NULL OR "expectedCash" >= 0) AND ("actualCash" IS NULL OR "actualCash" >= 0)),
  CONSTRAINT "cash_shift_open_state" CHECK (
    ("status" = 'OPEN' AND "openUserKey" = "openedByUserId" AND "closeMode" IS NULL AND "closeToken" IS NULL AND "closedByUserId" IS NULL AND "closedByName" IS NULL AND "closedByEmail" IS NULL AND "expectedCash" IS NULL AND "actualCash" IS NULL AND "cashDifference" IS NULL AND "closeReason" IS NULL AND "closedAt" IS NULL)
    OR
    ("status" = 'CLOSED' AND "openUserKey" IS NULL AND "closeMode" IS NOT NULL AND "closeToken" IS NOT NULL AND "closedByUserId" IS NOT NULL AND "closedByName" IS NOT NULL AND "closedByEmail" IS NOT NULL AND "expectedCash" IS NOT NULL AND "actualCash" IS NOT NULL AND "cashDifference" IS NOT NULL AND "closedAt" IS NOT NULL)
  ),
  CONSTRAINT "cash_shift_forced_reason" CHECK (("closeMode" = 'FORCED' AND "closeReason" IS NOT NULL) OR "closeMode" IS DISTINCT FROM 'FORCED')
);

CREATE UNIQUE INDEX "cash_shift_openUserKey_key" ON "cash_shift"("openUserKey");
CREATE UNIQUE INDEX "cash_shift_openToken_key" ON "cash_shift"("openToken");
CREATE UNIQUE INDEX "cash_shift_closeToken_key" ON "cash_shift"("closeToken");
CREATE INDEX "cash_shift_outletId_status_openedAt_idx" ON "cash_shift"("outletId", "status", "openedAt");
CREATE INDEX "cash_shift_openedByUserId_openedAt_idx" ON "cash_shift"("openedByUserId", "openedAt");

CREATE TABLE "cash_movement" (
  "id" TEXT NOT NULL,
  "shiftId" TEXT NOT NULL,
  "operationToken" TEXT NOT NULL,
  "direction" "CashMovementDirection" NOT NULL,
  "category" "CashMovementCategory" NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "reason" VARCHAR(240) NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "actorName" TEXT NOT NULL,
  "actorEmail" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cash_movement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "cash_movement_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "cash_shift"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "cash_movement_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "cash_movement_amount_positive" CHECK ("amount" > 0),
  CONSTRAINT "cash_movement_category_direction" CHECK (
    ("category" = 'ADDITIONAL_FLOAT' AND "direction" = 'IN') OR
    ("category" IN ('CASH_DROP', 'OPERATING_EXPENSE') AND "direction" = 'OUT') OR
    "category" = 'OTHER'
  )
);

CREATE UNIQUE INDEX "cash_movement_operationToken_key" ON "cash_movement"("operationToken");
CREATE INDEX "cash_movement_shiftId_createdAt_idx" ON "cash_movement"("shiftId", "createdAt");
CREATE INDEX "cash_movement_actorUserId_createdAt_idx" ON "cash_movement"("actorUserId", "createdAt");

CREATE TABLE "cash_shift_audit_log" (
  "id" TEXT NOT NULL,
  "shiftId" TEXT NOT NULL,
  "action" "CashShiftAuditAction" NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "actorEmail" TEXT NOT NULL,
  "after" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cash_shift_audit_log_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "cash_shift_audit_log_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "cash_shift"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "cash_shift_audit_log_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "cash_shift_audit_log_shiftId_createdAt_idx" ON "cash_shift_audit_log"("shiftId", "createdAt");
CREATE INDEX "cash_shift_audit_log_actorUserId_createdAt_idx" ON "cash_shift_audit_log"("actorUserId", "createdAt");

ALTER TABLE "sale" ADD COLUMN "shiftId" TEXT;
ALTER TABLE "sale" ADD CONSTRAINT "sale_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "cash_shift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "sale_shiftId_completedAt_idx" ON "sale"("shiftId", "completedAt");
