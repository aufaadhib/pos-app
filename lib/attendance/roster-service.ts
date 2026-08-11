import "server-only";

import { AttendanceAuditAction, AttendanceRosterSource, AttendanceRosterStatus, AttendanceScheduleMode, OutletStatus, Prisma, StaffPositionStatus } from "@/generated/prisma/client";
import { scheduledRange } from "@/lib/attendance/roster";
import type { AttendanceActor } from "@/lib/attendance/types";
import type { AddPublishedRosterEntryInput, CopyRosterWeekInput, ResetFixedScheduleOverrideInput, RosterWeekTarget, SaveFixedSchedulesInput, SaveRosterDraftInput, ShiftTemplateInput, ShiftTemplateTarget, UpdatePublishedRosterEntryInput, UpdateScheduleModeInput, UpdateShiftTemplateInput } from "@/lib/attendance/roster-validation";
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

/** Replaces one outlet's reusable weekly staff patterns after validating assignments, templates, and cross-outlet conflicts. */
export async function saveFixedSchedules(input: SaveFixedSchedulesInput, actor: AttendanceActor) {
  return runRosterMutation(async (transaction) => {
    const outlet = await assertOutletScope(transaction, input.outletId, actor);
    assertVersion(outlet.updatedAt, input.expectedUpdatedAt, "Pengaturan jadwal telah berubah.");
    const userIds = [...new Set(input.entries.map((entry) => entry.userId))];
    const templateIds = [...new Set(input.entries.map((entry) => entry.shiftTemplateId))];
    const [users, templates, conflicts] = await Promise.all([
      transaction.user.findMany({ where: { id: { in: userIds }, banned: false, role: { in: ["manager", "cashier", "staff"] }, jobPositionId: { not: null }, outletAssignments: { some: { outletId: outlet.id } } }, select: { id: true } }),
      transaction.attendanceShiftTemplate.findMany({ where: { id: { in: templateIds }, outletId: outlet.id, status: StaffPositionStatus.ACTIVE }, select: { id: true } }),
      transaction.attendanceFixedSchedule.findMany({ where: { outletId: { not: outlet.id }, userId: { in: userIds } }, select: { userId: true, weekday: true } }),
    ]);
    if (users.length !== userIds.length) throw new RosterError("CONFLICT", "Satu atau beberapa staf tidak aktif, belum memiliki jabatan, atau tidak ditugaskan ke outlet.");
    if (templates.length !== templateIds.length) throw new RosterError("CONFLICT", "Satu atau beberapa template shift tidak tersedia.");
    const conflictKeys = new Set(conflicts.map((entry) => `${entry.userId}:${entry.weekday}`));
    if (input.entries.some((entry) => conflictKeys.has(`${entry.userId}:${entry.weekday}`))) throw new RosterError("CONFLICT", "Staf sudah memiliki jadwal tetap pada outlet lain di hari yang sama.");
    const before = await transaction.attendanceFixedSchedule.findMany({ where: { outletId: outlet.id }, select: { userId: true, weekday: true, shiftTemplateId: true } });
    await transaction.attendanceFixedSchedule.deleteMany({ where: { outletId: outlet.id } });
    if (input.entries.length) await transaction.attendanceFixedSchedule.createMany({ data: input.entries.map((entry) => ({ ...entry, outletId: outlet.id })) });
    const updated = await transaction.outlet.update({ where: { id: outlet.id }, data: { updatedAt: new Date() } });
    await audit(transaction, "FIXED_SCHEDULE", outlet.id, AttendanceAuditAction.FIXED_SCHEDULE_UPDATE, actor, { entries: before }, { entries: input.entries });
    if (outlet.attendanceScheduleMode === AttendanceScheduleMode.FIXED) {
      const effective = nextMonday(new Date(), outlet.timezone);
      const weeks = await transaction.attendanceRosterWeek.findMany({ where: { outletId: outlet.id, source: AttendanceRosterSource.FIXED, weekStart: { gte: date(effective) } }, select: { weekStart: true } });
      for (const week of weeks) await materializeFixedWeek(transaction, outlet.id, week.weekStart.toISOString().slice(0, 10), actor, true);
    }
    return updated;
  }, Prisma.TransactionIsolationLevel.Serializable);
}

