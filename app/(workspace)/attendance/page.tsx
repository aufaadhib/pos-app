import type { Metadata } from "next";
import Link from "next/link";
import { Settings2, UsersRound } from "lucide-react";
import { redirect } from "next/navigation";

import { AttendanceClock } from "@/components/attendance/attendance-clock";
import { buttonVariants } from "@/components/ui/button";
import { getAttendanceHome } from "@/lib/attendance/queries";
import { isAppRole } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Absensi", description: "Absensi masuk dan pulang dengan akun, wajah, dan lokasi outlet." };

/** Loads fresh identity and attendance state for the authenticated employee. */
export default async function AttendancePage() {
  const session = await requirePermission({ attendance: ["clock"] });
  if (!isAppRole(session.user.role)) redirect("/workspace?access=denied");
  const data = await getAttendanceHome(session.user.id, session.user.role);
  return <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-8 sm:py-8 lg:px-10" id="main-content">
    <header className="mb-5 flex flex-col gap-4 rounded-2xl border bg-card p-5 sm:p-6 lg:flex-row lg:items-end lg:justify-between">
      <div><p className="text-sm font-medium text-success">Identitas akun · Verifikasi 1:1</p><h1 className="mt-1 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">Absensi karyawan</h1><p className="mt-2 max-w-2xl leading-6 text-muted-foreground">Wajah dibandingkan hanya dengan profil akun yang sedang login. Lokasi diperiksa saat tombol absensi ditekan.</p></div>
      {session.user.role !== "cashier" && <div className="flex flex-wrap gap-2"><Link className={buttonVariants({ variant: "outline", className: "min-h-11" })} href="/settings/attendance"><Settings2 aria-hidden="true" />Atur lokasi</Link><Link className={buttonVariants({ className: "min-h-11" })} href="/attendance/manage"><UsersRound aria-hidden="true" />Kelola absensi</Link></div>}
    </header>
    <AttendanceClock openSession={data.openSession} outlets={data.outlets} pendingReenrollment={data.pendingReenrollment} profile={data.profile} recentSessions={data.recentSessions} user={{ name: session.user.name, email: session.user.email, role: session.user.role }} />
  </main>;
}
