import "server-only";

import {
  AdminAuditAction,
  AdminAuditEntityType,
  OutletStatus,
  Prisma,
} from "@/generated/prisma/client";
import { normalizeOutletName } from "@/lib/outlets/normalization";
import type { AdminActor } from "@/lib/outlets/types";
import type {
  OutletInput,
  OutletMutationTarget,
  UpdateOutletInput,
} from "@/lib/outlets/validation";
import { prisma } from "@/lib/prisma";

export type OutletErrorCode = "NOT_FOUND" | "CONFLICT" | "DUPLICATE" | "INVALID_STATUS" | "FORBIDDEN";

export class OutletError extends Error {
  constructor(public readonly code: OutletErrorCode, message: string) {
    super(message);
    this.name = "OutletError";
  }
}

export async function createOutlet(input: OutletInput, actor: AdminActor) {
  assertOwner(actor);
  return runOutletMutation(async (transaction) => {
    const outlet = await transaction.outlet.create({
      data: {
        ...input,
        normalizedName: normalizeOutletName(input.name),
      },
    });
    await writeAdminAudit(transaction, {
      entityType: AdminAuditEntityType.OUTLET,
      entityId: outlet.id,
      action: AdminAuditAction.CREATE,
      actor,
      after: outletSnapshot(outlet),
    });
    return outlet;
  });
}

export async function updateOutlet(input: UpdateOutletInput, actor: AdminActor) {
  assertOwner(actor);
  return runOutletMutation(async (transaction) => {
    const current = await findOutlet(transaction, input.id);
    assertVersion(current.updatedAt, input.expectedUpdatedAt);
    const update = await transaction.outlet.updateMany({
      where: { id: input.id, updatedAt: current.updatedAt },
      data: {
        name: input.name,
        normalizedName: normalizeOutletName(input.name),
        code: input.code,
        timezone: input.timezone,
        addressLine: input.addressLine,
        provinceCode: input.provinceCode,
        provinceName: input.provinceName,
        cityCode: input.cityCode,
        cityName: input.cityName,
        taxRate: input.taxRate,
        serviceChargeRate: input.serviceChargeRate,
        pricesIncludeTax: input.pricesIncludeTax,
      },
    });
    assertUpdateSucceeded(update.count);
    const outlet = await findOutlet(transaction, input.id);
    await writeAdminAudit(transaction, {
      entityType: AdminAuditEntityType.OUTLET,
      entityId: outlet.id,
      action: AdminAuditAction.UPDATE,
      actor,
      before: outletSnapshot(current),
      after: outletSnapshot(outlet),
    });
    return outlet;
  });
}

export async function archiveOutlet(target: OutletMutationTarget, actor: AdminActor) {
  return changeOutletStatus(target, actor, OutletStatus.ARCHIVED);
}

export async function restoreOutlet(target: OutletMutationTarget, actor: AdminActor) {
  return changeOutletStatus(target, actor, OutletStatus.ACTIVE);
}

async function changeOutletStatus(
  target: OutletMutationTarget,
  actor: AdminActor,
  status: OutletStatus,
) {
  assertOwner(actor);
  return runOutletMutation(async (transaction) => {
    const current = await findOutlet(transaction, target.id);
    assertVersion(current.updatedAt, target.expectedUpdatedAt);
    if (current.status === status) {
      throw new OutletError("INVALID_STATUS", status === OutletStatus.ACTIVE ? "Outlet sudah aktif." : "Outlet sudah diarsipkan.");
    }
    const update = await transaction.outlet.updateMany({
      where: { id: current.id, updatedAt: current.updatedAt },
      data: {
        status,
        archivedAt: status === OutletStatus.ARCHIVED ? new Date() : null,
      },
    });
    assertUpdateSucceeded(update.count);
    if (status === OutletStatus.ARCHIVED) {
      await transaction.session.updateMany({
        where: { activeOutletId: current.id },
        data: { activeOutletId: null },
      });
    }
    const outlet = await findOutlet(transaction, current.id);
    await writeAdminAudit(transaction, {
      entityType: AdminAuditEntityType.OUTLET,
      entityId: outlet.id,
      action: status === OutletStatus.ACTIVE ? AdminAuditAction.RESTORE : AdminAuditAction.ARCHIVE,
      actor,
      before: outletSnapshot(current),
      after: outletSnapshot(outlet),
    });
    return outlet;
  });
}

