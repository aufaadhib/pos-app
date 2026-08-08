import { beforeEach, describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import { getOutletBusinessDate } from "@/lib/time/business-date";

const mocks = vi.hoisted(() => ({
  auditCreate: vi.fn(),
  cashMovementGroupBy: vi.fn(),
  cashShiftFindFirst: vi.fn(),
  cashShiftFindUnique: vi.fn(),
  outletFindFirst: vi.fn(),
  paymentAggregate: vi.fn(),
  refundAggregate: vi.fn(),
  refundCreate: vi.fn(),
  refundFindUnique: vi.fn(),
  refundItemGroupBy: vi.fn(),
  saleFindFirst: vi.fn(),
  saleUpdateMany: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    saleRefund: { findUnique: mocks.refundFindUnique },
    $transaction: mocks.transaction,
  },
}));

import { refundSale, SaleCorrectionError, voidSale } from "@/lib/pos/correction-service";

const actor = { id: "manager-1", name: "Manajer", email: "manager@example.com", role: "manager" as const };
const baseInput = {
  saleId: "sale-1",
  outletId: "outlet-1",
  operationToken: "a5df2f12-bf3e-4a1e-9b12-1dd4c931cd36",
  reason: "Pesanan pelanggan keliru",
};
const sale = {
  id: "sale-1",
  receiptNumber: "GLT-20260809-0001",
  businessDate: getOutletBusinessDate("Asia/Jakarta").date,
  status: "COMPLETED" as const,
  subtotal: new Prisma.Decimal(50000),
  serviceChargeAmount: new Prisma.Decimal(2500),
  taxAmount: new Prisma.Decimal(5250),
  pricesIncludeTax: false,
  total: new Prisma.Decimal(57750),
  payment: {
    method: "CASH" as const,
    settlementStatus: "NOT_APPLICABLE" as const,
    amount: new Prisma.Decimal(57750),
    expectedFeeAmount: null,
    expectedNetAmount: null,
    directEquivalentAmount: null,
  },
  items: [{ id: "item-1", quantity: 2, unitPrice: new Prisma.Decimal(25000), directUnitPrice: new Prisma.Decimal(25000) }],
};

const transactionClient = {
  outlet: { findFirst: mocks.outletFindFirst },
  sale: { findFirst: mocks.saleFindFirst, updateMany: mocks.saleUpdateMany },
  saleRefund: { aggregate: mocks.refundAggregate, create: mocks.refundCreate },
  saleRefundItem: { groupBy: mocks.refundItemGroupBy },
  salePayment: { aggregate: mocks.paymentAggregate },
  cashShift: { findUnique: mocks.cashShiftFindUnique, findFirst: mocks.cashShiftFindFirst },
  cashMovement: { groupBy: mocks.cashMovementGroupBy },
  saleAuditLog: { create: mocks.auditCreate },
};

