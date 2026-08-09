import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { redirect } from "next/navigation";

import { AttendanceManagement } from "@/components/attendance/attendance-management";
import { buttonVariants } from "@/components/ui/button";
import { getAttendanceManagement } from "@/lib/attendance/queries";
import { isAppRole } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { requireActiveOutlet } from "@/lib/outlets/context";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Kelola absensi" };

/** Loads active-outlet review, records, and profile controls in manager scope. */
export default async function AttendanceManagementPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const [session, raw] = await Promise.all([requirePermission({ attendance: ["viewReport"] }), searchParams]);
  if (!isAppRole(session.user.role) || session.user.role === "cashier") redirect("/workspace?access=denied");
  const outlet = await requireActiveOutlet(session);
  const page = Math.max(1, Number.parseInt(raw.page ?? "1", 10) || 1);
  const data = await getAttendanceManagement(outlet.id, { id: session.user.id, name: session.user.name, email: session.user.email, role: session.user.role }, page);
  return <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-8 sm:py-8 lg:px-10" id="main-content"><header className="mb-6 rounded-2xl border bg-card p-5 sm:p-6"><Link className={buttonVariants({ variant: "ghost", className: "-ml-3 min-h-11" })} href="/attendance"><ChevronLeft aria-hidden="true" />Kembali ke absensi</Link><p className="mt-3 text-sm font-medium text-muted-foreground">{outlet.code} · {outlet.name}</p><h1 className="mt-1 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">Kelola absensi</h1><p className="mt-2 max-w-2xl leading-6 text-muted-foreground">Tinjau pengecualian, koreksi waktu secara append-only, dan ekspor catatan outlet aktif.</p></header><AttendanceManagement currentUserId={session.user.id} outletId={outlet.id} pendingRequests={data.pending} sessions={data.sessions} staffProfiles={data.staffProfiles} />{data.totalPages > 1 && <nav aria-label="Paginasi catatan absensi" className="mt-6 flex items-center justify-center gap-3"><Link aria-disabled={data.page <= 1} className={cn(buttonVariants({ variant: "outline" }), data.page <= 1 && "pointer-events-none opacity-50")} href={`?page=${Math.max(1, data.page - 1)}`}><ChevronLeft aria-hidden="true" />Sebelumnya</Link><span className="text-sm text-muted-foreground">Halaman {data.page} dari {data.totalPages}</span><Link aria-disabled={data.page >= data.totalPages} className={cn(buttonVariants({ variant: "outline" }), data.page >= data.totalPages && "pointer-events-none opacity-50")} href={`?page=${Math.min(data.totalPages, data.page + 1)}`}>Berikutnya<ChevronRight aria-hidden="true" /></Link></nav>}</main>;
}
