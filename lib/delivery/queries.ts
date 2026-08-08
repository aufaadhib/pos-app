import "server-only";

import { CatalogStatus, DeliveryProvider, PaymentSettlementStatus, Prisma, SettlementBatchStatus } from "@/generated/prisma/client";
import type { AppRole } from "@/lib/auth/permissions";
import { deliveryProviderLabels, type DeliveryManagementDto } from "@/lib/delivery/types";
import { prisma } from "@/lib/prisma";

const managementProductLimit = 300;
const pendingSettlementLimit = 500;
const recentBatchLimit = 20;

/** Reads bounded channel configuration, pending receivables, batches, and financial summaries for one outlet. */
export async function getDeliveryManagement(outletId: string, userId: string, role: AppRole): Promise<DeliveryManagementDto | null> {
  const outlet = await prisma.outlet.findFirst({
    where: { id: outletId, ...(role === "owner" ? {} : { assignments: { some: { userId } } }) },
    select: { id: true },
  });
  if (!outlet) return null;
  const now = new Date();
  const [channels, products, pending, batches, pendingAggregate, overdueAggregate, settledAggregate, settledComparison] = await Promise.all([
    prisma.outletDeliveryChannel.findMany({ where: { outletId }, orderBy: { provider: "asc" } }),
    prisma.product.findMany({
      where: { status: CatalogStatus.ACTIVE, category: { status: CatalogStatus.ACTIVE } },
      orderBy: [{ category: { displayOrder: "asc" } }, { displayOrder: "asc" }, { name: "asc" }],
      take: managementProductLimit,
      select: {
        id: true,
        name: true,
        sku: true,
        basePrice: true,
        outletOverrides: { where: { outletId }, select: { priceOverride: true } },
        channelPrices: { where: { channel: { outletId } }, select: { channelId: true, priceOverride: true } },
      },
    }),
    prisma.salePayment.findMany({
      where: { settlementStatus: PaymentSettlementStatus.PENDING, sale: { outletId } },
      orderBy: { expectedSettlementAt: "asc" },
      take: pendingSettlementLimit,
      select: {
        id: true,
        amount: true,
        directEquivalentAmount: true,
        expectedFeeAmount: true,
        expectedNetAmount: true,
        expectedSettlementAt: true,
        sale: { select: { id: true, receiptNumber: true, externalOrderId: true, completedAt: true, channel: { select: { id: true, provider: true } } } },
      },
    }),
    prisma.platformSettlement.findMany({
      where: { channel: { outletId } },
      orderBy: { receivedAt: "desc" },
      take: recentBatchLimit,
      select: { id: true, reference: true, grossAmount: true, platformFeeAmount: true, merchantPromotionAmount: true, otherAdjustmentAmount: true, netReceivedAmount: true, receivedAt: true, status: true, channel: { select: { provider: true } }, _count: { select: { items: true } } },
    }),
    prisma.salePayment.aggregate({
      where: { settlementStatus: PaymentSettlementStatus.PENDING, sale: { outletId } },
      _sum: { amount: true, expectedNetAmount: true },
      _count: true,
    }),
    prisma.salePayment.aggregate({
      where: { settlementStatus: PaymentSettlementStatus.PENDING, expectedSettlementAt: { lt: now }, sale: { outletId } },
      _sum: { amount: true },
    }),
    prisma.platformSettlement.aggregate({
      where: { status: SettlementBatchStatus.CONFIRMED, channel: { outletId } },
      _sum: { netReceivedAmount: true, platformFeeAmount: true },
    }),
    prisma.platformSettlementItem.aggregate({
      where: { settlement: { status: SettlementBatchStatus.CONFIRMED, channel: { outletId } } },
      _sum: { directEquivalentAmount: true },
    }),
  ]);
  return {
    channels: channels.map((channel) => ({
      id: channel.id,
      provider: channel.provider,
      label: deliveryProviderLabels[channel.provider],
      isActive: channel.isActive,
      markupRate: channel.markupRate.toFixed(2),
      estimatedFeeRate: channel.estimatedFeeRate.toFixed(2),
      roundingUnit: channel.roundingUnit,
      settlementDelayHours: channel.settlementDelayHours,
      updatedAt: channel.updatedAt.toISOString(),
    })),
    products: products.map((product) => ({
      id: product.id,
      name: product.name,
      sku: product.sku,
      directPrice: (product.outletOverrides[0]?.priceOverride ?? product.basePrice).toFixed(2),
      overrides: product.channelPrices.map((price) => ({ channelId: price.channelId, priceOverride: price.priceOverride.toFixed(2) })),
    })),
    pending: pending.flatMap((payment) => {
      if (!payment.sale.channel || !payment.sale.externalOrderId || !payment.expectedSettlementAt || !payment.directEquivalentAmount || !payment.expectedFeeAmount || !payment.expectedNetAmount) return [];
      return [{
        paymentId: payment.id,
        saleId: payment.sale.id,
        receiptNumber: payment.sale.receiptNumber,
        externalOrderId: payment.sale.externalOrderId,
        channelId: payment.sale.channel.id,
        provider: payment.sale.channel.provider,
        grossAmount: payment.amount.toFixed(2),
        directEquivalentAmount: payment.directEquivalentAmount.toFixed(2),
        expectedFeeAmount: payment.expectedFeeAmount.toFixed(2),
        expectedNetAmount: payment.expectedNetAmount.toFixed(2),
        expectedSettlementAt: payment.expectedSettlementAt.toISOString(),
        completedAt: payment.sale.completedAt.toISOString(),
        overdue: payment.expectedSettlementAt < now,
      }];
    }),
    batches: batches.map((batch) => ({
      id: batch.id,
      provider: batch.channel.provider,
      reference: batch.reference,
      grossAmount: batch.grossAmount.toFixed(2),
      platformFeeAmount: batch.platformFeeAmount.toFixed(2),
      merchantPromotionAmount: batch.merchantPromotionAmount.toFixed(2),
      otherAdjustmentAmount: batch.otherAdjustmentAmount.toFixed(2),
      netReceivedAmount: batch.netReceivedAmount.toFixed(2),
      receivedAt: batch.receivedAt.toISOString(),
      status: batch.status,
      transactionCount: batch._count.items,
    })),
    summary: {
      pendingGross: pendingAggregate._sum.amount?.toFixed(2) ?? "0.00",
      expectedNet: pendingAggregate._sum.expectedNetAmount?.toFixed(2) ?? "0.00",
      overdueGross: overdueAggregate._sum.amount?.toFixed(2) ?? "0.00",
      settledNet: settledAggregate._sum.netReceivedAmount?.toFixed(2) ?? "0.00",
      settledFees: settledAggregate._sum.platformFeeAmount?.toFixed(2) ?? "0.00",
      directComparison: new Prisma.Decimal(settledAggregate._sum.netReceivedAmount ?? 0).sub(settledComparison._sum.directEquivalentAmount ?? 0).toFixed(2),
      pendingCount: pendingAggregate._count,
      statuses: [PaymentSettlementStatus.PENDING, PaymentSettlementStatus.SETTLED],
    },
  };
}

/** Returns the three supported providers for configuration cards even before database rows exist. */
export function getSupportedDeliveryProviders() {
  return [DeliveryProvider.GOFOOD, DeliveryProvider.GRABFOOD, DeliveryProvider.SHOPEEFOOD] as const;
}
