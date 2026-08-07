import "server-only";

import { redirect } from "next/navigation";

import { isAppRole } from "@/lib/auth/permissions";
import { getActiveOutlet } from "@/lib/outlets/queries";

export async function requireActiveOutlet(session: {
  session: { activeOutletId?: string | null };
  user: { id: string; role?: string | null };
}) {
  if (!isAppRole(session.user.role)) redirect("/workspace?access=denied");
  const outlet = await getActiveOutlet(
    session.session.activeOutletId,
    session.user.id,
    session.user.role,
  );
  if (!outlet) redirect("/select-outlet");
  return outlet;
}
