ALTER TYPE "SaleOrderType" ADD VALUE 'DELIVERY';
ALTER TYPE "PaymentMethod" ADD VALUE 'DELIVERY_PLATFORM';
ALTER TYPE "SaleAuditAction" ADD VALUE 'SETTLE';
ALTER TYPE "SaleAuditAction" ADD VALUE 'UNSETTLE';
ALTER TYPE "AdminAuditEntityType" ADD VALUE 'DELIVERY_CHANNEL';
ALTER TYPE "AdminAuditEntityType" ADD VALUE 'CHANNEL_PRODUCT_PRICE';
ALTER TYPE "AdminAuditEntityType" ADD VALUE 'SETTLEMENT';

CREATE TYPE "DeliveryProvider" AS ENUM ('GOFOOD', 'GRABFOOD', 'SHOPEEFOOD');
CREATE TYPE "PaymentSettlementStatus" AS ENUM ('NOT_APPLICABLE', 'PENDING', 'SETTLED');
CREATE TYPE "SettlementBatchStatus" AS ENUM ('CONFIRMED', 'REVERSED');

CREATE TABLE "outlet_delivery_channel" (
  "id" TEXT NOT NULL,
  "outletId" TEXT NOT NULL,
  "provider" "DeliveryProvider" NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT false,
  "markupRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "estimatedFeeRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "roundingUnit" INTEGER NOT NULL DEFAULT 500,
  "settlementDelayHours" INTEGER NOT NULL DEFAULT 24,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "outlet_delivery_channel_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "outlet_delivery_channel_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "outlet"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "outlet_delivery_channel_rate_range" CHECK ("markupRate" >= 0 AND "markupRate" < 1000 AND "estimatedFeeRate" >= 0 AND "estimatedFeeRate" < 100),
  CONSTRAINT "outlet_delivery_channel_rounding_positive" CHECK ("roundingUnit" > 0),
  CONSTRAINT "outlet_delivery_channel_delay_range" CHECK ("settlementDelayHours" BETWEEN 1 AND 720)
);

CREATE UNIQUE INDEX "outlet_delivery_channel_outletId_provider_key" ON "outlet_delivery_channel"("outletId", "provider");
CREATE INDEX "outlet_delivery_channel_outletId_isActive_idx" ON "outlet_delivery_channel"("outletId", "isActive");

CREATE TABLE "channel_product_price" (
  "channelId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "priceOverride" DECIMAL(12,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "channel_product_price_pkey" PRIMARY KEY ("channelId", "productId"),
  CONSTRAINT "channel_product_price_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "outlet_delivery_channel"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "channel_product_price_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "channel_product_price_nonnegative" CHECK ("priceOverride" >= 0)
);

CREATE INDEX "channel_product_price_productId_channelId_idx" ON "channel_product_price"("productId", "channelId");

ALTER TABLE "sale"
ADD COLUMN "channelId" TEXT,
ADD COLUMN "externalOrderId" VARCHAR(80);

ALTER TABLE "sale"
ADD CONSTRAINT "sale_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "outlet_delivery_channel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "sale_channelId_externalOrderId_key" ON "sale"("channelId", "externalOrderId");
CREATE INDEX "sale_channelId_completedAt_idx" ON "sale"("channelId", "completedAt");
ALTER TABLE "sale" ADD CONSTRAINT "sale_channel_order_pair" CHECK (("channelId" IS NULL) = ("externalOrderId" IS NULL));

ALTER TABLE "sale_item" ADD COLUMN "directUnitPrice" DECIMAL(14,2);
UPDATE "sale_item" SET "directUnitPrice" = "unitPrice";
ALTER TABLE "sale_item" ALTER COLUMN "directUnitPrice" SET NOT NULL;

ALTER TABLE "sale_payment"
ADD COLUMN "settlementStatus" "PaymentSettlementStatus" NOT NULL DEFAULT 'NOT_APPLICABLE',
ADD COLUMN "expectedFeeRate" DECIMAL(5,2),
ADD COLUMN "expectedFeeAmount" DECIMAL(14,2),
ADD COLUMN "expectedNetAmount" DECIMAL(14,2),
ADD COLUMN "directEquivalentAmount" DECIMAL(14,2),
ADD COLUMN "expectedSettlementAt" TIMESTAMP(3);

CREATE INDEX "sale_payment_settlementStatus_expectedSettlementAt_idx" ON "sale_payment"("settlementStatus", "expectedSettlementAt");

CREATE TABLE "platform_settlement" (
  "id" TEXT NOT NULL,
  "channelId" TEXT NOT NULL,
  "reference" VARCHAR(80) NOT NULL,
  "grossAmount" DECIMAL(14,2) NOT NULL,
  "platformFeeAmount" DECIMAL(14,2) NOT NULL,
  "merchantPromotionAmount" DECIMAL(14,2) NOT NULL,
  "otherAdjustmentAmount" DECIMAL(14,2) NOT NULL,
  "otherAdjustmentNote" VARCHAR(240),
  "netReceivedAmount" DECIMAL(14,2) NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL,
  "status" "SettlementBatchStatus" NOT NULL DEFAULT 'CONFIRMED',
  "confirmedByUserId" TEXT NOT NULL,
  "confirmedByName" TEXT NOT NULL,
  "confirmedByEmail" TEXT NOT NULL,
  "reversedAt" TIMESTAMP(3),
  "reversedByUserId" TEXT,
  "reversedByEmail" TEXT,
  "reversalReason" VARCHAR(240),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "platform_settlement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "platform_settlement_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "outlet_delivery_channel"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "platform_settlement_amounts_nonnegative" CHECK ("grossAmount" >= 0 AND "platformFeeAmount" >= 0 AND "merchantPromotionAmount" >= 0 AND "netReceivedAmount" >= 0)
);

CREATE UNIQUE INDEX "platform_settlement_channelId_reference_key" ON "platform_settlement"("channelId", "reference");
CREATE INDEX "platform_settlement_channelId_receivedAt_idx" ON "platform_settlement"("channelId", "receivedAt");
CREATE INDEX "platform_settlement_status_receivedAt_idx" ON "platform_settlement"("status", "receivedAt");

CREATE TABLE "platform_settlement_item" (
  "settlementId" TEXT NOT NULL,
  "salePaymentId" TEXT NOT NULL,
  "grossAmount" DECIMAL(14,2) NOT NULL,
  "directEquivalentAmount" DECIMAL(14,2) NOT NULL,
  "expectedNetAmount" DECIMAL(14,2) NOT NULL,
  CONSTRAINT "platform_settlement_item_pkey" PRIMARY KEY ("settlementId", "salePaymentId"),
  CONSTRAINT "platform_settlement_item_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "platform_settlement"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "platform_settlement_item_salePaymentId_fkey" FOREIGN KEY ("salePaymentId") REFERENCES "sale_payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "platform_settlement_item_salePaymentId_idx" ON "platform_settlement_item"("salePaymentId");
