import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  CalendarDays,
  Download,
  FileWarning,
  Landmark,
  ReceiptText,
  RotateCcw,
  Scale,
  TrendingUp,
  WalletCards,
} from "lucide-react";

import { Prisma } from "@/generated/prisma/client";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatRupiah } from "@/lib/catalog/normalization";
import type {
  CorrectionReport,
  DailyReportRow,
  OverviewReport,
  PaymentReportRow,
  ProductReportRow,
  ReportDataset,
  ReportOutlet,
  ReportSelection,
  SettlementReport,
  ShiftReport,
} from "@/lib/reports/types";
import { cn } from "@/lib/utils";

const viewLabels = {
  overview: "Ringkasan",
  products: "Produk",
  payments: "Pembayaran",
  shifts: "Shift",
  corrections: "Refund & void",
  settlements: "Settlement",
} as const;

const paymentLabels: Record<string, string> = {
  CASH: "Tunai",
  QRIS: "QRIS",
  DEBIT_CARD: "Kartu debit",
  CREDIT_CARD: "Kartu kredit",
  BANK_TRANSFER: "Transfer bank",
  DELIVERY_PLATFORM: "Platform delivery",
};

const sourceLabels: Record<string, string> = {
  DINE_IN: "Dine-in",
  TAKEAWAY: "Takeaway",
  DELIVERY: "Delivery",
  GOFOOD: "GoFood",
  GRABFOOD: "GrabFood",
  SHOPEEFOOD: "ShopeeFood",
};

type ReportDashboardProps = {
  dataset: ReportDataset;
  outlets: ReportOutlet[];
  overview: OverviewReport;
  selection: ReportSelection;
  selectedOutlets: ReportOutlet[];
  today: string;
};

/** Renders fresh report filters, ledger metrics, and the selected responsive report view. */
export function ReportDashboard({ dataset, outlets, overview, selection, selectedOutlets, today }: ReportDashboardProps) {
  const outletLabel = selectedOutlets.length === outlets.length && outlets.length > 1
    ? "Semua outlet"
    : selectedOutlets.map((outlet) => outlet.name).join(", ");
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 pb-24 sm:px-8 sm:py-8 lg:px-10" id="main-content">
      <section className="relative overflow-hidden rounded-2xl border bg-card p-5 sm:p-6">
        <div aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-primary" />
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground"><TrendingUp aria-hidden="true" className="size-4 text-primary" />Buku tutup operasional</div>
            <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">Laporan usaha</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Penjualan dan arus operasional berdasarkan transaksi yang benar-benar tercatat. Refund masuk pada tanggal pelaksanaannya.</p>
          </div>
          <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-end gap-x-3 rounded-xl bg-muted/45 px-4 py-3 lg:min-w-72">
            <span className="text-xs font-medium text-muted-foreground">Net sales</span><span className="text-right font-mono text-xl font-semibold tracking-tight">{formatRupiah(overview.summary.netSales)}</span>
            <span className="col-span-2 mt-1 truncate text-right text-xs text-muted-foreground">{outletLabel} · {dateRangeLabel(selection.from, selection.to)}</span>
          </div>
        </div>
      </section>

      <ReportFilters outlets={outlets} selection={selection} today={today} />
      <SummaryGrid overview={overview} />

      <nav aria-label="Jenis laporan" className="mt-5 flex flex-wrap gap-2">
        {Object.entries(viewLabels).map(([view, label]) => (
          <Link
            aria-current={selection.view === view ? "page" : undefined}
            className={cn(buttonVariants({ variant: selection.view === view ? "default" : "outline", size: "sm" }), "h-10 px-3")}
            href={reportHref(selection, { view: view as ReportSelection["view"] })}
            key={view}
          >
            {label}
          </Link>
        ))}
      </nav>

      <section aria-labelledby="report-view-heading" className="mt-4 min-w-0">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Tampilan aktif</p><h2 className="mt-1 font-heading text-xl font-semibold" id="report-view-heading">{viewLabels[dataset.view]}</h2></div>
          <Link className={buttonVariants({ variant: "outline" })} href={exportHref(selection)}><Download aria-hidden="true" />Unduh CSV</Link>
        </div>
        <ReportView dataset={dataset} />
      </section>
    </main>
  );
}

