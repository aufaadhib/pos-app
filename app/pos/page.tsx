import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PosRegister } from "@/components/pos/pos-register";
import { OpenShiftCard, PosShiftBar, WrongOutletShiftCard } from "@/components/shifts/shift-controls";
import { isAppRole } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { requireActiveOutlet } from "@/lib/outlets/context";
import { getPosMenu } from "@/lib/pos/queries";
import { getCurrentCashShift } from "@/lib/shifts/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Kasir", description: "Buat dan selesaikan transaksi outlet aktif." };

/** Loads fresh outlet pricing and renders the interactive POS register. */
export default async function PosPage() {
  const session = await requirePermission({ pos: ["operate"] });
  if (!isAppRole(session.user.role)) redirect("/workspace?access=denied");
  const activeOutlet = await requireActiveOutlet(session);
  const [menu, shift] = await Promise.all([
    getPosMenu(activeOutlet.id, session.user.id, session.user.role),
    getCurrentCashShift(session.user.id),
  ]);
  if (!menu) redirect("/select-outlet");
  if (!shift) return <OpenShiftCard outletId={activeOutlet.id} outletName={activeOutlet.name} />;
  if (shift.outletId !== activeOutlet.id) return <WrongOutletShiftCard shift={shift} />;
  return <main className="pos-main flex h-[calc(100svh-4rem)] min-h-0 w-full max-w-none flex-col overflow-hidden px-3 pt-3 pb-[calc(4.75rem+env(safe-area-inset-bottom))] sm:px-4 sm:pt-4 lg:h-svh lg:pb-4" id="main-content"><PosShiftBar shift={shift} /><PosRegister menu={menu} /></main>;
}
