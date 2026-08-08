import "server-only";

import { CatalogStatus, type DeliveryProvider, OutletStatus, type PaymentSettlementStatus, Prisma, type SaleStatus } from "@/generated/prisma/client";
import type { AppRole } from "@/lib/auth/permissions";
import { calculateChannelPrice } from "@/lib/delivery/pricing";
import { deliveryProviderLabels } from "@/lib/delivery/types";
import { prisma } from "@/lib/prisma";
import type { PosMenu, SaleDetail, SalePage } from "@/lib/pos/types";

const posProductLimit = 300;
const salePageSize = 20;

/** Reads the active, outlet-effective menu as a bounded serializable checkout DTO. */
export async function getPosMenu(outletId: string, userId: string, role: AppRole): Promise<PosMenu | null> {
  const outlet = await prisma.outlet.findFirst({
    where: {
      id: outletId,
      status: OutletStatus.ACTIVE,
      ...(role === "owner" ? {} : { assignments: { some: { userId } } }),
    },
    select: {
      id: true,
      code: true,
      name: true,
      timezone: true,
      taxRate: true,
      serviceChargeRate: true,
      pricesIncludeTax: true,
      deliveryChannels: {
        where: { isActive: true },
        orderBy: { provider: "asc" },
        select: { id: true, provider: true, markupRate: true, estimatedFeeRate: true, roundingUnit: true, settlementDelayHours: true },
      },
    },
  });
  if (!outlet) return null;

  const records = await prisma.product.findMany({
    where: {
      status: CatalogStatus.ACTIVE,
      category: { status: CatalogStatus.ACTIVE },
      outletOverrides: { none: { outletId, isAvailable: false } },
    },
    orderBy: [{ category: { displayOrder: "asc" } }, { displayOrder: "asc" }, { name: "asc" }],
    take: posProductLimit + 1,
    select: {
      id: true,
      categoryId: true,
      name: true,
      sku: true,
      description: true,
      imageUrl: true,
      imagePositionX: true,
      imagePositionY: true,
      basePrice: true,
      category: { select: { name: true } },
      outletOverrides: { where: { outletId }, select: { priceOverride: true } },
      channelPrices: { where: { channel: { outletId, isActive: true } }, select: { channelId: true, priceOverride: true } },
      variantGroups: {
        where: { status: CatalogStatus.ACTIVE },
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          options: {
            where: { status: CatalogStatus.ACTIVE },
            orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
            select: {
              id: true,
              name: true,
              priceAdjustment: true,
              outletOverrides: {
                where: { outletId },
                select: { isAvailable: true, priceAdjustmentOverride: true },
              },
            },
          },
        },
      },
      modifierGroups: {
        where: { status: CatalogStatus.ACTIVE, modifierGroup: { status: CatalogStatus.ACTIVE } },
        orderBy: [{ displayOrder: "asc" }, { modifierGroup: { name: "asc" } }],
        select: {
          modifierGroupId: true,
          minSelections: true,
          maxSelections: true,
          modifierGroup: {
            select: {
              name: true,
              options: {
                where: { status: CatalogStatus.ACTIVE },
                orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
                select: { id: true, name: true, priceAdjustment: true },
              },
            },
          },
        },
      },
    },
  });

  const products = records.slice(0, posProductLimit).map((product) => {
    const productOverride = product.outletOverrides[0];
    const directBasePrice = productOverride?.priceOverride ?? product.basePrice;
    const exactChannelPrices = new Map(product.channelPrices.map((price) => [price.channelId, price.priceOverride]));
    return {
      id: product.id,
      categoryId: product.categoryId,
      categoryName: product.category.name,
      name: product.name,
      sku: product.sku,
      description: product.description,
      imageUrl: product.imageUrl,
      imagePositionX: product.imagePositionX,
      imagePositionY: product.imagePositionY,
      effectiveBasePrice: directBasePrice.toFixed(2),
      channelBasePrices: outlet.deliveryChannels.map((channel) => ({
        channelId: channel.id,
        basePrice: (exactChannelPrices.get(channel.id) ?? calculateChannelPrice(directBasePrice, channel.markupRate, channel.roundingUnit)).toFixed(2),
      })),
      variantGroups: product.variantGroups.map((group) => ({
        id: group.id,
        name: group.name,
        options: group.options.flatMap((option) => {
          const override = option.outletOverrides[0];
          return override?.isAvailable === false ? [] : [{
            id: option.id,
            name: option.name,
            priceAdjustment: (override?.priceAdjustmentOverride ?? option.priceAdjustment).toFixed(2),
            channelPriceAdjustments: outlet.deliveryChannels.map((channel) => ({
              channelId: channel.id,
              priceAdjustment: calculateChannelPrice(override?.priceAdjustmentOverride ?? option.priceAdjustment, channel.markupRate, channel.roundingUnit).toFixed(2),
            })),
          }];
        }),
      })),
      modifierGroups: product.modifierGroups.map((relation) => ({
        id: relation.modifierGroupId,
        name: relation.modifierGroup.name,
        minSelections: relation.minSelections,
        maxSelections: relation.maxSelections,
        options: relation.modifierGroup.options.map((option) => ({
          id: option.id,
          name: option.name,
          priceAdjustment: option.priceAdjustment.toFixed(2),
          channelPriceAdjustments: outlet.deliveryChannels.map((channel) => ({
            channelId: channel.id,
            priceAdjustment: calculateChannelPrice(option.priceAdjustment, channel.markupRate, channel.roundingUnit).toFixed(2),
          })),
        })),
      })),
    };
  }).filter((product) => product.variantGroups.every((group) => group.options.length > 0));

  const categories = Array.from(new Map(products.map((product) => [
    product.categoryId,
    { id: product.categoryId, name: product.categoryName },
  ])).values());
  return {
    outlet: {
      id: outlet.id,
      code: outlet.code,
      name: outlet.name,
      timezone: outlet.timezone,
      pricesIncludeTax: outlet.pricesIncludeTax,
      taxRate: outlet.taxRate.toFixed(2),
      serviceChargeRate: outlet.serviceChargeRate.toFixed(2),
    },
    deliveryChannels: outlet.deliveryChannels.map((channel) => ({
      id: channel.id,
      provider: channel.provider,
      label: deliveryProviderLabels[channel.provider],
      markupRate: channel.markupRate.toFixed(2),
      estimatedFeeRate: channel.estimatedFeeRate.toFixed(2),
      settlementDelayHours: channel.settlementDelayHours,
    })),
    categories,
    products,
    truncated: records.length > posProductLimit,
  };
}

