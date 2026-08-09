import { beforeEach, describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";

const mocks = vi.hoisted(() => ({
  auditCreate: vi.fn(),
  outletFind: vi.fn(),
  channelFind: vi.fn(),
  productFindMany: vi.fn(),
  shiftFind: vi.fn(),
  receiptUpsert: vi.fn(),
  saleCreate: vi.fn(),
  saleFind: vi.fn(),
  orderFind: vi.fn(),
  orderCreate: vi.fn(),
  orderAuditCreate: vi.fn(),
  kitchenTicketCreate: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: { sale: { findUnique: mocks.saleFind }, $transaction: mocks.transaction } }));

import { PosError, createSale } from "@/lib/pos/service";

const checkout = {
  checkoutToken: "a5df2f12-bf3e-4a1e-9b12-1dd4c931cd36",
  outletId: "outlet-1",
  source: { type: "DIRECT" as const },
  orderType: "DINE_IN" as const,
  tableLabel: "A-07",
  items: [{ productId: "product-1", quantity: 2, note: "", variantOptionIds: [], modifierOptionIds: [], expectedUnitPrice: "25000.00" }],
  payment: { method: "CASH" as const, tenderedAmount: "100000.00", reference: "" },
};

describe("POS sale service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.saleFind.mockResolvedValue(null);
    mocks.orderFind.mockResolvedValue(null);
    mocks.outletFind.mockResolvedValue({ id: "outlet-1", code: "GLT", timezone: "Asia/Jakarta", taxRate: new Prisma.Decimal(10), serviceChargeRate: new Prisma.Decimal(5), pricesIncludeTax: false });
    mocks.channelFind.mockResolvedValue({ id: "channel-1", markupRate: new Prisma.Decimal(20), estimatedFeeRate: new Prisma.Decimal(20), roundingUnit: 500, settlementDelayHours: 24 });
    mocks.productFindMany.mockResolvedValue([{ id: "product-1", name: "Kopi Susu", sku: "KOP-1", basePrice: new Prisma.Decimal(25000), outletOverrides: [], channelPrices: [], variantGroups: [], modifierGroups: [] }]);
    mocks.shiftFind.mockResolvedValue({ id: "shift-1", outletId: "outlet-1" });
    mocks.receiptUpsert.mockResolvedValue({ lastValue: 1 });
    mocks.saleCreate.mockResolvedValue({ id: "sale-1", receiptNumber: "GLT-20260807-0001", total: new Prisma.Decimal(57750), payment: { changeAmount: new Prisma.Decimal(42250) } });
    mocks.auditCreate.mockResolvedValue({ id: "audit-1" });
    mocks.orderAuditCreate.mockResolvedValue({ id: "order-audit-1" });
    mocks.kitchenTicketCreate.mockResolvedValue({ id: "ticket-1" });
    mocks.orderCreate.mockImplementation(async ({ data }) => ({ id: "order-1", items: data.items.create.map((item: object, index: number) => ({ ...item, id: `order-item-${index + 1}` })) }));
    mocks.transaction.mockImplementation(async (callback) => callback({
      outlet: { findFirst: mocks.outletFind },
      outletDeliveryChannel: { findFirst: mocks.channelFind },
      cashShift: { findUnique: mocks.shiftFind },
      product: { findMany: mocks.productFindMany },
      receiptSequence: { upsert: mocks.receiptUpsert },
      order: { findFirst: mocks.orderFind, create: mocks.orderCreate },
      orderAuditLog: { create: mocks.orderAuditCreate },
      kitchenTicket: { create: mocks.kitchenTicketCreate },
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
      shiftId: "shift-1",
      orderId: "order-1",
      subtotal: expect.objectContaining({}),
      items: { create: [expect.objectContaining({ productName: "Kopi Susu", quantity: 2 })] },
      payment: { create: expect.objectContaining({ method: "CASH" }) },
    }), select: expect.any(Object) });
    expect(mocks.auditCreate).toHaveBeenCalledOnce();
    expect(mocks.kitchenTicketCreate).toHaveBeenCalledOnce();
  });

  it("rejects a stale client price before creating a sale", async () => {
    await expect(createSale({ ...checkout, items: [{ ...checkout.items[0], expectedUnitPrice: "24000.00" }] }, { id: "cashier-1", name: "Kasir", email: "cashier@example.com", role: "cashier" })).rejects.toBeInstanceOf(PosError);
    expect(mocks.saleCreate).not.toHaveBeenCalled();
  });

  it("stores a platform order as a pending receivable with direct-price comparison", async () => {
    await createSale({
      ...checkout,
      source: { type: "DELIVERY_PLATFORM", channelId: "channel-1", externalOrderId: "GF-12345" },
      orderType: "DELIVERY",
      tableLabel: undefined,
      items: [{ ...checkout.items[0], expectedUnitPrice: "30000.00" }],
      payment: undefined,
    }, { id: "cashier-1", name: "Kasir", email: "cashier@example.com", role: "cashier" });

    expect(mocks.saleCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      orderType: "DELIVERY",
      channelId: "channel-1",
      externalOrderId: "GF-12345",
      serviceChargeRate: 0,
      pricesIncludeTax: true,
      items: { create: [expect.objectContaining({ unitPrice: expect.objectContaining({}), directUnitPrice: expect.objectContaining({}) })] },
      payment: { create: expect.objectContaining({ method: "DELIVERY_PLATFORM", settlementStatus: "PENDING", directEquivalentAmount: expect.objectContaining({}) }) },
    }) }));
  });
});
