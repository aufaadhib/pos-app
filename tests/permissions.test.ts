import { describe, expect, it } from "vitest";

import {
  roleHasPermission,
  type AppPermission,
  type AppRole,
} from "@/lib/auth/permissions";

const expectations: Array<[AppRole, AppPermission, boolean]> = [
  ["owner", { designSystem: ["view"] }, true],
  ["manager", { designSystem: ["view"] }, false],
  ["cashier", { designSystem: ["view"] }, false],
  ["owner", { staff: ["manage"] }, true],
  ["manager", { staff: ["manage"] }, true],
  ["manager", { staff: ["view"] }, true],
  ["cashier", { staff: ["view"] }, false],
  ["owner", { workspace: ["view"] }, true],
  ["manager", { workspace: ["view"] }, true],
  ["cashier", { workspace: ["view"] }, true],
  ["owner", { pos: ["operate"] }, true],
  ["manager", { pos: ["operate"] }, true],
  ["cashier", { pos: ["operate"] }, true],
  ["owner", { catalog: ["view"] }, true],
  ["owner", { catalog: ["manageMaster"] }, true],
  ["owner", { catalog: ["manageOutlet"] }, true],
  ["manager", { catalog: ["view"] }, true],
  ["manager", { catalog: ["manageMaster"] }, false],
  ["manager", { catalog: ["manageOutlet"] }, true],
  ["cashier", { catalog: ["view"] }, true],
  ["cashier", { catalog: ["manageMaster"] }, false],
  ["cashier", { catalog: ["manageOutlet"] }, false],
  ["owner", { deliveryChannel: ["manage"] }, true],
  ["manager", { deliveryChannel: ["view"] }, true],
  ["manager", { deliveryChannel: ["manage"] }, false],
  ["cashier", { deliveryChannel: ["view"] }, false],
  ["owner", { settlement: ["reverse"] }, true],
  ["manager", { settlement: ["reconcile"] }, true],
  ["manager", { settlement: ["reverse"] }, false],
  ["cashier", { settlement: ["view"] }, false],
  ["owner", { outlet: ["manage"] }, true],
  ["manager", { outlet: ["manage"] }, false],
  ["manager", { outlet: ["view"] }, true],
  ["cashier", { outlet: ["view"] }, true],
];

describe("POS role permissions", () => {
  it.each(expectations)("authorizes %s consistently", (role, permission, expected) => {
    expect(roleHasPermission(role, permission)).toBe(expected);
  });
});
