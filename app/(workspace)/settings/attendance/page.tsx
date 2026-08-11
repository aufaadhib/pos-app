import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { redirect } from "next/navigation";

import { AttendanceSettingsForm } from "@/components/settings/attendance-settings-form";
import { buttonVariants } from "@/components/ui/button";
import { getAttendanceSettings } from "@/lib/attendance/queries";
import { isAppRole } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { requireActiveOutlet } from "@/lib/outlets/context";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pengaturan absensi", description: "Atur titik dan radius kehadiran outlet aktif." };

/** Loads fresh geofence settings for the assigned active outlet. */
export default async function AttendanceSettingsPage() {
  const session = await requirePermission({ attendance: ["manage"] });
  if (!isAppRole(session.user.role) || (session.user.role !== "owner" && session.user.role !== "manager")) redirect("/workspace?access=denied");
  const activeOutlet = await requireActiveOutlet(session);
  const outlet = await getAttendanceSettings(activeOutlet.id, { id: session.user.id, name: session.user.name, email: session.user.email, role: session.user.role });
  if (!outlet) redirect("/select-outlet");
  return <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-8 sm:py-8 lg:px-10" id="main-content"><header className="mb-5 rounded-2xl border bg-card p-5 sm:p-6"><Link className={buttonVariants({ variant: "ghost", className: "-ml-3 min-h-11" })} href="/settings"><ChevronLeft aria-hidden="true" />Kembali ke pengaturan</Link><p className="mt-3 text-sm font-medium text-muted-foreground">{outlet.code} · {outlet.name}</p><h1 className="mt-1 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">Lokasi absensi</h1><p className="mt-2 max-w-2xl leading-6 text-muted-foreground">Tentukan pusat outlet dan radius kehadiran melalui peta atau input angka.</p></header><AttendanceSettingsForm outlet={outlet} /></main>;
}
