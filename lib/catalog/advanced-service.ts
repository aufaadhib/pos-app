import "server-only";

import {
  CatalogAuditAction,
  CatalogEntityType,
  CatalogStatus,
  OutletStatus,
  Prisma,
} from "@/generated/prisma/client";
import type {
  CatalogEntityStatusInput,
  ModifierGroupInput,
  ModifierOptionInput,
  OutletProductOverrideInput,
  OutletVariantOverrideInput,
  ProductModifierInput,
  VariantGroupInput,
  VariantOptionInput,
} from "@/lib/catalog/advanced-validation";
import { normalizeCatalogName } from "@/lib/catalog/normalization";
import type { CatalogActor } from "@/lib/catalog/types";
import { prisma } from "@/lib/prisma";

export class AdvancedCatalogError extends Error {
  constructor(
    public readonly code: "NOT_FOUND" | "CONFLICT" | "DUPLICATE" | "FORBIDDEN" | "INVALID_RULE",
    message: string,
  ) {
    super(message);
    this.name = "AdvancedCatalogError";
  }
}

/** Creates or updates one required single-choice variant group and writes its audit atomically. */
export async function saveVariantGroup(input: VariantGroupInput, actor: CatalogActor) {
  return runAdvancedMutation(async (transaction) => {
    await requireProduct(transaction, input.productId);
    if (!input.id) {
      const created = await transaction.productVariantGroup.create({
        data: {
          productId: input.productId,
          name: input.name,
          normalizedName: normalizeCatalogName(input.name),
          displayOrder: input.displayOrder,
        },
      });
      await writeAudit(transaction, CatalogEntityType.VARIANT_GROUP, created.id, CatalogAuditAction.CREATE, actor, null, variantGroupSnapshot(created));
      return created;
    }
    const current = await transaction.productVariantGroup.findUnique({ where: { id: input.id } });
    requireCurrent(current, input.expectedUpdatedAt);
    const updated = await transaction.productVariantGroup.update({
      where: { id: input.id },
      data: { name: input.name, normalizedName: normalizeCatalogName(input.name), displayOrder: input.displayOrder },
    });
    await writeAudit(transaction, CatalogEntityType.VARIANT_GROUP, updated.id, CatalogAuditAction.UPDATE, actor, variantGroupSnapshot(current), variantGroupSnapshot(updated));
    return updated;
  });
}

/** Creates or updates a variant option with a non-negative additive price in one audited transaction. */
export async function saveVariantOption(input: VariantOptionInput, actor: CatalogActor) {
  return runAdvancedMutation(async (transaction) => {
    await requireVariantGroup(transaction, input.variantGroupId);
    const data = {
      name: input.name,
      normalizedName: normalizeCatalogName(input.name),
      priceAdjustment: new Prisma.Decimal(input.priceAdjustment),
      displayOrder: input.displayOrder,
    };
    if (!input.id) {
      const created = await transaction.productVariantOption.create({ data: { variantGroupId: input.variantGroupId, ...data } });
      await writeAudit(transaction, CatalogEntityType.VARIANT_OPTION, created.id, CatalogAuditAction.CREATE, actor, null, pricedOptionSnapshot(created));
      return created;
    }
    const current = await transaction.productVariantOption.findUnique({ where: { id: input.id } });
    requireCurrent(current, input.expectedUpdatedAt);
    const updated = await transaction.productVariantOption.update({ where: { id: input.id }, data });
    const action = current.priceAdjustment.equals(updated.priceAdjustment) ? CatalogAuditAction.UPDATE : CatalogAuditAction.PRICE_CHANGE;
    await writeAudit(transaction, CatalogEntityType.VARIANT_OPTION, updated.id, action, actor, pricedOptionSnapshot(current), pricedOptionSnapshot(updated));
    return updated;
  });
}

/** Creates or updates a reusable modifier group and records the before/after snapshots. */
export async function saveModifierGroup(input: ModifierGroupInput, actor: CatalogActor) {
  return runAdvancedMutation(async (transaction) => {
    const data = { name: input.name, normalizedName: normalizeCatalogName(input.name), description: input.description };
    if (!input.id) {
      const created = await transaction.modifierGroup.create({ data });
      await writeAudit(transaction, CatalogEntityType.MODIFIER_GROUP, created.id, CatalogAuditAction.CREATE, actor, null, modifierGroupSnapshot(created));
      return created;
    }
    const current = await transaction.modifierGroup.findUnique({ where: { id: input.id } });
    requireCurrent(current, input.expectedUpdatedAt);
    const updated = await transaction.modifierGroup.update({ where: { id: input.id }, data });
    await writeAudit(transaction, CatalogEntityType.MODIFIER_GROUP, updated.id, CatalogAuditAction.UPDATE, actor, modifierGroupSnapshot(current), modifierGroupSnapshot(updated));
    return updated;
  });
}

