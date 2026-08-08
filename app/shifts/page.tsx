import type { Metadata } from "next";
import Link from "next/link";
import { Banknote, ChevronLeft, ChevronRight, Clock3, Play, WalletCards } from "lucide-react";
import { notFound } from "next/navigation";

import { CashMovementDialog, CloseShiftDialog, ForceCloseShiftDialog } from "@/components/shifts/shift-controls";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { isAppRole } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { requireActiveOutlet } from "@/lib/outlets/context";
import { getCashShiftPage } from "@/lib/shifts/queries";
import type { CashShiftListItem, ShiftActor } from "@/lib/shifts/types";
import { cashShiftSearchSchema } from "@/lib/shifts/validation";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Shift Kasir" };

type ShiftsPageProps = { searchParams: Promise<{ page?: string; status?: string }> };

/** Loads fresh outlet-scoped shift activity and role-appropriate controls. */
export default async function ShiftsPage({ searchParams }: ShiftsPageProps) {
  const [session, rawSearch] = await Promise.all([requirePermission({ shift: ["view"] }), searchParams]);
  if (!isAppRole(session.user.role)) notFound();
  const outlet = await requireActiveOutlet(session);
  const search = cashShiftSearchSchema.parse(rawSearch);
  const actor: ShiftActor = { id: session.user.id, name: session.user.name, email: session.user.email, role: session.user.role };
  const data = await getCashShiftPage({ outletId: outlet.id, actor, ...search });
  if (!data) notFound();
  const ownShift = data.current?.outletId === outlet.id ? data.current : null;

  return <main className="mx-auto max-w-7xl px-4 py-6 pb-28 sm:px-8 sm:py-8 lg:px-10 lg:pb-8" id="main-content">
    <section className="overflow-hidden rounded-2xl border bg-card shadow-sm sm:grid sm:grid-cols-[minmax(0,1.3fr)_minmax(16rem,0.7fr)]">
      <div className="border-l-4 border-primary p-5 sm:p-7"><p className="text-sm font-medium text-muted-foreground">Operasional kas · {outlet.name}</p><h1 className="mt-1 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">Shift kasir</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Buka kas, catat movement, dan cocokkan uang fisik tanpa menghapus jejak finansial.</p></div>
      <div className="border-t bg-muted/25 p-5 sm:border-t-0 sm:border-l sm:p-7">{ownShift ? <><Badge>Shift Anda aktif</Badge><p className="mt-3 font-semibold">Sejak {formatDateTime(ownShift.openedAt, outlet.timezone)}</p><p className="mt-1 text-sm text-muted-foreground">Saldo awal {formatRupiah(ownShift.openingCash)}</p><div className="mt-4 flex flex-wrap gap-2"><CashMovementDialog direction="IN" shift={ownShift} /><CashMovementDialog direction="OUT" shift={ownShift} /><CloseShiftDialog shift={ownShift} /></div></> : <><Badge variant="outline">Belum ada shift pribadi</Badge><p className="mt-3 text-sm leading-6 text-muted-foreground">Buka shift dari register sebelum menerima pembayaran.</p><Link className={cn(buttonVariants(), "mt-4")} href="/pos"><Play aria-hidden="true" />Buka register</Link></>}</div>
    </section>

    {session.user.role !== "cashier" && <section aria-labelledby="open-shifts-heading" className="mt-8"><div><h2 className="font-heading text-xl font-semibold" id="open-shifts-heading">Shift terbuka</h2><p className="mt-1 text-sm text-muted-foreground">Pengelola dapat memeriksa dan menutup shift staf pada outlet aktif.</p></div><div className="mt-4 grid gap-3 lg:grid-cols-2">{data.openShifts.length ? data.openShifts.map((shift) => <Card className="border shadow-none" key={shift.id}><CardHeader className="pb-3"><div className="flex items-start justify-between gap-3"><div><CardTitle className="text-base">{shift.openedByName}</CardTitle><CardDescription>{formatDateTime(shift.openedAt, outlet.timezone)}</CardDescription></div><Badge>Terbuka</Badge></div></CardHeader><CardContent className="flex flex-wrap items-center justify-between gap-3"><span className="text-sm text-muted-foreground">Modal {formatRupiah(shift.openingCash)}</span><div className="flex gap-2"><Link className={buttonVariants({ size: "sm", variant: "ghost" })} href={`/shifts/${shift.id}`}>Rincian</Link>{shift.id !== ownShift?.id && <ForceCloseShiftDialog shift={shift} />}</div></CardContent></Card>) : <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground lg:col-span-2">Tidak ada shift terbuka pada outlet ini.</div>}</div></section>}

    <section aria-labelledby="history-heading" className="mt-8"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="font-heading text-xl font-semibold" id="history-heading">Riwayat shift</h2><p className="mt-1 text-sm text-muted-foreground">{data.totalItems} shift dalam cakupan tampilan.</p></div><form className="flex gap-2" method="get"><SearchableSelect defaultValue={search.status} name="status" options={[{ value: "all", label: "Semua status" }, { value: "OPEN", label: "Terbuka" }, { value: "CLOSED", label: "Ditutup" }]} /><Button type="submit" variant="outline">Terapkan</Button></form></div>
      <div className="mt-4 grid gap-3">{data.history.length ? data.history.map((shift) => <ShiftHistoryCard key={shift.id} shift={shift} timezone={outlet.timezone} />) : <div className="rounded-xl border border-dashed p-8 text-center"><WalletCards aria-hidden="true" className="mx-auto size-8 text-muted-foreground" /><p className="mt-3 font-semibold">Belum ada riwayat shift</p><p className="mt-1 text-sm text-muted-foreground">Shift yang dibuka akan muncul di sini.</p></div>}</div>
      <nav aria-label="Paginasi shift" className="mt-6 flex items-center justify-between"><Link aria-disabled={data.page <= 1} className={cn(buttonVariants({ variant: "outline" }), data.page <= 1 && "pointer-events-none opacity-50")} href={shiftHref(data.page - 1, search.status)}><ChevronLeft aria-hidden="true" />Sebelumnya</Link><span className="font-mono text-xs text-muted-foreground">{data.page} / {data.totalPages}</span><Link aria-disabled={data.page >= data.totalPages} className={cn(buttonVariants({ variant: "outline" }), data.page >= data.totalPages && "pointer-events-none opacity-50")} href={shiftHref(data.page + 1, search.status)}>Berikutnya<ChevronRight aria-hidden="true" /></Link></nav>
    </section>
  </main>;
}

/** Renders one compact shift history row that remains readable on phones. */
function ShiftHistoryCard({ shift, timezone }: { shift: CashShiftListItem; timezone: string }) {
  return <Link className="rounded-xl focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none" href={`/shifts/${shift.id}`}><Card className="border py-4 shadow-none transition-colors hover:border-primary"><CardContent className="flex flex-col gap-3 px-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted"><Banknote aria-hidden="true" className="size-5" /></span><div className="min-w-0"><p className="truncate font-semibold">{shift.openedByName}</p><p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Clock3 aria-hidden="true" className="size-3.5" />{formatDateTime(shift.openedAt, timezone)}</p></div></div><div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end"><Badge variant={shift.status === "OPEN" ? "default" : "outline"}>{shift.status === "OPEN" ? "Terbuka" : shift.closeMode === "FORCED" ? "Ditutup pengelola" : "Ditutup"}</Badge>{shift.cashDifference !== null && <span className={cn("font-mono text-sm font-semibold", Number(shift.cashDifference) === 0 ? "text-success" : "text-destructive")}>Selisih {formatRupiah(shift.cashDifference)}</span>}</div></CardContent></Card></Link>;
}

/** Builds a stable shift history URL while preserving the active status filter. */
function shiftHref(page: number, status: string) { return `/shifts?page=${Math.max(1, page)}&status=${status}`; }

/** Formats a decimal string as Indonesian Rupiah. */
function formatRupiah(value: string) { return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(value)); }

/** Formats one ISO timestamp using the active outlet timezone. */
function formatDateTime(value: string, timezone: string) { return new Intl.DateTimeFormat("id-ID", { timeZone: timezone, dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