/** Shows one explicit empty state when an authorized actor has no active outlet. */
export function ReportsNoOutlet() {
  return <main className="mx-auto grid min-h-[70svh] max-w-3xl place-items-center px-5 py-10 text-center" id="main-content"><div className="rounded-2xl border border-dashed bg-card p-8"><FileWarning aria-hidden="true" className="mx-auto size-9 text-muted-foreground" /><h1 className="mt-4 font-heading text-2xl font-semibold">Belum ada outlet aktif</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">Aktifkan atau tugaskan outlet sebelum membuka laporan.</p></div></main>;
}

/** Keeps outlet and date filters in the URL so report states remain shareable and exportable. */
function ReportFilters({ outlets, selection, today }: { outlets: ReportOutlet[]; selection: ReportSelection; today: string }) {
  const presets = [
    { label: "Hari ini", from: today, to: today },
    { label: "7 hari", from: subtractDays(today, 6), to: today },
    { label: "30 hari", from: subtractDays(today, 29), to: today },
    { label: "Bulan ini", from: `${today.slice(0, 8)}01`, to: today },
  ];
  return <section aria-label="Filter laporan" className="mt-4 rounded-2xl border bg-card p-3 sm:p-4">
    <div className="mb-3 flex flex-wrap gap-2">{presets.map((preset) => {
      const active = selection.from === preset.from && selection.to === preset.to;
      return <Link aria-current={active ? "date" : undefined} className={cn(buttonVariants({ variant: active ? "secondary" : "ghost", size: "sm" }), "h-9")} href={reportHref(selection, preset)} key={preset.label}>{preset.label}</Link>;
    })}</div>
    <form className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(12rem,1fr)_minmax(10rem,.65fr)_minmax(10rem,.65fr)_auto] lg:items-end" key={`${selection.outletId}:${selection.from}:${selection.to}`} method="get">
      <input name="view" type="hidden" value={selection.view} />
      <label className="grid min-w-0 gap-1.5 text-sm font-medium">Outlet<SearchableSelect defaultValue={selection.outletId} name="outletId" options={[...(outlets.length > 1 ? [{ value: "all", label: "Semua outlet" }] : []), ...outlets.map((outlet) => ({ value: outlet.id, label: `${outlet.code} · ${outlet.name}` }))]} /></label>
      <label className="grid min-w-0 gap-1.5 text-sm font-medium" htmlFor="report-from">Dari tanggal<Input defaultValue={selection.from} id="report-from" max={selection.to} name="from" type="date" /></label>
      <label className="grid min-w-0 gap-1.5 text-sm font-medium" htmlFor="report-to">Sampai tanggal<Input defaultValue={selection.to} id="report-to" max={today} min={selection.from} name="to" type="date" /></label>
      <Button type="submit"><CalendarDays aria-hidden="true" />Terapkan</Button>
    </form>
  </section>;
}

/** Keeps the six most useful indicators readable at compact mobile widths. */
function SummaryGrid({ overview }: { overview: OverviewReport }) {
  const { summary } = overview;
  return <section aria-label="Ringkasan angka utama" className="mt-4 grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-6">
    <MetricCard accent className="col-span-2 lg:col-span-1" icon={TrendingUp} label="Net sales" value={formatRupiah(summary.netSales)} />
    <MetricCard icon={ArrowUpRight} label="Penjualan bruto" value={formatRupiah(summary.grossSales)} />
    <MetricCard danger={new Prisma.Decimal(summary.refundAmount).add(summary.voidAmount).greaterThan(0)} icon={ArrowDownRight} label="Refund + void" value={formatRupiah(addMoney(summary.refundAmount, summary.voidAmount))} />
    <MetricCard icon={ReceiptText} label="Transaksi" value={new Intl.NumberFormat("id-ID").format(summary.transactionCount)} />
    <MetricCard icon={Scale} label="Rata-rata struk" value={formatRupiah(summary.averageTicket)} />
    <MetricCard icon={RotateCcw} label="Item dikembalikan" value={new Intl.NumberFormat("id-ID").format(summary.refundedQuantity)} />
  </section>;
}

