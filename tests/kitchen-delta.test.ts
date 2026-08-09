import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { buildKitchenDelta, OrderError } from "@/lib/orders/service";

const base = { id: "item-1", productName: "Kopi", quantity: 2, sentQuantity: 0, note: null, sentNote: null, selectionLabel: null, sentSelectionLabel: null, changeReason: null };

describe("kitchen delta", () => {
  it("creates additions and note updates", () => {
    expect(buildKitchenDelta([base])[0]).toMatchObject({ action: "ADD", quantity: 2 });
    expect(buildKitchenDelta([{ ...base, sentQuantity: 2, note: "Tanpa gula" }])[0]).toMatchObject({ action: "UPDATE", quantity: 2, note: "Tanpa gula" });
  });

  it("requires a reason for reductions", () => {
    expect(() => buildKitchenDelta([{ ...base, quantity: 1, sentQuantity: 2 }])).toThrow(OrderError);
    expect(buildKitchenDelta([{ ...base, quantity: 1, sentQuantity: 2, changeReason: "Salah jumlah" }])[0]).toMatchObject({ action: "REMOVE", quantity: 1, reason: "Salah jumlah" });
  });
});
