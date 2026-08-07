import { describe, expect, it } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import { calculateSaleTotals } from "@/lib/pos/pricing";

describe("POS pricing", () => {
  it("adds service before tax for tax-exclusive prices", () => {
    const totals = calculateSaleTotals({
      subtotal: new Prisma.Decimal("100000.00"),
      serviceChargeRate: new Prisma.Decimal("10.00"),
      taxRate: new Prisma.Decimal("11.00"),
      pricesIncludeTax: false,
    });
    expect(totals.serviceChargeAmount.toFixed(2)).toBe("10000.00");
    expect(totals.taxAmount.toFixed(2)).toBe("12100.00");
    expect(totals.total.toFixed(2)).toBe("122100.00");
  });

  it("extracts included tax without adding it again", () => {
    const totals = calculateSaleTotals({
      subtotal: new Prisma.Decimal("111000.00"),
      serviceChargeRate: new Prisma.Decimal("10.00"),
      taxRate: new Prisma.Decimal("11.00"),
      pricesIncludeTax: true,
    });
    expect(totals.serviceChargeAmount.toFixed(2)).toBe("11100.00");
    expect(totals.taxAmount.toFixed(2)).toBe("11000.00");
    expect(totals.total.toFixed(2)).toBe("122100.00");
  });

  it("rounds each charge to whole Rupiah with half-up semantics", () => {
    const totals = calculateSaleTotals({
      subtotal: new Prisma.Decimal("10001.00"),
      serviceChargeRate: new Prisma.Decimal("7.50"),
      taxRate: new Prisma.Decimal("0.00"),
      pricesIncludeTax: false,
    });
    expect(totals.serviceChargeAmount.toFixed(2)).toBe("750.00");
  });
});