/** Reads one outlet's newest completed sales with bounded pagination. */
export async function getSalesPage(outletId: string, page: number, filters: { source?: "DIRECT" | DeliveryProvider; settlementStatus?: PaymentSettlementStatus; status?: SaleStatus } = {}): Promise<SalePage> {
  const where: Prisma.SaleWhereInput = {
    outletId,
    ...(filters.source === "DIRECT" ? { channelId: null } : filters.source ? { channel: { provider: filters.source } } : {}),
    ...(filters.settlementStatus ? { payment: { settlementStatus: filters.settlementStatus } } : {}),
    ...(filters.status ? { status: filters.status } : {}),
  };
  const totalItems = await prisma.sale.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalItems / salePageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const sales = await prisma.sale.findMany({
    where,
    orderBy: { completedAt: "desc" },
    skip: (currentPage - 1) * salePageSize,
    take: salePageSize,
    select: {
      id: true,
      receiptNumber: true,
      orderType: true,
      tableLabel: true,
      total: true,
      status: true,
      createdByName: true,
      completedAt: true,
      externalOrderId: true,
      channel: { select: { provider: true } },
      payment: { select: { method: true, settlementStatus: true, expectedSettlementAt: true } },
      items: { select: { quantity: true } },
      refunds: { select: { amount: true } },
    },
  });
  return {
    items: sales.map((sale) => ({
      id: sale.id,
      receiptNumber: sale.receiptNumber,
      orderType: sale.orderType,
      tableLabel: sale.tableLabel,
      total: sale.total.toFixed(2),
      itemCount: sale.items.reduce((sum, item) => sum + item.quantity, 0),
      paymentMethod: sale.payment!.method,
      deliveryProvider: sale.channel?.provider ?? null,
      externalOrderId: sale.externalOrderId,
      settlementStatus: sale.payment!.settlementStatus,
      expectedSettlementAt: sale.payment!.expectedSettlementAt?.toISOString() ?? null,
      createdByName: sale.createdByName,
      completedAt: sale.completedAt.toISOString(),
      status: sale.status,
      refundedAmount: sale.refunds.reduce((sum, refund) => sum.add(refund.amount), new Prisma.Decimal(0)).toFixed(2),
    })),
    page: currentPage,
    totalPages,
    totalItems,
  };
}

