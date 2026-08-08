"use client";

import Image from "next/image";
import { useActionState, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowDownToLine, Banknote, CheckCircle2, Clock3, RotateCcw, Save, Settings2 } from "lucide-react";
import { toast } from "react-toastify";

import {
  createSettlementBatchAction,
  reverseSettlementBatchAction,
  saveChannelProductPriceAction,
  saveDeliveryChannelAction,
} from "@/app/settlements/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Spinner } from "@/components/ui/spinner";
import type { DeliveryProvider } from "@/generated/prisma/client";
import { deliveryProviderLabels, initialDeliveryActionState, type DeliveryActionState, type DeliveryChannelDto, type DeliveryManagementDto, type PendingSettlementDto } from "@/lib/delivery/types";

const deliveryProviderLogos: Record<DeliveryProvider, { src: string; background: string }> = {
  GOFOOD: { src: "/MerchantOjolLogo/Gojek.svg", background: "bg-[#00aa13]" },
  GRABFOOD: { src: "/MerchantOjolLogo/GrabFood_Final_Logo_RGB_green_horizontal-01.png", background: "bg-white" },
  SHOPEEFOOD: { src: "/MerchantOjolLogo/Shopee Food Logo (SVG) - Vector69Com.svg", background: "bg-white" },
};

type DeliveryManagementProps = {
  outlet: { id: string; name: string; timezone: string };
  data: DeliveryManagementDto;
  providers: readonly DeliveryProvider[];
  canManage: boolean;
  canReverse: boolean;
};

/** Renders channel pricing, pending receivables, and batch reconciliation for one outlet. */
export function DeliveryManagement({ outlet, data, providers, canManage, canReverse }: DeliveryManagementProps) {
  return <div className="grid gap-6">
    <section className="rounded-2xl border bg-card p-5 sm:p-6"><p className="text-sm font-medium text-muted-foreground">Keuangan channel · {outlet.name}</p><h1 className="mt-1 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">Ojol & settlement</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">Pisahkan omzet yang sudah dibayar pelanggan dari dana platform yang benar-benar masuk ke rekening outlet.</p></section>

    <section aria-label="Ringkasan settlement" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <SummaryCard icon={Clock3} label={`${data.summary.pendingCount} transaksi pending`} title="Piutang platform" value={formatRupiah(data.summary.pendingGross)} />
      <SummaryCard icon={ArrowDownToLine} label="Setelah estimasi fee" title="Estimasi net pending" value={formatRupiah(data.summary.expectedNet)} />
      <SummaryCard danger={Number(data.summary.overdueGross) > 0} icon={AlertTriangle} label="Melewati estimasi cair" title="Settlement terlambat" value={formatRupiah(data.summary.overdueGross)} />
      <SummaryCard icon={Banknote} label={`Fee ${formatRupiah(data.summary.settledFees)}`} title="Net sudah diterima" value={formatRupiah(data.summary.settledNet)} />
      <SummaryCard danger={Number(data.summary.directComparison) < 0} icon={AlertTriangle} label="Net settlement dikurangi nilai direct" title="Selisih vs penjualan langsung" value={formatRupiah(data.summary.directComparison)} />
    </section>

    <section aria-labelledby="channel-settings-heading" className="grid gap-4"><div><h2 className="font-heading text-xl font-semibold" id="channel-settings-heading">Pengaturan channel</h2><p className="mt-1 text-sm text-muted-foreground">Harga jual dibulatkan naik ke Rp500; laporan fee dan selisih tetap presisi.</p></div><div className="grid gap-4 lg:grid-cols-3">{providers.map((provider) => <ChannelConfigForm canManage={canManage} channel={data.channels.find((item) => item.provider === provider)} key={provider} outletId={outlet.id} provider={provider} />)}</div></section>

    {canManage && <ProductPriceOverrideForm channels={data.channels} outletId={outlet.id} products={data.products} />}

    <SettlementForm channels={data.channels} key={data.pending.map((payment) => payment.paymentId).join(":") || "empty"} outlet={outlet} pending={data.pending} />

    <section aria-labelledby="recent-batches-heading" className="grid gap-3"><div><h2 className="font-heading text-xl font-semibold" id="recent-batches-heading">Batch terbaru</h2><p className="mt-1 text-sm text-muted-foreground">Batch yang dibalik tetap disimpan sebagai riwayat keuangan.</p></div>{data.batches.length === 0 ? <div className="rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">Belum ada settlement yang dikonfirmasi.</div> : <div className="grid gap-3">{data.batches.map((batch) => <article className="rounded-xl border bg-card p-4 sm:flex sm:items-center sm:justify-between sm:gap-5" key={batch.id}><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{deliveryProviderLabels[batch.provider]} · {batch.reference}</h3><Badge variant={batch.status === "CONFIRMED" ? "secondary" : "outline"}>{batch.status === "CONFIRMED" ? "Terkonfirmasi" : "Dibalik"}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{formatDate(batch.receivedAt, outlet.timezone)} · {batch.transactionCount} transaksi · Fee {formatRupiah(batch.platformFeeAmount)}</p></div><div className="mt-3 flex items-center justify-between gap-4 sm:mt-0 sm:justify-end"><span className="font-mono font-semibold">{formatRupiah(batch.netReceivedAmount)}</span>{canReverse && batch.status === "CONFIRMED" && <ReverseSettlementForm outletId={outlet.id} settlementId={batch.id} />}</div></article>)}</div>}</section>
  </div>;
}