/** Renders one KPI with text and icon so meaning never depends on color alone. */
function MetricCard({ accent = false, className, danger = false, icon: Icon, label, value }: { accent?: boolean; className?: string; danger?: boolean; icon: typeof TrendingUp; label: string; value: string }) {
  return <Card className={cn("min-w-0", accent && "ring-primary/40", className)} size="sm"><CardHeader className="grid-cols-[1fr_auto]"><CardDescription className="truncate text-xs font-medium">{label}</CardDescription><Icon aria-hidden="true" className={cn("size-4 text-muted-foreground", accent && "text-primary", danger && "text-destructive")} /></CardHeader><CardContent><p className={cn("truncate font-mono text-lg font-semibold tracking-tight", danger && "text-destructive")}>{value}</p></CardContent></Card>;
}

/** Dispatches the selected report into a server-rendered responsive view. */
function ReportView({ dataset }: { dataset: ReportDataset }) {
  switch (dataset.view) {
    case "overview": return <OverviewView report={dataset.data} />;
    case "products": return <ProductsView rows={dataset.data} />;
    case "payments": return <PaymentsView rows={dataset.data} />;
    case "shifts": return <ShiftsView report={dataset.data} />;
    case "corrections": return <CorrectionsView report={dataset.data} />;
    case "settlements": return <SettlementsView report={dataset.data} />;
  }
}

