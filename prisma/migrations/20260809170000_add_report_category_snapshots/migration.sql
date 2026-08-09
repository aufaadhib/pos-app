-- Preserve the sale-time category for future historical product reporting.
-- Existing rows remain NULL because their historical category cannot be reconstructed safely.
ALTER TABLE "sale_item"
ADD COLUMN "categoryId" TEXT,
ADD COLUMN "categoryName" TEXT;