/** Displays one compact settlement metric without introducing a chart dependency. */
function SummaryCard({ icon: Icon, title, value, label, danger = false }: { icon: typeof Clock3; title: string; value: string; label: string; danger?: boolean }) {
  return <Card className={danger ? "border-destructive/40" : undefined}><CardHeader className="pb-2"><div className="flex items-center justify-between"><CardDescription>{title}</CardDescription><Icon aria-hidden="true" className={danger ? "size-5 text-destructive" : "size-5 text-primary"} /></div><CardTitle className="font-mono text-xl">{value}</CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground">{label}</CardContent></Card>;
}

/** Edits one provider configuration while keeping inactive providers visible. */
function ChannelConfigForm({ outletId, provider, channel, canManage }: { outletId: string; provider: DeliveryProvider; channel?: DeliveryChannelDto; canManage: boolean }) {
  const [state, action, pending] = useActionState(saveDeliveryChannelAction, initialDeliveryActionState);
  useActionToast(state);
  const exampleGross = 100_000;
  const exampleChannelGross = Math.ceil((exampleGross * (1 + Number(channel?.markupRate ?? 0) / 100)) / 500) * 500;
  const expectedNet = exampleChannelGross * (1 - Number(channel?.estimatedFeeRate ?? 0) / 100);
  return <Card><CardHeader><div className="flex items-center justify-between gap-3"><div className={`flex h-12 w-32 items-center rounded-lg border p-2 ${deliveryProviderLogos[provider].background}`}><span className="relative block h-8 w-full"><Image alt="" aria-hidden="true" className="object-contain" fill sizes="128px" src={deliveryProviderLogos[provider].src} /></span></div><Badge variant={channel?.isActive ? "secondary" : "outline"}>{channel?.isActive ? "Aktif" : "Nonaktif"}</Badge></div><div><CardTitle>{deliveryProviderLabels[provider]}</CardTitle><CardDescription className="mt-1">{channel ? `Harga Rp100.000 menjadi ${formatRupiah(String(exampleChannelGross))}; estimasi net ${formatRupiah(String(expectedNet))}.` : "Belum dikonfigurasi untuk outlet ini."}</CardDescription></div>{channel && expectedNet < exampleGross && <p className="mt-2 text-xs font-medium text-destructive">Estimasi net masih {formatRupiah(String(expectedNet - exampleGross))} dibanding penjualan langsung.</p>}</CardHeader><CardContent><form action={action} className="grid gap-4">
    <input name="outletId" type="hidden" value={outletId} /><input name="provider" type="hidden" value={provider} />
    <label className="flex min-h-12 items-center gap-3 rounded-lg border px-3"><input defaultChecked={channel?.isActive} disabled={!canManage} name="isActive" type="checkbox" /><span className="font-medium">Aktifkan di POS</span></label>
    <div className="grid grid-cols-2 gap-3"><NumberField defaultValue={channel?.markupRate} disabled={!canManage} label="Markup (%)" name="markupRate" placeholder="20" step="0.01" /><NumberField defaultValue={channel?.estimatedFeeRate} disabled={!canManage} label="Estimasi fee (%)" name="estimatedFeeRate" placeholder="20" step="0.01" /></div>
    <NumberField defaultValue={String(channel?.settlementDelayHours ?? 24)} disabled={!canManage} label="Estimasi cair (jam)" max="720" min="1" name="settlementDelayHours" step="1" />
    {canManage && <Button disabled={pending} type="submit">{pending ? <Spinner /> : <Save aria-hidden="true" />}{pending ? "Menyimpan…" : "Simpan channel"}</Button>}
  </form></CardContent></Card>;
}

