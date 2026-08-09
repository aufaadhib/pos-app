import type { ReactNode } from "react";
import { WorkspaceHeader } from "@/components/workspace-header";
import { isAppRole } from "@/lib/auth/permissions";
import { requirePasswordReadySession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/** Keeps the kitchen queue inside the authenticated responsive workspace shell. */
export default async function KitchenLayout({ children }: { children: ReactNode }) {
  const session = await requirePasswordReadySession();
  const role = isAppRole(session.user.role) ? session.user.role : "cashier";
  return <div className="workspace-shell min-h-svh min-w-0 overflow-x-hidden bg-background"><WorkspaceHeader activeOutletId={session.session.activeOutletId} activeRoute="kitchen" canManageStaff={role !== "cashier"} canViewDesignSystem={role === "owner"} role={role} />{children}</div>;
}
