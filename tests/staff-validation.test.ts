import { describe, expect, it } from "vitest";

import { changePasswordSchema, createStaffSchema } from "@/lib/staff/validation";

describe("staff validation", () => {
  it("normalizes email and removes duplicate outlet assignments", () => {
    const parsed = createStaffSchema.parse({
      name: "  Sari   Utami ",
      email: "SARI@EXAMPLE.COM",
      role: "manager",
      jobPositionId: "position-manager",
      outletIds: ["outlet-a", "outlet-a", "outlet-b"],
    });
    expect(parsed.email).toBe("sari@example.com");
    expect(parsed.name).toBe("Sari Utami");
    expect(parsed.outletIds).toEqual(["outlet-a", "outlet-b"]);
  });

  it("requires a confirmed 12-character replacement password", () => {
    expect(changePasswordSchema.safeParse({ currentPassword: "temporary", newPassword: "new-password-123", confirmPassword: "different" }).success).toBe(false);
    expect(changePasswordSchema.safeParse({ currentPassword: "temporary", newPassword: "new-password-123", confirmPassword: "new-password-123" }).success).toBe(true);
  });
});