/** Switches one outlet between weekly and fixed scheduling without overwriting published weeks. */
export async function updateScheduleMode(input: UpdateScheduleModeInput, actor: AttendanceActor) {
  return runRosterMutation(async (transaction) => {
    const outlet = await assertOutletScope(transaction, input.outletId, actor);
    assertVersion(outlet.updatedAt, input.expectedUpdatedAt, "Pengaturan jadwal telah berubah.");
    if (outlet.attendanceScheduleMode === input.mode) throw new RosterError("CONFLICT", input.mode === "FIXED" ? "Mode jadwal tetap sudah aktif." : "Mode roster mingguan sudah aktif.");
    let effectiveFrom: string | null = null;
    if (input.mode === "FIXED") {
      const staff = await transaction.userOutletAssignment.findMany({ where: { outletId: outlet.id, user: { banned: false, role: { in: ["manager", "cashier", "staff"] }, jobPositionId: { not: null } } }, select: { userId: true } });
      const scheduled = await transaction.attendanceFixedSchedule.findMany({ where: { outletId: outlet.id }, distinct: ["userId"], select: { userId: true } });
      const scheduledIds = new Set(scheduled.map((entry) => entry.userId));
      if (!staff.length || staff.some((assignment) => !scheduledIds.has(assignment.userId))) throw new RosterError("INVALID", "Lengkapi minimal satu hari kerja untuk setiap staf aktif sebelum mengaktifkan jadwal tetap.");
      effectiveFrom = nextMonday(new Date(), outlet.timezone);
      const latestPublished = await transaction.attendanceRosterWeek.findFirst({ where: { outletId: outlet.id, status: AttendanceRosterStatus.PUBLISHED, weekStart: { gte: date(effectiveFrom) } }, orderBy: { weekStart: "desc" }, select: { weekStart: true } });
      if (latestPublished) effectiveFrom = addDays(latestPublished.weekStart.toISOString().slice(0, 10), 7);
      await transaction.attendanceRosterWeek.deleteMany({ where: { outletId: outlet.id, status: AttendanceRosterStatus.DRAFT, weekStart: { gte: date(effectiveFrom) } } });
    }
    const updated = await transaction.outlet.update({ where: { id: outlet.id }, data: { attendanceScheduleMode: input.mode, attendanceScheduleEffectiveFrom: effectiveFrom ? date(effectiveFrom) : null } });
    await audit(transaction, "SCHEDULE_MODE", outlet.id, AttendanceAuditAction.SCHEDULE_MODE_UPDATE, actor, { mode: outlet.attendanceScheduleMode, effectiveFrom: outlet.attendanceScheduleEffectiveFrom?.toISOString().slice(0, 10) ?? null }, { mode: input.mode, effectiveFrom });
    if (effectiveFrom) {
      await materializeFixedWeek(transaction, outlet.id, effectiveFrom, actor);
      await materializeFixedWeek(transaction, outlet.id, addDays(effectiveFrom, 7), actor);
    }
    return updated;
  }, Prisma.TransactionIsolationLevel.Serializable);
}

