import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements } from "better-auth/plugins/admin/access";

export const permissionStatements = {
  ...defaultStatements,
  workspace: ["view"],
  pos: ["operate"],
  staff: ["view", "manage"],
  settings: ["view", "manage"],
  designSystem: ["view"],
  profile: ["view", "update"],
} as const;

export const accessControl = createAccessControl(permissionStatements);

export const ownerRole = accessControl.newRole({
  user: [...defaultStatements.user],
  session: [...defaultStatements.session],
  workspace: ["view"],
  pos: ["operate"],
  staff: ["view", "manage"],
  settings: ["view", "manage"],
  designSystem: ["view"],
  profile: ["view", "update"],
});

export const managerRole = accessControl.newRole({
  user: [],
  session: [],
  workspace: ["view"],
  pos: ["operate"],
  staff: ["view"],
  settings: ["view"],
  designSystem: [],
  profile: ["view", "update"],
});

export const cashierRole = accessControl.newRole({
  user: [],
  session: [],
  workspace: ["view"],
  pos: ["operate"],
  staff: [],
  settings: [],
  designSystem: [],
  profile: ["view", "update"],
});

export const roles = {
  owner: ownerRole,
  manager: managerRole,
  cashier: cashierRole,
} as const;

export type AppRole = keyof typeof roles;
export type AppPermission = {
  [Resource in keyof typeof permissionStatements]?: Array<
    (typeof permissionStatements)[Resource][number]
  >;
};

export const roleLabels: Record<AppRole, string> = {
  owner: "Pemilik",
  manager: "Manajer",
  cashier: "Kasir",
};

export function isAppRole(role: string | null | undefined): role is AppRole {
  return Boolean(role && role in roles);
}

export function roleHasPermission(
  role: AppRole,
  permission: AppPermission,
): boolean {
  return roles[role].authorize(permission).success;
}
