import { describe, expect, it } from "vitest";

import {
  createCategorySchema,
  createProductSchema,
  updateProductSchema,
} from "@/lib/catalog/validation";

describe("catalog validation", () => {
  it("accepts a valid category and trims its values", () => {
    const result = createCategorySchema.parse({
      name: "  Minuman   Dingin ",
      description: "  Menu dingin  ",
      displayOrder: "10",
    });
    expect(result).toEqual({
      name: "Minuman Dingin",
      description: "Menu dingin",
      displayOrder: 10,
    });
  });

  it("rejects an invalid SKU and fractional-looking price", () => {
    const result = createProductSchema.safeParse({
      categoryId: "category-1",
      name: "Kopi susu",
      sku: "kopi susu",
      description: "",
      basePrice: "25,50",
      displayOrder: "0",
    });
    expect(result.success).toBe(false);
  });

  it("requires an ISO timestamp for optimistic concurrency", () => {
    const result = updateProductSchema.safeParse({
      id: "product-1",
      expectedUpdatedAt: "kemarin",
      categoryId: "category-1",
      name: "Kopi susu",
      sku: "KOPI-1",
      description: "",
      basePrice: "25000",
      displayOrder: "0",
    });
    expect(result.success).toBe(false);
  });
});