describe("sale correction service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.refundFindUnique.mockResolvedValue(null);
    mocks.outletFindFirst.mockResolvedValue({ id: "outlet-1", timezone: "Asia/Jakarta" });
    mocks.saleFindFirst.mockResolvedValue(sale);
    mocks.refundAggregate.mockImplementation(async ({ where }) => where.saleId
      ? { _sum: { subtotalAmount: null, serviceChargeAmount: null, taxAmount: null, amount: null, expectedFeeAmount: null, expectedNetAmount: null, directEquivalentAmount: null } }
      : { _sum: { amount: null } });
    mocks.refundItemGroupBy.mockResolvedValue([]);
    mocks.cashShiftFindUnique.mockResolvedValue({ id: "shift-2", outletId: "outlet-1" });
    mocks.cashShiftFindFirst.mockResolvedValue({ openingCash: new Prisma.Decimal(100000) });
    mocks.paymentAggregate.mockResolvedValue({ _sum: { amount: new Prisma.Decimal(100000) } });
    mocks.cashMovementGroupBy.mockResolvedValue([]);
    mocks.refundCreate.mockResolvedValue({ id: "refund-1" });
    mocks.saleUpdateMany.mockResolvedValue({ count: 1 });
    mocks.auditCreate.mockResolvedValue({ id: "audit-1" });
    mocks.transaction.mockImplementation(async (callback) => callback(transactionClient));
  });

  it("voids a same-day cash sale in full and links the executing shift", async () => {
    const result = await voidSale(baseInput, actor);
    expect(result).toMatchObject({ status: "success", refundId: "refund-1" });
    expect(mocks.refundCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      type: "VOID",
      cashShiftId: "shift-2",
      amount: expect.objectContaining({}),
      items: { create: [expect.objectContaining({ saleItemId: "item-1", quantity: 2 })] },
    }) }));
    expect(mocks.saleUpdateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: "VOIDED" } }));
    expect(mocks.auditCreate).toHaveBeenCalledOnce();
  });

  it("records a partial item refund with snapshot-based allocation", async () => {
    const result = await refundSale({ ...baseInput, items: [{ saleItemId: "item-1", quantity: 1 }] }, actor);
    expect(result.status).toBe("success");
    const data = mocks.refundCreate.mock.calls[0][0].data;
    expect(data.subtotalAmount.toFixed(2)).toBe("25000.00");
    expect(data.serviceChargeAmount.toFixed(2)).toBe("1250.00");
    expect(data.taxAmount.toFixed(2)).toBe("2625.00");
    expect(data.amount.toFixed(2)).toBe("28875.00");
    expect(mocks.saleUpdateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: "PARTIALLY_REFUNDED" } }));
  });

  it("rejects quantities that have already been refunded", async () => {
    mocks.saleFindFirst.mockResolvedValue({ ...sale, status: "PARTIALLY_REFUNDED" });
    mocks.refundItemGroupBy.mockResolvedValue([{ saleItemId: "item-1", _sum: { quantity: 2 } }]);
    await expect(refundSale({ ...baseInput, items: [{ saleItemId: "item-1", quantity: 1 }] }, actor)).rejects.toBeInstanceOf(SaleCorrectionError);
    expect(mocks.refundCreate).not.toHaveBeenCalled();
  });

  it("blocks a delivery refund after settlement is confirmed", async () => {
    mocks.saleFindFirst.mockResolvedValue({ ...sale, payment: { ...sale.payment, method: "DELIVERY_PLATFORM", settlementStatus: "SETTLED" } });
    await expect(refundSale({ ...baseInput, providerReference: "RF-123", items: [{ saleItemId: "item-1", quantity: 1 }] }, actor)).rejects.toMatchObject({ code: "INVALID_STATE" });
    expect(mocks.refundCreate).not.toHaveBeenCalled();
  });

  it("requires the manager to own an open drawer for cash refunds", async () => {
    mocks.cashShiftFindUnique.mockResolvedValue(null);
    await expect(refundSale({ ...baseInput, items: [{ saleItemId: "item-1", quantity: 1 }] }, actor)).rejects.toBeDefined();
    expect(mocks.refundCreate).not.toHaveBeenCalled();
  });

  it("denies cashier corrections even when called outside a Server Action", async () => {
    await expect(voidSale(baseInput, { ...actor, role: "cashier" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("returns the original result for a repeated idempotency token", async () => {
    mocks.refundFindUnique.mockResolvedValue({ id: "refund-existing", saleId: "sale-1", type: "REFUND", actorUserId: actor.id, sale: { outletId: "outlet-1", receiptNumber: sale.receiptNumber } });
    const result = await refundSale({ ...baseInput, items: [{ saleItemId: "item-1", quantity: 1 }] }, actor);
    expect(result).toMatchObject({ status: "success", refundId: "refund-existing" });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("retries a serializable write conflict before committing once", async () => {
    mocks.transaction
      .mockRejectedValueOnce({ name: "DriverAdapterError", cause: { kind: "TransactionWriteConflict" } })
      .mockImplementationOnce(async (callback) => callback(transactionClient));
    const result = await refundSale({ ...baseInput, items: [{ saleItemId: "item-1", quantity: 1 }] }, actor);
    expect(result.status).toBe("success");
    expect(mocks.transaction).toHaveBeenCalledTimes(2);
  });

  it("stores pending delivery refund snapshots without requiring a cash shift", async () => {
    mocks.saleFindFirst.mockResolvedValue({ ...sale, payment: {
      ...sale.payment,
      method: "DELIVERY_PLATFORM",
      settlementStatus: "PENDING",
      expectedFeeAmount: new Prisma.Decimal(11550),
      expectedNetAmount: new Prisma.Decimal(46200),
      directEquivalentAmount: new Prisma.Decimal(50000),
    } });
    await refundSale({ ...baseInput, providerReference: "RF-GF-123", items: [{ saleItemId: "item-1", quantity: 1 }] }, actor);
    const data = mocks.refundCreate.mock.calls[0][0].data;
    expect(data.providerReference).toBe("RF-GF-123");
    expect(data.expectedNetAmount.toFixed(2)).toBe("23100.00");
    expect(data.cashShiftId).toBeNull();
    expect(mocks.cashShiftFindUnique).not.toHaveBeenCalled();
  });
});
