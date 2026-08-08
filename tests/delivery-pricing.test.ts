import { describe, expect, it } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import { calculateChannelPrice, calculateExpectedSettlement, calculateSettlementNet } from "@/lib/delivery/pricing";

describe("delivery pricing", () => {
  it("marks prices up and always rounds positive prices upward to Rp500", () => {
    expect(calculateChannelPrice(new Prisma.Decimal(6000), new Prisma.Decimal(20), 500).toFixed(2)).toBe("7500.00");
    expect(calculateChannelPrice(new Prisma.Decimal(0), new Prisma.Decimal(20), 500).toFixed(2)).toBe("0.00");
  });

  it("keeps settlement arithmetic precise and balanced", () => {
    const expected = calculateExpectedSettlement(new Prisma.Decimal(250000), new Prisma.Decimal(20));
    expect(expected.fee.toFixed(2)).toBe("50000.00");
    expect(expected.net.toFixed(2)).toBe("200000.00");
    expect(calculateSettlementNet({ gross: new Prisma.Decimal(250000), platformFee: new Prisma.Decimal(50000), merchantPromotion: new Prisma.Decimal(10000), otherAdjustment: new Prisma.Decimal(-2000) }).toFixed(2)).toBe("188000.00");
  });
});
