import type { ReactNode } from "react";

import { WorkspaceHeader } from "@/components/workspace-header";
import { isAppRole } from "@/lib/auth/permissions";
import { requirePasswordReadySession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/** Keeps the authenticated workspace shell mounted while POS content streams independently. */
export default async function PosLayout({ children }: { children: ReactNode }) {
  const session = await requirePasswordReadySession();
  const role = isAppRole(session.user.role) ? session.user.role : "cashier";
  return <div className="workspace-shell min-h-svh bg-background"><WorkspaceHeader activeOutletId={session.session.activeOutletId} activeRoute="pos" canManageStaff={role !== "cashier"} canViewDesignSystem={role === "owner"} defaultSidebarCollapsed role={role} />{children}</div>;
}
