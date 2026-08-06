import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  categoryCreate: vi.fn(),
  auditCreate: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction,
  },
}));

import { createCategory } from "@/lib/catalog/service";

describe("catalog service transaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const transactionClient = {
      category: { create: mocks.categoryCreate },
      catalogAuditLog: { create: mocks.auditCreate },
    };
    mocks.transaction.mockImplementation(async (callback) => callback(transactionClient));
    mocks.categoryCreate.mockResolvedValue({
      id: "category-1",
      name: "Kopi",
      normalizedName: "kopi",
      description: null,
      displayOrder: 0,
      status: "ACTIVE",
      archivedAt: null,
      createdAt: new Date("2026-08-06T08:00:00.000Z"),
      updatedAt: new Date("2026-08-06T08:00:00.000Z"),
    });
    mocks.auditCreate.mockResolvedValue({ id: "audit-1" });
  });

  it("writes the category and audit through the same transaction client", async () => {
    await createCategory(
      { name: "Kopi", description: null, displayOrder: 0 },
      { id: "owner-1", email: "owner@example.com" },
    );
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.categoryCreate).toHaveBeenCalledOnce();
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entityId: "category-1",
        actorUserId: "owner-1",
        action: "CREATE",
      }),
    });
  });

  it("rejects the whole mutation when audit writing fails", async () => {
    mocks.auditCreate.mockRejectedValueOnce(new Error("audit unavailable"));
    await expect(
      createCategory(
        { name: "Kopi", description: null, displayOrder: 0 },
        { id: "owner-1", email: "owner@example.com" },
      ),
    ).rejects.toThrow("audit unavailable");
  });
});
