import { describe, expect, it } from "vitest";

import { generateTemporaryPassword } from "@/lib/staff/password";
import { assertOutletAssignmentCount, assertStaffRoleAllowed } from "@/lib/staff/policies";

describe("staff policies", () => {
  it("allows owner to create managers and manager to create cashiers", () => {
    expect(() => assertStaffRoleAllowed("owner", "manager")).not.toThrow();
    expect(() => assertStaffRoleAllowed("manager", "cashier")).not.toThrow();
  });

  it("denies privilege escalation and enforces outlet cardinality", () => {
    expect(() => assertStaffRoleAllowed("manager", "manager")).toThrow();
    expect(() => assertStaffRoleAllowed("cashier", "cashier")).toThrow();
    expect(() => assertOutletAssignmentCount("cashier", ["one", "two"])).toThrow();
    expect(() => assertOutletAssignmentCount("manager", [])).toThrow();
  });

  it("generates a strong one-time password without ambiguous characters", () => {
    const password = generateTemporaryPassword();
    expect(password).toHaveLength(16);
    expect(password).toMatch(/[A-Z]/);
    expect(password).toMatch(/[a-z]/);
    expect(password).toMatch(/[2-9]/);
    expect(password).toMatch(/[!@#$%]/);
    expect(password).not.toMatch(/[0O1Il]/);
  });
});
