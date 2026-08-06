-- CreateEnum
CREATE TYPE "CatalogStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CatalogEntityType" AS ENUM ('CATEGORY', 'PRODUCT');

-- CreateEnum
CREATE TYPE "CatalogAuditAction" AS ENUM ('CREATE', 'UPDATE', 'PRICE_CHANGE', 'ARCHIVE', 'RESTORE', 'REORDER');

-- CreateTable
CREATE TABLE "category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "description" VARCHAR(240),
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "CatalogStatus" NOT NULL DEFAULT 'ACTIVE',
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "sku" TEXT,
    "description" VARCHAR(280),
    "basePrice" DECIMAL(12,2) NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "CatalogStatus" NOT NULL DEFAULT 'ACTIVE',
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_audit_log" (
    "id" TEXT NOT NULL,
    "entityType" "CatalogEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" "CatalogAuditAction" NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "actorEmail" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "catalog_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "category_normalizedName_key" ON "category"("normalizedName");

-- CreateIndex
CREATE INDEX "category_status_displayOrder_idx" ON "category"("status", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "product_sku_key" ON "product"("sku");

-- CreateIndex
CREATE INDEX "product_categoryId_status_displayOrder_idx" ON "product"("categoryId", "status", "displayOrder");

-- CreateIndex
CREATE INDEX "product_status_updatedAt_idx" ON "product"("status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "product_categoryId_normalizedName_key" ON "product"("categoryId", "normalizedName");

-- CreateIndex
CREATE INDEX "catalog_audit_log_entityType_entityId_createdAt_idx" ON "catalog_audit_log"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "catalog_audit_log_actorUserId_createdAt_idx" ON "catalog_audit_log"("actorUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "product" ADD CONSTRAINT "product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