/** Combines a native SVG pulse with exact ledger breakdowns and an accessible daily table. */
function OverviewView({ report }: { report: OverviewReport }) {
  const maxSource = Math.max(...report.sources.map((row) => Number(row.grossSales)), 1);
  return <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,.7fr)]">
    <Card><CardHeader><CardTitle>Tren net sales</CardTitle><CardDescription>Penjualan bruto dikurangi refund dan void pada hari koreksi.</CardDescription></CardHeader><CardContent><SalesPulse rows={report.daily} /></CardContent></Card>
    <Card><CardHeader><CardTitle>Sumber pesanan</CardTitle><CardDescription>Kontribusi bruto sebelum koreksi.</CardDescription></CardHeader><CardContent className="grid gap-4">{report.sources.length ? report.sources.map((row) => <div className="min-w-0" key={row.source}><div className="flex items-center justify-between gap-3 text-sm"><span className="truncate font-medium">{sourceLabels[row.source] ?? row.source}</span><span className="shrink-0 font-mono">{formatRupiah(row.grossSales)}</span></div><div aria-hidden="true" className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(2, Number(row.grossSales) / maxSource * 100)}%` }} /></div><p className="mt-1 text-xs text-muted-foreground">{row.transactionCount} transaksi</p></div>) : <EmptyInline text="Belum ada sumber penjualan pada periode ini." />}</CardContent></Card>
    <Card className="lg:col-span-2" size="sm"><CardContent className="grid gap-3 pt-1 sm:grid-cols-3"><LedgerValue label="Subtotal net" value={report.summary.netSubtotal} /><LedgerValue label="Service charge net" value={report.summary.netServiceCharge} /><LedgerValue label="Pajak net" value={report.summary.netTax} /></CardContent></Card>
  </div>;
}

/** Draws a dependency-free responsive sales line while retaining exact daily values below it. */
function SalesPulse({ rows }: { rows: DailyReportRow[] }) {
  const values = rows.map((row) => Number(row.netSales));
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const range = max - min || 1;
  const width = 640;
  const height = 160;
  const point = (value: number, index: number) => `${rows.length === 1 ? width / 2 : index / (rows.length - 1) * width},${height - (value - min) / range * height}`;
  const points = values.map(point).join(" ");
  const zeroY = height - (0 - min) / range * height;
  return <figure className="min-w-0">
    <svg aria-label={`Tren net sales ${dateRangeLabel(rows[0]?.date ?? "", rows.at(-1)?.date ?? "")}`} className="h-44 w-full overflow-visible" preserveAspectRatio="none" role="img" viewBox={`0 0 ${width} ${height}`}>
      <line stroke="var(--border)" strokeDasharray="4 6" vectorEffect="non-scaling-stroke" x1="0" x2={width} y1={zeroY} y2={zeroY} />
      {rows.length > 1 ? <polyline fill="none" points={points} stroke="var(--primary)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" vectorEffect="non-scaling-stroke" /> : <circle cx={width / 2} cy={point(values[0] ?? 0, 0).split(",")[1]} fill="var(--primary)" r="5" />}
    </svg>
    <figcaption className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground"><span>{formatShortDate(rows[0]?.date)}</span><span>{rows.length} hari</span><span>{formatShortDate(rows.at(-1)?.date)}</span></figcaption>
    <details className="mt-4 rounded-lg border bg-muted/20"><summary className="flex min-h-11 cursor-pointer items-center px-3 text-sm font-medium">Lihat angka harian</summary><div className="max-h-72 overflow-y-auto border-t"><Table><TableHeader><TableRow><TableHead>Tanggal</TableHead><TableHead className="text-right">Bruto</TableHead><TableHead className="text-right">Koreksi</TableHead><TableHead className="text-right">Net</TableHead></TableRow></TableHeader><TableBody>{rows.map((row) => <TableRow key={row.date}><TableCell>{formatShortDate(row.date)}</TableCell><TableCell className="text-right font-mono">{formatRupiah(row.grossSales)}</TableCell><TableCell className="text-right font-mono">{formatRupiah(row.correctionAmount)}</TableCell><TableCell className="text-right font-mono font-semibold">{formatRupiah(row.netSales)}</TableCell></TableRow>)}</TableBody></Table></div></details>
  </figure>;
}

/** Displays exact product contribution in a wide ledger and stacked mobile cards without horizontal scrolling. */
function ProductsView({ rows }: { rows: ProductReportRow[] }) {
  if (!rows.length) return <EmptyReport icon={ReceiptText} text="Produk yang terjual atau direfund akan muncul di sini." title="Belum ada aktivitas produk" />;
  return <Card><div className="hidden xl:block"><Table><TableHeader><TableRow><TableHead>Produk</TableHead><TableHead>Kategori</TableHead><TableHead className="text-right">Terjual</TableHead><TableHead className="text-right">Refund</TableHead><TableHead className="text-right">Net qty</TableHead><TableHead className="text-right">Bruto</TableHead><TableHead className="text-right">Refund</TableHead><TableHead className="text-right">Net</TableHead></TableRow></TableHeader><TableBody>{rows.map((row) => <TableRow key={row.key}><TableCell><span className="block font-semibold">{row.productName}</span><span className="text-xs text-muted-foreground">{row.sku ?? "Tanpa SKU"}</span></TableCell><TableCell>{row.categoryName}</TableCell><TableCell className="text-right font-mono">{row.soldQuantity}</TableCell><TableCell className="text-right font-mono">{row.refundedQuantity}</TableCell><TableCell className="text-right font-mono font-semibold">{row.netQuantity}</TableCell><TableCell className="text-right font-mono">{formatRupiah(row.grossRevenue)}</TableCell><TableCell className="text-right font-mono text-destructive">{formatRupiah(row.refundRevenue)}</TableCell><TableCell className="text-right font-mono font-semibold">{formatRupiah(row.netRevenue)}</TableCell></TableRow>)}</TableBody></Table></div><CardContent className="grid gap-3 xl:hidden">{rows.map((row) => <article className="min-w-0 rounded-xl border bg-background p-4" key={row.key}><div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate font-semibold">{row.productName}</h3><p className="truncate text-xs text-muted-foreground">{row.categoryName} · {row.sku ?? "Tanpa SKU"}</p></div><span className="shrink-0 font-mono font-semibold">{formatRupiah(row.netRevenue)}</span></div><div className="mt-3 grid grid-cols-3 gap-2 text-xs"><LedgerValue compact label="Terjual" value={String(row.soldQuantity)} /><LedgerValue compact label="Refund" value={String(row.refundedQuantity)} /><LedgerValue compact label="Net qty" value={String(row.netQuantity)} /></div></article>)}</CardContent></Card>;
}

/** Shows payment reconciliation as compact cards because the method set is intentionally small. */
function PaymentsView({ rows }: { rows: PaymentReportRow[] }) {
  if (!rows.length) return <EmptyReport icon={Banknote} text="Metode pembayaran akan diringkas setelah ada transaksi." title="Belum ada pembayaran" />;
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{rows.map((row) => <Card key={row.method}><CardHeader><CardTitle>{paymentLabels[row.method] ?? row.method}</CardTitle><CardDescription>{row.transactionCount} transaksi · {row.refundCount} koreksi</CardDescription></CardHeader><CardContent className="grid grid-cols-3 gap-2"><LedgerValue compact label="Bruto" value={formatRupiah(row.grossAmount)} /><LedgerValue compact danger label="Refund" value={formatRupiah(row.refundAmount)} /><LedgerValue compact label="Net" value={formatRupiah(row.netAmount)} /></CardContent></Card>)}</div>;
}

/** Presents shift cash reconciliation as responsive ledger cards with stored blind-close results. */
function ShiftsView({ report }: { report: ShiftReport }) {
  if (!report.rows.length) return <EmptyReport icon={WalletCards} text="Shift pada periode dan outlet terpilih akan muncul di sini." title="Belum ada shift" />;
  return <><TruncationNotice report={report} /><div className="grid gap-3 lg:grid-cols-2">{report.rows.map((row) => <Card key={row.id}><CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle>{row.openedByName}</CardTitle><CardDescription>{row.outletName} · {formatShortDate(row.businessDate)}</CardDescription></div><Badge variant={row.status === "CLOSED" ? "outline" : "secondary"}>{row.status === "CLOSED" ? "Ditutup" : "Terbuka"}</Badge></div></CardHeader><CardContent><div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><LedgerValue compact label="Penjualan tunai" value={formatRupiah(row.cashSales)} /><LedgerValue compact danger label="Refund" value={formatRupiah(row.cashRefunds)} /><LedgerValue compact label="Kas masuk" value={formatRupiah(row.cashIn)} /><LedgerValue compact label="Kas keluar" value={formatRupiah(row.cashOut)} /></div><div className="mt-3 grid grid-cols-3 gap-2 border-t pt-3"><LedgerValue compact label="Expected" value={formatRupiah(row.expectedCash)} /><LedgerValue compact label="Aktual" value={row.actualCash ? formatRupiah(row.actualCash) : "—"} /><LedgerValue compact danger={Number(row.difference ?? 0) !== 0} label="Selisih" value={row.difference ? formatSignedRupiah(row.difference) : "—"} /></div><p className="mt-3 text-xs text-muted-foreground">Dibuka {formatDateTime(row.openedAt, row.timezone)}{row.closedAt ? ` · Ditutup ${formatDateTime(row.closedAt, row.timezone)}` : ""}</p></CardContent></Card>)}</div></>;
}

/** Lists refund and void events on the date they affected operational cash. */
function CorrectionsView({ report }: { report: CorrectionReport }) {
  if (!report.rows.length) return <EmptyReport icon={RotateCcw} text="Refund atau void pada periode terpilih akan muncul di sini." title="Tidak ada koreksi" />;
  return <><TruncationNotice report={report} /><div className="grid gap-3">{report.rows.map((row) => <Card key={row.id} size="sm"><CardContent className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Badge variant="destructive">{row.type === "VOID" ? "Void" : "Refund"}</Badge><Link className="truncate font-mono text-sm font-semibold text-primary hover:underline" href={`/transactions/${row.saleId}`}>{row.receiptNumber}</Link></div><p className="mt-2 text-sm">{row.reason}</p><p className="mt-1 text-xs text-muted-foreground">{row.outletName} · {row.actorName} · {formatDateTime(row.createdAt, row.timezone)}</p></div><div className="text-left sm:text-right"><p className="font-mono text-lg font-semibold text-destructive">−{formatRupiah(row.amount)}</p><p className="text-xs text-muted-foreground">Subtotal {formatRupiah(row.subtotalAmount)}</p></div></CardContent></Card>)}</div></>;
}

/** Combines current receivables with settlement activity while keeping reversed batches visible. */
function SettlementsView({ report }: { report: SettlementReport }) {
  const summary = report.summary;
  return <div className="grid gap-4"><div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><MetricCard icon={Landmark} label="Pending" value={formatRupiah(summary.pendingGross)} /><MetricCard danger={new Prisma.Decimal(summary.overdueGross).greaterThan(0)} icon={FileWarning} label="Jatuh tempo" value={formatRupiah(summary.overdueGross)} /><MetricCard icon={Banknote} label="Net diterima" value={formatRupiah(summary.confirmedNet)} /><MetricCard danger={new Prisma.Decimal(summary.directComparison).lessThan(0)} icon={Scale} label="Selisih direct" value={formatSignedRupiah(summary.directComparison)} /></div><Card size="sm"><CardContent className="grid gap-3 pt-1 sm:grid-cols-4"><LedgerValue label="Expected pending" value={formatRupiah(summary.expectedNet)} /><LedgerValue label="Fee dikonfirmasi" value={formatRupiah(summary.confirmedFees)} /><LedgerValue label="Promo merchant" value={formatRupiah(summary.confirmedPromotions)} /><LedgerValue label="Penyesuaian" value={formatSignedRupiah(summary.confirmedAdjustments)} /></CardContent></Card>{report.rows.length ? <><TruncationNotice report={report} /><div className="grid gap-3 lg:grid-cols-2">{report.rows.map((row) => <Card key={row.id}><CardHeader><div className="flex items-start justify-between gap-3"><div className="min-w-0"><CardTitle className="truncate">{row.provider} · {row.reference}</CardTitle><CardDescription>{row.outletName} · {formatDateTime(row.receivedAt, row.timezone)}</CardDescription></div><Badge variant={row.status === "CONFIRMED" ? "outline" : "destructive"}>{row.status === "CONFIRMED" ? "Dikonfirmasi" : "Dibalik"}</Badge></div></CardHeader><CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-3"><LedgerValue compact label="Gross" value={formatRupiah(row.grossAmount)} /><LedgerValue compact label="Fee + promo" value={formatRupiah(addMoney(row.platformFeeAmount, row.merchantPromotionAmount))} /><LedgerValue compact label="Net diterima" value={formatRupiah(row.netReceivedAmount)} /></CardContent></Card>)}</div></> : <EmptyReport icon={Landmark} text="Batch settlement yang diterima pada periode ini akan muncul di sini." title="Belum ada settlement" />}</div>;
}

/** Renders a small label/value pair used inside financial ledger surfaces. */
function LedgerValue({ compact = false, danger = false, label, value }: { compact?: boolean; danger?: boolean; label: string; value: string }) {
  return <div className={cn("min-w-0 rounded-lg bg-muted/40 p-3", compact && "p-2")}><p className="truncate text-[0.7rem] font-medium text-muted-foreground">{label}</p><p className={cn("mt-1 truncate font-mono font-semibold", compact ? "text-xs sm:text-sm" : "text-sm", danger && "text-destructive")}>{value}</p></div>;
}

/** Warns when a screen result is intentionally bounded and points users to filters or CSV. */
function TruncationNotice({ report }: { report: { truncated: boolean; totalRows: number } }) {
  return report.truncated ? <p className="mb-3 rounded-lg border border-dashed bg-muted/30 px-3 py-2 text-sm text-muted-foreground">Menampilkan sebagian dari {new Intl.NumberFormat("id-ID").format(report.totalRows)} baris. Persempit filter atau gunakan CSV.</p> : null;
}

/** Provides a useful, compact no-data state for every report tab. */
function EmptyReport({ icon: Icon, text, title }: { icon: typeof ReceiptText; text: string; title: string }) {
  return <div className="grid min-h-64 place-items-center rounded-2xl border border-dashed bg-card p-6 text-center"><div><Icon aria-hidden="true" className="mx-auto size-8 text-muted-foreground" /><h3 className="mt-3 font-heading text-lg font-semibold">{title}</h3><p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">{text}</p></div></div>;
}

function EmptyInline({ text }: { text: string }) {
  return <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{text}</p>;
}

/** Builds a report URL while preserving every filter not explicitly replaced. */
function reportHref(selection: ReportSelection, changes: Partial<ReportSelection>) {
  const next = { ...selection, ...changes };
  return `/reports?${new URLSearchParams({ view: next.view, from: next.from, to: next.to, outletId: next.outletId })}`;
}

/** Builds the protected export URL from the exact visible report state. */
function exportHref(selection: ReportSelection) {
  return `/api/reports/export?${new URLSearchParams(selection)}`;
}

function subtractDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function dateRangeLabel(from: string, to: string) {
  if (!from || !to) return "Periode belum tersedia";
  return from === to ? formatShortDate(from) : `${formatShortDate(from)} – ${formatShortDate(to)}`;
}

function formatShortDate(value?: string) {
  return value ? new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00.000Z`)) : "—";
}

function formatDateTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat("id-ID", { timeZone: timezone, day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatSignedRupiah(value: string) {
  const amount = new Prisma.Decimal(value);
  if (amount.isZero()) return formatRupiah("0");
  return `${amount.greaterThan(0) ? "+" : "−"}${formatRupiah(amount.abs().toFixed(2))}`;
}

function addMoney(...values: string[]) {
  return values.reduce((total, value) => total.add(value), new Prisma.Decimal(0)).toFixed(2);
}
