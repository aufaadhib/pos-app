import { Prisma } from "@/generated/prisma/client";

/** Applies one channel markup and rounds positive amounts upward to the configured Rupiah unit. */
export function calculateChannelPrice(amount: Prisma.Decimal, markupRate: Prisma.Decimal, roundingUnit: number): Prisma.Decimal {
  if (amount.isZero()) return amount;
  const unit = new Prisma.Decimal(roundingUnit);
  return amount.mul(new Prisma.Decimal(100).add(markupRate)).div(100).div(unit).ceil().mul(unit);
}

/** Calculates the estimated fee and net amount using half-up Rupiah precision. */
export function calculateExpectedSettlement(gross: Prisma.Decimal, feeRate: Prisma.Decimal) {
  const fee = gross.mul(feeRate).div(100).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);
  return { fee, net: gross.sub(fee) };
}

/** Verifies the immutable arithmetic recorded by a manual settlement batch. */
export function calculateSettlementNet(input: {
  gross: Prisma.Decimal;
  platformFee: Prisma.Decimal;
  merchantPromotion: Prisma.Decimal;
  otherAdjustment: Prisma.Decimal;
}): Prisma.Decimal {
  return input.gross.sub(input.platformFee).sub(input.merchantPromotion).add(input.otherAdjustment);
}
