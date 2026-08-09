CREATE TYPE "ReceiptPaperSize" AS ENUM ('MM58', 'MM80');

ALTER TABLE "outlet"
  ADD COLUMN "receiptPaperSize" "ReceiptPaperSize" NOT NULL DEFAULT 'MM80',
  ADD COLUMN "receiptFooter" VARCHAR(160) NOT NULL DEFAULT 'Terima kasih atas kunjungan Anda.';
