import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, MapPinned, Printer } from "lucide-react";
import { redirect } from "next/navigation";

import { OutletOperationsForm } from "@/components/settings/outlet-operations-form";
import { isAppRole } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { getOutletOperations } from "@/lib/orders/queries";
import { requireActiveOutlet } from "@/lib/outlets/context";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pengaturan", description: "Atur perilaku operasional outlet aktif." };

/** Loads fresh settings for the active outlet. */
export default async function SettingsPage() {
  const session = await requirePermission({ settings: ["manage"] });
  if (!isAppRole(session.user.role)) redirect("/workspace?access=denied");
  const activeOutlet = await requireActiveOutlet(session);
  const outlet = await getOutletOperations(activeOutlet.id, session.user.id, session.user.role);
  if (!outlet) redirect("/select-outlet");
  return <main className="mx-auto w-full max-w-4xl px-4 py-6 pb-24 sm:px-8 sm:py-8 lg:pb-8" id="main-content"><header className="rounded-2xl border bg-card p-5 sm:p-6"><p className="text-sm font-medium text-muted-foreground">{outlet.code} · {outlet.name}</p><h1 className="mt-1 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">Pengaturan outlet</h1><p className="mt-2 max-w-2xl leading-6 text-muted-foreground">Perubahan hanya berlaku pada outlet yang sedang aktif.</p></header><section aria-labelledby="device-settings-heading" className="mt-5"><div className="mb-3"><h2 className="font-heading text-xl font-semibold" id="device-settings-heading">Perangkat & lokasi</h2><p className="mt-1 text-sm text-muted-foreground">Siapkan keluaran dan validasi perangkat di outlet aktif.</p></div><div className="grid gap-3 sm:grid-cols-2"><Link className="group flex min-h-20 items-center gap-4 rounded-xl border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none sm:p-5" href="/settings/printers"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Printer aria-hidden="true" className="size-5" /></span><span className="min-w-0 flex-1"><span className="block font-heading font-semibold">Printer struk</span><span className="mt-1 block text-sm leading-5 text-muted-foreground">Ukuran kertas, footer, preview, dan cetak otomatis perangkat.</span></span><ChevronRight aria-hidden="true" className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" /></Link><Link className="group flex min-h-20 items-center gap-4 rounded-xl border bg-card p-4 transition-colors hover:border-success/50 hover:bg-success/5 focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none sm:p-5" href="/settings/attendance"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-success/10 text-success"><MapPinned aria-hidden="true" className="size-5" /></span><span className="min-w-0 flex-1"><span className="block font-heading font-semibold">Lokasi absensi</span><span className="mt-1 block text-sm leading-5 text-muted-foreground">Pusat outlet, peta radius, dan validasi GPS.</span></span><ChevronRight aria-hidden="true" className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" /></Link></div></section><section aria-labelledby="pos-operations-heading" className="mt-6"><div className="mb-3"><h2 className="font-heading text-xl font-semibold" id="pos-operations-heading">Operasional POS</h2><p className="mt-1 text-sm text-muted-foreground">Atur alur pelayanan tanpa mengubah transaksi yang sudah tersimpan.</p></div><OutletOperationsForm initialEnabled={outlet.openOrdersEnabled} outletId={outlet.id} /></section></main>;
}
