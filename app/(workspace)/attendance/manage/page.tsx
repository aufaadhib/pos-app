import type { Metadata } from "next";
import Link from "next/link";
import { CalendarRange, ChevronLeft, ChevronRight } from "lucide-react";
import { redirect } from "next/navigation";

import { AttendanceManagement } from "@/components/attendance/attendance-management";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { getAttendanceManagement } from "@/lib/attendance/queries";
import { attendanceStatusLabels } from "@/lib/attendance/roster";
import { getAttendanceRosterSummary } from "@/lib/attendance/roster-queries";
import { isAppRole } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { requireActiveOutlet } from "@/lib/outlets/context";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Kelola absensi" };

/** Loads active-outlet review, records, and profile controls in manager scope. */
export default async function AttendanceManagementPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const [session, raw] = await Promise.all([requirePermission({ attendance: ["viewReport"] }), searchParams]);
  if (!isAppRole(session.user.role) || (session.user.role !== "owner" && session.user.role !== "manager")) redirect("/workspace?access=denied");
  const outlet = await requireActiveOutlet(session);
  const page = Math.max(1, Number.parseInt(raw.page ?? "1", 10) || 1);
  const actor = { id: session.user.id, name: session.user.name, email: session.user.email, role: session.user.role };
  const [data, summary] = await Promise.all([getAttendanceManagement(outlet.id, actor, page), getAttendanceRosterSummary(outlet.id, actor)]);
  const summaryStatuses = ["ON_TIME", "LATE", "NOT_CLOCKED_IN", "ABSENT", "MISSED_CHECKOUT", "UNSCHEDULED"] as const;
  return <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-8 sm:py-8 lg:px-10" id="main-content"><header className="mb-6 rounded-2xl border bg-card p-5 sm:p-6"><Link className={buttonVariants({ variant: "ghost", className: "-ml-3 min-h-11" })} href="/attendance"><ChevronLeft aria-hidden="true" />Kembali ke absensi</Link><div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-medium text-muted-foreground">{outlet.code} · {outlet.name}</p><h1 className="mt-1 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">Kelola absensi</h1><p className="mt-2 max-w-2xl leading-6 text-muted-foreground">Tinjau anomali, koreksi waktu, dan ekspor catatan outlet aktif.</p></div><Link className={buttonVariants({ variant: "outline", className: "min-h-11" })} href="/attendance/roster"><CalendarRange aria-hidden="true" />Atur roster</Link></div></header><section aria-labelledby="today-summary" className="mb-7"><div className="flex items-center justify-between gap-3"><div><h2 className="font-heading text-xl font-semibold" id="today-summary">Ringkasan hari ini</h2><p className="mt-1 text-sm text-muted-foreground">Tanggal bisnis {summary.workDate}</p></div><Badge variant="outline">{summary.rows.length} catatan</Badge></div><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">{summaryStatuses.map((status) => <article className="rounded-xl border bg-card p-4" key={status}><p className="font-mono text-2xl font-semibold">{summary.counts[status] ?? 0}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{attendanceStatusLabels[status]}</p></article>)}</div></section><AttendanceManagement currentUserId={session.user.id} outletId={outlet.id} pendingRequests={data.pending} sessions={data.sessions} staffProfiles={data.staffProfiles} timezone={outlet.timezone} />{data.totalPages > 1 && <nav aria-label="Paginasi catatan absensi" className="mt-6 flex items-center justify-center gap-3"><Link aria-disabled={data.page <= 1} className={cn(buttonVariants({ variant: "outline" }), data.page <= 1 && "pointer-events-none opacity-50")} href={`?page=${Math.max(1, data.page - 1)}`}><ChevronLeft aria-hidden="true" />Sebelumnya</Link><span className="text-sm text-muted-foreground">Halaman {data.page} dari {data.totalPages}</span><Link aria-disabled={data.page >= data.totalPages} className={cn(buttonVariants({ variant: "outline" }), data.page >= data.totalPages && "pointer-events-none opacity-50")} href={`?page=${Math.min(data.totalPages, data.page + 1)}`}>Berikutnya<ChevronRight aria-hidden="true" /></Link></nav>}</main>;
}
