import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements } from "better-auth/plugins/admin/access";

export const permissionStatements = {
  ...defaultStatements,
  workspace: ["view"],
  pos: ["operate"],
  transaction: ["correct"],
  shift: ["operate", "view", "forceClose"],
  staff: ["view", "manage"],
  settings: ["view", "manage"],
  designSystem: ["view"],
  catalog: ["view", "manageMaster", "manageOutlet"],
  deliveryChannel: ["view", "manage"],
  settlement: ["view", "reconcile", "reverse"],
  report: ["view", "export"],
  outlet: ["view", "manage"],
  profile: ["view", "update"],
} as const;

export const accessControl = createAccessControl(permissionStatements);

export const ownerRole = accessControl.newRole({
  user: [...defaultStatements.user],
  session: [...defaultStatements.session],
  workspace: ["view"],
  pos: ["operate"],
  transaction: ["correct"],
  shift: ["operate", "view", "forceClose"],
  staff: ["view", "manage"],
  settings: ["view", "manage"],
  designSystem: ["view"],
  catalog: ["view", "manageMaster", "manageOutlet"],
  deliveryChannel: ["view", "manage"],
  settlement: ["view", "reconcile", "reverse"],
  report: ["view", "export"],
  outlet: ["view", "manage"],
  profile: ["view", "update"],
});

export const managerRole = accessControl.newRole({
  user: [],
  session: [],
  workspace: ["view"],
  pos: ["operate"],
  transaction: ["correct"],
  shift: ["operate", "view", "forceClose"],
  staff: ["view", "manage"],
  settings: ["view", "manage"],
  designSystem: [],
  catalog: ["view", "manageOutlet"],
  deliveryChannel: ["view"],
  settlement: ["view", "reconcile"],
  report: ["view", "export"],
  outlet: ["view"],
  profile: ["view", "update"],
});

export const cashierRole = accessControl.newRole({
  user: [],
  session: [],
  workspace: ["view"],
  pos: ["operate"],
  transaction: [],
  shift: ["operate", "view"],
  staff: [],
  settings: [],
  designSystem: [],
  catalog: ["view"],
  deliveryChannel: [],
  settlement: [],
  report: [],
  outlet: ["view"],
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
