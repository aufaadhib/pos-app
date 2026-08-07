import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auditCreate: vi.fn(),
  productFind: vi.fn(),
  transaction: vi.fn(),
  variantGroupCreate: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));

import { saveVariantGroup } from "@/lib/catalog/advanced-service";

describe("advanced catalog service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation(async (callback) => callback({
      product: { findUnique: mocks.productFind },
      productVariantGroup: { create: mocks.variantGroupCreate },
      catalogAuditLog: { create: mocks.auditCreate },
    }));
    mocks.productFind.mockResolvedValue({ id: "product-1" });
    mocks.variantGroupCreate.mockResolvedValue({
      id: "group-1",
      productId: "product-1",
      name: "Ukuran",
      normalizedName: "ukuran",
      displayOrder: 0,
      status: "ACTIVE",
      archivedAt: null,
      createdAt: new Date("2026-08-07T08:00:00.000Z"),
      updatedAt: new Date("2026-08-07T08:00:00.000Z"),
    });
    mocks.auditCreate.mockResolvedValue({ id: "audit-1" });
  });

  it("creates a variant group and audit in the same transaction", async () => {
    await saveVariantGroup(
      { productId: "product-1", name: "Ukuran", displayOrder: 0 },
      { id: "owner-1", email: "owner@example.com", role: "owner" },
    );
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.variantGroupCreate).toHaveBeenCalledOnce();
    expect(mocks.auditCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ entityType: "VARIANT_GROUP", action: "CREATE" }) });
  });

  it("does not write when the product is missing", async () => {
    mocks.productFind.mockResolvedValueOnce(null);
    await expect(saveVariantGroup(
      { productId: "missing", name: "Ukuran", displayOrder: 0 },
      { id: "owner-1", email: "owner@example.com", role: "owner" },
    )).rejects.toThrow("Produk tidak ditemukan");
    expect(mocks.variantGroupCreate).not.toHaveBeenCalled();
  });
});
