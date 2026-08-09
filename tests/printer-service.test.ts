import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auditCreate: vi.fn(),
  outletFindFirst: vi.fn(),
  outletUpdate: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));

import { PrinterSettingsError, updatePrinterSettings } from "@/lib/printers/service";

const actor = { id: "manager-1", name: "Manajer", email: "manager@example.com", role: "manager" as const };
const transactionClient = {
  outlet: { findFirst: mocks.outletFindFirst, update: mocks.outletUpdate },
  adminAuditLog: { create: mocks.auditCreate },
};

describe("printer settings service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.outletFindFirst.mockResolvedValue({ id: "outlet-1", receiptPaperSize: "MM80", receiptFooter: "Footer lama" });
    mocks.outletUpdate.mockResolvedValue({ id: "outlet-1" });
    mocks.transaction.mockImplementation(async (callback) => callback(transactionClient));
  });

  it("checks assignment and writes update plus before/after audit in one transaction", async () => {
    const result = await updatePrinterSettings({ outletId: "outlet-1", receiptPaperSize: "MM58", receiptFooter: "Footer baru" }, actor);

    expect(result.status).toBe("success");
    expect(mocks.outletFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ assignments: { some: { userId: actor.id } } }) }));
    expect(mocks.outletUpdate).toHaveBeenCalledWith({ where: { id: "outlet-1" }, data: { receiptPaperSize: "MM58", receiptFooter: "Footer baru" } });
    expect(mocks.auditCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ before: { receiptPaperSize: "MM80", receiptFooter: "Footer lama" }, after: { receiptPaperSize: "MM58", receiptFooter: "Footer baru" } }) }));
    expect(mocks.transaction).toHaveBeenCalledOnce();
  });

  it("rejects an unassigned outlet without writing", async () => {
    mocks.outletFindFirst.mockResolvedValue(null);
    await expect(updatePrinterSettings({ outletId: "outlet-2", receiptPaperSize: "MM80", receiptFooter: "" }, actor)).rejects.toBeInstanceOf(PrinterSettingsError);
    expect(mocks.outletUpdate).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  it("rejects cashier mutations before opening a transaction", async () => {
    await expect(updatePrinterSettings({ outletId: "outlet-1", receiptPaperSize: "MM80", receiptFooter: "" }, { ...actor, role: "cashier" })).rejects.toBeInstanceOf(PrinterSettingsError);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
