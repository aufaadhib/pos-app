import type { Metadata } from "next";
import Link from "next/link";
import { AlertCircle, BookOpen, Clock3, Coffee, HandCoins, MapPin, ReceiptText, ShieldCheck, Store, Users, WalletCards } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isAppRole, roleLabels } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { requireActiveOutlet } from "@/lib/outlets/context";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Workspace",
};

type WorkspacePageProps = {
  searchParams: Promise<{ access?: string }>;
};

export default async function WorkspacePage({ searchParams }: WorkspacePageProps) {
  const [session, query] = await Promise.all([
    requirePermission({ workspace: ["view"] }),
    searchParams,
  ]);
  const role = isAppRole(session.user.role) ? session.user.role : "cashier";
  const activeOutlet = await requireActiveOutlet(session);
  const currentTime = new Intl.DateTimeFormat("id-ID", {
    timeZone: activeOutlet.timezone,
    hour: "2-digit",
    minute: "2-digit",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  return (
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-8 sm:py-8 lg:px-10" id="main-content">
        {query.access === "denied" && (
          <Alert className="mb-6" variant="destructive">
            <AlertCircle aria-hidden="true" />
            <AlertTitle>Akses dibatasi</AlertTitle>
            <AlertDescription>
              Akun Anda tidak memiliki izin untuk membuka halaman tersebut.
            </AlertDescription>
          </Alert>
        )}

        <section className="grid overflow-hidden rounded-2xl border bg-card lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
          <div className="border-l-4 border-primary p-5 sm:p-7">
            <p className="text-sm font-medium text-muted-foreground">Ringkasan layanan</p>
            <h1 className="mt-2 text-balance font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
              Selamat datang, {session.user.name}.
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-6 text-muted-foreground">
              Katalog dan transaksi outlet siap digunakan sesuai cakupan akses Anda.
            </p>
          </div>
          <Card className="rounded-none border-0 border-t bg-muted/35 shadow-none ring-0 lg:border-t-0 lg:border-l">
            <CardHeader>
              <CardDescription>Outlet aktif</CardDescription>
              <CardTitle className="text-xl">{activeOutlet.name}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-3">
              <Badge variant="secondary" className="font-mono uppercase">
                {roleLabels[role]}
              </Badge>
              <span className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                <Clock3 aria-hidden="true" className="size-4" />
                {currentTime}
              </span>
              <span className="flex items-center gap-2 font-mono text-xs text-muted-foreground"><MapPin aria-hidden="true" className="size-4" />{activeOutlet.code}</span>
            </CardContent>
          </Card>
        </section>

        <section aria-labelledby="module-heading" className="mt-8">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 id="module-heading" className="font-heading text-2xl font-semibold">
                Area kerja
              </h2>
              <p className="mt-1 text-muted-foreground">Ruang yang disiapkan untuk operasional outlet.</p>
            </div>
            <Badge variant="outline">{roleLabels[role]}</Badge>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Link className="rounded-xl focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none" href="/catalog">
              <Card className="h-full border border-border shadow-none transition-colors hover:border-primary">
                <CardHeader>
                  <BookOpen aria-hidden="true" className="mb-3 size-6 text-primary" />
                  <CardTitle>Katalog menu</CardTitle>
                  <CardDescription>Lihat kategori, produk, SKU, dan harga dasar.</CardDescription>
                </CardHeader>
              </Card>
            </Link>
            <Link className="rounded-xl focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none" href="/pos">
              <Card className="h-full border border-border shadow-none transition-colors hover:border-primary"><CardHeader>
                <Coffee aria-hidden="true" className="mb-3 size-6 text-primary" />
                <CardTitle>Kasir & pesanan</CardTitle>
                <CardDescription>Buat pesanan dine-in atau takeaway dan selesaikan pembayaran.</CardDescription>
              </CardHeader></Card>
            </Link>
            <Link className="rounded-xl focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none" href="/shifts"><Card className="h-full border border-border shadow-none transition-colors hover:border-primary"><CardHeader><WalletCards aria-hidden="true" className="mb-3 size-6 text-primary" /><CardTitle>Shift kasir</CardTitle><CardDescription>Buka kas, catat movement, dan cocokkan uang fisik saat tutup shift.</CardDescription></CardHeader></Card></Link>
            <Link className="rounded-xl focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none" href="/transactions"><Card className="h-full border border-border shadow-none transition-colors hover:border-primary"><CardHeader><ReceiptText aria-hidden="true" className="mb-3 size-6 text-primary" /><CardTitle>Riwayat transaksi</CardTitle><CardDescription>Lihat struk dan rincian penjualan outlet aktif.</CardDescription></CardHeader></Card></Link>
            {role !== "cashier" && <Link className="rounded-xl focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none" href="/settlements"><Card className="h-full border border-border shadow-none transition-colors hover:border-primary"><CardHeader><HandCoins aria-hidden="true" className="mb-3 size-6 text-primary" /><CardTitle>Ojol & settlement</CardTitle><CardDescription>Atur harga channel dan cocokkan dana platform yang masuk.</CardDescription></CardHeader></Card></Link>}
            <Link className="rounded-xl focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none" href="/outlets"><Card className="h-full border border-border shadow-none transition-colors hover:border-primary"><CardHeader><Store aria-hidden="true" className="mb-3 size-6 text-success" /><CardTitle>Outlet</CardTitle><CardDescription>Lihat lokasi, zona waktu, dan cakupan operasional.</CardDescription></CardHeader></Card></Link>
            {role !== "cashier" && <Link className="rounded-xl focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none" href="/staff"><Card className="h-full border border-border shadow-none transition-colors hover:border-primary"><CardHeader><Users aria-hidden="true" className="mb-3 size-6 text-success" /><CardTitle>Staf & akses</CardTitle><CardDescription>Kelola role, penugasan outlet, dan status akun.</CardDescription></CardHeader></Card></Link>}
            <Card className="border border-border shadow-none">
              <CardHeader>
                <ShieldCheck aria-hidden="true" className="mb-3 size-6 text-foreground" />
                <CardTitle>Akses berbasis peran</CardTitle>
                <CardDescription>Setiap area menolak akses secara default tanpa permission.</CardDescription>
              </CardHeader>
            </Card>
          </div>
        </section>
      </main>
  );
}
