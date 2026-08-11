import "server-only";

import { AttendanceAuditAction, AttendanceRosterStatus, OutletStatus, Prisma, StaffPositionStatus } from "@/generated/prisma/client";
import { scheduledRange } from "@/lib/attendance/roster";
import type { AttendanceActor } from "@/lib/attendance/types";
import type { CopyRosterWeekInput, RosterWeekTarget, SaveRosterDraftInput, ShiftTemplateInput, ShiftTemplateTarget, UpdatePublishedRosterEntryInput, UpdateShiftTemplateInput } from "@/lib/attendance/roster-validation";
import { normalizeOperationalLabel } from "@/lib/outlets/normalization";
import { prisma } from "@/lib/prisma";

export class RosterError extends Error {
  constructor(public readonly code: "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "DUPLICATE" | "INVALID", message: string) { super(message); this.name = "RosterError"; }
}

/** Creates an active outlet-scoped shift template and records its schedule snapshot. */
export async function createShiftTemplate(input: ShiftTemplateInput, actor: AttendanceActor) {
  return runRosterMutation(async (transaction) => {
    await assertOutletScope(transaction, input.outletId, actor);
    const template = await transaction.attendanceShiftTemplate.create({ data: { outletId: input.outletId, name: input.name, normalizedName: normalized(input.name), startMinute: minute(input.startTime), endMinute: minute(input.endTime) } });
    await audit(transaction, "SHIFT_TEMPLATE", template.id, AttendanceAuditAction.SHIFT_TEMPLATE_CREATE, actor, null, templateSnapshot(template));
    return template;
  });
}

/** Updates a shift template with optimistic concurrency without mutating published roster snapshots. */
export async function updateShiftTemplate(input: UpdateShiftTemplateInput, actor: AttendanceActor) {
  return runRosterMutation(async (transaction) => {
    await assertOutletScope(transaction, input.outletId, actor);
    const current = await findTemplate(transaction, input.id, input.outletId);
    assertVersion(current.updatedAt, input.expectedUpdatedAt, "Template shift telah berubah.");
    const template = await transaction.attendanceShiftTemplate.update({ where: { id: current.id }, data: { name: input.name, normalizedName: normalized(input.name), startMinute: minute(input.startTime), endMinute: minute(input.endTime) } });
    await audit(transaction, "SHIFT_TEMPLATE", template.id, AttendanceAuditAction.SHIFT_TEMPLATE_UPDATE, actor, templateSnapshot(current), templateSnapshot(template));
    return template;
  });
}

/** Archives or restores a shift template while retaining every existing roster reference. */
export async function changeShiftTemplateStatus(input: ShiftTemplateTarget, status: StaffPositionStatus, actor: AttendanceActor) {
  return runRosterMutation(async (transaction) => {
    await assertOutletScope(transaction, input.outletId, actor);
    const current = await findTemplate(transaction, input.id, input.outletId);
    assertVersion(current.updatedAt, input.expectedUpdatedAt, "Template shift telah berubah.");
    if (current.status === status) throw new RosterError("CONFLICT", status === StaffPositionStatus.ACTIVE ? "Template sudah aktif." : "Template sudah diarsipkan.");
    const template = await transaction.attendanceShiftTemplate.update({ where: { id: current.id }, data: { status, archivedAt: status === StaffPositionStatus.ARCHIVED ? new Date() : null } });
    await audit(transaction, "SHIFT_TEMPLATE", template.id, AttendanceAuditAction.SHIFT_TEMPLATE_ARCHIVE, actor, templateSnapshot(current), templateSnapshot(template));
    return template;
  });
}

/** Replaces one weekly draft atomically after validating staff, outlet, positions, templates, and date uniqueness. */
export async function saveRosterDraft(input: SaveRosterDraftInput, actor: AttendanceActor) {
  return runRosterMutation(async (transaction) => {
    const outlet = await assertOutletScope(transaction, input.outletId, actor);
    const current = await transaction.attendanceRosterWeek.findUnique({ where: { outletId_weekStart: { outletId: input.outletId, weekStart: date(input.weekStart) } } });
    if (current?.status === AttendanceRosterStatus.PUBLISHED) throw new RosterError("CONFLICT", "Roster sudah diterbitkan dan tidak dapat kembali menjadi draf.");
    if (current && !input.expectedUpdatedAt) throw new RosterError("CONFLICT", "Draf sudah dibuat oleh pengguna lain. Muat ulang halaman.");
    if (current && input.expectedUpdatedAt) assertVersion(current.updatedAt, input.expectedUpdatedAt, "Draf roster telah berubah.");
    const snapshots = await buildEntrySnapshots(transaction, input.entries, outlet);
    const week = current
      ? await transaction.attendanceRosterWeek.update({ where: { id: current.id }, data: { entries: { deleteMany: {}, create: snapshots } } })
      : await transaction.attendanceRosterWeek.create({ data: { outletId: outlet.id, weekStart: date(input.weekStart), entries: { create: snapshots } } });
    await audit(transaction, "ROSTER_WEEK", week.id, AttendanceAuditAction.ROSTER_UPDATE, actor, current ? { status: current.status } : null, { status: week.status, entryCount: snapshots.length, weekStart: input.weekStart });
    return week;
  }, Prisma.TransactionIsolationLevel.Serializable);
}

/** Publishes one non-empty draft and freezes its current schedule snapshots for attendance matching. */
export async function publishRosterWeek(input: RosterWeekTarget, actor: AttendanceActor) {
  return runRosterMutation(async (transaction) => {
    await assertOutletScope(transaction, input.outletId, actor);
    const week = await transaction.attendanceRosterWeek.findUnique({ where: { outletId_weekStart: { outletId: input.outletId, weekStart: date(input.weekStart) } }, include: { entries: { include: { shiftTemplate: { select: { status: true } }, user: { select: { banned: true, outletAssignments: { where: { outletId: input.outletId }, select: { outletId: true } } } } } } } });
    if (!week) throw new RosterError("NOT_FOUND", "Draf roster belum dibuat.");
    assertVersion(week.updatedAt, input.expectedUpdatedAt, "Draf roster telah berubah.");
    if (week.status === AttendanceRosterStatus.PUBLISHED) throw new RosterError("CONFLICT", "Roster sudah diterbitkan.");
    if (!week.entries.length) throw new RosterError("INVALID", "Isi minimal satu jadwal sebelum menerbitkan roster.");
    if (week.entries.some((entry) => entry.shiftTemplate.status !== StaffPositionStatus.ACTIVE || entry.user.banned || !entry.user.outletAssignments.length)) throw new RosterError("CONFLICT", "Roster memuat staf atau template yang tidak lagi aktif. Perbarui draf terlebih dahulu.");
    const publishedAt = new Date();
    const published = await transaction.attendanceRosterWeek.update({ where: { id: week.id }, data: { status: AttendanceRosterStatus.PUBLISHED, publishedAt, publishedByUserId: actor.id, publishedByName: actor.name, publishedByEmail: actor.email } });
    await audit(transaction, "ROSTER_WEEK", week.id, AttendanceAuditAction.ROSTER_PUBLISH, actor, { status: week.status }, { status: published.status, entryCount: week.entries.length, publishedAt: publishedAt.toISOString() });
    return published;
  }, Prisma.TransactionIsolationLevel.Serializable);
}

/** Copies one prior week into a new draft while preserving shift choices and moving dates by whole weeks. */
export async function copyRosterWeek(input: CopyRosterWeekInput, actor: AttendanceActor) {
  return runRosterMutation(async (transaction) => {
    const outlet = await assertOutletScope(transaction, input.outletId, actor);
    const existing = await transaction.attendanceRosterWeek.findUnique({ where: { outletId_weekStart: { outletId: input.outletId, weekStart: date(input.targetWeekStart) } }, select: { id: true } });
    if (existing) throw new RosterError("CONFLICT", "Minggu tujuan sudah memiliki roster.");
    const source = await transaction.attendanceRosterWeek.findUnique({ where: { outletId_weekStart: { outletId: input.outletId, weekStart: date(input.sourceWeekStart) } }, include: { entries: true } });
    if (!source?.entries.length) throw new RosterError("NOT_FOUND", "Roster sumber kosong atau tidak ditemukan.");
    const dayOffset = Math.round((date(input.targetWeekStart).getTime() - date(input.sourceWeekStart).getTime()) / 86_400_000);
    const copiedInput = source.entries.map((entry) => ({ userId: entry.userId, shiftTemplateId: entry.shiftTemplateId, workDate: addDays(entry.workDate.toISOString().slice(0, 10), dayOffset) }));
    const snapshots = await buildEntrySnapshots(transaction, copiedInput, outlet);
    const week = await transaction.attendanceRosterWeek.create({ data: { outletId: outlet.id, weekStart: date(input.targetWeekStart), entries: { create: snapshots } } });
    await audit(transaction, "ROSTER_WEEK", week.id, AttendanceAuditAction.ROSTER_UPDATE, actor, null, { copiedFrom: input.sourceWeekStart, weekStart: input.targetWeekStart, entryCount: snapshots.length });
    return week;
  }, Prisma.TransactionIsolationLevel.Serializable);
}

/** Revises one future published entry with a mandatory reason and an immutable before/after audit. */
export async function updatePublishedRosterEntry(input: UpdatePublishedRosterEntryInput, actor: AttendanceActor) {
  return runRosterMutation(async (transaction) => {
    const entry = await transaction.attendanceRosterEntry.findUnique({ where: { id: input.entryId }, include: { rosterWeek: { select: { status: true } } } });
    if (!entry || entry.rosterWeek.status !== AttendanceRosterStatus.PUBLISHED) throw new RosterError("NOT_FOUND", "Jadwal terbit tidak ditemukan.");
    await assertOutletScope(transaction, entry.outletId, actor);
    assertVersion(entry.updatedAt, input.expectedUpdatedAt, "Jadwal telah berubah.");
    if (entry.scheduledStartAt <= new Date()) throw new RosterError("CONFLICT", "Jadwal yang sudah mulai atau berlalu tidak dapat diubah.");
    const template = await findTemplate(transaction, input.shiftTemplateId, entry.outletId);
    if (template.status !== StaffPositionStatus.ACTIVE) throw new RosterError("CONFLICT", "Template shift sudah diarsipkan.");
    const range = scheduledRange(entry.workDate.toISOString().slice(0, 10), template.startMinute, template.endMinute, entry.timezone);
    const updated = await transaction.attendanceRosterEntry.update({ where: { id: entry.id }, data: { shiftTemplateId: template.id, shiftName: template.name, scheduledStartAt: range.scheduledStartAt, scheduledEndAt: range.scheduledEndAt } });
    await audit(transaction, "ROSTER_ENTRY", entry.id, AttendanceAuditAction.ROSTER_UPDATE, actor, entrySnapshot(entry), { ...entrySnapshot(updated), reason: input.reason });
    return updated;
  }, Prisma.TransactionIsolationLevel.Serializable);
}

async function buildEntrySnapshots(transaction: Prisma.TransactionClient, entries: Array<{ userId: string; workDate: string; shiftTemplateId: string }>, outlet: ScopedOutlet) {
  const userIds = [...new Set(entries.map((entry) => entry.userId))];
  const templateIds = [...new Set(entries.map((entry) => entry.shiftTemplateId))];
  const [users, templates] = await Promise.all([
    transaction.user.findMany({ where: { id: { in: userIds }, banned: false, role: { in: ["manager", "cashier", "staff"] }, outletAssignments: { some: { outletId: outlet.id } }, jobPositionId: { not: null } }, select: { id: true, jobPositionId: true, jobPosition: { select: { name: true, status: true } } } }),
    transaction.attendanceShiftTemplate.findMany({ where: { id: { in: templateIds }, outletId: outlet.id, status: StaffPositionStatus.ACTIVE } }),
  ]);
  if (users.length !== userIds.length) throw new RosterError("CONFLICT", "Satu atau beberapa staf tidak aktif, belum memiliki jabatan, atau tidak ditugaskan ke outlet.");
  if (templates.length !== templateIds.length) throw new RosterError("CONFLICT", "Satu atau beberapa template shift tidak tersedia.");
  const userMap = new Map(users.map((user) => [user.id, user]));
  const templateMap = new Map(templates.map((template) => [template.id, template]));
  return entries.map((entry) => {
    const user = userMap.get(entry.userId)!;
    const template = templateMap.get(entry.shiftTemplateId)!;
    if (!user.jobPositionId || !user.jobPosition || user.jobPosition.status !== StaffPositionStatus.ACTIVE) throw new RosterError("CONFLICT", "Jabatan staf tidak aktif.");
    const range = scheduledRange(entry.workDate, template.startMinute, template.endMinute, outlet.timezone);
    return { shiftTemplateId: template.id, userId: user.id, outletId: outlet.id, positionId: user.jobPositionId, workDate: date(entry.workDate), scheduledStartAt: range.scheduledStartAt, scheduledEndAt: range.scheduledEndAt, timezone: outlet.timezone, positionName: user.jobPosition.name, shiftName: template.name, lateGraceMinutes: outlet.attendanceLateGraceMinutes, earlyLeaveGraceMinutes: outlet.attendanceEarlyLeaveGraceMinutes };
  });
}

type ScopedOutlet = { id: string; timezone: string; attendanceLateGraceMinutes: number; attendanceEarlyLeaveGraceMinutes: number };
async function assertOutletScope(transaction: Prisma.TransactionClient, outletId: string, actor: AttendanceActor): Promise<ScopedOutlet> { assertManager(actor); const outlet = await transaction.outlet.findFirst({ where: { id: outletId, status: OutletStatus.ACTIVE, ...(actor.role === "owner" ? {} : { assignments: { some: { userId: actor.id } } }) }, select: { id: true, timezone: true, attendanceLateGraceMinutes: true, attendanceEarlyLeaveGraceMinutes: true } }); if (!outlet) throw new RosterError("FORBIDDEN", "Outlet berada di luar cakupan Anda."); return outlet; }
function assertManager(actor: AttendanceActor) { if (actor.role !== "owner" && actor.role !== "manager") throw new RosterError("FORBIDDEN", "Akun ini tidak dapat mengelola roster."); }
async function findTemplate(transaction: Prisma.TransactionClient, id: string, outletId: string) { const template = await transaction.attendanceShiftTemplate.findFirst({ where: { id, outletId } }); if (!template) throw new RosterError("NOT_FOUND", "Template shift tidak ditemukan."); return template; }
function assertVersion(actual: Date, expected: string, message: string) { if (actual.getTime() !== new Date(expected).getTime()) throw new RosterError("CONFLICT", `${message} Muat ulang halaman.`); }
function normalized(value: string) { return normalizeOperationalLabel(value).toLocaleLowerCase("id-ID"); }
function minute(value: string) { const [hour, minutes] = value.split(":").map(Number); return hour * 60 + minutes; }
function date(value: string) { return new Date(`${value}T00:00:00.000Z`); }
function addDays(value: string, days: number) { const result = date(value); result.setUTCDate(result.getUTCDate() + days); return result.toISOString().slice(0, 10); }
function templateSnapshot(template: { name: string; startMinute: number; endMinute: number; status: StaffPositionStatus }) { return { name: template.name, startMinute: template.startMinute, endMinute: template.endMinute, status: template.status }; }
function entrySnapshot(entry: { shiftTemplateId: string; scheduledStartAt: Date; scheduledEndAt: Date; shiftName: string }) { return { shiftTemplateId: entry.shiftTemplateId, shiftName: entry.shiftName, scheduledStartAt: entry.scheduledStartAt.toISOString(), scheduledEndAt: entry.scheduledEndAt.toISOString() }; }
async function audit(transaction: Prisma.TransactionClient, entityType: string, entityId: string, action: AttendanceAuditAction, actor: AttendanceActor, before: Prisma.InputJsonValue | null, after: Prisma.InputJsonValue | null) { await transaction.attendanceAuditLog.create({ data: { entityType, entityId, action, actorUserId: actor.id, actorEmail: actor.email, before: before ?? undefined, after: after ?? undefined } }); }
async function runRosterMutation<T>(callback: (transaction: Prisma.TransactionClient) => Promise<T>, isolationLevel?: Prisma.TransactionIsolationLevel) { try { return await prisma.$transaction(callback, isolationLevel ? { isolationLevel } : undefined); } catch (error) { if (error instanceof RosterError) throw error; if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new RosterError("DUPLICATE", "Jadwal bertabrakan atau nama template sudah digunakan."); throw error; } }
