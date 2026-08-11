import { beforeEach, describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";

const mocks = vi.hoisted(() => ({
  auditCreate: vi.fn(),
  cashMovementCreate: vi.fn(),
  cashMovementFindUnique: vi.fn(),
  cashMovementGroupBy: vi.fn(),
  cashShiftCreate: vi.fn(),
  cashShiftFindFirst: vi.fn(),
  cashShiftFindUnique: vi.fn(),
  cashShiftUpdateMany: vi.fn(),
  correctionCreate: vi.fn(),
  correctionFindFirst: vi.fn(),
  correctionFindUnique: vi.fn(),
  outletFindFirst: vi.fn(),
  paymentAggregate: vi.fn(),
  refundAggregate: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    cashShift: { findUnique: mocks.cashShiftFindUnique },
    cashMovement: { findUnique: mocks.cashMovementFindUnique },
    cashShiftReconciliationCorrection: { findUnique: mocks.correctionFindUnique },
    $transaction: mocks.transaction,
  },
}));

import {
  addCashMovement,
  CashShiftError,
  closeCashShift,
  correctCashShiftReconciliation,
  forceCloseCashShift,
  openCashShift,
} from "@/lib/shifts/service";

const actor = { id: "cashier-1", name: "Kasir", email: "cashier@example.com", role: "cashier" as const };
const transactionClient = {
  outlet: { findFirst: mocks.outletFindFirst },
  cashShift: { create: mocks.cashShiftCreate, findFirst: mocks.cashShiftFindFirst, updateMany: mocks.cashShiftUpdateMany },
  cashMovement: { create: mocks.cashMovementCreate, groupBy: mocks.cashMovementGroupBy },
  cashShiftReconciliationCorrection: { create: mocks.correctionCreate, findFirst: mocks.correctionFindFirst },
  salePayment: { aggregate: mocks.paymentAggregate },
  saleRefund: { aggregate: mocks.refundAggregate },
  cashShiftAuditLog: { create: mocks.auditCreate },
};

