import type { Metadata } from "next";
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
  return <main className="mx-auto w-full max-w-4xl px-4 py-6 pb-24 sm:px-8 sm:py-8 lg:pb-8" id="main-content"><header className="rounded-2xl border bg-card p-5 sm:p-6"><p className="text-sm font-medium text-muted-foreground">{outlet.code} · {outlet.name}</p><h1 className="mt-1 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">Pengaturan outlet</h1><p className="mt-2 max-w-2xl leading-6 text-muted-foreground">Perubahan hanya berlaku pada outlet yang sedang aktif.</p></header><section aria-labelledby="pos-operations-heading" className="mt-5"><div className="mb-3"><h2 className="font-heading text-xl font-semibold" id="pos-operations-heading">Operasional POS</h2><p className="mt-1 text-sm text-muted-foreground">Atur alur pelayanan tanpa mengubah transaksi yang sudah tersimpan.</p></div><OutletOperationsForm initialEnabled={outlet.openOrdersEnabled} outletId={outlet.id} /></section></main>;
}
