-- AlterEnum
ALTER TYPE "CatalogEntityType" ADD VALUE 'VARIANT_GROUP';
ALTER TYPE "CatalogEntityType" ADD VALUE 'VARIANT_OPTION';
ALTER TYPE "CatalogEntityType" ADD VALUE 'MODIFIER_GROUP';
ALTER TYPE "CatalogEntityType" ADD VALUE 'MODIFIER_OPTION';
ALTER TYPE "CatalogEntityType" ADD VALUE 'PRODUCT_MODIFIER';
ALTER TYPE "CatalogEntityType" ADD VALUE 'OUTLET_PRODUCT';
ALTER TYPE "CatalogEntityType" ADD VALUE 'OUTLET_VARIANT_OPTION';

-- AlterEnum
ALTER TYPE "CatalogAuditAction" ADD VALUE 'AVAILABILITY_CHANGE';
ALTER TYPE "CatalogAuditAction" ADD VALUE 'ASSIGN';
ALTER TYPE "CatalogAuditAction" ADD VALUE 'UNASSIGN';

-- AlterTable
ALTER TABLE "outlet"
ADD COLUMN "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN "serviceChargeRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN "pricesIncludeTax" BOOLEAN NOT NULL DEFAULT false,
ADD CONSTRAINT "outlet_taxRate_check" CHECK ("taxRate" >= 0 AND "taxRate" <= 100),
ADD CONSTRAINT "outlet_serviceChargeRate_check" CHECK ("serviceChargeRate" >= 0 AND "serviceChargeRate" <= 100);

-- CreateTable
CREATE TABLE "product_variant_group" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "CatalogStatus" NOT NULL DEFAULT 'ACTIVE',
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "product_variant_group_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "product_variant_option" (
    "id" TEXT NOT NULL,
    "variantGroupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "priceAdjustment" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "CatalogStatus" NOT NULL DEFAULT 'ACTIVE',
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "product_variant_option_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "product_variant_option_price_check" CHECK ("priceAdjustment" >= 0)
);

CREATE TABLE "modifier_group" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "description" VARCHAR(240),
    "status" "CatalogStatus" NOT NULL DEFAULT 'ACTIVE',
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "modifier_group_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "modifier_option" (
    "id" TEXT NOT NULL,
    "modifierGroupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "priceAdjustment" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "CatalogStatus" NOT NULL DEFAULT 'ACTIVE',
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "modifier_option_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "modifier_option_price_check" CHECK ("priceAdjustment" >= 0)
);

CREATE TABLE "product_modifier_group" (
    "productId" TEXT NOT NULL,
    "modifierGroupId" TEXT NOT NULL,
    "minSelections" INTEGER NOT NULL DEFAULT 0,
    "maxSelections" INTEGER NOT NULL DEFAULT 1,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "CatalogStatus" NOT NULL DEFAULT 'ACTIVE',
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "product_modifier_group_pkey" PRIMARY KEY ("productId", "modifierGroupId"),
    CONSTRAINT "product_modifier_group_selection_check" CHECK ("minSelections" >= 0 AND "maxSelections" >= 1 AND "minSelections" <= "maxSelections")
);

CREATE TABLE "outlet_product_override" (
    "outletId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "priceOverride" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "outlet_product_override_pkey" PRIMARY KEY ("outletId", "productId"),
    CONSTRAINT "outlet_product_override_price_check" CHECK ("priceOverride" IS NULL OR "priceOverride" >= 0)
);

CREATE TABLE "outlet_variant_option_override" (
    "outletId" TEXT NOT NULL,
    "variantOptionId" TEXT NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "priceAdjustmentOverride" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "outlet_variant_option_override_pkey" PRIMARY KEY ("outletId", "variantOptionId"),
    CONSTRAINT "outlet_variant_option_override_price_check" CHECK ("priceAdjustmentOverride" IS NULL OR "priceAdjustmentOverride" >= 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "product_variant_group_productId_normalizedName_key" ON "product_variant_group"("productId", "normalizedName");
CREATE INDEX "product_variant_group_productId_status_displayOrder_idx" ON "product_variant_group"("productId", "status", "displayOrder");
CREATE UNIQUE INDEX "product_variant_option_variantGroupId_normalizedName_key" ON "product_variant_option"("variantGroupId", "normalizedName");
CREATE INDEX "product_variant_option_variantGroupId_status_displayOrder_idx" ON "product_variant_option"("variantGroupId", "status", "displayOrder");
CREATE UNIQUE INDEX "modifier_group_normalizedName_key" ON "modifier_group"("normalizedName");
CREATE INDEX "modifier_group_status_name_idx" ON "modifier_group"("status", "name");
CREATE UNIQUE INDEX "modifier_option_modifierGroupId_normalizedName_key" ON "modifier_option"("modifierGroupId", "normalizedName");
CREATE INDEX "modifier_option_modifierGroupId_status_displayOrder_idx" ON "modifier_option"("modifierGroupId", "status", "displayOrder");
CREATE INDEX "product_modifier_group_productId_status_displayOrder_idx" ON "product_modifier_group"("productId", "status", "displayOrder");
CREATE INDEX "product_modifier_group_modifierGroupId_status_idx" ON "product_modifier_group"("modifierGroupId", "status");
CREATE INDEX "outlet_product_override_productId_outletId_idx" ON "outlet_product_override"("productId", "outletId");
CREATE INDEX "outlet_variant_option_override_variantOptionId_outletId_idx" ON "outlet_variant_option_override"("variantOptionId", "outletId");

-- AddForeignKey
ALTER TABLE "product_variant_group" ADD CONSTRAINT "product_variant_group_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "product_variant_option" ADD CONSTRAINT "product_variant_option_variantGroupId_fkey" FOREIGN KEY ("variantGroupId") REFERENCES "product_variant_group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "modifier_option" ADD CONSTRAINT "modifier_option_modifierGroupId_fkey" FOREIGN KEY ("modifierGroupId") REFERENCES "modifier_group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "product_modifier_group" ADD CONSTRAINT "product_modifier_group_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "product_modifier_group" ADD CONSTRAINT "product_modifier_group_modifierGroupId_fkey" FOREIGN KEY ("modifierGroupId") REFERENCES "modifier_group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "outlet_product_override" ADD CONSTRAINT "outlet_product_override_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "outlet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "outlet_product_override" ADD CONSTRAINT "outlet_product_override_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "outlet_variant_option_override" ADD CONSTRAINT "outlet_variant_option_override_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "outlet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "outlet_variant_option_override" ADD CONSTRAINT "outlet_variant_option_override_variantOptionId_fkey" FOREIGN KEY ("variantOptionId") REFERENCES "product_variant_option"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
