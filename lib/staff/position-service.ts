import "server-only";

import { AdminAuditAction, AdminAuditEntityType, Prisma, StaffPositionStatus } from "@/generated/prisma/client";
import { normalizeOperationalLabel } from "@/lib/outlets/normalization";
import { writeAdminAudit } from "@/lib/outlets/service";
import type { AdminActor } from "@/lib/outlets/types";
import { prisma } from "@/lib/prisma";
import type { StaffPositionInput, StaffPositionTarget, UpdateStaffPositionInput } from "@/lib/staff/validation";

export class StaffPositionError extends Error {
  constructor(public readonly code: "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "DUPLICATE", message: string) { super(message); this.name = "StaffPositionError"; }
}

/** Creates one globally reusable job position and writes an owner audit record. */
export async function createStaffPosition(input: StaffPositionInput, actor: AdminActor) {
  assertOwner(actor);
  return runPositionMutation(async (transaction) => {
    const position = await transaction.staffPosition.create({ data: { name: input.name, normalizedName: normalizeName(input.name) } });
    await writeAdminAudit(transaction, { entityType: AdminAuditEntityType.STAFF_POSITION, entityId: position.id, action: AdminAuditAction.CREATE, actor, after: snapshot(position) });
    return position;
  });
}

/** Renames one position with optimistic concurrency while preserving historical references. */
export async function updateStaffPosition(input: UpdateStaffPositionInput, actor: AdminActor) {
  assertOwner(actor);
  return runPositionMutation(async (transaction) => {
    const current = await findPosition(transaction, input.id);
    assertVersion(current.updatedAt, input.expectedUpdatedAt);
    const updated = await transaction.staffPosition.update({ where: { id: current.id }, data: { name: input.name, normalizedName: normalizeName(input.name) } });
    await writeAdminAudit(transaction, { entityType: AdminAuditEntityType.STAFF_POSITION, entityId: updated.id, action: AdminAuditAction.UPDATE, actor, before: snapshot(current), after: snapshot(updated) });
    return updated;
  });
}

/** Archives or restores a position without deleting references from users and rosters. */
export async function changeStaffPositionStatus(target: StaffPositionTarget, status: StaffPositionStatus, actor: AdminActor) {
  assertOwner(actor);
  return runPositionMutation(async (transaction) => {
    const current = await findPosition(transaction, target.id);
    assertVersion(current.updatedAt, target.expectedUpdatedAt);
    if (current.status === status) throw new StaffPositionError("CONFLICT", status === StaffPositionStatus.ACTIVE ? "Jabatan sudah aktif." : "Jabatan sudah diarsipkan.");
    const updated = await transaction.staffPosition.update({ where: { id: current.id }, data: { status, archivedAt: status === StaffPositionStatus.ARCHIVED ? new Date() : null } });
    await writeAdminAudit(transaction, { entityType: AdminAuditEntityType.STAFF_POSITION, entityId: updated.id, action: status === StaffPositionStatus.ACTIVE ? AdminAuditAction.RESTORE : AdminAuditAction.ARCHIVE, actor, before: snapshot(current), after: snapshot(updated) });
    return updated;
  });
}

function assertOwner(actor: AdminActor) { if (actor.role !== "owner") throw new StaffPositionError("FORBIDDEN", "Hanya pemilik yang dapat mengelola jabatan."); }
function normalizeName(value: string) { return normalizeOperationalLabel(value).toLocaleLowerCase("id-ID"); }
function assertVersion(actual: Date, expected: string) { if (actual.getTime() !== new Date(expected).getTime()) throw new StaffPositionError("CONFLICT", "Jabatan telah berubah. Muat ulang halaman."); }
async function findPosition(transaction: Prisma.TransactionClient, id: string) { const position = await transaction.staffPosition.findUnique({ where: { id } }); if (!position) throw new StaffPositionError("NOT_FOUND", "Jabatan tidak ditemukan."); return position; }
async function runPositionMutation<T>(callback: (transaction: Prisma.TransactionClient) => Promise<T>) { try { return await prisma.$transaction(callback); } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new StaffPositionError("DUPLICATE", "Nama jabatan sudah digunakan."); throw error; } }
function snapshot(position: { name: string; status: StaffPositionStatus; archivedAt: Date | null }) { return { name: position.name, status: position.status, archivedAt: position.archivedAt?.toISOString() ?? null }; }
