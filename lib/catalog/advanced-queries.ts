import "server-only";

import { CatalogStatus, OutletStatus, Prisma } from "@/generated/prisma/client";
import type { AppRole } from "@/lib/auth/permissions";
import type {
  AdvancedProductItem,
  ModifierGroupItem,
  OutletCatalogProductPage,
} from "@/lib/catalog/types";
import type { CatalogSearch } from "@/lib/catalog/validation";
import { prisma } from "@/lib/prisma";

const catalogPageSize = 20;

/** Reads a product's complete master option configuration as a serializable DTO. */
export async function getAdvancedProduct(id: string): Promise<AdvancedProductItem | null> {
  const product = await prisma.product.findUnique({
    where: { id },
    select: {
      id: true,
      categoryId: true,
      name: true,
      sku: true,
      description: true,
      basePrice: true,
      displayOrder: true,
      status: true,
      updatedAt: true,
      category: { select: { name: true, status: true } },
      variantGroups: {
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
        select: {
          id: true,
          productId: true,
          name: true,
          displayOrder: true,
          status: true,
          updatedAt: true,
          options: {
            orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
            select: { id: true, name: true, priceAdjustment: true, displayOrder: true, status: true, updatedAt: true },
          },
        },
      },
      modifierGroups: {
        orderBy: [{ displayOrder: "asc" }, { modifierGroup: { name: "asc" } }],
        select: {
          modifierGroupId: true,
          minSelections: true,
          maxSelections: true,
          displayOrder: true,
          status: true,
          updatedAt: true,
          modifierGroup: { select: { name: true } },
        },
      },
    },
  });
  if (!product) return null;
  return {
    id: product.id,
    categoryId: product.categoryId,
    categoryName: product.category.name,
    categoryStatus: product.category.status,
    name: product.name,
    sku: product.sku,
    description: product.description,
    basePrice: product.basePrice.toFixed(2),
    displayOrder: product.displayOrder,
    status: product.status,
    updatedAt: product.updatedAt.toISOString(),
    variantGroups: product.variantGroups.map((group) => ({
      ...group,
      updatedAt: group.updatedAt.toISOString(),
      options: group.options.map((option) => ({ ...option, priceAdjustment: option.priceAdjustment.toFixed(2), updatedAt: option.updatedAt.toISOString() })),
    })),
    modifierGroups: product.modifierGroups.map((relation) => ({
      modifierGroupId: relation.modifierGroupId,
      modifierGroupName: relation.modifierGroup.name,
      minSelections: relation.minSelections,
      maxSelections: relation.maxSelections,
      displayOrder: relation.displayOrder,
      status: relation.status,
      updatedAt: relation.updatedAt.toISOString(),
    })),
  };
}

/** Reads the reusable modifier library with ordered options and serialized prices. */
export async function getModifierGroups(includeArchived: boolean): Promise<ModifierGroupItem[]> {
  const groups = await prisma.modifierGroup.findMany({
    where: includeArchived ? undefined : { status: CatalogStatus.ACTIVE },
    orderBy: [{ status: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      updatedAt: true,
      options: {
        where: includeArchived ? undefined : { status: CatalogStatus.ACTIVE },
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
        select: { id: true, name: true, priceAdjustment: true, displayOrder: true, status: true, updatedAt: true },
      },
    },
  });
  return groups.map((group) => ({
    ...group,
    updatedAt: group.updatedAt.toISOString(),
    options: group.options.map((option) => ({ ...option, priceAdjustment: option.priceAdjustment.toFixed(2), updatedAt: option.updatedAt.toISOString() })),
  }));
}

/** Resolves an active outlet only when it is inside the actor's assignment scope. */
export async function getAccessibleCatalogOutlet(outletId: string, userId: string, role: AppRole) {
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
      taxRate: true,
      serviceChargeRate: true,
      pricesIncludeTax: true,
    },
  });
  return outlet ? {
    ...outlet,
    taxRate: outlet.taxRate.toFixed(2),
    serviceChargeRate: outlet.serviceChargeRate.toFixed(2),
  } : null;
}

