import "server-only";

import {
  CatalogAuditAction,
  CatalogEntityType,
  CatalogStatus,
  Prisma,
} from "@/generated/prisma/client";
import { normalizeCatalogName } from "@/lib/catalog/normalization";
import {
  assertCatalogVersion,
  assertCategoryCanArchive,
  assertProductCanRestore,
  CatalogPolicyError,
} from "@/lib/catalog/policies";
import type { CatalogActor } from "@/lib/catalog/types";
import type {
  CatalogMutationTarget,
  CategoryInput,
  ProductInput,
  UpdateCategoryInput,
  UpdateProductInput,
} from "@/lib/catalog/validation";
import { prisma } from "@/lib/prisma";

export type CatalogErrorCode =
  | "NOT_FOUND"
  | "CONFLICT"
  | "DUPLICATE"
  | "CATEGORY_ARCHIVED"
  | "CATEGORY_HAS_ACTIVE_PRODUCTS"
  | "ALREADY_ACTIVE"
  | "ALREADY_ARCHIVED";

export class CatalogError extends Error {
  constructor(
    public readonly code: CatalogErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CatalogError";
  }
}

export async function createCategory(input: CategoryInput, actor: CatalogActor) {
  return runCatalogMutation(async (transaction) => {
    const category = await transaction.category.create({
      data: {
        name: input.name,
        normalizedName: normalizeCatalogName(input.name),
        description: input.description,
        displayOrder: input.displayOrder,
      },
    });
    await writeAudit(transaction, {
      entityType: CatalogEntityType.CATEGORY,
      entityId: category.id,
      action: CatalogAuditAction.CREATE,
      actor,
      after: categorySnapshot(category),
    });
    return category;
  });
}

export async function updateCategory(input: UpdateCategoryInput, actor: CatalogActor) {
  return runCatalogMutation(async (transaction) => {
    const current = await findCategory(transaction, input.id);
    assertCatalogVersion(current.updatedAt, input.expectedUpdatedAt);
    const update = await transaction.category.updateMany({
      where: { id: input.id, updatedAt: current.updatedAt },
      data: {
        name: input.name,
        normalizedName: normalizeCatalogName(input.name),
        description: input.description,
        displayOrder: input.displayOrder,
      },
    });
    assertUpdateSucceeded(update.count);
    const category = await findCategory(transaction, input.id);
    const changedFields = getChangedFields(categorySnapshot(current), categorySnapshot(category));
    await writeChangeAudits(transaction, {
      entityType: CatalogEntityType.CATEGORY,
      entityId: category.id,
      actor,
      before: categorySnapshot(current),
      after: categorySnapshot(category),
      changedFields,
    });
    return category;
  });
}

export async function archiveCategory(target: CatalogMutationTarget, actor: CatalogActor) {
  return runCatalogMutation(async (transaction) => {
    const current = await findCategory(transaction, target.id);
    assertCatalogVersion(current.updatedAt, target.expectedUpdatedAt);
    if (current.status === CatalogStatus.ARCHIVED) {
      throw new CatalogError("ALREADY_ARCHIVED", "Kategori sudah diarsipkan.");
    }
    const activeProductCount = await transaction.product.count({
      where: { categoryId: current.id, status: CatalogStatus.ACTIVE },
    });
    assertCategoryCanArchive(activeProductCount);
    const category = await updateCategoryStatus(
      transaction,
      current,
      CatalogStatus.ARCHIVED,
    );
    await writeAudit(transaction, {
      entityType: CatalogEntityType.CATEGORY,
      entityId: category.id,
      action: CatalogAuditAction.ARCHIVE,
      actor,
      before: categorySnapshot(current),
      after: categorySnapshot(category),
    });
    return category;
  });
}

export async function restoreCategory(target: CatalogMutationTarget, actor: CatalogActor) {
  return runCatalogMutation(async (transaction) => {
    const current = await findCategory(transaction, target.id);
    assertCatalogVersion(current.updatedAt, target.expectedUpdatedAt);
    if (current.status === CatalogStatus.ACTIVE) {
      throw new CatalogError("ALREADY_ACTIVE", "Kategori sudah aktif.");
    }
    const category = await updateCategoryStatus(transaction, current, CatalogStatus.ACTIVE);
    await writeAudit(transaction, {
      entityType: CatalogEntityType.CATEGORY,
      entityId: category.id,
      action: CatalogAuditAction.RESTORE,
      actor,
      before: categorySnapshot(current),
      after: categorySnapshot(category),
    });
    return category;
  });
}

