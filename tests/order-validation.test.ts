import { describe, expect, it } from "vitest";

import { cancelOrderSchema, saveOrderSchema, updateOrderSchema } from "@/lib/orders/validation";

const item = { productId: "product-1", quantity: 1, variantOptionIds: [], modifierOptionIds: [], expectedUnitPrice: "25000.00" };

describe("open order validation", () => {
  it("requires a table label for dine-in but not takeaway", () => {
    expect(saveOrderSchema.safeParse({ operationToken: crypto.randomUUID(), outletId: "outlet-1", orderType: "DINE_IN", items: [item] }).success).toBe(false);
    expect(saveOrderSchema.safeParse({ operationToken: crypto.randomUUID(), outletId: "outlet-1", orderType: "TAKEAWAY", items: [item] }).success).toBe(true);
  });

  it("accepts an optimistic edit and rejects a short cancellation reason", () => {
    expect(updateOrderSchema.safeParse({ orderId: "order-1", outletId: "outlet-1", expectedVersion: 2, operationToken: crypto.randomUUID(), orderType: "DINE_IN", tableLabel: "A-01", items: [item], reductionReason: "Salah input" }).success).toBe(true);
    expect(cancelOrderSchema.safeParse({ orderId: "order-1", outletId: "outlet-1", expectedVersion: 2, operationToken: crypto.randomUUID(), reason: "x" }).success).toBe(false);
  });
});
