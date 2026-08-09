CREATE TYPE "OrderStatus" AS ENUM ('OPEN', 'COMPLETED', 'CANCELLED');
CREATE TYPE "OrderAuditAction" AS ENUM ('CREATE', 'UPDATE', 'SEND', 'PRICE_REFRESH', 'COMPLETE', 'CANCEL');
CREATE TYPE "KitchenTicketKind" AS ENUM ('INITIAL', 'DELTA');
CREATE TYPE "KitchenTicketStatus" AS ENUM ('NEW', 'PROCESSING', 'COMPLETED');
CREATE TYPE "KitchenTicketLineAction" AS ENUM ('ADD', 'UPDATE', 'REMOVE');

ALTER TABLE "outlet" ADD COLUMN "openOrdersEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "pos_order" (
  "id" TEXT NOT NULL,
  "operationToken" TEXT NOT NULL,
  "lastOperationToken" TEXT,
  "outletId" TEXT NOT NULL,
  "openedShiftId" TEXT,
  "orderType" "SaleOrderType" NOT NULL,
  "tableLabel" VARCHAR(40),
  "normalizedTableLabel" VARCHAR(40),
  "activeTableKey" VARCHAR(100),
  "channelId" TEXT,
  "externalOrderId" VARCHAR(80),
  "status" "OrderStatus" NOT NULL DEFAULT 'OPEN',
  "version" INTEGER NOT NULL DEFAULT 1,
  "lastSentVersion" INTEGER NOT NULL DEFAULT 0,
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
  "completedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "cancellationReason" VARCHAR(240),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "pos_order_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pos_order_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "outlet"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "pos_order_openedShiftId_fkey" FOREIGN KEY ("openedShiftId") REFERENCES "cash_shift"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "pos_order_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "outlet_delivery_channel"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "pos_order_values_valid" CHECK (
    "version" > 0 AND "lastSentVersion" >= 0 AND "lastSentVersion" <= "version"
    AND "subtotal" >= 0 AND "serviceChargeAmount" >= 0 AND "taxAmount" >= 0 AND "total" >= 0
  )
);

CREATE UNIQUE INDEX "pos_order_operationToken_key" ON "pos_order"("operationToken");
CREATE UNIQUE INDEX "pos_order_lastOperationToken_key" ON "pos_order"("lastOperationToken");
CREATE UNIQUE INDEX "pos_order_activeTableKey_key" ON "pos_order"("activeTableKey");
CREATE UNIQUE INDEX "pos_order_channelId_externalOrderId_key" ON "pos_order"("channelId", "externalOrderId");
CREATE INDEX "pos_order_outletId_status_updatedAt_idx" ON "pos_order"("outletId", "status", "updatedAt");
CREATE INDEX "pos_order_openedShiftId_createdAt_idx" ON "pos_order"("openedShiftId", "createdAt");

CREATE TABLE "order_item" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "productName" TEXT NOT NULL,
  "sku" TEXT,
  "quantity" INTEGER NOT NULL,
  "note" VARCHAR(240),
  "variantOptionIds" TEXT[] NOT NULL,
  "modifierOptionIds" TEXT[] NOT NULL,
  "selectionLabel" VARCHAR(280),
  "unitPrice" DECIMAL(14,2) NOT NULL,
  "sentQuantity" INTEGER NOT NULL DEFAULT 0,
  "sentNote" VARCHAR(240),
  "sentSelectionLabel" VARCHAR(280),
  "changeReason" VARCHAR(240),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "order_item_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "order_item_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "pos_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "order_item_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "order_item_values_valid" CHECK ("quantity" >= 0 AND "sentQuantity" >= 0 AND "unitPrice" >= 0)
);

CREATE INDEX "order_item_orderId_createdAt_idx" ON "order_item"("orderId", "createdAt");
CREATE INDEX "order_item_productId_idx" ON "order_item"("productId");

CREATE TABLE "kitchen_ticket" (
  "id" TEXT NOT NULL,
  "number" BIGSERIAL NOT NULL,
  "operationToken" TEXT NOT NULL,
  "outletId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "orderVersion" INTEGER NOT NULL,
  "kind" "KitchenTicketKind" NOT NULL,
  "status" "KitchenTicketStatus" NOT NULL DEFAULT 'NEW',
  "sentByUserId" TEXT NOT NULL,
  "sentByName" TEXT NOT NULL,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "statusUpdatedByUserId" TEXT,
  "statusUpdatedByName" TEXT,
  "statusUpdatedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "kitchen_ticket_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "kitchen_ticket_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "outlet"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "kitchen_ticket_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "pos_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "kitchen_ticket_version_valid" CHECK ("orderVersion" > 0)
);

CREATE UNIQUE INDEX "kitchen_ticket_number_key" ON "kitchen_ticket"("number");
CREATE UNIQUE INDEX "kitchen_ticket_operationToken_key" ON "kitchen_ticket"("operationToken");
CREATE UNIQUE INDEX "kitchen_ticket_orderId_orderVersion_key" ON "kitchen_ticket"("orderId", "orderVersion");
CREATE INDEX "kitchen_ticket_outletId_status_sentAt_idx" ON "kitchen_ticket"("outletId", "status", "sentAt");
CREATE INDEX "kitchen_ticket_orderId_sentAt_idx" ON "kitchen_ticket"("orderId", "sentAt");

CREATE TABLE "kitchen_ticket_line" (
  "id" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "orderItemId" TEXT,
  "action" "KitchenTicketLineAction" NOT NULL,
  "productName" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "selectionLabel" VARCHAR(280),
  "note" VARCHAR(240),
  "reason" VARCHAR(240),
  CONSTRAINT "kitchen_ticket_line_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "kitchen_ticket_line_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "kitchen_ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "kitchen_ticket_line_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_item"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "kitchen_ticket_line_quantity_valid" CHECK ("quantity" > 0),
  CONSTRAINT "kitchen_ticket_line_remove_reason" CHECK ("action" <> 'REMOVE' OR ("reason" IS NOT NULL AND LENGTH(TRIM("reason")) >= 5))
);

CREATE INDEX "kitchen_ticket_line_ticketId_idx" ON "kitchen_ticket_line"("ticketId");
CREATE INDEX "kitchen_ticket_line_orderItemId_idx" ON "kitchen_ticket_line"("orderItemId");

CREATE TABLE "order_audit_log" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "action" "OrderAuditAction" NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "actorEmail" TEXT NOT NULL,
  "before" JSONB,
  "after" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "order_audit_log_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "order_audit_log_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "pos_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "order_audit_log_orderId_createdAt_idx" ON "order_audit_log"("orderId", "createdAt");
CREATE INDEX "order_audit_log_actorUserId_createdAt_idx" ON "order_audit_log"("actorUserId", "createdAt");

ALTER TABLE "sale" ADD COLUMN "orderId" TEXT;
ALTER TABLE "sale" ADD CONSTRAINT "sale_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "pos_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "sale_orderId_key" ON "sale"("orderId");
