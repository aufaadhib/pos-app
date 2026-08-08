import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ReceiptText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { requirePermission } from "@/lib/auth/session";
import { formatRupiah } from "@/lib/catalog/normalization";
import { requireActiveOutlet } from "@/lib/outlets/context";
import { getSalesPage } from "@/lib/pos/queries";
import { deliveryProviderLabels } from "@/lib/delivery/types";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Transaksi", description: "Riwayat transaksi outlet aktif." };

/** Renders a paginated, outlet-scoped transaction history for all POS operators. */
export default async function TransactionsPage({ searchParams }: { searchParams: Promise<{ page?: string; source?: string; settlement?: string }> }) {
  const [session, query] = await Promise.all([requirePermission({ pos: ["operate"] }), searchParams]);
  const outlet = await requireActiveOutlet(session);
  const page = Number.isSafeInteger(Number(query.page)) ? Math.max(1, Number(query.page)) : 1;
  const source = (["DIRECT", "GOFOOD", "GRABFOOD", "SHOPEEFOOD"] as const).find((value) => value === query.source);
  const settlementStatus = (["PENDING", "SETTLED"] as const).find((value) => value === query.settlement);
  const sales = await getSalesPage(outlet.id, page, { source, settlementStatus });
  return <main className="mx-auto max-w-7xl px-4 py-6 sm:px-8 sm:py-8 lg:px-10" id="main-content">
    <section className="rounded-2xl border bg-card p-5 sm:flex sm:items-end sm:justify-between sm:p-6"><div><p className="text-sm font-medium text-muted-foreground">Outlet · {outlet.code}</p><h1 className="mt-1 font-heading text-2xl font-semibold sm:text-3xl">Riwayat transaksi</h1><p className="mt-2 text-sm text-muted-foreground">Struk yang sudah dibayar di {outlet.name}.</p></div><Link className={cn(buttonVariants(), "mt-4 sm:mt-0")} href="/pos">Buka kasir</Link></section>
    <form className="mt-4 grid gap-3 rounded-xl border bg-card p-3 sm:grid-cols-[1fr_1fr_auto]" method="get"><SearchableSelect aria-label="Filter sumber pesanan" defaultValue={source ?? "all"} name="source" options={[{ value: "all", label: "Semua sumber" }, { value: "DIRECT", label: "Penjualan langsung" }, { value: "GOFOOD", label: "GoFood" }, { value: "GRABFOOD", label: "GrabFood" }, { value: "SHOPEEFOOD", label: "ShopeeFood" }]} /><SearchableSelect aria-label="Filter status settlement" defaultValue={settlementStatus ?? "all"} name="settlement" options={[{ value: "all", label: "Semua status settlement" }, { value: "PENDING", label: "Settlement pending" }, { value: "SETTLED", label: "Settlement cair" }]} /><Button type="submit">Terapkan filter</Button></form>
    {sales.items.length === 0 ? <div className="mt-6 grid min-h-64 place-items-center rounded-2xl border border-dashed bg-card text-center"><div><ReceiptText aria-hidden="true" className="mx-auto size-8 text-muted-foreground" /><h2 className="mt-3 font-heading text-lg font-semibold">Belum ada transaksi</h2><p className="mt-1 text-sm text-muted-foreground">Transaksi yang berhasil akan muncul di sini.</p></div></div> : <>
      <div className="mt-6 hidden overflow-hidden rounded-xl border bg-card md:block"><Table><TableHeader><TableRow className="bg-muted/40"><TableHead>Nomor struk</TableHead><TableHead>Waktu</TableHead><TableHead>Pesanan</TableHead><TableHead>Pembayaran</TableHead><TableHead>Kasir</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader><TableBody>{sales.items.map((sale) => <TableRow key={sale.id}><TableCell><Link className="font-mono font-semibold text-primary hover:underline" href={`/transactions/${sale.id}`}>{sale.receiptNumber}</Link></TableCell><TableCell>{formatSaleDate(sale.completedAt, outlet.timezone)}</TableCell><TableCell>{orderLabel(sale)} · {sale.itemCount} item</TableCell><TableCell><div className="flex flex-wrap gap-1"><Badge variant="outline">{paymentLabel(sale.paymentMethod)}</Badge>{sale.deliveryProvider && <Badge variant={sale.settlementStatus === "SETTLED" ? "secondary" : "outline"}>{sale.settlementStatus === "SETTLED" ? "Cair" : "Pending"}</Badge>}</div></TableCell><TableCell>{sale.createdByName}</TableCell><TableCell className="text-right font-mono font-semibold">{formatRupiah(sale.total)}</TableCell></TableRow>)}</TableBody></Table></div>
      <div className="mt-6 grid gap-3 md:hidden">{sales.items.map((sale) => <Link className="rounded-xl focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none" href={`/transactions/${sale.id}`} key={sale.id}><Card className="transition-colors hover:ring-primary"><CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle className="font-mono text-primary">{sale.receiptNumber}</CardTitle><p className="mt-1 text-xs text-muted-foreground">{formatSaleDate(sale.completedAt, outlet.timezone)}</p></div><span className="font-mono font-semibold">{formatRupiah(sale.total)}</span></div></CardHeader><CardContent className="flex flex-wrap gap-2"><Badge variant="secondary">{orderLabel(sale)}</Badge><Badge variant="outline">{paymentLabel(sale.paymentMethod)}</Badge>{sale.deliveryProvider && <Badge variant={sale.settlementStatus === "SETTLED" ? "secondary" : "outline"}>{sale.settlementStatus === "SETTLED" ? "Settlement cair" : "Settlement pending"}</Badge>}<span className="text-xs text-muted-foreground">{sale.itemCount} item · {sale.createdByName}</span></CardContent></Card></Link>)}</div>
    </>}
    <nav aria-label="Paginasi transaksi" className="mt-6 flex items-center justify-between"><Link aria-disabled={sales.page <= 1} className={cn(buttonVariants({ variant: "outline" }), sales.page <= 1 && "pointer-events-none opacity-50")} href={transactionPageHref(sales.page - 1, source, settlementStatus)}><ChevronLeft />Sebelumnya</Link><span className="font-mono text-xs text-muted-foreground">{sales.page} / {sales.totalPages}</span><Link aria-disabled={sales.page >= sales.totalPages} className={cn(buttonVariants({ variant: "outline" }), sales.page >= sales.totalPages && "pointer-events-none opacity-50")} href={transactionPageHref(sales.page + 1, source, settlementStatus)}>Berikutnya<ChevronRight /></Link></nav>
  </main>;
}

