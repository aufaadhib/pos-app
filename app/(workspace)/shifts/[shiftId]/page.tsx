import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownToLine, ArrowLeft, ArrowUpFromLine, ChevronLeft, ChevronRight, EyeOff, ReceiptText } from "lucide-react";
import { notFound } from "next/navigation";

import { CashMovementDialog, CloseShiftDialog, ForceCloseShiftDialog } from "@/components/shifts/shift-controls";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { isAppRole, roleHasPermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { formatRupiah } from "@/lib/currency";
import { requireActiveOutlet } from "@/lib/outlets/context";
import { getCashShiftDetail } from "@/lib/shifts/queries";
import type { ShiftActor } from "@/lib/shifts/types";
import { cashShiftDetailSearchSchema } from "@/lib/shifts/validation";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Rincian Shift" };

type ShiftDetailPageProps = {
  params: Promise<{ shiftId: string }>;
  searchParams: Promise<{ page?: string }>;
};

/** Loads one authorized shift with bounded sales and immutable financial activity. */
export default async function ShiftDetailPage({ params, searchParams }: ShiftDetailPageProps) {
  const [session, route, rawSearch] = await Promise.all([requirePermission({ shift: ["view"] }), params, searchParams]);
  if (!isAppRole(session.user.role)) notFound();
  const outlet = await requireActiveOutlet(session);
  const search = cashShiftDetailSearchSchema.parse(rawSearch);
  const actor: ShiftActor = { id: session.user.id, name: session.user.name, email: session.user.email, role: session.user.role };
  const shift = await getCashShiftDetail({ shiftId: route.shiftId, outletId: outlet.id, actor, salesPage: search.page });
  if (!shift) notFound();
  const canForceClose = roleHasPermission(session.user.role, { shift: ["forceClose"] });

  return <main className="mx-auto max-w-6xl px-4 py-6 pb-28 sm:px-8 sm:py-8 lg:px-10 lg:pb-8" id="main-content">
    <Link className={cn(buttonVariants({ variant: "ghost" }), "mb-4")} href="/shifts"><ArrowLeft aria-hidden="true" />Kembali ke shift</Link>
    <section className="overflow-hidden rounded-2xl border bg-card shadow-sm sm:grid sm:grid-cols-[minmax(0,1fr)_auto]">
      <div className="border-l-4 border-primary p-5 sm:p-7"><div className="flex flex-wrap items-center gap-2"><Badge variant={shift.status === "OPEN" ? "default" : "outline"}>{shift.status === "OPEN" ? "Shift terbuka" : shift.closeMode === "FORCED" ? "Ditutup pengelola" : "Shift ditutup"}</Badge><span className="font-mono text-xs text-muted-foreground">{shift.businessDate}</span></div><h1 className="mt-3 font-heading text-2xl font-semibold">{shift.openedByName}</h1><p className="mt-1 text-sm text-muted-foreground">{shift.openedByEmail} · Dibuka {formatDateTime(shift.openedAt, shift.outletTimezone)}</p>{shift.closedAt && <p className="mt-1 text-sm text-muted-foreground">Ditutup {formatDateTime(shift.closedAt, shift.outletTimezone)} oleh {shift.closedByName}</p>}</div>
      {shift.status === "OPEN" && <div className="flex flex-wrap items-center gap-2 border-t p-5 sm:max-w-sm sm:border-t-0 sm:border-l sm:p-7">{shift.isCurrentUser ? <><CashMovementDialog direction="IN" shift={shift} /><CashMovementDialog direction="OUT" shift={shift} /><CloseShiftDialog shift={shift} /></> : canForceClose ? <ForceCloseShiftDialog shift={shift} /> : null}</div>}
    </section>

    {shift.paymentSummaries === null ? <Alert className="mt-5"><EyeOff aria-hidden="true" /><AlertTitle>Blind count aktif</AlertTitle><AlertDescription>Saldo seharusnya dan ringkasan pembayaran disembunyikan sampai Anda memasukkan kas fisik dan menutup shift.</AlertDescription></Alert> : <>
      <section aria-label="Ringkasan kas" className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><MetricCard label="Saldo awal" value={formatRupiah(shift.openingCash)} /><MetricCard label="Penjualan tunai" value={formatRupiah(shift.cashSales ?? "0")} /><MetricCard label="Refund tunai" value={formatRupiah(shift.cashRefunds ?? "0")} /><MetricCard label="Kas masuk / keluar" value={`${formatRupiah(shift.cashIn ?? "0")} / ${formatRupiah(shift.cashOut ?? "0")}`} /><MetricCard label={shift.status === "CLOSED" ? "Aktual / selisih" : "Kas seharusnya"} value={shift.status === "CLOSED" ? `${formatRupiah(shift.actualCash ?? "0")} / ${formatRupiah(shift.cashDifference ?? "0")}` : "Berjalan"} /></section>
      <section aria-labelledby="payment-heading" className="mt-8"><h2 className="font-heading text-xl font-semibold" id="payment-heading">Pembayaran per metode</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{shift.paymentSummaries.length ? shift.paymentSummaries.map((payment) => <Card className="py-4 shadow-none" key={payment.method}><CardContent className="flex items-center justify-between gap-4 px-4"><div><p className="text-sm font-medium">{paymentLabel(payment.method)}</p><p className="mt-1 text-xs text-muted-foreground">{payment.count} transaksi</p></div><span className="font-mono font-semibold">{formatRupiah(payment.amount)}</span></CardContent></Card>) : <p className="text-sm text-muted-foreground">Belum ada pembayaran pada shift ini.</p>}</div></section>
    </>}

    {shift.closeReason && <Alert className="mt-5" variant="destructive"><AlertTitle>Alasan force-close</AlertTitle><AlertDescription>{shift.closeReason}</AlertDescription></Alert>}

    <section aria-labelledby="movement-heading" className="mt-8"><h2 className="font-heading text-xl font-semibold" id="movement-heading">Pergerakan kas</h2><div className="mt-4 grid gap-3">{shift.movements.length ? shift.movements.map((movement) => <Card className="py-4 shadow-none" key={movement.id}><CardContent className="flex items-start justify-between gap-4 px-4"><div className="flex min-w-0 gap-3"><span className={cn("grid size-10 shrink-0 place-items-center rounded-lg", movement.direction === "IN" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>{movement.direction === "IN" ? <ArrowDownToLine aria-hidden="true" /> : <ArrowUpFromLine aria-hidden="true" />}</span><div><p className="font-semibold">{categoryLabel(movement.category)}</p><p className="mt-1 text-sm text-muted-foreground">{movement.reason}</p><p className="mt-1 text-xs text-muted-foreground">{movement.actorName} · {formatDateTime(movement.createdAt, shift.outletTimezone)}</p></div></div><span className={cn("shrink-0 font-mono font-semibold", movement.direction === "IN" ? "text-success" : "text-destructive")}>{movement.direction === "IN" ? "+" : "−"}{formatRupiah(movement.amount)}</span></CardContent></Card>) : <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">Belum ada movement manual.</div>}</div></section>

    <section aria-labelledby="sales-heading" className="mt-8"><div><h2 className="font-heading text-xl font-semibold" id="sales-heading">Transaksi shift</h2><p className="mt-1 text-sm text-muted-foreground">{shift.salesTotalItems} transaksi terhubung.</p></div><div className="mt-4 grid gap-3">{shift.sales.length ? shift.sales.map((sale) => <Link className="rounded-xl focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none" href={`/transactions/${sale.id}`} key={sale.id}><Card className="py-4 shadow-none transition-colors hover:border-primary"><CardContent className="flex items-center justify-between gap-4 px-4"><div className="flex min-w-0 items-center gap-3"><ReceiptText aria-hidden="true" className="size-5 shrink-0 text-primary" /><div><p className="font-mono font-semibold">{sale.receiptNumber}</p><p className="mt-1 text-xs text-muted-foreground">{paymentLabel(sale.paymentMethod)} · {formatDateTime(sale.completedAt, shift.outletTimezone)}</p></div></div><span className="font-mono font-semibold">{formatRupiah(sale.total)}</span></CardContent></Card></Link>) : <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">Belum ada transaksi pada shift ini.</div>}</div><nav aria-label="Paginasi transaksi shift" className="mt-5 flex items-center justify-between"><Link aria-disabled={shift.salesPage <= 1} className={cn(buttonVariants({ variant: "outline" }), shift.salesPage <= 1 && "pointer-events-none opacity-50")} href={`/shifts/${shift.id}?page=${Math.max(1, shift.salesPage - 1)}`}><ChevronLeft aria-hidden="true" />Sebelumnya</Link><span className="font-mono text-xs text-muted-foreground">{shift.salesPage} / {shift.salesTotalPages}</span><Link aria-disabled={shift.salesPage >= shift.salesTotalPages} className={cn(buttonVariants({ variant: "outline" }), shift.salesPage >= shift.salesTotalPages && "pointer-events-none opacity-50")} href={`/shifts/${shift.id}?page=${shift.salesPage + 1}`}>Berikutnya<ChevronRight aria-hidden="true" /></Link></nav></section>

    <Separator className="my-8" />
    <section aria-labelledby="audit-heading"><h2 className="font-heading text-lg font-semibold" id="audit-heading">Jejak audit</h2><ol className="mt-3 grid gap-2">{shift.audits.map((audit) => <li className="flex flex-col justify-between gap-1 rounded-lg border bg-muted/15 px-3 py-2 text-sm sm:flex-row" key={audit.id}><span>{auditLabel(audit.action)}</span><span className="text-xs text-muted-foreground">{audit.actorEmail} · {formatDateTime(audit.createdAt, shift.outletTimezone)}</span></li>)}</ol></section>
  </main>;
}

/** Renders one compact financial metric with stable dimensions. */
function MetricCard({ label, value }: { label: string; value: string }) { return <Card className="shadow-none"><CardHeader className="pb-2"><CardDescription>{label}</CardDescription><CardTitle className="font-mono text-lg">{value}</CardTitle></CardHeader></Card>; }

/** Returns the Indonesian label for a payment method snapshot. */
function paymentLabel(method: string) { return ({ CASH: "Tunai", QRIS: "QRIS", DEBIT_CARD: "Kartu debit", CREDIT_CARD: "Kartu kredit", BANK_TRANSFER: "Transfer bank", DELIVERY_PLATFORM: "Platform delivery" } as Record<string, string>)[method] ?? method; }

/** Returns the Indonesian label for a fixed cash movement category. */
function categoryLabel(category: string) { return ({ ADDITIONAL_FLOAT: "Tambahan modal", CASH_DROP: "Setor kas", OPERATING_EXPENSE: "Biaya operasional", OTHER: "Lainnya" } as Record<string, string>)[category] ?? category; }

/** Returns a concise Indonesian label for one immutable shift audit action. */
function auditLabel(action: string) { return ({ OPEN: "Shift dibuka", CASH_IN: "Kas masuk dicatat", CASH_OUT: "Kas keluar dicatat", CLOSE: "Shift ditutup", FORCE_CLOSE: "Shift ditutup oleh pengelola" } as Record<string, string>)[action] ?? action; }

/** Formats one decimal string as Indonesian Rupiah. */

/** Formats one ISO timestamp in the shift outlet timezone. */
function formatDateTime(value: string, timezone: string) { return new Intl.DateTimeFormat("id-ID", { timeZone: timezone, dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
