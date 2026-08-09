import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, CircleX, ReceiptText, RotateCcw } from "lucide-react";
import { notFound } from "next/navigation";

import { TransactionCorrectionControls } from "@/components/pos/transaction-correction-controls";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { isAppRole, roleHasPermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { formatRupiah } from "@/lib/currency";
import { deliveryProviderLabels } from "@/lib/delivery/types";
import { requireActiveOutlet } from "@/lib/outlets/context";
import { getSaleDetail } from "@/lib/pos/queries";
import type { SaleDetail } from "@/lib/pos/types";
import { getOutletBusinessDate } from "@/lib/time/business-date";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Detail Transaksi" };

const paymentLabels = { CASH: "Tunai", QRIS: "QRIS", DEBIT_CARD: "Kartu debit", CREDIT_CARD: "Kartu kredit", BANK_TRANSFER: "Transfer bank", DELIVERY_PLATFORM: "Dibayar melalui platform" } as const;

/** Renders one immutable receipt, its correction ledger, and authorized correction controls. */
export default async function SaleDetailPage({ params }: { params: Promise<{ saleId: string }> }) {
  const [session, route] = await Promise.all([requirePermission({ pos: ["operate"] }), params]);
  const outlet = await requireActiveOutlet(session);
  const sale = await getSaleDetail(route.saleId, outlet.id);
  if (!sale || !isAppRole(session.user.role)) notFound();
  const completedAt = formatDateTime(sale.completedAt, outlet.timezone, true);
  const canCorrect = roleHasPermission(session.user.role, { transaction: ["correct"] });
  const canVoid = sale.status === "COMPLETED" && sale.businessDate === getOutletBusinessDate(outlet.timezone).value;

  return <main className="mx-auto max-w-3xl px-4 py-6 sm:px-8 sm:py-8" id="main-content">
    <Link className={cn(buttonVariants({ variant: "ghost" }), "mb-4 -ml-3")} href="/transactions"><ArrowLeft />Kembali ke transaksi</Link>
    <article className="min-w-0 overflow-hidden rounded-2xl border border-t-4 border-t-primary bg-card">
      <header className="border-b p-5 text-center sm:p-7">
        <StatusIcon status={sale.status} />
        <p className="mt-3 text-sm font-medium text-muted-foreground">{statusHeading(sale.status)}</p>
        <h1 className="mt-1 break-all font-mono text-xl font-semibold sm:text-2xl">{sale.receiptNumber}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{completedAt}</p>
        <div className="mt-3 flex flex-wrap justify-center gap-2"><StatusBadge status={sale.status} /><Badge variant="secondary">{sale.deliveryProvider ? `Delivery · ${deliveryProviderLabels[sale.deliveryProvider]}` : sale.orderType === "DINE_IN" ? `Dine-in · Meja ${sale.tableLabel}` : "Takeaway"}</Badge><Badge variant="outline">{paymentLabels[sale.paymentMethod]}</Badge>{sale.deliveryProvider && <Badge variant={sale.settlementStatus === "SETTLED" ? "secondary" : "outline"}>{sale.settlementStatus === "SETTLED" ? "Settlement cair" : "Settlement pending"}</Badge>}</div>
        {sale.externalOrderId && <p className="mt-3 break-all font-mono text-sm">Order {sale.externalOrderId}</p>}
      </header>
      <section aria-labelledby="receipt-items" className="p-5 sm:p-7"><div className="mb-4 flex items-center justify-between"><h2 className="font-heading text-lg font-semibold" id="receipt-items">Rincian pesanan</h2><span className="text-xs text-muted-foreground">{sale.itemCount} item</span></div><div className="grid gap-4">{sale.items.map((item) => <div className="min-w-0 border-b pb-4 last:border-0 last:pb-0" key={item.id}><div className="flex min-w-0 items-start justify-between gap-4"><div className="min-w-0"><h3 className="font-semibold">{item.quantity}× {item.productName}</h3>{item.refundedQuantity > 0 && <p className="mt-1 text-xs font-medium text-destructive">{item.refundedQuantity} item sudah direfund</p>}{item.sku && <p className="mt-0.5 font-mono text-xs text-muted-foreground">{item.sku}</p>}<div className="mt-1 text-xs leading-5 text-muted-foreground">{item.variants.map((value) => <p key={`${value.groupName}:${value.optionName}`}>{value.groupName}: {value.optionName}</p>)}{item.modifiers.map((value) => <p key={`${value.groupName}:${value.optionName}`}>{value.groupName}: {value.optionName}</p>)}{item.note && <p className="italic">Catatan: {item.note}</p>}</div></div><div className="shrink-0 text-right"><p className="font-mono font-semibold">{formatRupiah(item.lineTotal)}</p><p className="mt-0.5 text-xs text-muted-foreground">{formatRupiah(item.unitPrice)} / item</p></div></div></div>)}</div></section>
      <section aria-label="Ringkasan pembayaran" className="border-t bg-muted/25 p-5 sm:p-7"><dl className="grid gap-2 text-sm"><div className="flex justify-between gap-4"><dt className="text-muted-foreground">Subtotal</dt><dd className="font-mono">{formatRupiah(sale.subtotal)}</dd></div><div className="flex justify-between gap-4"><dt className="text-muted-foreground">Layanan ({formatRate(sale.serviceChargeRate)})</dt><dd className="font-mono">{formatRupiah(sale.serviceChargeAmount)}</dd></div><div className="flex justify-between gap-4"><dt className="text-muted-foreground">Pajak ({formatRate(sale.taxRate)}){sale.pricesIncludeTax ? " · termasuk" : ""}</dt><dd className="font-mono">{formatRupiah(sale.taxAmount)}</dd></div><div className="mt-2 flex justify-between gap-4 border-t pt-4 text-lg font-semibold"><dt>Total asli</dt><dd className="font-mono text-primary">{formatRupiah(sale.total)}</dd></div>{Number(sale.refundedAmount) > 0 && <><div className="flex justify-between gap-4"><dt className="text-muted-foreground">Dikembalikan</dt><dd className="font-mono text-destructive">−{formatRupiah(sale.refundedAmount)}</dd></div><div className="flex justify-between gap-4 font-semibold"><dt>Nilai tersisa</dt><dd className="font-mono">{formatRupiah(sale.remainingAmount)}</dd></div></>}{sale.tenderedAmount && <><div className="flex justify-between gap-4"><dt className="text-muted-foreground">Uang diterima</dt><dd className="font-mono">{formatRupiah(sale.tenderedAmount)}</dd></div><div className="flex justify-between gap-4"><dt className="text-muted-foreground">Kembalian</dt><dd className="font-mono">{formatRupiah(sale.changeAmount ?? "0.00")}</dd></div></>}{sale.deliveryProvider && <><div className="mt-2 flex justify-between gap-4 border-t pt-3"><dt className="text-muted-foreground">Estimasi fee</dt><dd className="font-mono">{formatRupiah(sale.expectedFeeAmount ?? "0.00")}</dd></div><div className="flex justify-between gap-4"><dt className="text-muted-foreground">Estimasi net</dt><dd className="font-mono">{formatRupiah(sale.expectedNetAmount ?? "0.00")}</dd></div><div className="flex justify-between gap-4"><dt className="text-muted-foreground">Pembanding penjualan langsung</dt><dd className="font-mono">{formatRupiah(sale.directEquivalentAmount ?? "0.00")}</dd></div>{sale.settlementReference && <><div className="mt-2 flex justify-between gap-4 border-t pt-3"><dt className="text-muted-foreground">Referensi settlement</dt><dd className="min-w-0 break-all text-right font-mono">{sale.settlementReference}</dd></div><div className="flex justify-between gap-4"><dt className="text-muted-foreground">Dana diterima</dt><dd className="text-right">{formatDateTime(sale.settledAt!, outlet.timezone)}</dd></div></>}</>}{sale.paymentReference && !sale.deliveryProvider && <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Referensi</dt><dd className="min-w-0 break-all text-right font-mono">{sale.paymentReference}</dd></div>}</dl></section>
      {sale.refunds.length > 0 && <section aria-labelledby="refund-history" className="border-t p-5 sm:p-7"><h2 className="font-heading text-lg font-semibold" id="refund-history">Riwayat koreksi</h2><ol className="mt-4 grid gap-3">{sale.refunds.map((refund) => <li className="min-w-0 rounded-xl border p-4" key={refund.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><Badge variant="destructive">{refund.type === "VOID" ? "Void" : "Refund"}</Badge><p className="mt-2 text-sm font-medium">{refund.reason}</p><p className="mt-1 text-xs text-muted-foreground">{refund.actorName} · {formatDateTime(refund.createdAt, outlet.timezone)}</p></div><strong className="font-mono text-destructive">−{formatRupiah(refund.amount)}</strong></div><div className="mt-3 grid gap-1 border-t pt-3 text-xs text-muted-foreground">{refund.items.map((item) => <p className="flex justify-between gap-3" key={item.saleItemId}><span className="min-w-0 truncate">{item.quantity}× {item.productName}</span><span className="shrink-0 font-mono">{formatRupiah(item.lineAmount)}</span></p>)}</div>{refund.providerReference && <p className="mt-3 break-all text-xs text-muted-foreground">Referensi: <span className="font-mono text-foreground">{refund.providerReference}</span></p>}{refund.cashShiftId && <Link className="mt-3 inline-block text-xs font-semibold underline underline-offset-4" href={`/shifts/${refund.cashShiftId}`}>Lihat shift refund</Link>}</li>)}</ol></section>}
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t p-5 text-xs text-muted-foreground sm:px-7"><span className="flex min-w-0 items-center gap-3"><ReceiptText aria-hidden="true" className="size-4 shrink-0" /><span>{sale.outletName} · {sale.outletCode} · dilayani {sale.createdByName}</span></span>{sale.shiftId ? <Link className="font-semibold text-foreground underline underline-offset-4" href={`/shifts/${sale.shiftId}`}>Lihat shift asal</Link> : <Badge variant="outline">Transaksi lama tanpa shift</Badge>}</footer>
    </article>
    {canCorrect && <TransactionCorrectionControls canVoid={canVoid} outletId={outlet.id} sale={sale} />}
  </main>;
}

/** Shows the primary transaction state icon using the existing Lucide icon family. */
function StatusIcon({ status }: { status: SaleDetail["status"] }) {
  const className = cn("mx-auto grid size-12 place-items-center rounded-full", status === "COMPLETED" ? "bg-success/10 text-success" : status === "VOIDED" ? "bg-destructive/10 text-destructive" : "bg-secondary text-secondary-foreground");
  return <span className={className}>{status === "COMPLETED" ? <CheckCircle2 aria-hidden="true" className="size-6" /> : status === "VOIDED" ? <CircleX aria-hidden="true" className="size-6" /> : <RotateCcw aria-hidden="true" className="size-6" />}</span>;
}

/** Returns concise Indonesian copy for the current sale status. */
function statusHeading(status: SaleDetail["status"]) {
  return { COMPLETED: "Pembayaran berhasil", PARTIALLY_REFUNDED: "Sebagian pembayaran dikembalikan", REFUNDED: "Pembayaran dikembalikan penuh", VOIDED: "Transaksi dibatalkan penuh" }[status];
}

/** Labels the current status without relying on color alone. */
function StatusBadge({ status }: { status: SaleDetail["status"] }) {
  const labels = { COMPLETED: "Selesai", PARTIALLY_REFUNDED: "Refund sebagian", REFUNDED: "Direfund", VOIDED: "Divoid" } as const;
  return <Badge variant={status === "COMPLETED" ? "outline" : status === "PARTIALLY_REFUNDED" ? "secondary" : "destructive"}>{labels[status]}</Badge>;
}

/** Formats a persisted decimal rate as an Indonesian percentage. */
function formatRate(value: string): string {
  return `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(Number(value))}%`;
}

/** Formats one UTC timestamp in the active outlet timezone. */
function formatDateTime(value: string, timezone: string, long = false) {
  return new Intl.DateTimeFormat("id-ID", { timeZone: timezone, dateStyle: long ? "long" : "medium", timeStyle: "short" }).format(new Date(value));
}
