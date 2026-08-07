import { describe, expect, it } from "vitest";

import { createOutletSchema } from "@/lib/outlets/validation";

const validOutlet = {
  name: "Glutong Kemang",
  code: "KMG-01",
  timezone: "Asia/Jakarta",
  addressLine: "Jl. Kemang Raya",
  provinceCode: "31",
  provinceName: "DKI Jakarta",
  cityCode: "3174",
  cityName: "Kota Jakarta Selatan",
  taxRate: "10",
  serviceChargeRate: "5",
  pricesIncludeTax: "true",
};

describe("outlet validation", () => {
  it("accepts an Indonesian outlet and normalizes its code", () => {
    expect(createOutletSchema.parse({ ...validOutlet, code: "kmg 01" }).code).toBe("KMG-01");
  });

  it("rejects unsupported timezones and malformed region codes", () => {
    expect(createOutletSchema.safeParse({ ...validOutlet, timezone: "UTC" }).success).toBe(false);
    expect(createOutletSchema.safeParse({ ...validOutlet, cityCode: "31" }).success).toBe(false);
  });

  it("normalizes tax settings without floating point money", () => {
    const result = createOutletSchema.parse({ ...validOutlet, taxRate: "11,5", pricesIncludeTax: undefined });
    expect(result.taxRate).toBe("11.50");
    expect(result.pricesIncludeTax).toBe(false);
    expect(createOutletSchema.safeParse({ ...validOutlet, serviceChargeRate: "101" }).success).toBe(false);
  });
});