export async function selectActiveOutlet(
  outletId: string,
  session: { id: string; userId: string },
  actor: AdminActor,
) {
  return runOutletMutation(async (transaction) => {
    const outlet = await transaction.outlet.findFirst({
      where: {
        id: outletId,
        status: OutletStatus.ACTIVE,
        ...(actor.role === "owner" ? {} : { assignments: { some: { userId: actor.id } } }),
      },
    });
    if (!outlet) throw new OutletError("FORBIDDEN", "Outlet tidak tersedia untuk akun Anda.");
    await transaction.session.update({
      where: { id: session.id, userId: session.userId },
      data: { activeOutletId: outlet.id },
    });
    await writeAdminAudit(transaction, {
      entityType: AdminAuditEntityType.SESSION,
      entityId: session.id,
      action: AdminAuditAction.ACTIVE_OUTLET_CHANGE,
      actor,
      after: { activeOutletId: outlet.id, outletCode: outlet.code },
    });
    return outlet;
  });
}

async function findOutlet(transaction: Prisma.TransactionClient, id: string) {
  const outlet = await transaction.outlet.findUnique({ where: { id } });
  if (!outlet) throw new OutletError("NOT_FOUND", "Outlet tidak ditemukan.");
  return outlet;
}

function assertOwner(actor: AdminActor) {
  if (actor.role !== "owner") throw new OutletError("FORBIDDEN", "Hanya pemilik yang dapat mengelola outlet.");
}

function assertVersion(actual: Date, expected: string) {
  if (actual.getTime() !== new Date(expected).getTime()) {
    throw new OutletError("CONFLICT", "Outlet telah diubah oleh pengguna lain. Muat ulang lalu coba kembali.");
  }
}

function assertUpdateSucceeded(count: number) {
  if (count !== 1) throw new OutletError("CONFLICT", "Outlet telah berubah. Muat ulang lalu coba kembali.");
}

async function runOutletMutation<T>(mutation: (transaction: Prisma.TransactionClient) => Promise<T>) {
  try {
    return await prisma.$transaction(mutation);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new OutletError("DUPLICATE", "Nama atau kode outlet sudah digunakan.");
    }
    throw error;
  }
}

type AuditInput = {
  entityType: AdminAuditEntityType;
  entityId: string;
  action: AdminAuditAction;
  actor: AdminActor;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
};

export async function writeAdminAudit(transaction: Prisma.TransactionClient, input: AuditInput) {
  await transaction.adminAuditLog.create({
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

function outletSnapshot(outlet: {
  code: string;
  name: string;
  timezone: string;
  addressLine: string | null;
  provinceCode: string;
  provinceName: string;
  cityCode: string;
  cityName: string;
  taxRate: Prisma.Decimal;
  serviceChargeRate: Prisma.Decimal;
  pricesIncludeTax: boolean;
  status: OutletStatus;
  archivedAt: Date | null;
}) {
  return {
    code: outlet.code,
    name: outlet.name,
    timezone: outlet.timezone,
    addressLine: outlet.addressLine,
    provinceCode: outlet.provinceCode,
    provinceName: outlet.provinceName,
    cityCode: outlet.cityCode,
    cityName: outlet.cityName,
    taxRate: outlet.taxRate.toFixed(2),
    serviceChargeRate: outlet.serviceChargeRate.toFixed(2),
    pricesIncludeTax: outlet.pricesIncludeTax,
    status: outlet.status,
    archivedAt: outlet.archivedAt?.toISOString() ?? null,
  } satisfies Prisma.InputJsonObject;
}
