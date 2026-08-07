import { Prisma } from "@/generated/prisma/client";

export type SaleTotals = {
  subtotal: Prisma.Decimal;
  serviceChargeAmount: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  total: Prisma.Decimal;
};

/** Calculates checkout totals with half-up Rupiah rounding and no floating-point arithmetic. */
export function calculateSaleTotals(input: {
  subtotal: Prisma.Decimal;
  serviceChargeRate: Prisma.Decimal;
  taxRate: Prisma.Decimal;
  pricesIncludeTax: boolean;
}): SaleTotals {
  const hundred = new Prisma.Decimal(100);
  const serviceChargeAmount = input.subtotal
    .mul(input.serviceChargeRate)
    .div(hundred)
    .toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);
  const taxAmount = input.pricesIncludeTax
    ? input.subtotal.mul(input.taxRate).div(hundred.add(input.taxRate)).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP)
    : input.subtotal.add(serviceChargeAmount).mul(input.taxRate).div(hundred).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);
  return {
    subtotal: input.subtotal,
    serviceChargeAmount,
    taxAmount,
    total: input.subtotal.add(serviceChargeAmount).add(input.pricesIncludeTax ? 0 : taxAmount),
  };
}
