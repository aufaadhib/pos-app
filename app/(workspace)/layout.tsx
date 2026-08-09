import type { ReactNode } from "react";

import { WorkspaceHeader } from "@/components/workspace-header";
import { isAppRole } from "@/lib/auth/permissions";
import { requirePasswordReadySession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/** Keeps one authenticated navigation shell mounted across every operational route. */
export default async function WorkspaceShellLayout({ children }: { children: ReactNode }) {
  const session = await requirePasswordReadySession();
  const role = isAppRole(session.user.role) ? session.user.role : "cashier";
  return <div className="workspace-shell min-h-svh min-w-0 overflow-x-hidden bg-background"><WorkspaceHeader activeOutletId={session.session.activeOutletId} canManageStaff={role !== "cashier"} canViewDesignSystem={role === "owner"} role={role} />{children}</div>;
}
