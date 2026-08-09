import { CheckCircle2, ReceiptText } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ReceiptPaperSizeValue } from "@/lib/printers/types";

export type ReceiptRendererData = {
  receiptNumber: string;
  completedAt: string;
  orderType: "DINE_IN" | "TAKEAWAY" | "DELIVERY";
  tableLabel: string;
  deliveryLabel: string | null;
  externalOrderId: string | null;
  paymentMethod: "CASH" | "QRIS" | "DEBIT_CARD" | "CREDIT_CARD" | "BANK_TRANSFER" | "DELIVERY_PLATFORM";
  paymentReference: string;
  tenderedMinor: bigint | null;
  changeMinor: bigint | null;
  expectedSettlementAt: string | null;
  items: Array<{
    id: string;
    productName: string;
    quantity: number;
    note: string;
    selectionLabel: string;
    unitMinor: bigint;
  }>;
  totals: {
    subtotal: bigint;
    service: bigint;
    tax: bigint;
    includedTax: boolean;
    total: bigint;
  };
};

const paymentLabels: Record<ReceiptRendererData["paymentMethod"], string> = {
  CASH: "Tunai",
  QRIS: "QRIS",
  DEBIT_CARD: "Kartu debit",
  CREDIT_CARD: "Kartu kredit",
  BANK_TRANSFER: "Transfer bank",
  DELIVERY_PLATFORM: "Dibayar melalui platform",
};

/** Renders the shared customer receipt used by checkout, settings preview, and browser print. */
export function ReceiptRenderer({
  className,
  data,
  outlet,
}: {
  className?: string;
  data: ReceiptRendererData;
  outlet: {
    name: string;
    code: string;
    timezone: string;
    receiptPaperSize: ReceiptPaperSizeValue;
    receiptFooter: string;
  };
}) {
  const completedAt = formatReceiptDate(data.completedAt, outlet.timezone);
  const itemCount = data.items.reduce((sum, item) => sum + item.quantity, 0);

  return <article
    aria-label={`Struk transaksi ${data.receiptNumber}`}
    className={cn(
      "thermal-receipt mx-auto w-full bg-card text-sm",
      outlet.receiptPaperSize === "MM58" ? "receipt-paper-mm58 max-w-[17rem]" : "receipt-paper-mm80 max-w-[22.5rem]",
      className,
    )}
    data-paper-size={outlet.receiptPaperSize}
  >
    <header className="border-b border-dashed pb-4 text-center">
      <CheckCircle2 aria-hidden="true" className="mx-auto size-9 text-success print:hidden" />
      <p className="mt-2 font-heading text-lg font-semibold">{outlet.name}</p>
      <p className="font-mono text-xs text-muted-foreground">{outlet.code}</p>
      <p className="mt-3 text-xs font-semibold uppercase tracking-wider">Pembayaran berhasil</p>
      <h2 className="mt-1 font-mono text-base font-semibold">{data.receiptNumber}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{completedAt}</p>
    </header>

    <section aria-label="Informasi pesanan" className="grid gap-1 border-b border-dashed py-3 text-xs">
      <div className="flex justify-between gap-3"><span>Pesanan</span><span className="text-right font-semibold">{data.orderType === "DINE_IN" ? `Dine-in · Meja ${data.tableLabel}` : data.orderType === "DELIVERY" ? `Delivery · ${data.deliveryLabel}` : "Takeaway"}</span></div>
      {data.externalOrderId && <div className="flex justify-between gap-3"><span>Nomor order</span><span className="break-all text-right font-mono font-semibold">{data.externalOrderId}</span></div>}
      <div className="flex justify-between gap-3"><span>Pembayaran</span><span className="font-semibold">{paymentLabels[data.paymentMethod]}</span></div>
      <div className="flex justify-between gap-3"><span>Jumlah</span><span>{itemCount} item</span></div>
    </section>

    <section aria-label="Rincian pesanan" className="grid gap-3 border-b border-dashed py-3">
      {data.items.map((item) => <div key={item.id}>
        <div className="flex items-start justify-between gap-3"><span className="font-semibold">{item.quantity}× {item.productName}</span><span className="shrink-0 font-mono">{formatReceiptMinor(item.unitMinor * BigInt(item.quantity))}</span></div>
        <p className="font-mono text-[0.68rem] text-muted-foreground">{formatReceiptMinor(item.unitMinor)} / item</p>
        {item.selectionLabel && <p className="text-xs text-muted-foreground">{item.selectionLabel}</p>}
        {item.note && <p className="text-xs italic text-muted-foreground">Catatan: {item.note}</p>}
      </div>)}
    </section>

    <section aria-label="Ringkasan pembayaran" className="py-3">
      <dl className="grid gap-1.5 text-xs">
        <div className="flex justify-between"><dt>Subtotal</dt><dd className="font-mono">{formatReceiptMinor(data.totals.subtotal)}</dd></div>
        <div className="flex justify-between"><dt>Layanan</dt><dd className="font-mono">{formatReceiptMinor(data.totals.service)}</dd></div>
        <div className="flex justify-between"><dt>Pajak {data.totals.includedTax ? "(termasuk)" : ""}</dt><dd className="font-mono">{formatReceiptMinor(data.totals.tax)}</dd></div>
        <div className="mt-1 flex justify-between border-t pt-2 text-base font-semibold"><dt>Total</dt><dd className="font-mono">{formatReceiptMinor(data.totals.total)}</dd></div>
        {data.tenderedMinor !== null && <div className="flex justify-between"><dt>Uang diterima</dt><dd className="font-mono">{formatReceiptMinor(data.tenderedMinor)}</dd></div>}
        {data.changeMinor !== null && <div className="flex justify-between"><dt>Kembalian</dt><dd className="font-mono">{formatReceiptMinor(data.changeMinor)}</dd></div>}
        {data.paymentReference && <div className="flex justify-between gap-3"><dt>Referensi</dt><dd className="break-all text-right font-mono">{data.paymentReference}</dd></div>}
      </dl>
    </section>

    {data.expectedSettlementAt && <section className="mb-3 rounded-lg border border-dashed p-3 text-xs"><p className="font-semibold">Menunggu settlement platform</p><p className="mt-1 text-muted-foreground">Estimasi sebelum {formatReceiptDate(data.expectedSettlementAt, outlet.timezone)}</p></section>}

    {outlet.receiptFooter && <footer className="border-t border-dashed pt-3 text-center text-xs text-muted-foreground"><ReceiptText aria-hidden="true" className="mx-auto mb-2 size-4 print:hidden" /><p className="whitespace-pre-wrap break-words">{outlet.receiptFooter}</p></footer>}
  </article>;
}

/** Formats integer minor units as Indonesian Rupiah for receipt display. */
export function formatReceiptMinor(value: bigint): string {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: value % 100n === 0n ? 0 : 2 }).format(Number(value) / 100);
}

/** Formats one UTC receipt timestamp in the outlet timezone. */
function formatReceiptDate(value: string, timeZone: string): string {
  return new Intl.DateTimeFormat("id-ID", { timeZone, dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
