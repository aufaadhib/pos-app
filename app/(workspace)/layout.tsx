import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { WorkspaceHeader } from "@/components/workspace-header";
import { isAppRole, roleHasPermission } from "@/lib/auth/permissions";
import { requirePasswordReadySession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/** Keeps one authenticated navigation shell mounted across every operational route. */
export default async function WorkspaceShellLayout({ children }: { children: ReactNode }) {
  const session = await requirePasswordReadySession();
  if (!isAppRole(session.user.role)) redirect("/workspace?access=denied");
  const role = session.user.role;
  return <div className="workspace-shell min-h-svh min-w-0 overflow-x-hidden bg-background"><WorkspaceHeader activeOutletId={session.session.activeOutletId} canManageStaff={roleHasPermission(role, { staff: ["view"] })} canViewDesignSystem={roleHasPermission(role, { designSystem: ["view"] })} role={role} />{children}</div>;
}