/** Ensures current and following fixed roster weeks exist for active outlets; intended for bounded cron maintenance. */
export async function materializeUpcomingFixedRosters(now = new Date(), limit = 100) {
  const outlets = await prisma.outlet.findMany({ where: { status: OutletStatus.ACTIVE, attendanceScheduleMode: AttendanceScheduleMode.FIXED }, take: limit, orderBy: { id: "asc" }, select: { id: true, timezone: true } });
  let materialized = 0;
  for (const outlet of outlets) {
    const weekStart = mondayOfLocal(now, outlet.timezone);
    await prisma.$transaction(async (transaction) => {
      if (await materializeFixedWeek(transaction, outlet.id, weekStart, systemActor)) materialized += 1;
      if (await materializeFixedWeek(transaction, outlet.id, addDays(weekStart, 7), systemActor)) materialized += 1;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
  return { scanned: outlets.length, materialized };
}

/** Materializes a fixed roster inside an existing attendance transaction when cron has not created it yet. */
export async function ensureFixedRosterWeek(transaction: Prisma.TransactionClient, outletId: string, timezone: string, now: Date) {
  return materializeFixedWeek(transaction, outletId, mondayOfLocal(now, timezone), systemActor);
}

/** Revises or removes one future published entry with a mandatory reason and immutable audit snapshots. */
export async function updatePublishedRosterEntry(input: UpdatePublishedRosterEntryInput, actor: AttendanceActor) {
  return runRosterMutation(async (transaction) => {
    const entry = await transaction.attendanceRosterEntry.findUnique({ where: { id: input.entryId }, include: { rosterWeek: { select: { status: true, source: true } } } });
    if (!entry || entry.rosterWeek.status !== AttendanceRosterStatus.PUBLISHED) throw new RosterError("NOT_FOUND", "Jadwal terbit tidak ditemukan.");
    await assertOutletScope(transaction, entry.outletId, actor);
    assertVersion(entry.updatedAt, input.expectedUpdatedAt, "Jadwal telah berubah.");
    if (entry.scheduledStartAt <= new Date()) throw new RosterError("CONFLICT", "Jadwal yang sudah mulai atau berlalu tidak dapat diubah.");
    if (entry.rosterWeek.source === AttendanceRosterSource.FIXED) await transaction.attendanceScheduleOverride.upsert({ where: { userId_workDate: { userId: entry.userId, workDate: entry.workDate } }, create: { outletId: entry.outletId, userId: entry.userId, workDate: entry.workDate, shiftTemplateId: input.shiftTemplateId, reason: input.reason }, update: { outletId: entry.outletId, shiftTemplateId: input.shiftTemplateId, reason: input.reason } });
    if (!input.shiftTemplateId) {
      await transaction.attendanceRosterEntry.delete({ where: { id: entry.id } });
      await audit(transaction, "ROSTER_ENTRY", entry.id, AttendanceAuditAction.ROSTER_UPDATE, actor, entrySnapshot(entry), { status: "DAY_OFF", reason: input.reason });
      return null;
    }
    const template = await findTemplate(transaction, input.shiftTemplateId, entry.outletId);
    if (template.status !== StaffPositionStatus.ACTIVE) throw new RosterError("CONFLICT", "Template shift sudah diarsipkan.");
    const range = scheduledRange(entry.workDate.toISOString().slice(0, 10), template.startMinute, template.endMinute, entry.timezone);
    const updated = await transaction.attendanceRosterEntry.update({ where: { id: entry.id }, data: { shiftTemplateId: template.id, shiftName: template.name, scheduledStartAt: range.scheduledStartAt, scheduledEndAt: range.scheduledEndAt } });
    await audit(transaction, "ROSTER_ENTRY", entry.id, AttendanceAuditAction.ROSTER_UPDATE, actor, entrySnapshot(entry), { ...entrySnapshot(updated), reason: input.reason });
    return updated;
  }, Prisma.TransactionIsolationLevel.Serializable);
}

/** Adds a future shift to a published day-off cell after revalidating the week, staff, and outlet scope. */
export async function addPublishedRosterEntry(input: AddPublishedRosterEntryInput, actor: AttendanceActor) {
  return runRosterMutation(async (transaction) => {
    const outlet = await assertOutletScope(transaction, input.outletId, actor);
    const week = await transaction.attendanceRosterWeek.findFirst({ where: { id: input.rosterWeekId, outletId: input.outletId } });
    if (!week || week.status !== AttendanceRosterStatus.PUBLISHED) throw new RosterError("NOT_FOUND", "Roster terbit tidak ditemukan.");
    assertVersion(week.updatedAt, input.expectedWeekUpdatedAt, "Roster telah berubah.");
    const workDate = date(input.workDate);
    const weekEnd = new Date(week.weekStart); weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
    if (workDate < week.weekStart || workDate > weekEnd) throw new RosterError("INVALID", "Tanggal berada di luar minggu roster.");
    const [snapshot] = await buildEntrySnapshots(transaction, [{ userId: input.userId, workDate: input.workDate, shiftTemplateId: input.shiftTemplateId }], outlet);
    if (snapshot.scheduledStartAt <= new Date()) throw new RosterError("CONFLICT", "Shift yang sudah mulai atau berlalu tidak dapat ditambahkan.");
    if (week.source === AttendanceRosterSource.FIXED) await transaction.attendanceScheduleOverride.upsert({ where: { userId_workDate: { userId: input.userId, workDate: date(input.workDate) } }, create: { outletId: outlet.id, userId: input.userId, workDate: date(input.workDate), shiftTemplateId: input.shiftTemplateId, reason: input.reason }, update: { outletId: outlet.id, shiftTemplateId: input.shiftTemplateId, reason: input.reason } });
    const entry = await transaction.attendanceRosterEntry.create({ data: { rosterWeekId: week.id, ...snapshot } });
    await transaction.attendanceRosterWeek.update({ where: { id: week.id }, data: { updatedAt: new Date() } });
    await audit(transaction, "ROSTER_ENTRY", entry.id, AttendanceAuditAction.ROSTER_UPDATE, actor, { status: "DAY_OFF", userId: input.userId, workDate: input.workDate }, { ...entrySnapshot(entry), reason: input.reason });
    return entry;
  }, Prisma.TransactionIsolationLevel.Serializable);
}

/** Removes one fixed-date override and restores the recurring pattern for that employee and date. */
export async function resetFixedScheduleOverride(input: ResetFixedScheduleOverrideInput, actor: AttendanceActor) {
  return runRosterMutation(async (transaction) => {
    const outlet = await assertOutletScope(transaction, input.outletId, actor);
    const week = await transaction.attendanceRosterWeek.findFirst({ where: { id: input.rosterWeekId, outletId: outlet.id, source: AttendanceRosterSource.FIXED }, include: { entries: { where: { userId: input.userId, workDate: date(input.workDate) }, take: 1 } } });
    if (!week) throw new RosterError("NOT_FOUND", "Roster tetap tidak ditemukan.");
    assertVersion(week.updatedAt, input.expectedWeekUpdatedAt, "Roster telah berubah.");
    const pattern = await transaction.attendanceFixedSchedule.findUnique({ where: { outletId_userId_weekday: { outletId: outlet.id, userId: input.userId, weekday: weekday(input.workDate) } } });
    const current = week.entries[0] ?? null;
    if (current?.scheduledStartAt && current.scheduledStartAt <= new Date()) throw new RosterError("CONFLICT", "Jadwal yang sudah mulai atau berlalu tidak dapat diubah.");
    if (!current && outletLocalStart(input.workDate, pattern?.shiftTemplateId ? await findTemplate(transaction, pattern.shiftTemplateId, outlet.id) : null, outlet.timezone) <= new Date()) throw new RosterError("CONFLICT", "Jadwal yang sudah mulai atau berlalu tidak dapat diubah.");
    await transaction.attendanceScheduleOverride.deleteMany({ where: { outletId: outlet.id, userId: input.userId, workDate: date(input.workDate) } });
    if (current) await transaction.attendanceRosterEntry.delete({ where: { id: current.id } });
    if (pattern) {
      const [snapshot] = await buildEntrySnapshots(transaction, [{ userId: input.userId, workDate: input.workDate, shiftTemplateId: pattern.shiftTemplateId }], outlet);
      await transaction.attendanceRosterEntry.create({ data: { rosterWeekId: week.id, ...snapshot } });
    }
    await transaction.attendanceRosterWeek.update({ where: { id: week.id }, data: { updatedAt: new Date() } });
    await audit(transaction, "ROSTER_ENTRY", current?.id ?? week.id, AttendanceAuditAction.ROSTER_UPDATE, actor, current ? entrySnapshot(current) : { status: "DAY_OFF" }, { status: "FOLLOW_FIXED_PATTERN", reason: input.reason });
  }, Prisma.TransactionIsolationLevel.Serializable);
}

async function materializeFixedWeek(transaction: Prisma.TransactionClient, outletId: string, weekStart: string, actor: AttendanceActor, replace = false) {
  const outlet = await transaction.outlet.findFirst({ where: { id: outletId, status: OutletStatus.ACTIVE }, select: { id: true, timezone: true, attendanceLateGraceMinutes: true, attendanceEarlyLeaveGraceMinutes: true, attendanceScheduleMode: true, attendanceScheduleEffectiveFrom: true, updatedAt: true } });
  if (!outlet || outlet.attendanceScheduleMode !== AttendanceScheduleMode.FIXED || !outlet.attendanceScheduleEffectiveFrom || date(addDays(weekStart, 6)) < outlet.attendanceScheduleEffectiveFrom) return null;
  const existing = await transaction.attendanceRosterWeek.findUnique({ where: { outletId_weekStart: { outletId, weekStart: date(weekStart) } }, include: { entries: { select: { session: { select: { id: true } } } } } });
  if (existing?.source === AttendanceRosterSource.MANUAL || (existing && !replace)) return null;
  if (existing?.entries.some((entry) => entry.session)) throw new RosterError("CONFLICT", "Roster yang sudah memiliki presensi tidak dapat dibangun ulang.");
  const weekEnd = addDays(weekStart, 6);
  const [patterns, overrides] = await Promise.all([
    transaction.attendanceFixedSchedule.findMany({ where: { outletId, user: { banned: false, role: { in: ["manager", "cashier", "staff"] }, jobPositionId: { not: null }, outletAssignments: { some: { outletId } } } }, select: { userId: true, weekday: true, shiftTemplateId: true } }),
    transaction.attendanceScheduleOverride.findMany({ where: { outletId, workDate: { gte: date(weekStart), lte: date(weekEnd) } }, select: { userId: true, workDate: true, shiftTemplateId: true } }),
  ]);
  const overrideMap = new Map(overrides.map((entry) => [`${entry.userId}:${entry.workDate.toISOString().slice(0, 10)}`, entry.shiftTemplateId]));
  const entries: Array<{ userId: string; workDate: string; shiftTemplateId: string }> = [];
  const handled = new Set<string>();
  for (const pattern of patterns) {
    const workDate = addDays(weekStart, pattern.weekday - 1);
    const key = `${pattern.userId}:${workDate}`;
    const shiftTemplateId = overrideMap.has(key) ? overrideMap.get(key) : pattern.shiftTemplateId;
    handled.add(key);
    if (shiftTemplateId) entries.push({ userId: pattern.userId, workDate, shiftTemplateId });
  }
  for (const override of overrides) {
    const workDate = override.workDate.toISOString().slice(0, 10);
    const key = `${override.userId}:${workDate}`;
    if (!handled.has(key) && override.shiftTemplateId) entries.push({ userId: override.userId, workDate, shiftTemplateId: override.shiftTemplateId });
  }
  const snapshots = await buildEntrySnapshots(transaction, entries, outlet);
  const publishedAt = new Date();
  const week = existing
    ? await transaction.attendanceRosterWeek.update({ where: { id: existing.id }, data: { status: AttendanceRosterStatus.PUBLISHED, source: AttendanceRosterSource.FIXED, publishedAt, publishedByUserId: actor.id, publishedByName: actor.name, publishedByEmail: actor.email, entries: { deleteMany: {}, create: snapshots } } })
    : await transaction.attendanceRosterWeek.create({ data: { outletId, weekStart: date(weekStart), status: AttendanceRosterStatus.PUBLISHED, source: AttendanceRosterSource.FIXED, publishedAt, publishedByUserId: actor.id, publishedByName: actor.name, publishedByEmail: actor.email, entries: { create: snapshots } } });
  await audit(transaction, "ROSTER_WEEK", week.id, AttendanceAuditAction.FIXED_ROSTER_MATERIALIZE, actor, existing ? { source: existing.source, entryCount: existing.entries.length } : null, { source: AttendanceRosterSource.FIXED, entryCount: snapshots.length, weekStart });
  return week;
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

type ScopedOutlet = { id: string; timezone: string; attendanceLateGraceMinutes: number; attendanceEarlyLeaveGraceMinutes: number; attendanceScheduleMode: AttendanceScheduleMode; attendanceScheduleEffectiveFrom: Date | null; updatedAt: Date };
async function assertOutletScope(transaction: Prisma.TransactionClient, outletId: string, actor: AttendanceActor): Promise<ScopedOutlet> { assertManager(actor); const outlet = await transaction.outlet.findFirst({ where: { id: outletId, status: OutletStatus.ACTIVE, ...(actor.role === "owner" ? {} : { assignments: { some: { userId: actor.id } } }) }, select: { id: true, timezone: true, attendanceLateGraceMinutes: true, attendanceEarlyLeaveGraceMinutes: true, attendanceScheduleMode: true, attendanceScheduleEffectiveFrom: true, updatedAt: true } }); if (!outlet) throw new RosterError("FORBIDDEN", "Outlet berada di luar cakupan Anda."); return outlet; }
function assertManager(actor: AttendanceActor) { if (actor.role !== "owner" && actor.role !== "manager") throw new RosterError("FORBIDDEN", "Akun ini tidak dapat mengelola roster."); }
async function findTemplate(transaction: Prisma.TransactionClient, id: string, outletId: string) { const template = await transaction.attendanceShiftTemplate.findFirst({ where: { id, outletId } }); if (!template) throw new RosterError("NOT_FOUND", "Template shift tidak ditemukan."); return template; }
function assertVersion(actual: Date, expected: string, message: string) { if (actual.getTime() !== new Date(expected).getTime()) throw new RosterError("CONFLICT", `${message} Muat ulang halaman.`); }
function normalized(value: string) { return normalizeOperationalLabel(value).toLocaleLowerCase("id-ID"); }
function minute(value: string) { const [hour, minutes] = value.split(":").map(Number); return hour * 60 + minutes; }
function date(value: string) { return new Date(`${value}T00:00:00.000Z`); }
function addDays(value: string, days: number) { const result = date(value); result.setUTCDate(result.getUTCDate() + days); return result.toISOString().slice(0, 10); }
function weekday(value: string) { return date(value).getUTCDay() || 7; }
function mondayOfLocal(now: Date, timezone: string) { const local = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now); return addDays(local, -(weekday(local) - 1)); }
function nextMonday(now: Date, timezone: string) { return addDays(mondayOfLocal(now, timezone), 7); }
function outletLocalStart(workDate: string, template: { startMinute: number } | null, timezone: string) { return template ? scheduledRange(workDate, template.startMinute, template.startMinute + 1, timezone).scheduledStartAt : new Date(`${workDate}T23:59:59.999Z`); }
function templateSnapshot(template: { name: string; startMinute: number; endMinute: number; status: StaffPositionStatus }) { return { name: template.name, startMinute: template.startMinute, endMinute: template.endMinute, status: template.status }; }
function entrySnapshot(entry: { shiftTemplateId: string; scheduledStartAt: Date; scheduledEndAt: Date; shiftName: string }) { return { shiftTemplateId: entry.shiftTemplateId, shiftName: entry.shiftName, scheduledStartAt: entry.scheduledStartAt.toISOString(), scheduledEndAt: entry.scheduledEndAt.toISOString() }; }
async function audit(transaction: Prisma.TransactionClient, entityType: string, entityId: string, action: AttendanceAuditAction, actor: AttendanceActor, before: Prisma.InputJsonValue | null, after: Prisma.InputJsonValue | null) { await transaction.attendanceAuditLog.create({ data: { entityType, entityId, action, actorUserId: actor.id, actorEmail: actor.email, before: before ?? undefined, after: after ?? undefined } }); }
async function runRosterMutation<T>(callback: (transaction: Prisma.TransactionClient) => Promise<T>, isolationLevel?: Prisma.TransactionIsolationLevel) { try { return await prisma.$transaction(callback, isolationLevel ? { isolationLevel } : undefined); } catch (error) { if (error instanceof RosterError) throw error; if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new RosterError("DUPLICATE", "Jadwal bertabrakan atau nama template sudah digunakan."); throw error; } }
const systemActor: AttendanceActor = { id: "system", name: "Sistem", email: "cron@glutong.local", role: "owner" };
