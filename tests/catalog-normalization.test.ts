import { describe, expect, it } from "vitest";

import {
  normalizeCatalogLabel,
  normalizeCatalogName,
  normalizeSku,
  parseRupiahToMinorUnit,
} from "@/lib/catalog/normalization";
import { formatRupiah } from "@/lib/currency";

describe("catalog normalization", () => {
  it("normalizes spacing and case for unique names", () => {
    expect(normalizeCatalogName("  Es   Kopi SUSU  ")).toBe("es kopi susu");
    expect(normalizeCatalogLabel("  Es   Kopi SUSU  ")).toBe("Es Kopi SUSU");
  });

  it("normalizes optional SKU to uppercase", () => {
    expect(normalizeSku(" kopi-001 ")).toBe("KOPI-001");
    expect(normalizeSku("   ")).toBeNull();
  });

  it("parses whole Rupiah without floating-point arithmetic", () => {
    expect(parseRupiahToMinorUnit("Rp 25.000")).toBe("25000");
    expect(parseRupiahToMinorUnit("25000")).toBe("25000");
    expect(parseRupiahToMinorUnit("25,50")).toBeNull();
    expect(parseRupiahToMinorUnit("0")).toBeNull();
    expect(formatRupiah("25000.00")).toContain("25.000");
  });
});
