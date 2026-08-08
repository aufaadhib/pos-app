import { beforeEach, describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";

const mocks = vi.hoisted(() => ({
  outletFind: vi.fn(),
  channelFind: vi.fn(),
  paymentFind: vi.fn(),
  settlementCreate: vi.fn(),
  paymentUpdate: vi.fn(),
  saleAuditCreateMany: vi.fn(),
  adminAuditCreate: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));

import { createSettlementBatch, DeliveryError } from "@/lib/delivery/service";

const input = {
  outletId: "outlet-1",
  channelId: "channel-1",
  paymentIds: ["payment-1", "payment-2"],
  reference: "BANK-20260808-001",
  platformFeeAmount: "50000.00",
  merchantPromotionAmount: "10000.00",
  otherAdjustmentAmount: "-2000.00",
  otherAdjustmentNote: "Koreksi platform",
  netReceivedAmount: "188000.00",
  receivedAt: "2026-08-08T05:00:00.000Z",
};

describe("delivery settlement service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.outletFind.mockResolvedValue({ id: "outlet-1" });
    mocks.channelFind.mockResolvedValue({ id: "channel-1" });
    mocks.paymentFind.mockResolvedValue([
      { id: "payment-1", saleId: "sale-1", amount: new Prisma.Decimal(100000), directEquivalentAmount: new Prisma.Decimal(85000), expectedNetAmount: new Prisma.Decimal(80000) },
      { id: "payment-2", saleId: "sale-2", amount: new Prisma.Decimal(150000), directEquivalentAmount: new Prisma.Decimal(125000), expectedNetAmount: new Prisma.Decimal(120000) },
    ]);
    mocks.settlementCreate.mockImplementation(async ({ data }) => ({ id: "settlement-1", ...data }));
    mocks.paymentUpdate.mockResolvedValue({ count: 2 });
    mocks.saleAuditCreateMany.mockResolvedValue({ count: 2 });
    mocks.adminAuditCreate.mockResolvedValue({ id: "audit-1" });
    mocks.transaction.mockImplementation(async (callback) => callback({
      outlet: { findFirst: mocks.outletFind },
      outletDeliveryChannel: { findFirst: mocks.channelFind },
      salePayment: { findMany: mocks.paymentFind, updateMany: mocks.paymentUpdate },
      platformSettlement: { create: mocks.settlementCreate },
      saleAuditLog: { createMany: mocks.saleAuditCreateMany },
      adminAuditLog: { create: mocks.adminAuditCreate },
    }));
  });

  it("confirms a balanced multi-order transfer atomically", async () => {
    await createSettlementBatch(input, { id: "manager-1", name: "Manajer", email: "manager@example.com", role: "manager" });
    expect(mocks.settlementCreate).toHaveBeenCalledWith({ data: expect.objectContaining({
      grossAmount: expect.objectContaining({}),
      netReceivedAmount: expect.objectContaining({}),
      items: { create: expect.arrayContaining([expect.objectContaining({ salePaymentId: "payment-1" }), expect.objectContaining({ salePaymentId: "payment-2" })]) },
    }) });
    expect(mocks.paymentUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { settlementStatus: "SETTLED" } }));
    expect(mocks.saleAuditCreateMany).toHaveBeenCalledOnce();
  });

  it("rejects a batch whose bank net does not match its deductions", async () => {
    await expect(createSettlementBatch({ ...input, netReceivedAmount: "190000.00" }, { id: "manager-1", name: "Manajer", email: "manager@example.com", role: "manager" })).rejects.toBeInstanceOf(DeliveryError);
    expect(mocks.settlementCreate).not.toHaveBeenCalled();
  });
});