describe("cash shift service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cashShiftFindUnique.mockResolvedValue(null);
    mocks.cashMovementFindUnique.mockResolvedValue(null);
    mocks.correctionFindUnique.mockResolvedValue(null);
    mocks.correctionFindFirst.mockResolvedValue(null);
    mocks.correctionCreate.mockResolvedValue({ id: "correction-1" });
    mocks.outletFindFirst.mockResolvedValue({ id: "outlet-1", timezone: "Asia/Jakarta" });
    mocks.cashShiftCreate.mockResolvedValue({ id: "shift-1" });
    mocks.cashMovementCreate.mockResolvedValue({ id: "movement-1" });
    mocks.cashShiftFindFirst.mockResolvedValue({ id: "shift-1", outletId: "outlet-1", openingCash: new Prisma.Decimal(100000), openedByUserId: actor.id });
    mocks.cashShiftUpdateMany.mockResolvedValue({ count: 1 });
    mocks.paymentAggregate.mockResolvedValue({ _sum: { amount: new Prisma.Decimal(250000) } });
    mocks.refundAggregate.mockResolvedValue({ _sum: { amount: new Prisma.Decimal(0) } });
    mocks.cashMovementGroupBy.mockResolvedValue([
      { direction: "IN", _sum: { amount: new Prisma.Decimal(50000) } },
      { direction: "OUT", _sum: { amount: new Prisma.Decimal(25000) } },
    ]);
    mocks.transaction.mockImplementation(async (callback) => callback(transactionClient));
  });

  it("opens one shift and audits its opening balance atomically", async () => {
    const result = await openCashShift({ outletId: "outlet-1", openingCash: "100000", openToken: "a5df2f12-bf3e-4a1e-9b12-1dd4c931cd36" }, actor);
    expect(result).toMatchObject({ status: "success", shiftId: "shift-1" });
    expect(mocks.cashShiftCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ openUserKey: actor.id, openingCash: expect.objectContaining({}) }) }));
    expect(mocks.auditCreate).toHaveBeenCalledOnce();
  });

  it("retries a Neon driver transaction write conflict", async () => {
    mocks.transaction
      .mockRejectedValueOnce({ name: "DriverAdapterError", cause: { kind: "TransactionWriteConflict" } })
      .mockImplementationOnce(async (callback) => callback(transactionClient));

    const result = await openCashShift({ outletId: "outlet-1", openingCash: "100000", openToken: "e5df2f12-bf3e-4a1e-9b12-1dd4c931cd36" }, actor);

    expect(result.status).toBe("success");
    expect(mocks.transaction).toHaveBeenCalledTimes(2);
  });

  it("appends an owned cash movement with an idempotency token", async () => {
    const result = await addCashMovement({
      shiftId: "shift-1",
      outletId: "outlet-1",
      operationToken: "b5df2f12-bf3e-4a1e-9b12-1dd4c931cd36",
      direction: "IN",
      category: "ADDITIONAL_FLOAT",
      amount: "50000",
      reason: "Tambahan pecahan kecil",
    }, actor);
    expect(result.status).toBe("success");
    expect(mocks.cashMovementCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ operationToken: expect.any(String), actorUserId: actor.id }) }));
  });

  it("stores a stable expected cash snapshot when closing", async () => {
    const result = await closeCashShift({ shiftId: "shift-1", outletId: "outlet-1", actualCash: "380000", closeToken: "c5df2f12-bf3e-4a1e-9b12-1dd4c931cd36" }, actor);
    expect(result).toMatchObject({ status: "success", expectedCash: "375000.00", actualCash: "380000.00", cashDifference: "5000.00" });
    expect(mocks.cashShiftUpdateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "CLOSED", openUserKey: null, expectedCash: expect.objectContaining({}) }) }));
  });

  it("subtracts cash refunds paid from the active drawer", async () => {
    mocks.refundAggregate.mockResolvedValue({ _sum: { amount: new Prisma.Decimal(50000) } });
    const result = await closeCashShift({ shiftId: "shift-1", outletId: "outlet-1", actualCash: "325000", closeToken: "f5df2f12-bf3e-4a1e-9b12-1dd4c931cd36" }, actor);
    expect(result).toMatchObject({ status: "success", expectedCash: "325000.00", cashDifference: "0.00" });
  });

  it("rejects force-close from a cashier", async () => {
    await expect(forceCloseCashShift({ shiftId: "shift-1", outletId: "outlet-1", actualCash: "0", closeToken: "d5df2f12-bf3e-4a1e-9b12-1dd4c931cd36", reason: "Kasir lupa menutup shift" }, actor)).rejects.toBeInstanceOf(CashShiftError);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("appends an effective reconciliation correction without updating the original close snapshot", async () => {
    const manager = { id: "manager-1", name: "Manajer", email: "manager@example.com", role: "manager" as const };
    mocks.cashShiftFindFirst.mockResolvedValue({ id: "shift-1", outletId: "outlet-1", expectedCash: new Prisma.Decimal(375000), actualCash: new Prisma.Decimal(350000), cashDifference: new Prisma.Decimal(-25000) });

    const result = await correctCashShiftReconciliation({ shiftId: "shift-1", outletId: "outlet-1", correctionToken: "15df2f12-bf3e-4a1e-9b12-1dd4c931cd36", correctedActualCash: "380000", reason: "Uang pecahan terselip saat dihitung" }, manager);

    expect(result).toMatchObject({ status: "success", actualCash: "380000.00", cashDifference: "5000.00" });
    expect(mocks.correctionCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ revision: 1, actorUserId: manager.id }) }));
    expect(mocks.cashShiftUpdateMany).not.toHaveBeenCalled();
    expect(mocks.auditCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "RECONCILIATION_CORRECT" }) }));
  });

  it("continues the immutable correction chain from the latest revision", async () => {
    const owner = { id: "owner-1", name: "Pemilik", email: "owner@example.com", role: "owner" as const };
    mocks.cashShiftFindFirst.mockResolvedValue({ id: "shift-1", outletId: "outlet-1", expectedCash: new Prisma.Decimal(375000), actualCash: new Prisma.Decimal(350000), cashDifference: new Prisma.Decimal(-25000) });
    mocks.correctionFindFirst.mockResolvedValue({ revision: 1, correctedActualCash: new Prisma.Decimal(380000), correctedDifference: new Prisma.Decimal(5000) });

    await correctCashShiftReconciliation({ shiftId: "shift-1", outletId: "outlet-1", correctionToken: "25df2f12-bf3e-4a1e-9b12-1dd4c931cd36", correctedActualCash: "375000", reason: "Hitung ulang bersama supervisor" }, owner);

    expect(mocks.correctionCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ revision: 2, previousActualCash: expect.objectContaining({}), previousDifference: expect.objectContaining({}) }) }));
  });

  it("rejects cashier reconciliation corrections before opening a transaction", async () => {
    await expect(correctCashShiftReconciliation({ shiftId: "shift-1", outletId: "outlet-1", correctionToken: "35df2f12-bf3e-4a1e-9b12-1dd4c931cd36", correctedActualCash: "375000", reason: "Hitung ulang bersama supervisor" }, actor)).rejects.toBeInstanceOf(CashShiftError);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("returns an idempotent correction without writing a second revision", async () => {
    const manager = { id: "manager-1", name: "Manajer", email: "manager@example.com", role: "manager" as const };
    mocks.correctionFindUnique.mockResolvedValue({ shiftId: "shift-1", actorUserId: manager.id, expectedCash: new Prisma.Decimal(375000), correctedActualCash: new Prisma.Decimal(375000), correctedDifference: new Prisma.Decimal(0) });

    const result = await correctCashShiftReconciliation({ shiftId: "shift-1", outletId: "outlet-1", correctionToken: "45df2f12-bf3e-4a1e-9b12-1dd4c931cd36", correctedActualCash: "375000", reason: "Hitung ulang bersama supervisor" }, manager);

    expect(result).toMatchObject({ status: "success", actualCash: "375000.00", cashDifference: "0.00" });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