/** Creates or updates one reusable modifier option and audits price changes separately. */
export async function saveModifierOption(input: ModifierOptionInput, actor: CatalogActor) {
  return runAdvancedMutation(async (transaction) => {
    await requireModifierGroup(transaction, input.modifierGroupId);
    const data = {
      name: input.name,
      normalizedName: normalizeCatalogName(input.name),
      priceAdjustment: new Prisma.Decimal(input.priceAdjustment),
      displayOrder: input.displayOrder,
    };
    if (!input.id) {
      const created = await transaction.modifierOption.create({ data: { modifierGroupId: input.modifierGroupId, ...data } });
      await writeAudit(transaction, CatalogEntityType.MODIFIER_OPTION, created.id, CatalogAuditAction.CREATE, actor, null, pricedOptionSnapshot(created));
      return created;
    }
    const current = await transaction.modifierOption.findUnique({ where: { id: input.id } });
    requireCurrent(current, input.expectedUpdatedAt);
    const updated = await transaction.modifierOption.update({ where: { id: input.id }, data });
    const action = current.priceAdjustment.equals(updated.priceAdjustment) ? CatalogAuditAction.UPDATE : CatalogAuditAction.PRICE_CHANGE;
    await writeAudit(transaction, CatalogEntityType.MODIFIER_OPTION, updated.id, action, actor, pricedOptionSnapshot(current), pricedOptionSnapshot(updated));
    return updated;
  });
}

/** Attaches or updates a reusable modifier group on a product with validated selection limits. */
export async function saveProductModifier(input: ProductModifierInput, actor: CatalogActor) {
  return runAdvancedMutation(async (transaction) => {
    await Promise.all([requireProduct(transaction, input.productId), requireModifierGroup(transaction, input.modifierGroupId)]);
    const activeOptionCount = await transaction.modifierOption.count({
      where: { modifierGroupId: input.modifierGroupId, status: CatalogStatus.ACTIVE },
    });
    if (input.maxSelections > activeOptionCount) {
      throw new AdvancedCatalogError("INVALID_RULE", `Maksimum pilihan tidak boleh melebihi ${activeOptionCount} opsi aktif.`);
    }
    const key = { productId_modifierGroupId: { productId: input.productId, modifierGroupId: input.modifierGroupId } };
    const current = await transaction.productModifierGroup.findUnique({ where: key });
    if (current) requireCurrent(current, input.expectedUpdatedAt);
    const data = {
      minSelections: input.minSelections,
      maxSelections: input.maxSelections,
      displayOrder: input.displayOrder,
      status: CatalogStatus.ACTIVE,
      archivedAt: null,
    };
    const saved = current
      ? await transaction.productModifierGroup.update({ where: key, data })
      : await transaction.productModifierGroup.create({ data: { productId: input.productId, modifierGroupId: input.modifierGroupId, ...data } });
    await writeAudit(
      transaction,
      CatalogEntityType.PRODUCT_MODIFIER,
      `${input.productId}:${input.modifierGroupId}`,
      current ? CatalogAuditAction.UPDATE : CatalogAuditAction.ASSIGN,
      actor,
      current ? productModifierSnapshot(current) : null,
      productModifierSnapshot(saved),
    );
    return saved;
  });
}

