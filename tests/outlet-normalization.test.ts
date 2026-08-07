import { describe, expect, it } from "vitest";

import {
  formatOutletAddress,
  normalizeOutletCode,
  normalizeOutletName,
  parseOutletPercentage,
  suggestOutletCode,
} from "@/lib/outlets/normalization";

describe("outlet normalization", () => {
  it("normalizes names and codes consistently", () => {
    expect(normalizeOutletName("  Glutong   Kémang ")).toBe("glutong kémang");
    expect(normalizeOutletCode(" kmg 01 ")).toBe("KMG-01");
  });

  it("suggests a short editable code", () => {
    expect(suggestOutletCode("Glutong Kemang Selatan")).toBe("GLU-KEM-SEL");
    expect(suggestOutletCode("Kemang")).toBe("KEMANG");
  });

  it("formats a structured address without empty fragments", () => {
    expect(formatOutletAddress({ addressLine: null, cityName: "Jakarta Selatan", provinceName: "DKI Jakarta" }))
      .toBe("Jakarta Selatan, DKI Jakarta");
  });

  it("parses bounded Indonesian percentages", () => {
    expect(parseOutletPercentage("10,5")).toBe("10.50");
    expect(parseOutletPercentage("100")).toBe("100.00");
    expect(parseOutletPercentage("100,01")).toBeNull();
  });
});
