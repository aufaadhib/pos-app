"use client";

import { useMemo, useState } from "react";
import { RotateCcw, Undo2 } from "lucide-react";

import { refundSaleAction, voidSaleAction } from "@/app/transactions/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useAutoCloseDialogAction } from "@/components/ui/use-auto-close-dialog-action";
import { formatRupiah } from "@/lib/currency";
import { initialTransactionActionState, type SaleDetail, type TransactionActionState } from "@/lib/pos/types";

type TransactionCorrectionControlsProps = {
  sale: Pick<SaleDetail, "id" | "receiptNumber" | "paymentMethod" | "status" | "settlementStatus" | "items">;
  outletId: string;
  canVoid: boolean;
};

/** Renders responsive, permission-gated correction controls for one paid transaction. */
export function TransactionCorrectionControls({ sale, outletId, canVoid }: TransactionCorrectionControlsProps) {
  if (sale.status === "VOIDED" || sale.status === "REFUNDED" || sale.settlementStatus === "SETTLED") return null;
  const refundableItems = sale.items.filter((item) => item.refundedQuantity < item.quantity);
  if (refundableItems.length === 0) return null;
  return <section aria-labelledby="correction-heading" className="mt-5 rounded-2xl border bg-card p-4 sm:p-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-heading text-lg font-semibold" id="correction-heading">Koreksi transaksi</h2><p className="mt-1 text-sm text-muted-foreground">Void dan refund tidak mengubah struk asli.</p></div><div className="flex flex-col gap-2 sm:flex-row">{canVoid && <VoidSaleDialog outletId={outletId} sale={sale} />}<RefundSaleDialog items={refundableItems} outletId={outletId} sale={sale} /></div></div>
  </section>;
}

/** Collects an explicit reason and provider reference before a full void. */
function VoidSaleDialog({ outletId, sale }: { outletId: string; sale: TransactionCorrectionControlsProps["sale"] }) {
  const form = useAutoCloseDialogAction(voidSaleAction, initialTransactionActionState);
  const [token, setToken] = useState("");
  const requiresReference = sale.paymentMethod !== "CASH";
  return <Dialog onOpenChange={(open) => { form.setOpen(open); if (open) setToken(crypto.randomUUID()); }} open={form.open}>
    <DialogTrigger render={<Button variant="destructive" />}><Undo2 aria-hidden="true" />Void penuh</DialogTrigger>
    <DialogContent><DialogHeader><DialogTitle>Void {sale.receiptNumber}</DialogTitle><DialogDescription>Seluruh pembayaran akan dibalik. Tindakan ini tidak dapat dibatalkan dan tetap tercatat pada audit.</DialogDescription></DialogHeader>
      <form action={form.action} className="grid min-w-0 gap-5"><input name="saleId" type="hidden" value={sale.id} /><input name="outletId" type="hidden" value={outletId} /><input name="operationToken" type="hidden" value={token} />
        <Alert variant="destructive"><AlertDescription>Pastikan dana sudah atau akan dikembalikan melalui metode pembayaran asal.</AlertDescription></Alert>
        <ReasonField errors={form.state.fieldErrors?.reason} id="void-reason" />
        {requiresReference && <ReferenceField errors={form.state.fieldErrors?.providerReference} id="void-reference" />}
        <ActionFeedback state={form.state} /><DialogFooter><Button disabled={form.pending || !token} type="submit" variant="destructive">{form.pending && <Spinner />}{form.pending ? "Memproses…" : "Konfirmasi void"}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}

