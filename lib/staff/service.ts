import "server-only";

import { randomUUID } from "node:crypto";
import { hashPassword, verifyPassword } from "better-auth/crypto";

import {
  AdminAuditAction,
  AdminAuditEntityType,
  OutletStatus,
  Prisma,
} from "@/generated/prisma/client";
import { writeAdminAudit } from "@/lib/outlets/service";
import type { AdminActor } from "@/lib/outlets/types";
import { prisma } from "@/lib/prisma";
import {
  assertOutletAssignmentCount,
  assertStaffRoleAllowed,
  StaffPolicyError,
} from "@/lib/staff/policies";
import { generateTemporaryPassword } from "@/lib/staff/password";
import type {
  ChangePasswordInput,
  CreateStaffInput,
  StaffMutationTarget,
  UpdateStaffInput,
} from "@/lib/staff/validation";

export type StaffErrorCode = "NOT_FOUND" | "CONFLICT" | "DUPLICATE" | "FORBIDDEN" | "INVALID_PASSWORD";

export class StaffError extends Error {
  constructor(public readonly code: StaffErrorCode, message: string) {
    super(message);
    this.name = "StaffError";
  }
}

export async function createStaff(input: CreateStaffInput, actor: AdminActor) {
  assertStaffRoleAllowed(actor.role, input.role);
  assertOutletAssignmentCount(input.role, input.outletIds);
  const password = generateTemporaryPassword();
  const passwordHash = await hashPassword(password);

  const user = await runStaffMutation(async (transaction) => {
    await assertManageableOutlets(transaction, actor, input.outletIds);
    const userId = randomUUID();
    const created = await transaction.user.create({
      data: {
        id: userId,
        name: input.name,
        email: input.email,
        role: input.role,
        mustChangePassword: true,
        accounts: {
          create: {
            id: randomUUID(),
            accountId: userId,
            providerId: "credential",
            password: passwordHash,
          },
        },
        outletAssignments: {
          create: input.outletIds.map((outletId) => ({
            outletId,
            assignedByUserId: actor.id,
          })),
        },
      },
    });
    await writeAdminAudit(transaction, {
      entityType: AdminAuditEntityType.STAFF,
      entityId: created.id,
      action: AdminAuditAction.CREATE,
      actor,
      after: staffSnapshot({ ...created, outletIds: input.outletIds }),
    });
    await Promise.all(input.outletIds.map((outletId) => writeAdminAudit(transaction, {
      entityType: AdminAuditEntityType.STAFF_ASSIGNMENT,
      entityId: `${created.id}:${outletId}`,
      action: AdminAuditAction.ASSIGN,
      actor,
      after: { userId: created.id, outletId },
    })));
    return created;
  });

  return { user, password };
}

export async function updateStaff(input: UpdateStaffInput, actor: AdminActor) {
  assertStaffRoleAllowed(actor.role, input.role);
  assertOutletAssignmentCount(input.role, input.outletIds);

  return runStaffMutation(async (transaction) => {
    const current = await findManageableStaff(transaction, input.id, actor);
    assertVersion(current.updatedAt, input.expectedUpdatedAt);
    await assertManageableOutlets(transaction, actor, input.outletIds);
    const previousOutletIds = current.outletAssignments.map((assignment) => assignment.outletId);
    const addedOutletIds = input.outletIds.filter((id) => !previousOutletIds.includes(id));
    const removedOutletIds = previousOutletIds.filter((id) => !input.outletIds.includes(id));

    const update = await transaction.user.updateMany({
      where: { id: current.id, updatedAt: current.updatedAt },
      data: { name: input.name, role: input.role },
    });
    assertUpdateSucceeded(update.count);
    if (removedOutletIds.length > 0) {
      await transaction.userOutletAssignment.deleteMany({
        where: { userId: current.id, outletId: { in: removedOutletIds } },
      });
    }
    if (addedOutletIds.length > 0) {
      await transaction.userOutletAssignment.createMany({
        data: addedOutletIds.map((outletId) => ({
          userId: current.id,
          outletId,
          assignedByUserId: actor.id,
        })),
      });
    }
    await transaction.session.updateMany({
      where: {
        userId: current.id,
        activeOutletId: { notIn: input.outletIds },
      },
      data: { activeOutletId: null },
    });
    const updated = await transaction.user.findUniqueOrThrow({ where: { id: current.id } });
    await writeAdminAudit(transaction, {
      entityType: AdminAuditEntityType.STAFF,
      entityId: updated.id,
      action: AdminAuditAction.UPDATE,
      actor,
      before: staffSnapshot({ ...current, outletIds: previousOutletIds }),
      after: staffSnapshot({ ...updated, outletIds: input.outletIds }),
    });
    await Promise.all([
      ...addedOutletIds.map((outletId) => writeAdminAudit(transaction, {
        entityType: AdminAuditEntityType.STAFF_ASSIGNMENT,
        entityId: `${updated.id}:${outletId}`,
        action: AdminAuditAction.ASSIGN,
        actor,
        after: { userId: updated.id, outletId },
      })),
      ...removedOutletIds.map((outletId) => writeAdminAudit(transaction, {
        entityType: AdminAuditEntityType.STAFF_ASSIGNMENT,
        entityId: `${updated.id}:${outletId}`,
        action: AdminAuditAction.UNASSIGN,
        actor,
        before: { userId: updated.id, outletId },
      })),
    ]);
    return updated;
  });
}