/** Formats a UTC sale timestamp in the active outlet timezone. */
function formatSaleDate(value: string, timezone: string): string {
  return new Intl.DateTimeFormat("id-ID", { timeZone: timezone, day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

/** Maps a stored payment enum to concise Indonesian interface copy. */
function paymentLabel(method: "CASH" | "QRIS" | "DEBIT_CARD" | "CREDIT_CARD" | "BANK_TRANSFER" | "DELIVERY_PLATFORM"): string {
  return { CASH: "Tunai", QRIS: "QRIS", DEBIT_CARD: "Debit", CREDIT_CARD: "Kredit", BANK_TRANSFER: "Transfer", DELIVERY_PLATFORM: "Platform" }[method];
}

/** Formats direct and delivery fulfillment consistently across desktop and mobile lists. */
function orderLabel(sale: Awaited<ReturnType<typeof getSalesPage>>["items"][number]): string {
  if (sale.deliveryProvider) return `${deliveryProviderLabels[sale.deliveryProvider]} · ${sale.externalOrderId}`;
  return sale.orderType === "DINE_IN" ? `Dine-in · ${sale.tableLabel}` : "Takeaway";
}

/** Preserves active transaction filters while changing pagination. */
function transactionPageHref(page: number, source?: string, settlement?: string): string {
  const params = new URLSearchParams({ page: String(page) });
  if (source) params.set("source", source);
  if (settlement) params.set("settlement", settlement);
  return `/transactions?${params}`;
}