export async function createProduct(input: ProductInput, actor: CatalogActor) {
  return runCatalogMutation(async (transaction) => {
    await requireActiveCategory(transaction, input.categoryId);
    const product = await transaction.product.create({
      data: {
        categoryId: input.categoryId,
        name: input.name,
        normalizedName: normalizeCatalogName(input.name),
        sku: input.sku,
        description: input.description,
        basePrice: new Prisma.Decimal(input.basePrice),
        displayOrder: input.displayOrder,
      },
    });
    await writeAudit(transaction, {
      entityType: CatalogEntityType.PRODUCT,
      entityId: product.id,
      action: CatalogAuditAction.CREATE,
      actor,
      after: productSnapshot(product),
    });
    return product;
  });
}

export async function updateProduct(input: UpdateProductInput, actor: CatalogActor) {
  return runCatalogMutation(async (transaction) => {
    const current = await findProduct(transaction, input.id);
    assertCatalogVersion(current.updatedAt, input.expectedUpdatedAt);
    await requireActiveCategory(transaction, input.categoryId);
    const update = await transaction.product.updateMany({
      where: { id: input.id, updatedAt: current.updatedAt },
      data: {
        categoryId: input.categoryId,
        name: input.name,
        normalizedName: normalizeCatalogName(input.name),
        sku: input.sku,
        description: input.description,
        basePrice: new Prisma.Decimal(input.basePrice),
        displayOrder: input.displayOrder,
      },
    });
    assertUpdateSucceeded(update.count);
    const product = await findProduct(transaction, input.id);
    const before = productSnapshot(current);
    const after = productSnapshot(product);
    await writeChangeAudits(transaction, {
      entityType: CatalogEntityType.PRODUCT,
      entityId: product.id,
      actor,
      before,
      after,
      changedFields: getChangedFields(before, after),
    });
    return product;
  });
}

export async function archiveProduct(target: CatalogMutationTarget, actor: CatalogActor) {
  return changeProductStatus(target, actor, CatalogStatus.ARCHIVED);
}

export async function restoreProduct(target: CatalogMutationTarget, actor: CatalogActor) {
  return changeProductStatus(target, actor, CatalogStatus.ACTIVE);
}

async function changeProductStatus(
  target: CatalogMutationTarget,
  actor: CatalogActor,
  status: CatalogStatus,
) {
  return runCatalogMutation(async (transaction) => {
    const current = await findProduct(transaction, target.id);
    assertCatalogVersion(current.updatedAt, target.expectedUpdatedAt);
    if (current.status === status) {
      throw new CatalogError(
        status === CatalogStatus.ACTIVE ? "ALREADY_ACTIVE" : "ALREADY_ARCHIVED",
        status === CatalogStatus.ACTIVE ? "Produk sudah aktif." : "Produk sudah diarsipkan.",
      );
    }
    if (status === CatalogStatus.ACTIVE) {
      const category = await findCategory(transaction, current.categoryId);
      assertProductCanRestore(category.status);
    }
    const update = await transaction.product.updateMany({
      where: { id: current.id, updatedAt: current.updatedAt },
      data: {
        status,
        archivedAt: status === CatalogStatus.ARCHIVED ? new Date() : null,
      },
    });
    assertUpdateSucceeded(update.count);
    const product = await findProduct(transaction, current.id);
    await writeAudit(transaction, {
      entityType: CatalogEntityType.PRODUCT,
      entityId: product.id,
      action:
        status === CatalogStatus.ACTIVE
          ? CatalogAuditAction.RESTORE
          : CatalogAuditAction.ARCHIVE,
      actor,
      before: productSnapshot(current),
      after: productSnapshot(product),
    });
    return product;
  });
}

async function updateCategoryStatus(
  transaction: Prisma.TransactionClient,
  current: Awaited<ReturnType<typeof findCategory>>,
  status: CatalogStatus,
) {
  const update = await transaction.category.updateMany({
    where: { id: current.id, updatedAt: current.updatedAt },
    data: {
      status,
      archivedAt: status === CatalogStatus.ARCHIVED ? new Date() : null,
    },
  });
  assertUpdateSucceeded(update.count);
  return findCategory(transaction, current.id);
}

