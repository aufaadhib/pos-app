"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowDownToLine, ArrowUpFromLine, Clock3, LockKeyhole, Play, Square } from "lucide-react";

import {
  addCashMovementAction,
  closeCashShiftAction,
  forceCloseCashShiftAction,
  openCashShiftAction,
} from "@/app/shifts/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useAutoCloseDialogAction } from "@/components/ui/use-auto-close-dialog-action";
import { formatRupiah } from "@/lib/currency";
import type { CashShiftListItem, CurrentCashShift, ShiftActionState } from "@/lib/shifts/types";
import { initialShiftActionState } from "@/lib/shifts/types";

/** Renders the POS gate used to open a personal shift before checkout. */
export function OpenShiftCard({ outletId, outletName }: { outletId: string; outletName: string }) {
  const form = useAutoCloseDialogAction(openCashShiftAction, initialShiftActionState, false);
  const [token] = useState(() => crypto.randomUUID());

  return (
    <main className="mx-auto grid min-h-[calc(100svh-8rem)] max-w-3xl place-items-center px-4 py-8 pb-28 sm:px-8 lg:pb-8" id="main-content">
      <Card className="w-full overflow-hidden border shadow-sm">
        <CardHeader className="border-l-4 border-primary bg-muted/20 sm:p-7">
          <span className="grid size-12 place-items-center rounded-xl bg-primary text-primary-foreground"><Play aria-hidden="true" /></span>
          <h1 className="mt-4 font-heading text-2xl font-medium leading-snug">Buka shift kasir</h1>
          <CardDescription className="max-w-xl text-sm leading-6 sm:text-base">Catat saldo awal sebelum menerima pembayaran di {outletName}. Satu akun hanya dapat membuka satu shift.</CardDescription>
        </CardHeader>
        <CardContent className="p-5 sm:p-7">
          <form action={form.action} className="grid gap-5">
            <input name="outletId" type="hidden" value={outletId} />
            <input name="openToken" type="hidden" value={token} />
            <Field data-invalid={Boolean(form.state.fieldErrors?.openingCash)}>
              <FieldLabel htmlFor="opening-cash">Saldo awal kas (Rp)</FieldLabel>
              <CurrencyInput aria-invalid={Boolean(form.state.fieldErrors?.openingCash)} autoFocus id="opening-cash" name="openingCash" placeholder="0" required />
              <FieldDescription>Masukkan uang fisik yang benar-benar tersedia di cash drawer.</FieldDescription>
              <FieldError errors={toFieldErrors(form.state.fieldErrors?.openingCash)} />
            </Field>
            <ActionFeedback state={form.state} />
            <Button className="min-h-12 w-full sm:w-fit" disabled={form.pending || !token} size="lg" type="submit">
              {form.pending ? <Spinner /> : <Play aria-hidden="true" />}
              {form.pending ? "Membuka shift…" : "Buka shift"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

/** Shows a blocking POS state when the user's only open shift belongs to another outlet. */
export function WrongOutletShiftCard({ shift }: { shift: CurrentCashShift }) {
  return <main className="mx-auto grid min-h-[calc(100svh-8rem)] max-w-3xl place-items-center px-4 py-8 pb-28 sm:px-8 lg:pb-8" id="main-content"><Card className="w-full border shadow-sm"><CardHeader><LockKeyhole aria-hidden="true" className="size-9 text-primary" /><CardTitle className="mt-3">Shift masih aktif di {shift.outletName}</CardTitle><CardDescription>Tutup shift tersebut sebelum melanjutkan transaksi atau berpindah outlet.</CardDescription></CardHeader><CardContent><Link className={buttonVariants()} href={`/shifts/${shift.id}`}>Buka rincian shift</Link></CardContent></Card></main>;
}

/** Provides compact shift status and financial controls above the active POS register. */
export function PosShiftBar({ shift }: { shift: CurrentCashShift }) {
  return <section aria-label="Shift kasir aktif" className="pos-shift-bar mb-3 flex shrink-0 flex-col gap-3 rounded-xl border bg-card p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-4">
    <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Badge>Shift aktif</Badge><span className="truncate font-semibold">{shift.outletName}</span></div><p className="pos-shift-meta mt-1 flex items-center gap-2 text-xs text-muted-foreground"><Clock3 aria-hidden="true" className="size-4" />Dibuka {formatDateTime(shift.openedAt, shift.outletTimezone)} · Saldo awal {formatRupiah(shift.openingCash)}</p></div>
    <div className="pos-shift-actions grid grid-cols-3 gap-2 sm:flex">
      <CashMovementDialog direction="IN" shift={shift} />
      <CashMovementDialog direction="OUT" shift={shift} />
      <CloseShiftDialog shift={shift} />
    </div>
  </section>;
}

/** Collects one fixed-category cash movement with a fresh idempotency token. */
export function CashMovementDialog({ direction, shift }: { direction: "IN" | "OUT"; shift: CashShiftListItem }) {
  const form = useAutoCloseDialogAction(addCashMovementAction, initialShiftActionState);
  const [token, setToken] = useState("");
  const incoming = direction === "IN";
  const options = incoming
    ? [{ value: "ADDITIONAL_FLOAT", label: "Tambahan modal" }, { value: "OTHER", label: "Lainnya" }]
    : [{ value: "CASH_DROP", label: "Setor kas" }, { value: "OPERATING_EXPENSE", label: "Biaya operasional" }, { value: "OTHER", label: "Lainnya" }];
  const defaultCategory = options[0].value;

  return <Dialog onOpenChange={(open) => { form.setOpen(open); if (open) setToken(crypto.randomUUID()); }} open={form.open}>
    <DialogTrigger render={<Button className="min-h-11 px-2 sm:px-3" size="sm" variant="outline" />}>
      {incoming ? <ArrowDownToLine aria-hidden="true" /> : <ArrowUpFromLine aria-hidden="true" />}<span className="hidden sm:inline">Kas {incoming ? "masuk" : "keluar"}</span><span className="sm:hidden">{incoming ? "Masuk" : "Keluar"}</span>
    </DialogTrigger>
    <DialogContent>
      <DialogHeader><DialogTitle>Catat kas {incoming ? "masuk" : "keluar"}</DialogTitle><DialogDescription>Movement akan menjadi bagian permanen dari perhitungan shift.</DialogDescription></DialogHeader>
      <form action={form.action} className="grid gap-5">
        <input name="shiftId" type="hidden" value={shift.id} /><input name="outletId" type="hidden" value={shift.outletId} /><input name="operationToken" type="hidden" value={token} /><input name="direction" type="hidden" value={direction} />
        <FieldGroup>
          <Field data-invalid={Boolean(form.state.fieldErrors?.category)}><FieldLabel htmlFor={`${direction}-category`}>Kategori</FieldLabel><SearchableSelect defaultValue={defaultCategory} id={`${direction}-category`} name="category" options={options} required /><FieldError errors={toFieldErrors(form.state.fieldErrors?.category)} /></Field>
          <MoneyField errors={form.state.fieldErrors?.amount} id={`${direction}-amount`} label="Nominal (Rp)" name="amount" />
          <Field data-invalid={Boolean(form.state.fieldErrors?.reason)}><FieldLabel htmlFor={`${direction}-reason`}>Alasan</FieldLabel><Textarea aria-invalid={Boolean(form.state.fieldErrors?.reason)} id={`${direction}-reason`} maxLength={240} minLength={5} name="reason" placeholder={incoming ? "Contoh: Tambahan uang kembalian" : "Contoh: Setoran kas ke brankas"} required /><FieldError errors={toFieldErrors(form.state.fieldErrors?.reason)} /></Field>
        </FieldGroup>
        <ActionFeedback state={form.state} />
        <DialogFooter><Button disabled={form.pending || !token} type="submit">{form.pending && <Spinner />}{form.pending ? "Menyimpan…" : "Simpan movement"}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}

/** Collects a blind physical count without exposing expected cash before commit. */
export function CloseShiftDialog({ shift }: { shift: CashShiftListItem }) {
  const form = useAutoCloseDialogAction(closeCashShiftAction, initialShiftActionState);
  const [token, setToken] = useState("");
  return <Dialog onOpenChange={(open) => { form.setOpen(open); if (open) setToken(crypto.randomUUID()); }} open={form.open}>
    <DialogTrigger render={<Button className="min-h-11 px-2 sm:px-3" size="sm" variant="destructive" />}><Square aria-hidden="true" /><span className="hidden sm:inline">Tutup shift</span><span className="sm:hidden">Tutup</span></DialogTrigger>
    <DialogContent><DialogHeader><DialogTitle>Tutup shift</DialogTitle><DialogDescription>Hitung uang fisik tanpa melihat saldo seharusnya. Perbandingan baru tampil setelah shift ditutup.</DialogDescription></DialogHeader>
      <form action={form.action} className="grid gap-5"><input name="shiftId" type="hidden" value={shift.id} /><input name="outletId" type="hidden" value={shift.outletId} /><input name="closeToken" type="hidden" value={token} />
        <MoneyField autoFocus errors={form.state.fieldErrors?.actualCash} id={`${shift.id}-actual-cash`} label="Kas fisik aktual (Rp)" name="actualCash" />
        <ActionFeedback state={form.state} /><DialogFooter><Button disabled={form.pending || !token} type="submit" variant="destructive">{form.pending && <Spinner />}{form.pending ? "Menutup…" : "Konfirmasi tutup shift"}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}

/** Allows an authorized owner or manager to close another operator's shift. */
export function ForceCloseShiftDialog({ shift }: { shift: CashShiftListItem }) {
  const form = useAutoCloseDialogAction(forceCloseCashShiftAction, initialShiftActionState);
  const [token, setToken] = useState("");
  return <Dialog onOpenChange={(open) => { form.setOpen(open); if (open) setToken(crypto.randomUUID()); }} open={form.open}>
    <DialogTrigger render={<Button size="sm" variant="outline" />}>Tutup paksa</DialogTrigger>
    <DialogContent><DialogHeader><DialogTitle>Tutup shift {shift.openedByName}</DialogTitle><DialogDescription>Masukkan hasil hitung fisik dan alasan. Tindakan ini dicatat sebagai force-close.</DialogDescription></DialogHeader>
      <form action={form.action} className="grid gap-5"><input name="shiftId" type="hidden" value={shift.id} /><input name="outletId" type="hidden" value={shift.outletId} /><input name="closeToken" type="hidden" value={token} />
        <MoneyField errors={form.state.fieldErrors?.actualCash} id={`${shift.id}-force-actual`} label="Kas fisik aktual (Rp)" name="actualCash" />
        <Field data-invalid={Boolean(form.state.fieldErrors?.reason)}><FieldLabel htmlFor={`${shift.id}-force-reason`}>Alasan penutupan</FieldLabel><Textarea aria-invalid={Boolean(form.state.fieldErrors?.reason)} id={`${shift.id}-force-reason`} maxLength={240} minLength={5} name="reason" required /><FieldError errors={toFieldErrors(form.state.fieldErrors?.reason)} /></Field>
        <ActionFeedback state={form.state} /><DialogFooter><Button disabled={form.pending || !token} type="submit" variant="destructive">{form.pending && <Spinner />}{form.pending ? "Menutup…" : "Tutup shift staf"}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}

/** Renders one accessible Rupiah input with inline field errors. */
function MoneyField({ errors, id, label, name, autoFocus = false }: { errors?: string[]; id: string; label: string; name: string; autoFocus?: boolean }) {
  return <Field data-invalid={Boolean(errors)}><FieldLabel htmlFor={id}>{label}</FieldLabel><CurrencyInput aria-invalid={Boolean(errors)} autoFocus={autoFocus} id={id} name={name} placeholder="0" required /><FieldError errors={toFieldErrors(errors)} /></Field>;
}

/** Displays non-success action feedback without relying on color alone. */
function ActionFeedback({ state }: { state: ShiftActionState }) {
  if (state.status === "idle" || state.status === "success") return null;
  return <Alert variant="destructive"><AlertDescription>{state.message}</AlertDescription></Alert>;
}

/** Converts action field messages into the shadcn FieldError shape. */
function toFieldErrors(errors?: string[]) { return errors?.map((message) => ({ message })); }

/** Formats a decimal string as concise Indonesian Rupiah. */

/** Formats an ISO timestamp in the outlet's configured timezone. */
function formatDateTime(value: string, timezone: string) { return new Intl.DateTimeFormat("id-ID", { timeZone: timezone, dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
