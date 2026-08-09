import { describe, expect, it } from "vitest";

import { formatRupiah, formatRupiahFromMinor } from "@/lib/currency";

const normalizeSpace = (value: string) => value.replace(/\s/g, " ");

describe("Rupiah display formatting", () => {
  it("hides database decimal digits for positive and zero values", () => {
    expect(normalizeSpace(formatRupiah("122400.00"))).toBe("Rp 122.400");
    expect(normalizeSpace(formatRupiah("0.00"))).toBe("Rp 0");
  });

  it("formats negative adjustments without decimal digits", () => {
    expect(normalizeSpace(formatRupiah("-2000.00"))).toBe("-Rp 2.000");
  });

  it("rounds receipt minor units to whole Rupiah", () => {
    expect(normalizeSpace(formatRupiahFromMinor(12_240_000n))).toBe("Rp 122.400");
    expect(normalizeSpace(formatRupiahFromMinor(12_240_050n))).toBe("Rp 122.401");
  });
});
