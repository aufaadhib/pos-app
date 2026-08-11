import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight, Search, ShieldCheck, UserRound } from "lucide-react";

import { StaffAccountActions, StaffFormDialog } from "@/components/staff/staff-dialogs";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { isAppRole, roleHasPermission, roleLabels } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { getManageableOutlets, getManageablePositions, getStaff } from "@/lib/staff/queries";
import { staffSearchSchema } from "@/lib/staff/validation";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Staf", description: "Kelola akses dan penugasan staf Glutong POS." };

export default async function StaffPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [session, rawSearch] = await Promise.all([requirePermission({ staff: ["view"] }), searchParams]);
  if (!isAppRole(session.user.role)) redirect("/workspace?access=denied");
  const role = session.user.role;
  const canManage = roleHasPermission(role, { staff: ["manage"] });
  const search = staffSearchSchema.parse({ q: singleValue(rawSearch.q), role: singleValue(rawSearch.role), status: singleValue(rawSearch.status), outlet: singleValue(rawSearch.outlet), page: singleValue(rawSearch.page) });
  const [staffPage, outlets, positions] = await Promise.all([getStaff(search, { id: session.user.id, role }), getManageableOutlets(session.user.id, role), getManageablePositions()]);
  return <main className="mx-auto max-w-[90rem] px-4 py-6 sm:px-8 sm:py-8 lg:px-10" id="main-content">
      <section className="rounded-2xl border bg-card p-5 sm:flex sm:items-end sm:justify-between sm:gap-8 sm:p-6"><div><p className="text-sm font-medium text-muted-foreground">Tim & penugasan</p><h1 className="mt-1 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">Staf & akses</h1><p className="mt-2 max-w-2xl leading-6 text-muted-foreground">Role menentukan akses aplikasi; jabatan menjelaskan pekerjaan staf.</p></div>{canManage && <div className="mt-5 sm:mt-0"><StaffFormDialog actorRole={role} outlets={outlets} positions={positions} /></div>}</section>
      <form className="mt-4 grid gap-3 rounded-xl border bg-card p-3 md:grid-cols-[1fr_10rem_10rem_13rem_auto]" method="get">
        <label className="relative"><span className="sr-only">Cari staf</span><Search aria-hidden="true" className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-10" defaultValue={search.q} name="q" placeholder="Cari nama atau email" /></label>
        <FilterSelect defaultValue={search.role} label="Peran" name="role" options={[['all','Semua peran'],['manager','Manajer'],['cashier','Kasir'],['staff','Staf']]} />
        <FilterSelect defaultValue={search.status} label="Status" name="status" options={[['active','Aktif'],['inactive','Nonaktif'],['all','Semua status']]} />
        <FilterSelect defaultValue={search.outlet} label="Outlet" name="outlet" options={[["","Semua outlet"], ...outlets.map((outlet) => [outlet.id, outlet.name] as [string,string])]} />
        <Button type="submit" variant="outline">Terapkan</Button>
      </form>
      {staffPage.items.length === 0 ? <section className="mt-8 grid min-h-64 place-items-center rounded-xl border border-dashed p-8 text-center"><div><UserRound className="mx-auto size-8 text-muted-foreground" /><h2 className="mt-4 font-heading text-xl font-semibold">Tidak ada staf pada tampilan ini</h2><p className="mt-2 text-sm text-muted-foreground">Ubah filter atau tambahkan staf baru ke outlet aktif.</p></div></section> : <section aria-label="Daftar staf" className="mt-6 grid gap-3">
        {staffPage.items.map((staff) => {
          const editable = canManage && staff.role !== "owner" && staff.id !== session.user.id;
          return <Card className={cn("border shadow-none", staff.banned && "opacity-70")} key={staff.id}><CardHeader className="grid grid-cols-[auto_1fr] gap-3 md:grid-cols-[auto_minmax(12rem,1fr)_minmax(12rem,0.8fr)_auto] md:items-center">
            <span className="grid size-12 place-items-center rounded-xl bg-muted"><UserRound aria-hidden="true" className="size-5" /></span>
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate font-heading text-lg font-semibold">{staff.name}</h2><Badge variant={staff.banned ? "outline" : "secondary"}>{staff.banned ? "Nonaktif" : "Aktif"}</Badge>{staff.mustChangePassword && <Badge variant="outline">Akses sementara</Badge>}</div><p className="mt-1 truncate text-sm text-muted-foreground">{staff.email}</p></div>
            <div className="col-span-2 flex flex-wrap gap-2 md:col-span-1"><Badge className="font-mono uppercase" variant="outline">{roleLabels[staff.role]}</Badge>{staff.jobPosition && <Badge variant="secondary">{staff.jobPosition.name}</Badge>}{staff.role === "owner" ? <span className="text-sm text-muted-foreground">Seluruh outlet</span> : staff.outlets.map((outlet) => <Badge key={outlet.id} variant="secondary">{outlet.code}</Badge>)}</div>
            {editable && <div className="col-span-2 flex items-start justify-end gap-1 md:col-span-1"><StaffFormDialog actorRole={role} outlets={outlets} positions={positions} staff={staff} /><StaffAccountActions staff={staff} /></div>}
          </CardHeader></Card>;
        })}
      </section>}
      <StaffPagination page={staffPage.page} search={search} totalPages={staffPage.totalPages} />
      <aside className="mt-8 flex items-start gap-3 rounded-xl border bg-muted/35 p-4 text-sm text-muted-foreground"><ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-success" /><p>Kata sandi sementara hanya ditampilkan sekali. Reset password mencabut seluruh session staf dan mewajibkan penggantian pada login berikutnya.</p></aside>
    </main>;
}

function FilterSelect({ defaultValue, label, name, options }: { defaultValue: string; label: string; name: string; options: [string,string][] }) { return <label><span className="sr-only">{label}</span><SearchableSelect aria-label={label} defaultValue={defaultValue} name={name} options={options.map(([value, text]) => ({ label: text, value }))} placeholder={`Cari ${label.toLocaleLowerCase("id-ID")}`} /></label>; }
function StaffPagination({ page, totalPages, search }: { page: number; totalPages: number; search: ReturnType<typeof staffSearchSchema.parse> }) { if (totalPages <= 1) return null; return <nav aria-label="Halaman staf" className="mt-6 flex items-center justify-between"><Link aria-disabled={page <= 1} className={cn(buttonVariants({ variant: "outline" }), page <= 1 && "pointer-events-none opacity-50")} href={staffHref(search,page-1)}><ChevronLeft />Sebelumnya</Link><span className="font-mono text-xs">{page} / {totalPages}</span><Link aria-disabled={page >= totalPages} className={cn(buttonVariants({ variant: "outline" }), page >= totalPages && "pointer-events-none opacity-50")} href={staffHref(search,page+1)}>Berikutnya<ChevronRight /></Link></nav>; }
function staffHref(search: ReturnType<typeof staffSearchSchema.parse>, page: number) { const params = new URLSearchParams(); if (search.q) params.set("q",search.q); if (search.role !== "all") params.set("role",search.role); if (search.status !== "active") params.set("status",search.status); if (search.outlet) params.set("outlet",search.outlet); if (page > 1) params.set("page",String(page)); const query=params.toString(); return query ? `/staff?${query}` : "/staff"; }
function singleValue(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
