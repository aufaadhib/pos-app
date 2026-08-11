import { ReceiptRenderer, type ReceiptRendererData } from "@/components/receipt/receipt-renderer";
import type { ReceiptPaperSizeValue } from "@/lib/printers/types";
import { cn } from "@/lib/utils";

/** Renders the full physical paper sheet shared by printer settings and completed POS receipts. */
export function ReceiptPaperSheet({ className, data, outlet }: { className?: string; data: ReceiptRendererData; outlet: { name: string; code: string; timezone: string; receiptPaperSize: ReceiptPaperSizeValue; receiptFooter: string } }) {
  return <div className={cn("receipt-preview-sheet mx-auto w-full overflow-hidden bg-white py-5 shadow-sm ring-1 ring-black/8", outlet.receiptPaperSize === "MM58" ? "max-w-[18rem] px-[5.17%]" : "max-w-[24rem] px-[5%]", className)} data-paper-size={outlet.receiptPaperSize} data-testid="receipt-preview-sheet">
    <ReceiptRenderer className="max-w-none bg-transparent" data={data} outlet={outlet} />
  </div>;
}
