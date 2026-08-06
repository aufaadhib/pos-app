import "server-only";

import { CatalogStatus, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  CatalogCategoryItem,
  CatalogProductItem,
  CatalogProductPage,
} from "@/lib/catalog/types";
import type { CatalogSearch } from "@/lib/catalog/validation";

const catalogPageSize = 20;

export async function getCatalogCategories(includeArchived: boolean) {
  const [categories, activeCounts] = await Promise.all([
    prisma.category.findMany({
      where: includeArchived ? undefined : { status: CatalogStatus.ACTIVE },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        description: true,
        displayOrder: true,
        status: true,
        updatedAt: true,
        _count: { select: { products: true } },
      },
    }),
    prisma.product.groupBy({
      by: ["categoryId"],
      where: { status: CatalogStatus.ACTIVE },
      _count: { _all: true },
    }),
  ]);
  const activeCountByCategory = new Map(
    activeCounts.map((entry) => [entry.categoryId, entry._count._all]),
  );

  return categories.map<CatalogCategoryItem>((category) => ({
    id: category.id,
    name: category.name,
    description: category.description,
    displayOrder: category.displayOrder,
    status: category.status,
    updatedAt: category.updatedAt.toISOString(),
    activeProductCount: activeCountByCategory.get(category.id) ?? 0,
    totalProductCount: category._count.products,
  }));
}

export async function getCatalogProducts(
  search: CatalogSearch,
  includeArchived: boolean,
): Promise<CatalogProductPage> {
  const requestedStatus = includeArchived ? search.status : "active";
  const where: Prisma.ProductWhereInput = {
    ...(search.category ? { categoryId: search.category } : {}),
    ...(requestedStatus === "all"
      ? {}
      : {
          status:
            requestedStatus === "archived"
              ? CatalogStatus.ARCHIVED
              : CatalogStatus.ACTIVE,
        }),
    ...(search.q
      ? {
          OR: [
            { name: { contains: search.q, mode: "insensitive" } },
            { sku: { contains: search.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const totalItems = await prisma.product.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalItems / catalogPageSize));
  const page = Math.min(search.page, totalPages);
  const products = await prisma.product.findMany({
    where,
    orderBy: [
      { category: { displayOrder: "asc" } },
      { displayOrder: "asc" },
      { name: "asc" },
    ],
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
    },
  });

  return {
    items: products.map(serializeCatalogProduct),
    page,
    pageSize: catalogPageSize,
    totalItems,
    totalPages,
  };
}

export async function getCatalogProduct(id: string) {
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
    },
  });

  return product ? serializeCatalogProduct(product) : null;
}

function serializeCatalogProduct(product: {
  id: string;
  categoryId: string;
  name: string;
  sku: string | null;
  description: string | null;
  basePrice: Prisma.Decimal;
  displayOrder: number;
  status: "ACTIVE" | "ARCHIVED";
  updatedAt: Date;
  category: { name: string; status: "ACTIVE" | "ARCHIVED" };
}): CatalogProductItem {
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
  };
}