/** Saves one exact product base-price exception for an existing channel. */
function ProductPriceOverrideForm({ outletId, channels, products }: { outletId: string; channels: DeliveryChannelDto[]; products: DeliveryManagementDto["products"] }) {
  const [state, action, pending] = useActionState(saveChannelProductPriceAction, initialDeliveryActionState);
  const [channelId, setChannelId] = useState(channels[0]?.id ?? "");
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  useActionToast(state);
  const product = products.find((item) => item.id === productId);
  const channel = channels.find((item) => item.id === channelId);
  const override = product?.overrides.find((item) => item.channelId === channelId)?.priceOverride;
  const calculatedPrice = product && channel ? Math.ceil((Number(product.directPrice) * (1 + Number(channel.markupRate) / 100)) / 500) * 500 : 0;
  const activePrice = Number(override ?? calculatedPrice);
  const expectedNet = channel ? activePrice * (1 - Number(channel.estimatedFeeRate) / 100) : 0;
  const difference = product ? expectedNet - Number(product.directPrice) : 0;
  return <section aria-labelledby="product-channel-price-heading" className="rounded-2xl border bg-card p-5 sm:p-6"><div className="flex items-center gap-3"><Settings2 aria-hidden="true" className="size-5 text-primary" /><div><h2 className="font-heading text-xl font-semibold" id="product-channel-price-heading">Harga khusus produk</h2><p className="text-sm text-muted-foreground">Kosongkan harga untuk kembali memakai markup default.</p></div></div>{channels.length === 0 ? <Alert className="mt-5"><AlertDescription>Simpan minimal satu pengaturan channel terlebih dahulu.</AlertDescription></Alert> : <><form action={action} className="mt-5 grid gap-4 md:grid-cols-[1fr_1fr_12rem_auto] md:items-end"><input name="outletId" type="hidden" value={outletId} /><label className="grid gap-2 text-sm font-medium">Channel<SearchableSelect name="channelId" onValueChange={setChannelId} options={channels.map((item) => ({ value: item.id, label: item.label }))} value={channelId} /></label><label className="grid gap-2 text-sm font-medium">Produk<SearchableSelect name="productId" onValueChange={setProductId} options={products.map((item) => ({ value: item.id, label: `${item.name} · ${formatRupiah(item.directPrice)}` }))} value={productId} /></label><label className="grid gap-2 text-sm font-medium">Harga channel (Rp)<CurrencyInput defaultValue={override?.split(".")[0] ?? ""} key={`${channelId}:${productId}:${override ?? "default"}`} name="priceOverride" placeholder="Kelipatan 500" /></label><Button disabled={pending || !channelId || !productId} type="submit">{pending && <Spinner />}Simpan</Button></form>{product && channel && <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 rounded-xl bg-muted/40 p-4 text-sm"><span>Harga channel <strong>{formatRupiah(String(activePrice))}</strong></span><span>Estimasi net <strong>{formatRupiah(String(expectedNet))}</strong></span><span className={difference < 0 ? "font-semibold text-destructive" : "font-semibold text-success"}>Selisih {formatRupiah(String(difference))}</span></div>}</>}</section>;
}

/** Selects pending transactions from one provider and submits one balanced settlement batch. */
function SettlementForm({ outlet, channels, pending }: { outlet: DeliveryManagementProps["outlet"]; channels: DeliveryChannelDto[]; pending: PendingSettlementDto[] }) {
  const availableChannels = channels.filter((channel) => pending.some((payment) => payment.channelId === channel.id));
  const [channelId, setChannelId] = useState(availableChannels[0]?.id ?? "");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [fee, setFee] = useState("0");
  const [promotion, setPromotion] = useState("0");
  const [adjustment, setAdjustment] = useState("0");
  const [netReceived, setNetReceived] = useState("0");
  const [receivedAt, setReceivedAt] = useState(toLocalDateTime(new Date()));
  const [state, action, submitting] = useActionState(createSettlementBatchAction, initialDeliveryActionState);
  useActionToast(state);
  const visiblePayments = useMemo(() => pending.filter((payment) => payment.channelId === channelId), [channelId, pending]);
  const selectedPayments = visiblePayments.filter((payment) => selectedIds.includes(payment.paymentId));
  const gross = selectedPayments.reduce((sum, payment) => sum + Number(payment.grossAmount), 0);
  const calculatedNet = gross - Number(fee || 0) - Number(promotion || 0) + Number(adjustment || 0);
  function changeChannel(value: string) { setChannelId(value); setSelectedIds([]); }
  function togglePayment(id: string) { setSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]); }
  return <section aria-labelledby="reconcile-heading" className="rounded-2xl border bg-card p-5 sm:p-6"><div><h2 className="font-heading text-xl font-semibold" id="reconcile-heading">Rekonsiliasi transfer</h2><p className="mt-1 text-sm text-muted-foreground">Pilih order yang tercakup dalam satu transfer platform. Gross dihitung sistem dan tidak dapat diedit.</p></div>{availableChannels.length === 0 ? <div className="mt-5 rounded-xl border border-dashed p-8 text-center"><CheckCircle2 aria-hidden="true" className="mx-auto size-7 text-success" /><p className="mt-3 font-semibold">Tidak ada settlement pending</p></div> : <form action={action} className="mt-5 grid gap-5"><input name="outletId" type="hidden" value={outlet.id} /><input name="channelId" type="hidden" value={channelId} />{selectedIds.map((id) => <input key={id} name="paymentIds" type="hidden" value={id} />)}<input name="platformFeeAmount" type="hidden" value={moneyValue(fee)} /><input name="merchantPromotionAmount" type="hidden" value={moneyValue(promotion)} /><input name="otherAdjustmentAmount" type="hidden" value={moneyValue(adjustment, true)} /><input name="netReceivedAmount" type="hidden" value={moneyValue(netReceived)} /><input name="receivedAt" type="hidden" value={toIsoDateTime(receivedAt)} />
    <div className="grid gap-4 md:grid-cols-[minmax(0,20rem)_auto] md:items-end"><label className="grid gap-2 text-sm font-medium">Channel<SearchableSelect onValueChange={changeChannel} options={availableChannels.map((item) => ({ value: item.id, label: item.label }))} value={channelId} /></label><Button className="justify-self-start" onClick={() => setSelectedIds(selectedIds.length === visiblePayments.length ? [] : visiblePayments.map((payment) => payment.paymentId))} type="button" variant="outline">{selectedIds.length === visiblePayments.length ? "Batalkan semua" : "Pilih semua"}</Button></div>
    <div className="grid max-h-96 gap-2 overflow-y-auto rounded-xl border p-2">{visiblePayments.map((payment) => <label className="flex min-h-16 cursor-pointer items-center gap-3 rounded-lg px-3 hover:bg-muted" key={payment.paymentId}><input checked={selectedIds.includes(payment.paymentId)} onChange={() => togglePayment(payment.paymentId)} type="checkbox" /><span className="min-w-0 flex-1"><span className="block truncate font-semibold">{payment.externalOrderId} · {payment.receiptNumber}</span><span className="block text-xs text-muted-foreground">Estimasi net {formatRupiah(payment.expectedNetAmount)} · {payment.overdue ? "Terlambat" : formatDate(payment.expectedSettlementAt, outlet.timezone)}</span></span><span className="font-mono text-sm font-semibold">{formatRupiah(payment.grossAmount)}</span></label>)}</div>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><ReadOnlyMoney label="Gross terpilih" value={gross} /><MoneyField label="Fee platform aktual" onChange={setFee} value={fee} /><MoneyField label="Promo merchant" onChange={setPromotion} value={promotion} /><MoneyField allowNegative label="Penyesuaian lain" onChange={setAdjustment} value={adjustment} /></div>
    <div className="grid gap-4 md:grid-cols-2"><label className="grid gap-2 text-sm font-medium">Catatan penyesuaian<Input maxLength={240} name="otherAdjustmentNote" placeholder="Wajib jika penyesuaian tidak nol" /></label><label className="grid gap-2 text-sm font-medium">Referensi transfer<Input maxLength={80} name="reference" placeholder="Nomor mutasi bank/platform" required /></label><label className="grid gap-2 text-sm font-medium">Waktu dana diterima<Input onChange={(event) => setReceivedAt(event.target.value)} required type="datetime-local" value={receivedAt} /></label><MoneyField label="Net masuk rekening" onChange={setNetReceived} value={netReceived} /></div>
    <div className="flex flex-col gap-3 rounded-xl bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm text-muted-foreground">Net berdasarkan rincian</p><p className="font-mono text-xl font-semibold">{formatRupiah(String(calculatedNet))}</p>{Number(netReceived) !== calculatedNet && <p className="mt-1 text-xs text-destructive">Net masuk belum sama dengan rincian potongan.</p>}</div><Button disabled={submitting || selectedIds.length === 0} type="submit">{submitting ? <Spinner /> : <ArrowDownToLine aria-hidden="true" />}{submitting ? "Mengonfirmasi…" : "Konfirmasi settlement"}</Button></div>
  </form>}</section>;
}

