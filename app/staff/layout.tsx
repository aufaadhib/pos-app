import type { ReactNode } from "react";

import { WorkspaceHeader } from "@/components/workspace-header";
import { isAppRole } from "@/lib/auth/permissions";
import { requirePasswordReadySession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/** Keeps workspace navigation mounted while staff content streams. */
export default async function StaffLayout({ children }: { children: ReactNode }) {
  const session = await requirePasswordReadySession();
  const role = isAppRole(session.user.role) ? session.user.role : "cashier";
  return <div className="workspace-shell min-h-svh bg-background"><WorkspaceHeader activeOutletId={session.session.activeOutletId} activeRoute="staff" canManageStaff canViewDesignSystem={role === "owner"} role={role} />{children}</div>;
}
