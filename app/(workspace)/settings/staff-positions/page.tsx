import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { StaffPositionManager } from "@/components/settings/staff-position-manager";
import { buttonVariants } from "@/components/ui/button";
import { isAppRole } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { getStaffPositions } from "@/lib/staff/position-queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Jabatan staf" };

/** Loads the owner-only global job-position configuration. */
export default async function StaffPositionsPage() {
  const session = await requirePermission({ staff: ["managePositions"] });
  if (!isAppRole(session.user.role) || session.user.role !== "owner") redirect("/workspace?access=denied");
  const positions = await getStaffPositions();
  return <main className="mx-auto w-full max-w-6xl px-4 py-6 pb-24 sm:px-8 sm:py-8 lg:pb-8" id="main-content"><header className="mb-6 rounded-2xl border bg-card p-5 sm:p-6"><Link className={buttonVariants({ variant: "ghost", className: "-ml-3 min-h-11" })} href="/settings"><ChevronLeft aria-hidden="true" />Kembali ke pengaturan</Link><p className="mt-3 text-sm font-medium text-primary">Struktur tim</p><h1 className="mt-1 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">Jabatan staf</h1><p className="mt-2 max-w-2xl leading-6 text-muted-foreground">Pisahkan nama pekerjaan dari role akses agar staf dapat absensi tanpa memperoleh akses kasir.</p></header><StaffPositionManager positions={positions} /></main>;
}
