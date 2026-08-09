import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { redirect } from "next/navigation";

import { PrinterSettingsForm } from "@/components/settings/printer-settings-form";
import { buttonVariants } from "@/components/ui/button";
import { isAppRole } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { requireActiveOutlet } from "@/lib/outlets/context";
import { getPrinterSettings } from "@/lib/printers/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Printer struk", description: "Atur format struk browser untuk outlet aktif." };

/** Loads fresh printer settings for the assigned active outlet. */
export default async function PrinterSettingsPage() {
  const session = await requirePermission({ settings: ["manage"] });
  if (!isAppRole(session.user.role)) redirect("/workspace?access=denied");
  const activeOutlet = await requireActiveOutlet(session);
  const outlet = await getPrinterSettings(activeOutlet.id, session.user.id, session.user.role);
  if (!outlet) redirect("/select-outlet");

  return <main className="mx-auto w-full max-w-6xl px-4 py-6 pb-24 sm:px-8 sm:py-8 lg:pb-8" id="main-content">
    <header className="mb-5 rounded-2xl border bg-card p-5 sm:p-6">
      <Link className={buttonVariants({ variant: "ghost", className: "-ml-3 min-h-11" })} href="/settings"><ChevronLeft aria-hidden="true" />Kembali ke pengaturan</Link>
      <p className="mt-3 text-sm font-medium text-muted-foreground">{outlet.code} · {outlet.name}</p>
      <h1 className="mt-1 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">Printer struk</h1>
      <p className="mt-2 max-w-2xl leading-6 text-muted-foreground">Atur struk pelanggan yang dicetak melalui dialog browser.</p>
    </header>
    <PrinterSettingsForm outlet={outlet} />
  </main>;
}
