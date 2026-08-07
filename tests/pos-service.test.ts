import { beforeEach, describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";

const mocks = vi.hoisted(() => ({
  auditCreate: vi.fn(),
  outletFind: vi.fn(),
  productFindMany: vi.fn(),
  receiptUpsert: vi.fn(),
  saleCreate: vi.fn(),
  saleFind: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: { sale: { findUnique: mocks.saleFind }, $transaction: mocks.transaction } }));

import { PosError, createSale } from "@/lib/pos/service";

const checkout = {
  checkoutToken: "a5df2f12-bf3e-4a1e-9b12-1dd4c931cd36",
  outletId: "outlet-1",
  orderType: "DINE_IN" as const,
  tableLabel: "A-07",
  items: [{ productId: "product-1", quantity: 2, note: "", variantOptionIds: [], modifierOptionIds: [], expectedUnitPrice: "25000.00" }],
  payment: { method: "CASH" as const, tenderedAmount: "100000.00", reference: "" },
};

describe("POS sale service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.saleFind.mockResolvedValue(null);
    mocks.outletFind.mockResolvedValue({ id: "outlet-1", code: "GLT", timezone: "Asia/Jakarta", taxRate: new Prisma.Decimal(10), serviceChargeRate: new Prisma.Decimal(5), pricesIncludeTax: false });
    mocks.productFindMany.mockResolvedValue([{ id: "product-1", name: "Kopi Susu", sku: "KOP-1", basePrice: new Prisma.Decimal(25000), outletOverrides: [], variantGroups: [], modifierGroups: [] }]);
    mocks.receiptUpsert.mockResolvedValue({ lastValue: 1 });
    mocks.saleCreate.mockResolvedValue({ id: "sale-1", receiptNumber: "GLT-20260807-0001", total: new Prisma.Decimal(57750), payment: { changeAmount: new Prisma.Decimal(42250) } });
    mocks.auditCreate.mockResolvedValue({ id: "audit-1" });
    mocks.transaction.mockImplementation(async (callback) => callback({
      outlet: { findFirst: mocks.outletFind },
      product: { findMany: mocks.productFindMany },
      receiptSequence: { upsert: mocks.receiptUpsert },
      sale: { create: mocks.saleCreate },
      saleAuditLog: { create: mocks.auditCreate },
    }));
  });

  it("writes sale, payment, item snapshots, receipt, and audit in one transaction", async () => {
    const result = await createSale(checkout, { id: "cashier-1", name: "Kasir", email: "cashier@example.com", role: "cashier" });
    expect(result.status).toBe("success");
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.saleCreate).toHaveBeenCalledWith({ data: expect.objectContaining({
      receiptNumber: expect.stringMatching(/^GLT-\d{8}-0001$/),
      subtotal: expect.objectContaining({}),
      items: { create: [expect.objectContaining({ productName: "Kopi Susu", quantity: 2 })] },
      payment: { create: expect.objectContaining({ method: "CASH" }) },
    }), select: expect.any(Object) });
    expect(mocks.auditCreate).toHaveBeenCalledOnce();
  });

  it("rejects a stale client price before creating a sale", async () => {
    await expect(createSale({ ...checkout, items: [{ ...checkout.items[0], expectedUnitPrice: "24000.00" }] }, { id: "cashier-1", name: "Kasir", email: "cashier@example.com", role: "cashier" })).rejects.toBeInstanceOf(PosError);
    expect(mocks.saleCreate).not.toHaveBeenCalled();
  });
});
