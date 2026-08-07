import type { Metadata } from "next";
import Link from "next/link";
import { Store } from "lucide-react";

import { BrandMark } from "@/components/brand-mark";
import { OutletSelector } from "@/components/outlets/outlet-selector";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isAppRole } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { getAccessibleOutlets } from "@/lib/outlets/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pilih Outlet" };

export default async function SelectOutletPage() {
  const session = await requirePermission({ outlet: ["view"] });
  const role = isAppRole(session.user.role) ? session.user.role : "cashier";
  const outlets = await getAccessibleOutlets(session.user.id, role);
  return <div className="min-h-svh bg-background"><header className="border-b bg-card"><div className="mx-auto flex min-h-20 max-w-5xl items-center justify-between px-5"><BrandMark compact /><div className="flex gap-2"><ThemeToggle /><SignOutButton /></div></div></header><main className="mx-auto grid max-w-5xl gap-8 px-5 py-8 lg:grid-cols-[0.8fr_1.2fr] lg:py-16" id="main-content"><section><p className="font-mono text-xs font-semibold tracking-widest text-success uppercase">Konteks layanan</p><h1 className="mt-3 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">Pilih outlet kerja.</h1><p className="mt-3 max-w-md leading-7 text-muted-foreground">Jam, shift, stok, dan transaksi berikutnya akan mengikuti outlet ini. Anda dapat menggantinya kembali dari header.</p></section><Card className="border shadow-none"><CardHeader><CardTitle>Outlet tersedia</CardTitle><CardDescription>{outlets.length} lokasi aktif dalam cakupan akun Anda.</CardDescription></CardHeader><CardContent>{outlets.length > 0 ? <OutletSelector activeOutletId={session.session.activeOutletId} outlets={outlets} /> : <div className="grid min-h-52 place-items-center rounded-xl border border-dashed p-6 text-center"><div><Store className="mx-auto size-8 text-muted-foreground" /><p className="mt-4 font-semibold">Belum ada outlet aktif</p><p className="mt-2 text-sm text-muted-foreground">{role === "owner" ? "Buat outlet pertama untuk memulai." : "Minta pemilik menambahkan penugasan outlet Anda."}</p>{role === "owner" && <Link className={`${buttonVariants()} mt-5`} href="/outlets">Buat outlet</Link>}</div></div>}</CardContent></Card></main></div>;
}