/** Archives or restores an advanced catalog entity after re-reading and validating its current version. */
export async function changeAdvancedCatalogStatus(input: CatalogEntityStatusInput, actor: CatalogActor) {
  return runAdvancedMutation(async (transaction) => {
    const nextStatus = input.status as CatalogStatus;
    if (input.entityType === "PRODUCT_MODIFIER") {
      if (!input.parentId) throw new AdvancedCatalogError("NOT_FOUND", "Relasi modifier tidak ditemukan.");
      const key = { productId_modifierGroupId: { productId: input.parentId, modifierGroupId: input.id } };
      const current = await transaction.productModifierGroup.findUnique({ where: key });
      requireCurrent(current, input.expectedUpdatedAt);
      const updated = await transaction.productModifierGroup.update({ where: key, data: statusData(nextStatus) });
      await writeAudit(transaction, CatalogEntityType.PRODUCT_MODIFIER, `${input.parentId}:${input.id}`, statusAuditAction(nextStatus), actor, productModifierSnapshot(current), productModifierSnapshot(updated));
      return updated;
    }

    if (input.entityType === "VARIANT_GROUP") {
      const current = await transaction.productVariantGroup.findUnique({ where: { id: input.id } });
      requireCurrent(current, input.expectedUpdatedAt);
      const updated = await transaction.productVariantGroup.update({ where: { id: input.id }, data: statusData(nextStatus) });
      await writeAudit(transaction, CatalogEntityType.VARIANT_GROUP, input.id, statusAuditAction(nextStatus), actor, variantGroupSnapshot(current), variantGroupSnapshot(updated));
      return updated;
    }

    if (input.entityType === "VARIANT_OPTION") {
      const current = await transaction.productVariantOption.findUnique({ where: { id: input.id } });
      requireCurrent(current, input.expectedUpdatedAt);
      if (nextStatus === CatalogStatus.ARCHIVED) {
        const remaining = await transaction.productVariantOption.count({ where: { variantGroupId: current.variantGroupId, status: CatalogStatus.ACTIVE, id: { not: current.id } } });
        if (remaining === 0) throw new AdvancedCatalogError("INVALID_RULE", "Grup varian harus memiliki minimal satu opsi aktif.");
      }
      const updated = await transaction.productVariantOption.update({ where: { id: input.id }, data: statusData(nextStatus) });
      await writeAudit(transaction, CatalogEntityType.VARIANT_OPTION, input.id, statusAuditAction(nextStatus), actor, pricedOptionSnapshot(current), pricedOptionSnapshot(updated));
      return updated;
    }

    if (input.entityType === "MODIFIER_GROUP") {
      const current = await transaction.modifierGroup.findUnique({ where: { id: input.id } });
      requireCurrent(current, input.expectedUpdatedAt);
      const updated = await transaction.modifierGroup.update({ where: { id: input.id }, data: statusData(nextStatus) });
      await writeAudit(transaction, CatalogEntityType.MODIFIER_GROUP, input.id, statusAuditAction(nextStatus), actor, modifierGroupSnapshot(current), modifierGroupSnapshot(updated));
      return updated;
    }

    const current = await transaction.modifierOption.findUnique({ where: { id: input.id } });
    requireCurrent(current, input.expectedUpdatedAt);
    if (nextStatus === CatalogStatus.ARCHIVED) {
      const remaining = await transaction.modifierOption.count({ where: { modifierGroupId: current.modifierGroupId, status: CatalogStatus.ACTIVE, id: { not: current.id } } });
      const required = await transaction.productModifierGroup.findFirst({
        where: { modifierGroupId: current.modifierGroupId, status: CatalogStatus.ACTIVE, minSelections: { gt: remaining } },
      });
      if (required) throw new AdvancedCatalogError("INVALID_RULE", "Opsi masih dibutuhkan oleh aturan minimum produk.");
    }
    const updated = await transaction.modifierOption.update({ where: { id: input.id }, data: statusData(nextStatus) });
    await writeAudit(transaction, CatalogEntityType.MODIFIER_OPTION, input.id, statusAuditAction(nextStatus), actor, pricedOptionSnapshot(current), pricedOptionSnapshot(updated));
    return updated;
  });
}