/** Reverses one batch after collecting an explicit owner reason. */
function ReverseSettlementForm({ outletId, settlementId }: { outletId: string; settlementId: string }) {
  const [state, action, pending] = useActionState(reverseSettlementBatchAction, initialDeliveryActionState);
  useActionToast(state);
  return <details className="relative"><summary className="cursor-pointer list-none rounded-lg border px-3 py-2 text-sm font-semibold">Balik</summary><form action={action} className="absolute right-0 z-20 mt-2 grid w-72 gap-3 rounded-xl border bg-popover p-4 shadow-lg"><input name="outletId" type="hidden" value={outletId} /><input name="settlementId" type="hidden" value={settlementId} /><label className="grid gap-2 text-sm font-medium">Alasan pembalikan<Input maxLength={240} minLength={5} name="reason" required /></label><Button disabled={pending} type="submit" variant="destructive">{pending ? <Spinner /> : <RotateCcw aria-hidden="true" />}Balik settlement</Button></form></details>;
}

/** Displays action feedback as the project's bottom-right toast convention. */
function useActionToast(state: DeliveryActionState) {
  useEffect(() => {
    if (state.status === "success") toast.success(state.message);
    if (state.status === "error" || state.status === "conflict") toast.error(state.message);
  }, [state]);
}

