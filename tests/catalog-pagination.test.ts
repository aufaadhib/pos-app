import { describe, expect, it } from "vitest";

import { getCatalogPaginationItems } from "@/lib/catalog/pagination";

describe("catalog pagination", () => {
  it("shows every page for short result sets", () => {
    expect(getCatalogPaginationItems(2, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("keeps the current page between the first and last pages", () => {
    expect(getCatalogPaginationItems(6, 12)).toEqual([1, "start-ellipsis", 5, 6, 7, "end-ellipsis", 12]);
  });

  it("expands the beginning and end without duplicate page numbers", () => {
    expect(getCatalogPaginationItems(1, 8)).toEqual([1, 2, 3, 4, "end-ellipsis", 8]);
    expect(getCatalogPaginationItems(8, 8)).toEqual([1, "start-ellipsis", 5, 6, 7, 8]);
  });
});
