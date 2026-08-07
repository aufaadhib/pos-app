import "server-only";

import { CatalogStatus, OutletStatus } from "@/generated/prisma/client";
import type { AppRole } from "@/lib/auth/permissions";
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
      basePrice: true,
      category: { select: { name: true } },
      outletOverrides: { where: { outletId }, select: { priceOverride: true } },
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
    return {
      id: product.id,
      categoryId: product.categoryId,
      categoryName: product.category.name,
      name: product.name,
      sku: product.sku,
      description: product.description,
      effectiveBasePrice: (productOverride?.priceOverride ?? product.basePrice).toFixed(2),
      variantGroups: product.variantGroups.map((group) => ({
        id: group.id,
        name: group.name,
        options: group.options.flatMap((option) => {
          const override = option.outletOverrides[0];
          return override?.isAvailable === false ? [] : [{
            id: option.id,
            name: option.name,
            priceAdjustment: (override?.priceAdjustmentOverride ?? option.priceAdjustment).toFixed(2),
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
      ...outlet,
      taxRate: outlet.taxRate.toFixed(2),
      serviceChargeRate: outlet.serviceChargeRate.toFixed(2),
    },
    categories,
    products,
    truncated: records.length > posProductLimit,
  };
}

/** Reads one outlet's newest completed sales with bounded pagination. */
export async function getSalesPage(outletId: string, page: number): Promise<SalePage> {
  const totalItems = await prisma.sale.count({ where: { outletId } });
  const totalPages = Math.max(1, Math.ceil(totalItems / salePageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const sales = await prisma.sale.findMany({
    where: { outletId },
    orderBy: { completedAt: "desc" },
    skip: (currentPage - 1) * salePageSize,
    take: salePageSize,
    select: {
      id: true,
      receiptNumber: true,
      orderType: true,
      tableLabel: true,
      total: true,
      createdByName: true,
      completedAt: true,
      payment: { select: { method: true } },
      items: { select: { quantity: true } },
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
      createdByName: sale.createdByName,
      completedAt: sale.completedAt.toISOString(),
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
      receiptNumber: true,
      orderType: true,
      tableLabel: true,
      subtotal: true,
      serviceChargeRate: true,
      serviceChargeAmount: true,
      taxRate: true,
      taxAmount: true,
      pricesIncludeTax: true,
      total: true,
      createdByName: true,
      completedAt: true,
      outlet: { select: { name: true, code: true } },
      payment: { select: { method: true, reference: true, tenderedAmount: true, changeAmount: true } },
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
    },
  });
  if (!sale?.payment) return null;
  return {
    id: sale.id,
    receiptNumber: sale.receiptNumber,
    orderType: sale.orderType,
    tableLabel: sale.tableLabel,
    total: sale.total.toFixed(2),
    itemCount: sale.items.reduce((sum, item) => sum + item.quantity, 0),
    paymentMethod: sale.payment.method,
    createdByName: sale.createdByName,
    completedAt: sale.completedAt.toISOString(),
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
    })),
  };
}