export async function deactivateStaff(target: StaffMutationTarget, actor: AdminActor) {
  return changeStaffStatus(target, actor, true);
}

export async function reactivateStaff(target: StaffMutationTarget, actor: AdminActor) {
  return changeStaffStatus(target, actor, false);
}

export async function resetStaffPassword(target: StaffMutationTarget, actor: AdminActor) {
  const password = generateTemporaryPassword();
  const passwordHash = await hashPassword(password);
  const user = await runStaffMutation(async (transaction) => {
    const current = await findManageableStaff(transaction, target.id, actor);
    assertVersion(current.updatedAt, target.expectedUpdatedAt);
    const account = await transaction.account.findFirst({
      where: { userId: current.id, providerId: "credential" },
    });
    if (account) {
      await transaction.account.update({ where: { id: account.id }, data: { password: passwordHash } });
    } else {
      await transaction.account.create({
        data: {
          id: randomUUID(),
          accountId: current.id,
          providerId: "credential",
          userId: current.id,
          password: passwordHash,
        },
      });
    }
    const updated = await transaction.user.update({
      where: { id: current.id },
      data: { mustChangePassword: true },
    });
    await transaction.session.deleteMany({ where: { userId: current.id } });
    await writeAdminAudit(transaction, {
      entityType: AdminAuditEntityType.STAFF,
      entityId: current.id,
      action: AdminAuditAction.PASSWORD_RESET,
      actor,
      before: { mustChangePassword: current.mustChangePassword },
      after: { mustChangePassword: true },
    });
    return updated;
  });
  return { user, password };
}

export async function changeOwnPassword(
  input: ChangePasswordInput,
  session: { id: string },
  actor: AdminActor,
) {
  const account = await prisma.account.findFirst({
    where: { userId: actor.id, providerId: "credential" },
    select: { id: true, password: true },
  });
  if (!account?.password || !(await verifyPassword({ hash: account.password, password: input.currentPassword }))) {
    throw new StaffError("INVALID_PASSWORD", "Kata sandi saat ini tidak sesuai.");
  }
  const passwordHash = await hashPassword(input.newPassword);

  return runStaffMutation(async (transaction) => {
    await transaction.account.update({ where: { id: account.id }, data: { password: passwordHash } });
    await transaction.user.update({ where: { id: actor.id }, data: { mustChangePassword: false } });
    await transaction.session.deleteMany({ where: { userId: actor.id, id: { not: session.id } } });
    await writeAdminAudit(transaction, {
      entityType: AdminAuditEntityType.STAFF,
      entityId: actor.id,
      action: AdminAuditAction.PASSWORD_CHANGE,
      actor,
      before: { mustChangePassword: true },
      after: { mustChangePassword: false },
    });
  });
}

