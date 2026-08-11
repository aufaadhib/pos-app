import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { redirect } from "next/navigation";
import { RosterPlanner } from "@/components/attendance/roster-planner";
import { buttonVariants } from "@/components/ui/button";
import { addIsoDays, mondayOf } from "@/lib/attendance/roster";
import { getRosterWorkspace } from "@/lib/attendance/roster-queries";
import { isAppRole } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { requireActiveOutlet } from "@/lib/outlets/context";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Roster staf" };

/** Loads one fresh outlet week and its permission-scoped roster editor. */
export default async function AttendanceRosterPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const [session, search] = await Promise.all([requirePermission({ attendance: ["schedule"] }), searchParams]);
  if (!isAppRole(session.user.role) || (session.user.role !== "owner" && session.user.role !== "manager")) redirect("/workspace?access=denied");
  const outlet = await requireActiveOutlet(session);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: outlet.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const requested = /^\d{4}-\d{2}-\d{2}$/.test(search.week ?? "") ? search.week! : today;
  const weekStart = mondayOf(requested);
  const data = await getRosterWorkspace(outlet.id, { id: session.user.id, name: session.user.name, email: session.user.email, role: session.user.role }, weekStart);
  return <main className="mx-auto w-full max-w-[96rem] px-4 py-6 pb-24 sm:px-8 sm:py-8 lg:pb-8" id="main-content"><header className="mb-5 rounded-2xl border bg-card p-5 sm:p-6"><Link className={buttonVariants({ variant: "ghost", className: "-ml-3 min-h-11" })} href="/attendance"><ChevronLeft aria-hidden="true" />Kembali ke absensi</Link><div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-medium text-primary">{outlet.code} · {outlet.name}</p><h1 className="mt-1 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">Roster staf</h1><p className="mt-2 text-sm text-muted-foreground">{longDate(data.weekStart)}—{longDate(data.weekEnd)}</p></div><nav aria-label="Pilih minggu roster" className="flex gap-2"><Link className={buttonVariants({ variant: "outline", className: "min-h-11" })} href={`?week=${addIsoDays(weekStart, -7)}`}><ChevronLeft aria-hidden="true" />Sebelumnya</Link><Link className={buttonVariants({ variant: "outline", className: "min-h-11" })} href={`?week=${addIsoDays(weekStart, 7)}`}>Berikutnya<ChevronRight aria-hidden="true" /></Link></nav></div></header><RosterPlanner key={`${data.weekStart}:${data.week?.updatedAt ?? "new"}`} outlet={data.outlet} staff={data.staff} templates={data.templates} week={data.week} weekStart={data.weekStart} /></main>;
}

function longDate(value: string) { return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)); }
