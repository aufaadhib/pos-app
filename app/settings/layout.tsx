import type { ReactNode } from "react";
import { WorkspaceHeader } from "@/components/workspace-header";
import { isAppRole } from "@/lib/auth/permissions";
import { requirePasswordReadySession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/** Keeps settings inside the authenticated responsive workspace shell. */
export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const session = await requirePasswordReadySession();
  const role = isAppRole(session.user.role) ? session.user.role : "cashier";
  return <div className="workspace-shell min-h-svh bg-background"><WorkspaceHeader activeOutletId={session.session.activeOutletId} activeRoute="settings" canManageStaff={role !== "cashier"} canViewDesignSystem={role === "owner"} role={role} />{children}</div>;
}
