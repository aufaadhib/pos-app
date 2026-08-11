import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight, MapPin, Search, Store } from "lucide-react";

import { OutletFormDialog, OutletStatusAction } from "@/components/outlets/outlet-dialogs";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { isAppRole, roleHasPermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { formatOutletAddress } from "@/lib/outlets/normalization";
import { getOutlets } from "@/lib/outlets/queries";
import { outletSearchSchema } from "@/lib/outlets/validation";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Outlet", description: "Kelola lokasi operasional Glutong POS." };

export default async function OutletsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [session, rawSearch] = await Promise.all([requirePermission({ outlet: ["view"] }), searchParams]);
  if (!isAppRole(session.user.role)) redirect("/workspace?access=denied");
  const role = session.user.role;
  const canManage = roleHasPermission(role, { outlet: ["manage"] });
  const search = outletSearchSchema.parse({ q: singleValue(rawSearch.q), status: singleValue(rawSearch.status), page: singleValue(rawSearch.page) });
  const outlets = await getOutlets(search, { id: session.user.id, role });
  return (
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-8 sm:py-8 lg:px-10" id="main-content">
        <section className="rounded-2xl border bg-card p-5 sm:flex sm:items-end sm:justify-between sm:gap-8 sm:p-6">
          <div><p className="text-sm font-medium text-muted-foreground">Operasional</p><h1 className="mt-1 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">Outlet</h1><p className="mt-2 max-w-2xl leading-6 text-muted-foreground">Lokasi, zona waktu, dan cakupan staf menjadi konteks sebelum layanan dimulai.</p></div>
          {canManage && <div className="mt-5 sm:mt-0"><OutletFormDialog /></div>}
        </section>
        <form className="mt-4 grid gap-3 rounded-xl border bg-card p-3 sm:grid-cols-[1fr_12rem_auto]" method="get">
          <label className="relative"><span className="sr-only">Cari outlet</span><Search aria-hidden="true" className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-10" defaultValue={search.q} name="q" placeholder="Cari nama, kode, atau kota" /></label>
          <label><span className="sr-only">Status outlet</span><SearchableSelect aria-label="Status outlet" defaultValue={search.status} name="status" options={[{ label: "Aktif", value: "active" }, ...(canManage ? [{ label: "Arsip", value: "archived" }, { label: "Semua status", value: "all" }] : [])]} placeholder="Cari status" /></label>
          <Button type="submit" variant="outline">Terapkan</Button>
        </form>
        {outlets.items.length === 0 ? <section className="mt-8 grid min-h-64 place-items-center rounded-xl border border-dashed p-8 text-center"><div><Store className="mx-auto size-8 text-muted-foreground" /><h2 className="mt-4 font-heading text-xl font-semibold">Belum ada outlet pada tampilan ini</h2><p className="mt-2 text-sm text-muted-foreground">{canManage ? "Buat outlet pertama atau ubah filter pencarian." : "Hubungi pemilik untuk menambahkan penugasan outlet."}</p></div></section> : (
          <section aria-label="Daftar outlet" className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {outlets.items.map((outlet) => <Card className={cn("border shadow-none", outlet.status === "ARCHIVED" && "opacity-70")} key={outlet.id}>
              <CardHeader className="grid grid-cols-[auto_1fr_auto] items-start gap-3">
                <span className="grid size-12 place-items-center rounded-xl bg-accent font-mono text-xs font-bold">{outlet.code.slice(0, 3)}</span>
                <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate font-heading text-lg font-semibold">{outlet.name}</h2><Badge variant={outlet.status === "ACTIVE" ? "secondary" : "outline"}>{outlet.status === "ACTIVE" ? "Aktif" : "Arsip"}</Badge></div><p className="mt-1 font-mono text-xs text-muted-foreground">{outlet.code} · {outlet.timezone}</p></div>
                {canManage && <div className="flex"><OutletFormDialog outlet={outlet} /><OutletStatusAction outlet={outlet} /></div>}
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-4"><p className="flex items-start gap-2 text-sm leading-6 text-muted-foreground"><MapPin aria-hidden="true" className="mt-1 size-4 shrink-0" />{formatOutletAddress(outlet)}</p><div className="mt-auto flex items-center justify-between border-t pt-4"><span className="text-sm text-muted-foreground">Staf ditugaskan</span><span className="font-mono font-bold">{outlet.staffCount}</span></div></CardContent>
            </Card>)}
          </section>
        )}
        <Pagination page={outlets.page} totalPages={outlets.totalPages} search={search} />
      </main>
  );
}

function Pagination({ page, totalPages, search }: { page: number; totalPages: number; search: ReturnType<typeof outletSearchSchema.parse> }) {
  if (totalPages <= 1) return null;
  return <nav aria-label="Halaman outlet" className="mt-6 flex items-center justify-between"><Link aria-disabled={page <= 1} className={cn(buttonVariants({ variant: "outline" }), page <= 1 && "pointer-events-none opacity-50")} href={outletHref(search, page - 1)}><ChevronLeft />Sebelumnya</Link><span className="font-mono text-xs">{page} / {totalPages}</span><Link aria-disabled={page >= totalPages} className={cn(buttonVariants({ variant: "outline" }), page >= totalPages && "pointer-events-none opacity-50")} href={outletHref(search, page + 1)}>Berikutnya<ChevronRight /></Link></nav>;
}

function outletHref(search: ReturnType<typeof outletSearchSchema.parse>, page: number) { const params = new URLSearchParams(); if (search.q) params.set("q", search.q); if (search.status !== "active") params.set("status", search.status); if (page > 1) params.set("page", String(page)); const query = params.toString(); return query ? `/outlets?${query}` : "/outlets"; }
function singleValue(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
