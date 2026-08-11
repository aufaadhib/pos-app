ALTER TYPE "CashShiftAuditAction" ADD VALUE 'RECONCILIATION_CORRECT';

CREATE TABLE "cash_shift_reconciliation_correction" (
  "id" TEXT NOT NULL,
  "shiftId" TEXT NOT NULL,
  "correctionToken" TEXT NOT NULL,
  "revision" INTEGER NOT NULL,
  "expectedCash" DECIMAL(14,2) NOT NULL,
  "previousActualCash" DECIMAL(14,2) NOT NULL,
  "correctedActualCash" DECIMAL(14,2) NOT NULL,
  "previousDifference" DECIMAL(14,2) NOT NULL,
  "correctedDifference" DECIMAL(14,2) NOT NULL,
  "reason" VARCHAR(240) NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "actorName" TEXT NOT NULL,
  "actorEmail" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cash_shift_reconciliation_correction_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "cash_shift_reconciliation_correction_values_check" CHECK ("revision" > 0 AND "previousActualCash" >= 0 AND "correctedActualCash" >= 0)
);

CREATE UNIQUE INDEX "cash_shift_reconciliation_correction_correctionToken_key" ON "cash_shift_reconciliation_correction"("correctionToken");
CREATE UNIQUE INDEX "cash_shift_reconciliation_correction_shiftId_revision_key" ON "cash_shift_reconciliation_correction"("shiftId", "revision");
CREATE INDEX "cash_shift_reconciliation_correction_shiftId_createdAt_idx" ON "cash_shift_reconciliation_correction"("shiftId", "createdAt");
CREATE INDEX "cash_shift_reconciliation_correction_actorUserId_createdAt_idx" ON "cash_shift_reconciliation_correction"("actorUserId", "createdAt");

ALTER TABLE "cash_shift_reconciliation_correction" ADD CONSTRAINT "cash_shift_reconciliation_correction_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "cash_shift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cash_shift_reconciliation_correction" ADD CONSTRAINT "cash_shift_reconciliation_correction_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