async function requireActiveCategory(transaction: Prisma.TransactionClient, id: string) {
  const category = await findCategory(transaction, id);
  if (category.status !== CatalogStatus.ACTIVE) {
    throw new CatalogError("CATEGORY_ARCHIVED", "Kategori yang dipilih sedang diarsipkan.");
  }
  return category;
}

async function findCategory(transaction: Prisma.TransactionClient, id: string) {
  const category = await transaction.category.findUnique({ where: { id } });
  if (!category) {
    throw new CatalogError("NOT_FOUND", "Kategori tidak ditemukan.");
  }
  return category;
}

async function findProduct(transaction: Prisma.TransactionClient, id: string) {
  const product = await transaction.product.findUnique({ where: { id } });
  if (!product) {
    throw new CatalogError("NOT_FOUND", "Produk tidak ditemukan.");
  }
  return product;
}

function assertUpdateSucceeded(count: number) {
  if (count !== 1) {
    throw new CatalogError(
      "CONFLICT",
      "Data telah diubah oleh pengguna lain. Muat ulang lalu coba kembali.",
    );
  }
}

async function runCatalogMutation<T>(
  mutation: (transaction: Prisma.TransactionClient) => Promise<T>,
) {
  try {
    return await prisma.$transaction(mutation);
  } catch (error) {
    if (error instanceof CatalogPolicyError) {
      throw new CatalogError(error.code, error.message);
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new CatalogError(
        "DUPLICATE",
        "Nama kategori, nama produk dalam kategori, atau SKU sudah digunakan.",
      );
    }
    throw error;
  }
}

type AuditInput = {
  entityType: CatalogEntityType;
  entityId: string;
  action: CatalogAuditAction;
  actor: CatalogActor;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
};

async function writeAudit(transaction: Prisma.TransactionClient, input: AuditInput) {
  await transaction.catalogAuditLog.create({
    data: {
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      actorUserId: input.actor.id,
      actorEmail: input.actor.email,
      before: input.before,
      after: input.after,
    },
  });
}

async function writeChangeAudits(
  transaction: Prisma.TransactionClient,
  input: Omit<AuditInput, "action"> & { changedFields: string[] },
) {
  const actions: CatalogAuditAction[] = [];
  const ordinaryFields = input.changedFields.filter(
    (field) => field !== "displayOrder" && field !== "basePrice",
  );
  if (ordinaryFields.length > 0) actions.push(CatalogAuditAction.UPDATE);
  if (input.changedFields.includes("basePrice")) actions.push(CatalogAuditAction.PRICE_CHANGE);
  if (input.changedFields.includes("displayOrder")) actions.push(CatalogAuditAction.REORDER);
  if (actions.length === 0) actions.push(CatalogAuditAction.UPDATE);
  await Promise.all(actions.map((action) => writeAudit(transaction, { ...input, action })));
}

function categorySnapshot(category: {
  name: string;
  normalizedName: string;
  description: string | null;
  displayOrder: number;
  status: CatalogStatus;
  archivedAt: Date | null;
}) {
  return {
    name: category.name,
    normalizedName: category.normalizedName,
    description: category.description,
    displayOrder: category.displayOrder,
    status: category.status,
    archivedAt: category.archivedAt?.toISOString() ?? null,
  } satisfies Prisma.InputJsonObject;
}

function productSnapshot(product: {
  categoryId: string;
  name: string;
  normalizedName: string;
  sku: string | null;
  description: string | null;
  basePrice: Prisma.Decimal;
  displayOrder: number;
  status: CatalogStatus;
  archivedAt: Date | null;
}) {
  return {
    categoryId: product.categoryId,
    name: product.name,
    normalizedName: product.normalizedName,
    sku: product.sku,
    description: product.description,
    basePrice: product.basePrice.toFixed(2),
    displayOrder: product.displayOrder,
    status: product.status,
    archivedAt: product.archivedAt?.toISOString() ?? null,
  } satisfies Prisma.InputJsonObject;
}

function getChangedFields(
  before: Record<string, Prisma.JsonValue>,
  after: Record<string, Prisma.JsonValue>,
) {
  return Object.keys(after).filter(
    (key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]),
  );
}