/** Saves or clears a product's outlet-specific availability and base-price override after scope validation. */
export async function saveOutletProductOverride(input: OutletProductOverrideInput, actor: CatalogActor) {
  return runAdvancedMutation(async (transaction) => {
    await assertOutletAccess(transaction, input.outletId, actor);
    const product = await requireProduct(transaction, input.productId);
    const key = { outletId_productId: { outletId: input.outletId, productId: input.productId } };
    const current = await transaction.outletProductOverride.findUnique({ where: key });
    if (current) requireCurrent(current, input.expectedUpdatedAt);
    if (input.isAvailable && input.priceOverride === null) {
      if (!current) return product;
      if (current) await transaction.outletProductOverride.delete({ where: key });
      await writeAudit(transaction, CatalogEntityType.OUTLET_PRODUCT, `${input.outletId}:${input.productId}`, CatalogAuditAction.UNASSIGN, actor, current ? outletProductSnapshot(current) : null, null);
      return product;
    }
    const saved = await transaction.outletProductOverride.upsert({
      where: key,
      create: { outletId: input.outletId, productId: input.productId, isAvailable: input.isAvailable, priceOverride: input.priceOverride === null ? null : new Prisma.Decimal(input.priceOverride) },
      update: { isAvailable: input.isAvailable, priceOverride: input.priceOverride === null ? null : new Prisma.Decimal(input.priceOverride) },
    });
    const action = current?.isAvailable !== saved.isAvailable ? CatalogAuditAction.AVAILABILITY_CHANGE : CatalogAuditAction.PRICE_CHANGE;
    await writeAudit(transaction, CatalogEntityType.OUTLET_PRODUCT, `${input.outletId}:${input.productId}`, action, actor, current ? outletProductSnapshot(current) : null, outletProductSnapshot(saved));
    return saved;
  });
}

/** Saves or clears one outlet-specific variant option override after validating assignment scope. */
export async function saveOutletVariantOverride(input: OutletVariantOverrideInput, actor: CatalogActor) {
  return runAdvancedMutation(async (transaction) => {
    await assertOutletAccess(transaction, input.outletId, actor);
    await transaction.productVariantOption.findUniqueOrThrow({ where: { id: input.variantOptionId } });
    const key = { outletId_variantOptionId: { outletId: input.outletId, variantOptionId: input.variantOptionId } };
    const current = await transaction.outletVariantOptionOverride.findUnique({ where: key });
    if (current) requireCurrent(current, input.expectedUpdatedAt);
    if (input.isAvailable && input.priceAdjustmentOverride === null) {
      if (!current) return null;
      if (current) await transaction.outletVariantOptionOverride.delete({ where: key });
      await writeAudit(transaction, CatalogEntityType.OUTLET_VARIANT_OPTION, `${input.outletId}:${input.variantOptionId}`, CatalogAuditAction.UNASSIGN, actor, current ? outletVariantSnapshot(current) : null, null);
      return null;
    }
    const saved = await transaction.outletVariantOptionOverride.upsert({
      where: key,
      create: { outletId: input.outletId, variantOptionId: input.variantOptionId, isAvailable: input.isAvailable, priceAdjustmentOverride: input.priceAdjustmentOverride === null ? null : new Prisma.Decimal(input.priceAdjustmentOverride) },
      update: { isAvailable: input.isAvailable, priceAdjustmentOverride: input.priceAdjustmentOverride === null ? null : new Prisma.Decimal(input.priceAdjustmentOverride) },
    });
    const action = current?.isAvailable !== saved.isAvailable ? CatalogAuditAction.AVAILABILITY_CHANGE : CatalogAuditAction.PRICE_CHANGE;
    await writeAudit(transaction, CatalogEntityType.OUTLET_VARIANT_OPTION, `${input.outletId}:${input.variantOptionId}`, action, actor, current ? outletVariantSnapshot(current) : null, outletVariantSnapshot(saved));
    return saved;
  });
}

async function assertOutletAccess(transaction: Prisma.TransactionClient, outletId: string, actor: CatalogActor) {
  if (!actor.role) throw new AdvancedCatalogError("FORBIDDEN", "Peran akun tidak valid.");
  const outlet = await transaction.outlet.findFirst({
    where: {
      id: outletId,
      status: OutletStatus.ACTIVE,
      ...(actor.role === "owner" ? {} : { assignments: { some: { userId: actor.id } } }),
    },
    select: { id: true },
  });
  if (!outlet || (actor.role !== "owner" && actor.role !== "manager")) throw new AdvancedCatalogError("FORBIDDEN", "Anda tidak dapat mengubah katalog outlet ini.");
}

async function requireProduct(transaction: Prisma.TransactionClient, id: string) {
  const product = await transaction.product.findUnique({ where: { id } });
  if (!product) throw new AdvancedCatalogError("NOT_FOUND", "Produk tidak ditemukan.");
  return product;
}

async function requireVariantGroup(transaction: Prisma.TransactionClient, id: string) {
  const group = await transaction.productVariantGroup.findUnique({ where: { id } });
  if (!group) throw new AdvancedCatalogError("NOT_FOUND", "Grup varian tidak ditemukan.");
  return group;
}

