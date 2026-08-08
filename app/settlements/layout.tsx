import type { ReactNode } from "react";

import { WorkspaceHeader } from "@/components/workspace-header";
import { isAppRole } from "@/lib/auth/permissions";
import { requirePasswordReadySession } from "@/lib/auth/session";

/** Keeps delivery settlement pages inside the authenticated workspace shell. */
export default async function SettlementsLayout({ children }: { children: ReactNode }) {
  const session = await requirePasswordReadySession();
  const role = isAppRole(session.user.role) ? session.user.role : "cashier";
  return <div className="workspace-shell min-h-svh bg-background"><WorkspaceHeader activeOutletId={session.session.activeOutletId} activeRoute="settlements" canManageStaff={role !== "cashier"} canViewDesignSystem={role === "owner"} role={role} />{children}</div>;
}
