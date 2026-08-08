ALTER TYPE "SaleAuditAction" ADD VALUE 'VOID';
ALTER TYPE "SaleAuditAction" ADD VALUE 'REFUND';

CREATE TYPE "SaleStatus" AS ENUM ('COMPLETED', 'PARTIALLY_REFUNDED', 'REFUNDED', 'VOIDED');
CREATE TYPE "SaleRefundType" AS ENUM ('VOID', 'REFUND');

ALTER TABLE "sale" ADD COLUMN "status" "SaleStatus" NOT NULL DEFAULT 'COMPLETED';
DROP INDEX "sale_outletId_completedAt_idx";
CREATE INDEX "sale_outletId_status_completedAt_idx" ON "sale"("outletId", "status", "completedAt");

CREATE TABLE "sale_refund" (
  "id" TEXT NOT NULL,
  "saleId" TEXT NOT NULL,
  "cashShiftId" TEXT,
  "operationToken" TEXT NOT NULL,
  "type" "SaleRefundType" NOT NULL,
  "method" "PaymentMethod" NOT NULL,
  "subtotalAmount" DECIMAL(14,2) NOT NULL,
  "serviceChargeAmount" DECIMAL(14,2) NOT NULL,
  "taxAmount" DECIMAL(14,2) NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "expectedFeeAmount" DECIMAL(14,2),
  "expectedNetAmount" DECIMAL(14,2),
  "directEquivalentAmount" DECIMAL(14,2),
  "reason" VARCHAR(240) NOT NULL,
  "providerReference" VARCHAR(80),
  "actorUserId" TEXT NOT NULL,
  "actorName" TEXT NOT NULL,
  "actorEmail" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sale_refund_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sale_refund_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "sale_refund_cashShiftId_fkey" FOREIGN KEY ("cashShiftId") REFERENCES "cash_shift"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "sale_refund_amounts_valid" CHECK (
    "subtotalAmount" >= 0 AND "serviceChargeAmount" >= 0 AND "taxAmount" >= 0 AND "amount" > 0
    AND ("expectedFeeAmount" IS NULL OR "expectedFeeAmount" >= 0)
    AND ("expectedNetAmount" IS NULL OR "expectedNetAmount" >= 0)
    AND ("directEquivalentAmount" IS NULL OR "directEquivalentAmount" >= 0)
  ),
  CONSTRAINT "sale_refund_cash_shift_method" CHECK (
    ("method" = 'CASH' AND "cashShiftId" IS NOT NULL)
    OR ("method" <> 'CASH' AND "cashShiftId" IS NULL)
  ),
  CONSTRAINT "sale_refund_provider_reference" CHECK (
    "method" = 'CASH' OR ("providerReference" IS NOT NULL AND LENGTH(TRIM("providerReference")) > 0)
  )
);

CREATE UNIQUE INDEX "sale_refund_operationToken_key" ON "sale_refund"("operationToken");
CREATE INDEX "sale_refund_saleId_createdAt_idx" ON "sale_refund"("saleId", "createdAt");
CREATE INDEX "sale_refund_cashShiftId_createdAt_idx" ON "sale_refund"("cashShiftId", "createdAt");
CREATE INDEX "sale_refund_actorUserId_createdAt_idx" ON "sale_refund"("actorUserId", "createdAt");

CREATE TABLE "sale_refund_item" (
  "id" TEXT NOT NULL,
  "refundId" TEXT NOT NULL,
  "saleItemId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "lineAmount" DECIMAL(14,2) NOT NULL,
  CONSTRAINT "sale_refund_item_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sale_refund_item_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "sale_refund"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "sale_refund_item_saleItemId_fkey" FOREIGN KEY ("saleItemId") REFERENCES "sale_item"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "sale_refund_item_values_valid" CHECK ("quantity" > 0 AND "lineAmount" >= 0)
);

CREATE UNIQUE INDEX "sale_refund_item_refundId_saleItemId_key" ON "sale_refund_item"("refundId", "saleItemId");
CREATE INDEX "sale_refund_item_saleItemId_idx" ON "sale_refund_item"("saleItemId");
