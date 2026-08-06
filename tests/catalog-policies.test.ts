import { describe, expect, it } from "vitest";

import {
  assertCatalogVersion,
  assertCategoryCanArchive,
  assertProductCanRestore,
  CatalogPolicyError,
} from "@/lib/catalog/policies";

describe("catalog business policies", () => {
  it("blocks category archive while active products remain", () => {
    expect(() => assertCategoryCanArchive(1)).toThrowError(CatalogPolicyError);
    expect(() => assertCategoryCanArchive(0)).not.toThrow();
  });

  it("blocks product restore under an archived category", () => {
    expect(() => assertProductCanRestore("ARCHIVED")).toThrowError(CatalogPolicyError);
    expect(() => assertProductCanRestore("ACTIVE")).not.toThrow();
  });

  it("detects a stale updatedAt value", () => {
    const actual = new Date("2026-08-06T08:00:00.000Z");
    expect(() => assertCatalogVersion(actual, actual.toISOString())).not.toThrow();
    expect(() => assertCatalogVersion(actual, "2026-08-06T08:01:00.000Z")).toThrowError(CatalogPolicyError);
  });
});