/** Collects remaining item quantities and submits one append-only partial or full refund. */
function RefundSaleDialog({ items, outletId, sale }: { items: SaleDetail["items"]; outletId: string; sale: TransactionCorrectionControlsProps["sale"] }) {
  const form = useAutoCloseDialogAction(refundSaleAction, initialTransactionActionState);
  const [token, setToken] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const selected = useMemo(() => items.flatMap((item) => {
    const quantity = quantities[item.id] ?? 0;
    return quantity > 0 ? [{ saleItemId: item.id, quantity }] : [];
  }), [items, quantities]);
  const selectedSubtotal = items.reduce((sum, item) => sum + Number(item.unitPrice) * (quantities[item.id] ?? 0), 0);
  const requiresReference = sale.paymentMethod !== "CASH";
  /** Resets controlled form data whenever a fresh refund dialog is opened. */
  function changeOpen(open: boolean) {
    form.setOpen(open);
    if (open) {
      setToken(crypto.randomUUID());
      setQuantities({});
    }
  }
  /** Selects every remaining unit for a full refund without exceeding prior refunds. */
  function selectAll() {
    setQuantities(Object.fromEntries(items.map((item) => [item.id, item.quantity - item.refundedQuantity])));
  }
  return <Dialog onOpenChange={changeOpen} open={form.open}>
    <DialogTrigger render={<Button variant="outline" />}><RotateCcw aria-hidden="true" />Refund item</DialogTrigger>
    <DialogContent className="sm:max-w-2xl"><DialogHeader><DialogTitle>Refund {sale.receiptNumber}</DialogTitle><DialogDescription>Pilih jumlah item yang dikembalikan. Pajak dan layanan dialokasikan dari nilai transaksi asli.</DialogDescription></DialogHeader>
      <form action={form.action} className="grid min-w-0 gap-5"><input name="saleId" type="hidden" value={sale.id} /><input name="outletId" type="hidden" value={outletId} /><input name="operationToken" type="hidden" value={token} /><input name="items" type="hidden" value={JSON.stringify(selected)} />
        <div className="grid gap-2"><div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold">Item yang direfund</p><Button onClick={selectAll} type="button" variant="ghost">Pilih semua</Button></div><div className="grid max-h-72 gap-2 overflow-y-auto rounded-xl border p-2">{items.map((item) => {
          const remaining = item.quantity - item.refundedQuantity;
          const quantity = quantities[item.id] ?? 0;
          return <label className="grid min-w-0 grid-cols-[minmax(0,1fr)_5rem] items-center gap-3 rounded-lg p-2 hover:bg-muted/50" key={item.id}><span className="min-w-0"><span className="block truncate text-sm font-medium">{item.productName}</span><span className="block text-xs text-muted-foreground">Sisa {remaining} · {formatRupiah(item.unitPrice)} / item</span></span><Input aria-label={`Jumlah refund ${item.productName}`} inputMode="numeric" max={remaining} min={0} onChange={(event) => setQuantities((current) => ({ ...current, [item.id]: Math.min(remaining, Math.max(0, Number(event.target.value) || 0)) }))} type="number" value={quantity} /></label>;
        })}</div><div className="flex items-center justify-between rounded-xl bg-muted/40 px-4 py-3 text-sm"><span className="text-muted-foreground">Subtotal item terpilih</span><strong className="font-mono">{formatRupiah(String(selectedSubtotal))}</strong></div><FieldError errors={toFieldErrors(form.state.fieldErrors?.items)} /></div>
        <ReasonField errors={form.state.fieldErrors?.reason} id="refund-reason" />
        {requiresReference && <ReferenceField errors={form.state.fieldErrors?.providerReference} id="refund-reference" />}
        <ActionFeedback state={form.state} /><DialogFooter><Button disabled={form.pending || !token || selected.length === 0} type="submit" variant="destructive">{form.pending && <Spinner />}{form.pending ? "Memproses…" : "Konfirmasi refund"}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}

/** Renders one labeled correction reason with server-side error feedback. */
function ReasonField({ errors, id }: { errors?: string[]; id: string }) {
  return <Field data-invalid={Boolean(errors)}><FieldLabel htmlFor={id}>Alasan koreksi</FieldLabel><Textarea aria-invalid={Boolean(errors)} id={id} maxLength={240} minLength={5} name="reason" placeholder="Contoh: pelanggan salah memesan" required /><FieldError errors={toFieldErrors(errors)} /></Field>;
}

/** Renders the mandatory bank or provider reference for a non-cash reversal. */
function ReferenceField({ errors, id }: { errors?: string[]; id: string }) {
  return <Field data-invalid={Boolean(errors)}><FieldLabel htmlFor={id}>Referensi bank / provider</FieldLabel><Input aria-invalid={Boolean(errors)} id={id} maxLength={80} name="providerReference" placeholder="Nomor refund atau reversal" required /><FieldError errors={toFieldErrors(errors)} /></Field>;
}

/** Displays safe server feedback inside the active correction dialog. */
function ActionFeedback({ state }: { state: TransactionActionState }) {
  if (state.status === "idle" || state.status === "success") return null;
  return <Alert variant="destructive"><AlertDescription>{state.message}</AlertDescription></Alert>;
}

/** Converts action messages into the shadcn FieldError shape. */
function toFieldErrors(errors?: string[]) { return errors?.map((message) => ({ message })); }

/** Formats one decimal string as Indonesian Rupiah for the refund preview. */
