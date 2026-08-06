import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/config";
import {
  isAppRole,
  type AppPermission,
} from "@/lib/auth/permissions";

export const getCurrentSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

export async function requireSession() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/sign-in");
  }

  return session;
}

export async function requirePermission(permission: AppPermission) {
  const session = await requireSession();
  const role = session.user.role;

  if (!isAppRole(role)) {
    redirect("/workspace?access=denied");
  }

  const authorization = await auth.api.userHasPermission({
    body: {
      userId: session.user.id,
      permissions: permission,
    },
  });

  if (!authorization.success) {
    redirect("/workspace?access=denied");
  }

  return session;
}