async function requireModifierGroup(transaction: Prisma.TransactionClient, id: string) {
  const group = await transaction.modifierGroup.findUnique({ where: { id } });
  if (!group) throw new AdvancedCatalogError("NOT_FOUND", "Grup modifier tidak ditemukan.");
  return group;
}

function requireCurrent<T extends { updatedAt: Date }>(current: T | null, expectedUpdatedAt?: string): asserts current is T {
  if (!current) throw new AdvancedCatalogError("NOT_FOUND", "Data katalog tidak ditemukan.");
  if (!expectedUpdatedAt || current.updatedAt.toISOString() !== expectedUpdatedAt) {
    throw new AdvancedCatalogError("CONFLICT", "Data telah diubah pengguna lain. Muat ulang lalu coba kembali.");
  }
}

function statusData(status: CatalogStatus) {
  return { status, archivedAt: status === CatalogStatus.ARCHIVED ? new Date() : null };
}

function statusAuditAction(status: CatalogStatus) {
  return status === CatalogStatus.ACTIVE ? CatalogAuditAction.RESTORE : CatalogAuditAction.ARCHIVE;
}

async function runAdvancedMutation<T>(callback: (transaction: Prisma.TransactionClient) => Promise<T>) {
  try {
    return await prisma.$transaction(callback);
  } catch (error) {
    if (error instanceof AdvancedCatalogError) throw error;
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AdvancedCatalogError("DUPLICATE", "Nama grup atau opsi sudah digunakan.");
    }
    throw error;
  }
}

async function writeAudit(
  transaction: Prisma.TransactionClient,
  entityType: CatalogEntityType,
  entityId: string,
  action: CatalogAuditAction,
  actor: CatalogActor,
  before: Prisma.InputJsonValue | null,
  after: Prisma.InputJsonValue | null,
) {
  await transaction.catalogAuditLog.create({
    data: {
      entityType,
      entityId,
      action,
      actorUserId: actor.id,
      actorEmail: actor.email,
      before: before ?? Prisma.DbNull,
      after: after ?? Prisma.DbNull,
    },
  });
}

function variantGroupSnapshot(value: { productId: string; name: string; displayOrder: number; status: CatalogStatus; archivedAt: Date | null }) {
  return { productId: value.productId, name: value.name, displayOrder: value.displayOrder, status: value.status, archivedAt: value.archivedAt?.toISOString() ?? null } satisfies Prisma.InputJsonObject;
}

function pricedOptionSnapshot(value: { name: string; priceAdjustment: Prisma.Decimal; displayOrder: number; status: CatalogStatus; archivedAt: Date | null }) {
  return { name: value.name, priceAdjustment: value.priceAdjustment.toFixed(2), displayOrder: value.displayOrder, status: value.status, archivedAt: value.archivedAt?.toISOString() ?? null } satisfies Prisma.InputJsonObject;
}

function modifierGroupSnapshot(value: { name: string; description: string | null; status: CatalogStatus; archivedAt: Date | null }) {
  return { name: value.name, description: value.description, status: value.status, archivedAt: value.archivedAt?.toISOString() ?? null } satisfies Prisma.InputJsonObject;
}

function productModifierSnapshot(value: { productId: string; modifierGroupId: string; minSelections: number; maxSelections: number; displayOrder: number; status: CatalogStatus; archivedAt: Date | null }) {
  return { productId: value.productId, modifierGroupId: value.modifierGroupId, minSelections: value.minSelections, maxSelections: value.maxSelections, displayOrder: value.displayOrder, status: value.status, archivedAt: value.archivedAt?.toISOString() ?? null } satisfies Prisma.InputJsonObject;
}

function outletProductSnapshot(value: { outletId: string; productId: string; isAvailable: boolean; priceOverride: Prisma.Decimal | null }) {
  return { outletId: value.outletId, productId: value.productId, isAvailable: value.isAvailable, priceOverride: value.priceOverride?.toFixed(2) ?? null } satisfies Prisma.InputJsonObject;
}

function outletVariantSnapshot(value: { outletId: string; variantOptionId: string; isAvailable: boolean; priceAdjustmentOverride: Prisma.Decimal | null }) {
  return { outletId: value.outletId, variantOptionId: value.variantOptionId, isAvailable: value.isAvailable, priceAdjustmentOverride: value.priceAdjustmentOverride?.toFixed(2) ?? null } satisfies Prisma.InputJsonObject;
}
