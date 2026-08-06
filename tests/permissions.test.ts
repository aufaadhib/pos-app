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
  ["manager", { staff: ["manage"] }, false],
  ["manager", { staff: ["view"] }, true],
  ["cashier", { staff: ["view"] }, false],
  ["owner", { workspace: ["view"] }, true],
  ["manager", { workspace: ["view"] }, true],
  ["cashier", { workspace: ["view"] }, true],
  ["owner", { pos: ["operate"] }, true],
  ["manager", { pos: ["operate"] }, true],
  ["cashier", { pos: ["operate"] }, true],
];

describe("POS role permissions", () => {
  it.each(expectations)("authorizes %s consistently", (role, permission, expected) => {
    expect(roleHasPermission(role, permission)).toBe(expected);
  });
});
