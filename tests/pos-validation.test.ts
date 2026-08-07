import { describe, expect, it } from "vitest";

import { checkoutSchema } from "@/lib/pos/validation";

const baseCheckout = {
  checkoutToken: "a5df2f12-bf3e-4a1e-9b12-1dd4c931cd36",
  outletId: "outlet-1",
  orderType: "DINE_IN" as const,
  tableLabel: "A-07",
  items: [{ productId: "product-1", quantity: 1, note: "", variantOptionIds: [], modifierOptionIds: [], expectedUnitPrice: "25000.00" }],
  payment: { method: "CASH" as const, tenderedAmount: "50000.00", reference: "" },
};

describe("POS checkout validation", () => {
  it("accepts one complete paid order", () => {
    expect(checkoutSchema.safeParse(baseCheckout).success).toBe(true);
  });

  it("requires a table for dine-in", () => {
    const parsed = checkoutSchema.safeParse({ ...baseCheckout, tableLabel: "" });
    expect(parsed.success).toBe(false);
  });

  it("requires tendered cash but not for non-cash", () => {
    expect(checkoutSchema.safeParse({ ...baseCheckout, payment: { method: "CASH" } }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...baseCheckout, payment: { method: "QRIS" } }).success).toBe(true);
  });

  it("rejects duplicate option identifiers", () => {
    const parsed = checkoutSchema.safeParse({
      ...baseCheckout,
      items: [{ ...baseCheckout.items[0], modifierOptionIds: ["option-1", "option-1"] }],
    });
    expect(parsed.success).toBe(false);
  });
});
