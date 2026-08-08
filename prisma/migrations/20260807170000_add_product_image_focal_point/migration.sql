ALTER TABLE "product"
ADD COLUMN "imagePositionX" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN "imagePositionY" INTEGER NOT NULL DEFAULT 50;

ALTER TABLE "product"
ADD CONSTRAINT "product_image_position_x_range" CHECK ("imagePositionX" BETWEEN 0 AND 100),
ADD CONSTRAINT "product_image_position_y_range" CHECK ("imagePositionY" BETWEEN 0 AND 100);
