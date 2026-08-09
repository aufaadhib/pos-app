import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { KitchenBoard } from "@/components/kitchen/kitchen-board";
import { isAppRole } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { getKitchenTickets } from "@/lib/orders/queries";
import { requireActiveOutlet } from "@/lib/outlets/context";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Dapur", description: "Antrean kitchen ticket outlet aktif." };

/** Streams the fresh kitchen queue for the active outlet. */
export default async function KitchenPage() {
  const session = await requirePermission({ pos: ["operate"] });
  if (!isAppRole(session.user.role)) redirect("/workspace?access=denied");
  const outlet = await requireActiveOutlet(session);
  const tickets = await getKitchenTickets(outlet.id, session.user.id, session.user.role);
  return <main className="w-full min-w-0 max-w-none px-3 py-4 pb-24 sm:px-5 lg:px-6 lg:pb-6" id="main-content"><header className="mb-4 flex min-w-0 items-end justify-between gap-4 rounded-2xl border bg-card p-4 sm:p-5"><div className="min-w-0"><p className="truncate text-sm font-medium text-muted-foreground">{outlet.name}</p><h1 className="mt-1 font-heading text-2xl font-semibold tracking-tight">Antrean dapur</h1><p className="mt-1 text-sm text-muted-foreground">Ticket terbaru tampil berdasarkan waktu kirim.</p></div><BadgeCount count={tickets.filter((ticket) => ticket.status !== "COMPLETED").length} /></header><KitchenBoard outletId={outlet.id} tickets={tickets} /></main>;
}

function BadgeCount({ count }: { count: number }) { return <div className="shrink-0 rounded-xl bg-primary px-3 py-2 text-center text-primary-foreground"><span className="block font-mono text-xl font-bold">{count}</span><span className="text-[0.68rem] font-semibold">Aktif</span></div>; }
