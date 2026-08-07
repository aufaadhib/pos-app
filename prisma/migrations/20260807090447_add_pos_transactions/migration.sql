-- CreateEnum
CREATE TYPE "SaleOrderType" AS ENUM ('DINE_IN', 'TAKEAWAY');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'QRIS', 'DEBIT_CARD', 'CREDIT_CARD', 'BANK_TRANSFER');

-- CreateEnum
CREATE TYPE "SaleAuditAction" AS ENUM ('CREATE');

-- CreateTable
CREATE TABLE "receipt_sequence" (
    "outletId" TEXT NOT NULL,
    "businessDate" DATE NOT NULL,
    "lastValue" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "receipt_sequence_pkey" PRIMARY KEY ("outletId","businessDate")
);

-- CreateTable
CREATE TABLE "sale" (
    "id" TEXT NOT NULL,
    "checkoutToken" TEXT NOT NULL,
    "outletId" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "businessDate" DATE NOT NULL,
    "dailySequence" INTEGER NOT NULL,
    "orderType" "SaleOrderType" NOT NULL,
    "tableLabel" VARCHAR(40),
    "subtotal" DECIMAL(14,2) NOT NULL,
    "serviceChargeRate" DECIMAL(5,2) NOT NULL,
    "serviceChargeAmount" DECIMAL(14,2) NOT NULL,
    "taxRate" DECIMAL(5,2) NOT NULL,
    "taxAmount" DECIMAL(14,2) NOT NULL,
    "pricesIncludeTax" BOOLEAN NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdByEmail" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_item" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "sku" TEXT,
    "quantity" INTEGER NOT NULL,
    "note" VARCHAR(240),
    "baseUnitPrice" DECIMAL(14,2) NOT NULL,
    "variantUnitAmount" DECIMAL(14,2) NOT NULL,
    "modifierUnitAmount" DECIMAL(14,2) NOT NULL,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "lineTotal" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "sale_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_item_variant" (
    "id" TEXT NOT NULL,
    "saleItemId" TEXT NOT NULL,
    "variantGroupId" TEXT NOT NULL,
    "variantGroupName" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "optionName" TEXT NOT NULL,
    "priceAdjustment" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "sale_item_variant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_item_modifier" (
    "id" TEXT NOT NULL,
    "saleItemId" TEXT NOT NULL,
    "modifierGroupId" TEXT NOT NULL,
    "modifierGroupName" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "optionName" TEXT NOT NULL,
    "priceAdjustment" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "sale_item_modifier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_payment" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "reference" VARCHAR(80),
    "tenderedAmount" DECIMAL(14,2),
    "changeAmount" DECIMAL(14,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sale_payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_audit_log" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "action" "SaleAuditAction" NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "actorEmail" TEXT NOT NULL,
    "after" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sale_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sale_checkoutToken_key" ON "sale"("checkoutToken");

-- CreateIndex
CREATE INDEX "sale_outletId_completedAt_idx" ON "sale"("outletId", "completedAt");

-- CreateIndex
CREATE INDEX "sale_createdByUserId_completedAt_idx" ON "sale"("createdByUserId", "completedAt");

-- CreateIndex
CREATE UNIQUE INDEX "sale_outletId_receiptNumber_key" ON "sale"("outletId", "receiptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "sale_outletId_businessDate_dailySequence_key" ON "sale"("outletId", "businessDate", "dailySequence");

-- CreateIndex
CREATE INDEX "sale_item_saleId_idx" ON "sale_item"("saleId");

-- CreateIndex
CREATE INDEX "sale_item_productId_idx" ON "sale_item"("productId");

-- CreateIndex
CREATE INDEX "sale_item_variant_saleItemId_idx" ON "sale_item_variant"("saleItemId");

-- CreateIndex
CREATE INDEX "sale_item_modifier_saleItemId_idx" ON "sale_item_modifier"("saleItemId");

-- CreateIndex
CREATE UNIQUE INDEX "sale_payment_saleId_key" ON "sale_payment"("saleId");

-- CreateIndex
CREATE INDEX "sale_payment_method_createdAt_idx" ON "sale_payment"("method", "createdAt");

-- CreateIndex
CREATE INDEX "sale_audit_log_saleId_createdAt_idx" ON "sale_audit_log"("saleId", "createdAt");

-- CreateIndex
CREATE INDEX "sale_audit_log_actorUserId_createdAt_idx" ON "sale_audit_log"("actorUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "receipt_sequence" ADD CONSTRAINT "receipt_sequence_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "outlet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale" ADD CONSTRAINT "sale_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "outlet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_item" ADD CONSTRAINT "sale_item_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_item_variant" ADD CONSTRAINT "sale_item_variant_saleItemId_fkey" FOREIGN KEY ("saleItemId") REFERENCES "sale_item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_item_modifier" ADD CONSTRAINT "sale_item_modifier_saleItemId_fkey" FOREIGN KEY ("saleItemId") REFERENCES "sale_item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_payment" ADD CONSTRAINT "sale_payment_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_audit_log" ADD CONSTRAINT "sale_audit_log_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