/** Reads one outlet's effective menu by merging sparse product and variant overrides with master values. */
export async function getOutletCatalogProducts(
  search: CatalogSearch,
  outletId: string,
  includeUnavailable: boolean,
): Promise<OutletCatalogProductPage> {
  const requestedStatus = includeUnavailable ? search.status : "active";
  const where: Prisma.ProductWhereInput = {
    ...(search.category ? { categoryId: search.category } : {}),
    ...(requestedStatus === "all" ? {} : { status: requestedStatus === "archived" ? CatalogStatus.ARCHIVED : CatalogStatus.ACTIVE }),
    ...(!includeUnavailable ? {
      category: { status: CatalogStatus.ACTIVE },
      outletOverrides: { none: { outletId, isAvailable: false } },
      NOT: {
        variantGroups: {
          some: {
            status: CatalogStatus.ACTIVE,
            options: {
              none: {
                status: CatalogStatus.ACTIVE,
                outletOverrides: { none: { outletId, isAvailable: false } },
              },
            },
          },
        },
      },
    } : {}),
    ...(search.q ? {
      OR: [
        { name: { contains: search.q, mode: "insensitive" } },
        { sku: { contains: search.q, mode: "insensitive" } },
      ],
    } : {}),
  };
  const totalItems = await prisma.product.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalItems / catalogPageSize));
  const page = Math.min(search.page, totalPages);
  const products = await prisma.product.findMany({
    where,
    orderBy: [{ category: { displayOrder: "asc" } }, { displayOrder: "asc" }, { name: "asc" }],
    skip: (page - 1) * catalogPageSize,
    take: catalogPageSize,
    select: {
      id: true,
      categoryId: true,
      name: true,
      sku: true,
      description: true,
      basePrice: true,
      displayOrder: true,
      status: true,
      updatedAt: true,
      category: { select: { name: true, status: true } },
      outletOverrides: {
        where: { outletId },
        select: { isAvailable: true, priceOverride: true, updatedAt: true },
      },
      variantGroups: {
        where: includeUnavailable ? undefined : { status: CatalogStatus.ACTIVE },
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
        select: {
          id: true,
          productId: true,
          name: true,
          displayOrder: true,
          status: true,
          updatedAt: true,
          options: {
            where: includeUnavailable ? undefined : { status: CatalogStatus.ACTIVE },
            orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
            select: {
              id: true,
              name: true,
              priceAdjustment: true,
              displayOrder: true,
              status: true,
              updatedAt: true,
              outletOverrides: { where: { outletId }, select: { isAvailable: true, priceAdjustmentOverride: true, updatedAt: true } },
            },
          },
        },
      },
    },
  });

  return {
    items: products.map((product) => {
      const productOverride = product.outletOverrides[0];
      const variantGroups = product.variantGroups.map((group) => ({
        id: group.id,
        productId: group.productId,
        name: group.name,
        displayOrder: group.displayOrder,
        status: group.status,
        updatedAt: group.updatedAt.toISOString(),
        options: group.options.map((option) => {
          const override = option.outletOverrides[0];
          return {
            id: option.id,
            name: option.name,
            priceAdjustment: option.priceAdjustment.toFixed(2),
            effectivePriceAdjustment: (override?.priceAdjustmentOverride ?? option.priceAdjustment).toFixed(2),
            isAvailable: option.status === CatalogStatus.ACTIVE && override?.isAvailable !== false,
            hasPriceOverride: override?.priceAdjustmentOverride !== null && override?.priceAdjustmentOverride !== undefined,
            overrideUpdatedAt: override?.updatedAt.toISOString() ?? null,
            displayOrder: option.displayOrder,
            status: option.status,
            updatedAt: option.updatedAt.toISOString(),
          };
        }),
      }));
      const hasSelectableVariants = variantGroups
        .filter((group) => group.status === CatalogStatus.ACTIVE)
        .every((group) => group.options.some((option) => option.isAvailable));
      return {
        id: product.id,
        categoryId: product.categoryId,
        categoryName: product.category.name,
        categoryStatus: product.category.status,
        name: product.name,
        sku: product.sku,
        description: product.description,
        basePrice: product.basePrice.toFixed(2),
        effectiveBasePrice: (productOverride?.priceOverride ?? product.basePrice).toFixed(2),
        isAvailable: product.status === CatalogStatus.ACTIVE && product.category.status === CatalogStatus.ACTIVE && productOverride?.isAvailable !== false && hasSelectableVariants,
        hasPriceOverride: productOverride?.priceOverride !== null && productOverride?.priceOverride !== undefined,
        overrideUpdatedAt: productOverride?.updatedAt.toISOString() ?? null,
        displayOrder: product.displayOrder,
        status: product.status,
        updatedAt: product.updatedAt.toISOString(),
        variantGroups,
      };
    }),
    page,
    pageSize: catalogPageSize,
    totalItems,
    totalPages,
  };
}