/** Reads one immutable receipt detail only inside the caller's active outlet. */
export async function getSaleDetail(id: string, outletId: string): Promise<SaleDetail | null> {
  const sale = await prisma.sale.findFirst({
    where: { id, outletId },
    select: {
      id: true,
      shiftId: true,
      receiptNumber: true,
      businessDate: true,
      orderType: true,
      tableLabel: true,
      subtotal: true,
      serviceChargeRate: true,
      serviceChargeAmount: true,
      taxRate: true,
      taxAmount: true,
      pricesIncludeTax: true,
      total: true,
      status: true,
      createdByName: true,
      completedAt: true,
      externalOrderId: true,
      channel: { select: { provider: true } },
      outlet: { select: { name: true, code: true } },
      payment: { select: {
        method: true,
        reference: true,
        tenderedAmount: true,
        changeAmount: true,
        settlementStatus: true,
        expectedSettlementAt: true,
        expectedFeeAmount: true,
        expectedNetAmount: true,
        directEquivalentAmount: true,
        settlementItems: { where: { settlement: { status: "CONFIRMED" } }, take: 1, select: { settlement: { select: { reference: true, receivedAt: true } } } },
      } },
      items: {
        orderBy: { id: "asc" },
        select: {
          id: true,
          productName: true,
          sku: true,
          quantity: true,
          note: true,
          unitPrice: true,
          lineTotal: true,
          variants: { select: { variantGroupName: true, optionName: true, priceAdjustment: true } },
          modifiers: { select: { modifierGroupName: true, optionName: true, priceAdjustment: true } },
        },
      },
      refunds: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          type: true,
          amount: true,
          reason: true,
          providerReference: true,
          actorName: true,
          cashShiftId: true,
          createdAt: true,
          items: { select: { saleItemId: true, quantity: true, lineAmount: true, saleItem: { select: { productName: true } } } },
        },
      },
    },
  });
  if (!sale?.payment) return null;
  return {
    id: sale.id,
    shiftId: sale.shiftId,
    businessDate: sale.businessDate.toISOString().slice(0, 10),
    receiptNumber: sale.receiptNumber,
    orderType: sale.orderType,
    tableLabel: sale.tableLabel,
    total: sale.total.toFixed(2),
    itemCount: sale.items.reduce((sum, item) => sum + item.quantity, 0),
    paymentMethod: sale.payment.method,
    deliveryProvider: sale.channel?.provider ?? null,
    externalOrderId: sale.externalOrderId,
    settlementStatus: sale.payment.settlementStatus,
    expectedSettlementAt: sale.payment.expectedSettlementAt?.toISOString() ?? null,
    createdByName: sale.createdByName,
    completedAt: sale.completedAt.toISOString(),
    status: sale.status,
    refundedAmount: sale.refunds.reduce((sum, refund) => sum.add(refund.amount), new Prisma.Decimal(0)).toFixed(2),
    remainingAmount: sale.total.sub(sale.refunds.reduce((sum, refund) => sum.add(refund.amount), new Prisma.Decimal(0))).toFixed(2),
    outletName: sale.outlet.name,
    outletCode: sale.outlet.code,
    subtotal: sale.subtotal.toFixed(2),
    serviceChargeRate: sale.serviceChargeRate.toFixed(2),
    serviceChargeAmount: sale.serviceChargeAmount.toFixed(2),
    taxRate: sale.taxRate.toFixed(2),
    taxAmount: sale.taxAmount.toFixed(2),
    pricesIncludeTax: sale.pricesIncludeTax,
    paymentReference: sale.payment.reference,
    tenderedAmount: sale.payment.tenderedAmount?.toFixed(2) ?? null,
    changeAmount: sale.payment.changeAmount?.toFixed(2) ?? null,
    expectedFeeAmount: sale.payment.expectedFeeAmount?.toFixed(2) ?? null,
    expectedNetAmount: sale.payment.expectedNetAmount?.toFixed(2) ?? null,
    directEquivalentAmount: sale.payment.directEquivalentAmount?.toFixed(2) ?? null,
    settlementReference: sale.payment.settlementItems[0]?.settlement.reference ?? null,
    settledAt: sale.payment.settlementItems[0]?.settlement.receivedAt.toISOString() ?? null,
    items: sale.items.map((item) => ({
      id: item.id,
      productName: item.productName,
      sku: item.sku,
      quantity: item.quantity,
      note: item.note,
      unitPrice: item.unitPrice.toFixed(2),
      lineTotal: item.lineTotal.toFixed(2),
      variants: item.variants.map((value) => ({ groupName: value.variantGroupName, optionName: value.optionName, priceAdjustment: value.priceAdjustment.toFixed(2) })),
      modifiers: item.modifiers.map((value) => ({ groupName: value.modifierGroupName, optionName: value.optionName, priceAdjustment: value.priceAdjustment.toFixed(2) })),
      refundedQuantity: sale.refunds.reduce((sum, refund) => sum + (refund.items.find((value) => value.saleItemId === item.id)?.quantity ?? 0), 0),
    })),
    refunds: sale.refunds.map((refund) => ({
      id: refund.id,
      type: refund.type,
      amount: refund.amount.toFixed(2),
      reason: refund.reason,
      providerReference: refund.providerReference,
      actorName: refund.actorName,
      cashShiftId: refund.cashShiftId,
      createdAt: refund.createdAt.toISOString(),
      items: refund.items.map((item) => ({
        saleItemId: item.saleItemId,
        productName: item.saleItem.productName,
        quantity: item.quantity,
        lineAmount: item.lineAmount.toFixed(2),
      })),
    })),
  };
}
