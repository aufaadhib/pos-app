import { describe, expect, it } from "vitest";

import { cashMovementSchema, cashShiftReconciliationCorrectionSchema, closeCashShiftSchema, openCashShiftSchema } from "@/lib/shifts/validation";

const ids = {
  shiftId: "shift-1",
  outletId: "outlet-1",
  operationToken: "a5df2f12-bf3e-4a1e-9b12-1dd4c931cd36",
};

describe("cash shift validation", () => {
  it("accepts a zero opening float and a nonnegative blind count", () => {
    expect(openCashShiftSchema.safeParse({ outletId: ids.outletId, openingCash: "0", openToken: ids.operationToken }).success).toBe(true);
    expect(closeCashShiftSchema.safeParse({ shiftId: ids.shiftId, outletId: ids.outletId, actualCash: "0", closeToken: ids.operationToken }).success).toBe(true);
  });

  it("enforces fixed movement category directions", () => {
    expect(cashMovementSchema.safeParse({ ...ids, direction: "IN", category: "ADDITIONAL_FLOAT", amount: "10000", reason: "Tambah uang kecil" }).success).toBe(true);
    expect(cashMovementSchema.safeParse({ ...ids, direction: "OUT", category: "ADDITIONAL_FLOAT", amount: "10000", reason: "Arah yang salah" }).success).toBe(false);
    expect(cashMovementSchema.safeParse({ ...ids, direction: "IN", category: "OPERATING_EXPENSE", amount: "10000", reason: "Arah yang salah" }).success).toBe(false);
  });

  it("rejects zero movement amounts and short reasons", () => {
    expect(cashMovementSchema.safeParse({ ...ids, direction: "OUT", category: "OTHER", amount: "0", reason: "Tes" }).success).toBe(false);
  });

  it("accepts a nonnegative corrected count and requires an audit reason", () => {
    expect(cashShiftReconciliationCorrectionSchema.safeParse({ shiftId: ids.shiftId, outletId: ids.outletId, correctionToken: ids.operationToken, correctedActualCash: "0", reason: "Uang dihitung ulang" }).success).toBe(true);
    expect(cashShiftReconciliationCorrectionSchema.safeParse({ shiftId: ids.shiftId, outletId: ids.outletId, correctionToken: ids.operationToken, correctedActualCash: "-1", reason: "Uang dihitung ulang" }).success).toBe(false);
    expect(cashShiftReconciliationCorrectionSchema.safeParse({ shiftId: ids.shiftId, outletId: ids.outletId, correctionToken: ids.operationToken, correctedActualCash: "1000", reason: "Salah" }).success).toBe(false);
  });
});
