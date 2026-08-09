import "server-only";

import { isAppRole, roleHasPermission, type AppPermission } from "@/lib/auth/permissions";
import { getCurrentSession } from "@/lib/auth/session";

/** Authenticates a Route Handler and returns a minimal attendance actor or an HTTP error. */
export async function authorizeAttendanceRequest(permission: AppPermission) {
  const session = await getCurrentSession();
  if (!session) return { error: Response.json({ message: "Tidak terautentikasi." }, { status: 401 }) } as const;
  if (!isAppRole(session.user.role) || !roleHasPermission(session.user.role, permission)) {
    return { error: Response.json({ message: "Akses ditolak." }, { status: 403 }) } as const;
  }
  return { actor: { id: session.user.id, name: session.user.name, email: session.user.email, role: session.user.role }, session } as const;
}
