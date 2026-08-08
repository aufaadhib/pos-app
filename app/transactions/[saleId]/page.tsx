import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, ReceiptText } from "lucide-react";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { requirePermission } from "@/lib/auth/session";
import { formatRupiah } from "@/lib/catalog/normalization";
import { requireActiveOutlet } from "@/lib/outlets/context";
import { getSaleDetail } from "@/lib/pos/queries";
import { deliveryProviderLabels } from "@/lib/delivery/types";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Detail Transaksi" };

const paymentLabels = { CASH: "Tunai", QRIS: "QRIS", DEBIT_CARD: "Kartu debit", CREDIT_CARD: "Kartu kredit", BANK_TRANSFER: "Transfer bank", DELIVERY_PLATFORM: "Dibayar melalui platform" } as const;

/** Renders one immutable receipt after rechecking permission and active-outlet scope. */
export default async function SaleDetailPage({ params }: { params: Promise<{ saleId: string }> }) {
  const [session, route] = await Promise.all([requirePermission({ pos: ["operate"] }), params]);
  const outlet = await requireActiveOutlet(session);
  const sale = await getSaleDetail(route.saleId, outlet.id);
  if (!sale) notFound();
  const completedAt = new Intl.DateTimeFormat("id-ID", { timeZone: outlet.timezone, dateStyle: "long", timeStyle: "short" }).format(new Date(sale.completedAt));
  return <main className="mx-auto max-w-3xl px-4 py-6 sm:px-8 sm:py-8" id="main-content">
    <Link className={cn(buttonVariants({ variant: "ghost" }), "mb-4 -ml-3")} href="/transactions"><ArrowLeft />Kembali ke transaksi</Link>
    <article className="overflow-hidden rounded-2xl border border-t-4 border-t-primary bg-card">
      <header className="border-b p-5 text-center sm:p-7"><span className="mx-auto grid size-12 place-items-center rounded-full bg-success/10 text-success"><CheckCircle2 aria-hidden="true" className="size-6" /></span><p className="mt-3 text-sm font-medium text-muted-foreground">Pembayaran berhasil</p><h1 className="mt-1 font-mono text-xl font-semibold sm:text-2xl">{sale.receiptNumber}</h1><p className="mt-2 text-sm text-muted-foreground">{completedAt}</p><div className="mt-3 flex flex-wrap justify-center gap-2"><Badge variant="secondary">{sale.deliveryProvider ? `Delivery · ${deliveryProviderLabels[sale.deliveryProvider]}` : sale.orderType === "DINE_IN" ? `Dine-in · Meja ${sale.tableLabel}` : "Takeaway"}</Badge><Badge variant="outline">{paymentLabels[sale.paymentMethod]}</Badge>{sale.deliveryProvider && <Badge variant={sale.settlementStatus === "SETTLED" ? "secondary" : "outline"}>{sale.settlementStatus === "SETTLED" ? "Settlement cair" : "Settlement pending"}</Badge>}</div>{sale.externalOrderId && <p className="mt-3 font-mono text-sm">Order {sale.externalOrderId}</p>}</header>
      <section aria-labelledby="receipt-items" className="p-5 sm:p-7"><div className="mb-4 flex items-center justify-between"><h2 className="font-heading text-lg font-semibold" id="receipt-items">Rincian pesanan</h2><span className="text-xs text-muted-foreground">{sale.itemCount} baris</span></div><div className="grid gap-4">{sale.items.map((item) => <div className="border-b pb-4 last:border-0 last:pb-0" key={item.id}><div className="flex items-start justify-between gap-4"><div><h3 className="font-semibold">{item.quantity}× {item.productName}</h3>{item.sku && <p className="mt-0.5 font-mono text-xs text-muted-foreground">{item.sku}</p>}<div className="mt-1 text-xs leading-5 text-muted-foreground">{item.variants.map((value) => <p key={`${value.groupName}:${value.optionName}`}>{value.groupName}: {value.optionName}</p>)}{item.modifiers.map((value) => <p key={`${value.groupName}:${value.optionName}`}>{value.groupName}: {value.optionName}</p>)}{item.note && <p className="italic">Catatan: {item.note}</p>}</div></div><div className="text-right"><p className="font-mono font-semibold">{formatRupiah(item.lineTotal)}</p><p className="mt-0.5 text-xs text-muted-foreground">{formatRupiah(item.unitPrice)} / item</p></div></div></div>)}</div></section>
      <section aria-label="Ringkasan pembayaran" className="border-t bg-muted/25 p-5 sm:p-7"><dl className="grid gap-2 text-sm"><div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd className="font-mono">{formatRupiah(sale.subtotal)}</dd></div><div className="flex justify-between"><dt className="text-muted-foreground">Layanan ({formatRate(sale.serviceChargeRate)})</dt><dd className="font-mono">{formatRupiah(sale.serviceChargeAmount)}</dd></div><div className="flex justify-between"><dt className="text-muted-foreground">Pajak ({formatRate(sale.taxRate)}){sale.pricesIncludeTax ? " · termasuk" : ""}</dt><dd className="font-mono">{formatRupiah(sale.taxAmount)}</dd></div><div className="mt-2 flex justify-between border-t pt-4 text-lg font-semibold"><dt>Total</dt><dd className="font-mono text-primary">{formatRupiah(sale.total)}</dd></div>{sale.tenderedAmount && <><div className="flex justify-between"><dt className="text-muted-foreground">Uang diterima</dt><dd className="font-mono">{formatRupiah(sale.tenderedAmount)}</dd></div><div className="flex justify-between"><dt className="text-muted-foreground">Kembalian</dt><dd className="font-mono">{formatRupiah(sale.changeAmount ?? "0.00")}</dd></div></>}{sale.deliveryProvider && <><div className="mt-2 flex justify-between border-t pt-3"><dt className="text-muted-foreground">Estimasi fee</dt><dd className="font-mono">{formatRupiah(sale.expectedFeeAmount ?? "0.00")}</dd></div><div className="flex justify-between"><dt className="text-muted-foreground">Estimasi net</dt><dd className="font-mono">{formatRupiah(sale.expectedNetAmount ?? "0.00")}</dd></div><div className="flex justify-between"><dt className="text-muted-foreground">Pembanding penjualan langsung</dt><dd className="font-mono">{formatRupiah(sale.directEquivalentAmount ?? "0.00")}</dd></div>{sale.settlementReference && <><div className="mt-2 flex justify-between border-t pt-3"><dt className="text-muted-foreground">Referensi settlement</dt><dd className="break-all text-right font-mono">{sale.settlementReference}</dd></div><div className="flex justify-between"><dt className="text-muted-foreground">Dana diterima</dt><dd>{new Intl.DateTimeFormat("id-ID", { timeZone: outlet.timezone, dateStyle: "medium", timeStyle: "short" }).format(new Date(sale.settledAt!))}</dd></div></>}</>}{sale.paymentReference && !sale.deliveryProvider && <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Referensi</dt><dd className="break-all text-right font-mono">{sale.paymentReference}</dd></div>}</dl></section>
      <footer className="flex items-center gap-3 border-t p-5 text-xs text-muted-foreground sm:px-7"><ReceiptText aria-hidden="true" className="size-4 shrink-0" /><span>{sale.outletName} · {sale.outletCode} · dilayani {sale.createdByName}</span></footer>
    </article>
  </main>;
}

/** Formats a persisted decimal rate as an Indonesian percentage. */
function formatRate(value: string): string {
  return `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(Number(value))}%`;
}
