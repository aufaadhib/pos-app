import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PosRegister } from "@/components/pos/pos-register";
import { isAppRole } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { requireActiveOutlet } from "@/lib/outlets/context";
import { getPosMenu } from "@/lib/pos/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Kasir", description: "Buat dan selesaikan transaksi outlet aktif." };

/** Loads fresh outlet pricing and renders the interactive POS register. */
export default async function PosPage() {
  const session = await requirePermission({ pos: ["operate"] });
  if (!isAppRole(session.user.role)) redirect("/workspace?access=denied");
  const activeOutlet = await requireActiveOutlet(session);
  const menu = await getPosMenu(activeOutlet.id, session.user.id, session.user.role);
  if (!menu) redirect("/select-outlet");
  return <main className="max-w-none px-3 py-3 pb-40 sm:px-4 sm:py-4 xl:pb-4" id="main-content"><PosRegister menu={menu} /></main>;
}
