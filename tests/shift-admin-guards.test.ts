import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cashShiftFindFirst: vi.fn(),
  cashShiftFindUnique: vi.fn(),
  outletFindFirst: vi.fn(),
  outletFindUnique: vi.fn(),
  sessionUpdate: vi.fn(),
  transaction: vi.fn(),
  userFindUnique: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));

import { OutletError, archiveOutlet, selectActiveOutlet } from "@/lib/outlets/service";
import { StaffError, deactivateStaff } from "@/lib/staff/service";

const owner = { id: "owner-1", email: "owner@example.com", role: "owner" as const };

describe("open shift administration guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation(async (callback) => callback({
      outlet: { findFirst: mocks.outletFindFirst, findUnique: mocks.outletFindUnique },
      cashShift: { findFirst: mocks.cashShiftFindFirst, findUnique: mocks.cashShiftFindUnique },
      session: { update: mocks.sessionUpdate },
      user: { findUnique: mocks.userFindUnique },
    }));
  });

  it("blocks switching to another outlet while the actor has an open shift", async () => {
    mocks.outletFindFirst.mockResolvedValue({ id: "outlet-2" });
    mocks.cashShiftFindUnique.mockResolvedValue({ outletId: "outlet-1" });
    await expect(selectActiveOutlet("outlet-2", { id: "session-1", userId: owner.id }, owner)).rejects.toBeInstanceOf(OutletError);
    expect(mocks.sessionUpdate).not.toHaveBeenCalled();
  });

  it("blocks archiving an outlet that still has an open shift", async () => {
    const updatedAt = new Date("2026-08-08T00:00:00.000Z");
    mocks.outletFindUnique.mockResolvedValue({ id: "outlet-1", status: "ACTIVE", updatedAt });
    mocks.cashShiftFindFirst.mockResolvedValue({ id: "shift-1" });
    await expect(archiveOutlet({ id: "outlet-1", expectedUpdatedAt: updatedAt.toISOString() }, owner)).rejects.toBeInstanceOf(OutletError);
  });

  it("blocks deactivating a staff member who still owns an open shift", async () => {
    const updatedAt = new Date("2026-08-08T00:00:00.000Z");
    mocks.userFindUnique.mockResolvedValue({ id: "cashier-1", role: "cashier", banned: false, updatedAt, outletAssignments: [{ outletId: "outlet-1" }] });
    mocks.cashShiftFindUnique.mockResolvedValue({ id: "shift-1" });
    await expect(deactivateStaff({ id: "cashier-1", expectedUpdatedAt: updatedAt.toISOString() }, owner)).rejects.toBeInstanceOf(StaffError);
  });
});