async function changeStaffStatus(target: StaffMutationTarget, actor: AdminActor, banned: boolean) {
  return runStaffMutation(async (transaction) => {
    const current = await findManageableStaff(transaction, target.id, actor);
    assertVersion(current.updatedAt, target.expectedUpdatedAt);
    if (Boolean(current.banned) === banned) {
      throw new StaffError("CONFLICT", banned ? "Staf sudah dinonaktifkan." : "Staf sudah aktif.");
    }
    const update = await transaction.user.updateMany({
      where: { id: current.id, updatedAt: current.updatedAt },
      data: {
        banned,
        banReason: banned ? "Dinonaktifkan oleh pengelola Glutong POS" : null,
        banExpires: null,
      },
    });
    assertUpdateSucceeded(update.count);
    if (banned) await transaction.session.deleteMany({ where: { userId: current.id } });
    const updated = await transaction.user.findUniqueOrThrow({ where: { id: current.id } });
    await writeAdminAudit(transaction, {
      entityType: AdminAuditEntityType.STAFF,
      entityId: current.id,
      action: banned ? AdminAuditAction.DEACTIVATE : AdminAuditAction.REACTIVATE,
      actor,
      before: { banned: Boolean(current.banned) },
      after: { banned },
    });
    return updated;
  });
}

async function findManageableStaff(
  transaction: Prisma.TransactionClient,
  userId: string,
  actor: AdminActor,
) {
  if (userId === actor.id) throw new StaffError("FORBIDDEN", "Kelola profil Anda dari menu akun.");
  const user = await transaction.user.findUnique({
    where: { id: userId },
    include: { outletAssignments: { select: { outletId: true } } },
  });
  if (!user) throw new StaffError("NOT_FOUND", "Staf tidak ditemukan.");
  if (user.role === "owner") throw new StaffError("FORBIDDEN", "Akun pemilik tidak dapat diubah dari daftar staf.");
  if (actor.role === "manager") {
    if (user.role !== "cashier") throw new StaffError("FORBIDDEN", "Manajer hanya dapat mengelola kasir.");
    const actorOutletIds = await getActorOutletIds(transaction, actor);
    if (!user.outletAssignments.some((assignment) => actorOutletIds.includes(assignment.outletId))) {
      throw new StaffError("FORBIDDEN", "Kasir berada di luar cakupan outlet Anda.");
    }
  }
  if (actor.role === "cashier") throw new StaffError("FORBIDDEN", "Akses pengelolaan staf ditolak.");
  return user;
}

async function assertManageableOutlets(
  transaction: Prisma.TransactionClient,
  actor: AdminActor,
  outletIds: string[],
) {
  const outlets = await transaction.outlet.findMany({
    where: {
      id: { in: outletIds },
      status: OutletStatus.ACTIVE,
      ...(actor.role === "owner" ? {} : { assignments: { some: { userId: actor.id } } }),
    },
    select: { id: true },
  });
  if (outlets.length !== outletIds.length) {
    throw new StaffError("FORBIDDEN", "Satu atau beberapa outlet tidak tersedia untuk penugasan.");
  }
}

async function getActorOutletIds(transaction: Prisma.TransactionClient, actor: AdminActor) {
  const assignments = await transaction.userOutletAssignment.findMany({
    where: { userId: actor.id, outlet: { status: OutletStatus.ACTIVE } },
    select: { outletId: true },
  });
  return assignments.map((assignment) => assignment.outletId);
}

function assertVersion(actual: Date, expected: string) {
  if (actual.getTime() !== new Date(expected).getTime()) {
    throw new StaffError("CONFLICT", "Data staf telah diubah. Muat ulang lalu coba kembali.");
  }
}

function assertUpdateSucceeded(count: number) {
  if (count !== 1) throw new StaffError("CONFLICT", "Data staf telah berubah. Muat ulang lalu coba kembali.");
}

async function runStaffMutation<T>(mutation: (transaction: Prisma.TransactionClient) => Promise<T>) {
  try {
    return await prisma.$transaction(mutation);
  } catch (error) {
    if (error instanceof StaffPolicyError) throw new StaffError("FORBIDDEN", error.message);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new StaffError("DUPLICATE", "Email sudah digunakan oleh akun lain.");
    }
    throw error;
  }
}

function staffSnapshot(user: {
  name: string;
  email: string;
  role: string | null;
  banned: boolean | null;
  mustChangePassword: boolean;
  outletIds: string[];
}) {
  return {
    name: user.name,
    email: user.email,
    role: user.role,
    banned: Boolean(user.banned),
    mustChangePassword: user.mustChangePassword,
    outletIds: user.outletIds,
  } satisfies Prisma.InputJsonObject;
}
