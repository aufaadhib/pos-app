import { describe, expect, it } from "vitest";

import {
  outletProductOverrideSchema,
  productModifierSchema,
  variantOptionSchema,
} from "@/lib/catalog/advanced-validation";

describe("advanced catalog validation", () => {
  it("accepts zero-cost additive variants", () => {
    const result = variantOptionSchema.parse({
      variantGroupId: "group-1",
      name: "Regular",
      priceAdjustment: "0",
      displayOrder: "0",
    });
    expect(result.priceAdjustment).toBe("0");
  });

  it("rejects invalid modifier selection bounds", () => {
    const result = productModifierSchema.safeParse({
      productId: "product-1",
      modifierGroupId: "modifier-1",
      minSelections: "2",
      maxSelections: "1",
      displayOrder: "0",
    });
    expect(result.success).toBe(false);
  });

  it("maps an empty outlet price to inherited master pricing", () => {
    const result = outletProductOverrideSchema.parse({
      outletId: "outlet-1",
      productId: "product-1",
      isAvailable: "false",
      priceOverride: "",
    });
    expect(result).toMatchObject({ isAvailable: false, priceOverride: null });
  });
});