function NumberField({ label, name, ...props }: React.ComponentProps<typeof Input> & { label: string; name: string }) { return <label className="grid gap-2 text-sm font-medium">{label}<Input name={name} required type="number" {...props} /></label>; }
function MoneyField({ label, value, onChange, allowNegative = false }: { label: string; value: string; onChange: (value: string) => void; allowNegative?: boolean }) { return <label className="grid gap-2 text-sm font-medium">{label}<CurrencyInput allowNegative={allowNegative} onValueChange={onChange} value={value} /></label>; }
function ReadOnlyMoney({ label, value }: { label: string; value: number }) { return <div className="grid gap-2 text-sm font-medium"><span>{label}</span><div className="flex h-12 items-center rounded-lg border bg-muted/40 px-3 font-mono">{formatRupiah(String(value))}</div></div>; }
function moneyValue(value: string, signed = false) { const amount = Number(value || 0); return `${signed && amount < 0 ? "-" : ""}${Math.abs(Math.trunc(amount))}.00`; }
function formatRupiah(value: string) { return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(value)); }
function formatDate(value: string, timezone: string) { return new Intl.DateTimeFormat("id-ID", { timeZone: timezone, dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
function toLocalDateTime(value: Date) { return new Date(value.getTime() - value.getTimezoneOffset() * 60_000).toISOString().slice(0, 16); }
function toIsoDateTime(value: string) { const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString(); }
