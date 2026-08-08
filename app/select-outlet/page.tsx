import type { Metadata } from "next";
import Link from "next/link";
import { Clock3, Store } from "lucide-react";

import { OutletSelector } from "@/components/outlets/outlet-selector";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isAppRole } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { getAccessibleOutlets } from "@/lib/outlets/queries";
import { getCurrentCashShift } from "@/lib/shifts/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pilih Outlet" };

export default async function SelectOutletPage() {
  const session = await requirePermission({ outlet: ["view"] });
  const role = isAppRole(session.user.role) ? session.user.role : "cashier";
  const [outlets, shift] = await Promise.all([
    getAccessibleOutlets(session.user.id, role),
    getCurrentCashShift(session.user.id),
  ]);
  return <main className="mx-auto grid max-w-5xl gap-8 px-5 py-8 lg:grid-cols-[0.8fr_1.2fr] lg:py-16" id="main-content"><section><p className="font-mono text-xs font-semibold tracking-widest text-success uppercase">Konteks layanan</p><h1 className="mt-3 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">Pilih outlet kerja.</h1><p className="mt-3 max-w-md leading-7 text-muted-foreground">Jam, shift, stok, dan transaksi berikutnya akan mengikuti outlet ini. Anda dapat menggantinya kembali dari header.</p>{shift && <div className="mt-6 rounded-xl border border-primary/30 bg-primary/5 p-4" role="status"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground"><Clock3 aria-hidden="true" className="size-5" /></span><div><p className="text-xs font-semibold tracking-wide text-primary uppercase">Shift sedang aktif</p><p className="mt-1 font-heading text-lg font-semibold">{shift.outletName}</p></div></div><p className="mt-3 text-sm leading-6 text-muted-foreground">Outlet lain dikunci sampai shift ini ditutup agar transaksi dan laci kas tidak tercampur.</p><Link className={`${buttonVariants({ size: "sm", variant: "outline" })} mt-4`} href={`/shifts/${shift.id}`}>Buka rincian shift</Link></div>}</section><Card className="border shadow-none"><CardHeader><CardTitle>Outlet tersedia</CardTitle><CardDescription>{outlets.length} lokasi aktif dalam cakupan akun Anda.</CardDescription></CardHeader><CardContent>{outlets.length > 0 ? <OutletSelector activeOutletId={session.session.activeOutletId} activeShiftOutletId={shift?.outletId} outlets={outlets} /> : <div className="grid min-h-52 place-items-center rounded-xl border border-dashed p-6 text-center"><div><Store className="mx-auto size-8 text-muted-foreground" /><p className="mt-4 font-semibold">Belum ada outlet aktif</p><p className="mt-2 text-sm text-muted-foreground">{role === "owner" ? "Buat outlet pertama untuk memulai." : "Minta pemilik menambahkan penugasan outlet Anda."}</p>{role === "owner" && <Link className={`${buttonVariants()} mt-5`} href="/outlets">Buat outlet</Link>}</div></div>}</CardContent></Card></main>;
}
