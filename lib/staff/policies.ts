import type { AppRole } from "@/lib/auth/permissions";

export class StaffPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StaffPolicyError";
  }
}

export function assertStaffRoleAllowed(actorRole: AppRole, targetRole: "manager" | "cashier") {
  if (actorRole === "cashier" || (actorRole === "manager" && targetRole !== "cashier")) {
    throw new StaffPolicyError("Anda tidak dapat menetapkan peran tersebut.");
  }
}

export function assertOutletAssignmentCount(role: "manager" | "cashier", outletIds: string[]) {
  if (role === "cashier" && outletIds.length !== 1) {
    throw new StaffPolicyError("Kasir harus ditugaskan tepat ke satu outlet.");
  }
  if (role === "manager" && outletIds.length < 1) {
    throw new StaffPolicyError("Manajer harus ditugaskan minimal ke satu outlet.");
  }
}
