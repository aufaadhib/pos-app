import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AttendanceRosterStatus, Prisma, StaffPositionStatus } from "@/generated/prisma/client";

const mocks = vi.hoisted(() => ({
  auditCreate: vi.fn(),
  entryCreate: vi.fn(),
  entryDelete: vi.fn(),
  entryFindUnique: vi.fn(),
  entryUpdate: vi.fn(),
  fixedCreateMany: vi.fn(),
  fixedDeleteMany: vi.fn(),
  fixedFindMany: vi.fn(),
  overrideFindMany: vi.fn(),
  outletFindFirst: vi.fn(),
  outletUpdate: vi.fn(),
  assignmentFindMany: vi.fn(),
  rosterCreate: vi.fn(),
  rosterDeleteMany: vi.fn(),
  rosterFindMany: vi.fn(),
  rosterFindUnique: vi.fn(),
  rosterFindFirst: vi.fn(),
  rosterUpdate: vi.fn(),
  templateCreate: vi.fn(),
  templateFindFirst: vi.fn(),
  templateFindMany: vi.fn(),
  templateUpdate: vi.fn(),
  transaction: vi.fn(),
  userFindMany: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));

import { addPublishedRosterEntry, changeShiftTemplateStatus, createShiftTemplate, publishRosterWeek, saveFixedSchedules, saveRosterDraft, updatePublishedRosterEntry, updateScheduleMode, updateShiftTemplate } from "@/lib/attendance/roster-service";

const actor = { id: "manager-1", name: "Manajer", email: "manager@example.com", role: "manager" as const };
const outlet = { id: "outlet-1", timezone: "Asia/Jakarta", attendanceLateGraceMinutes: 15, attendanceEarlyLeaveGraceMinutes: 15, attendanceScheduleMode: "WEEKLY" as const, attendanceScheduleEffectiveFrom: null, updatedAt: new Date("2026-08-11T01:00:00.000Z") };
const updatedAt = new Date("2026-08-11T01:00:00.000Z");
const transactionClient = {
  attendanceAuditLog: { create: mocks.auditCreate },
  attendanceRosterEntry: { create: mocks.entryCreate, delete: mocks.entryDelete, findUnique: mocks.entryFindUnique, update: mocks.entryUpdate },
  attendanceFixedSchedule: { createMany: mocks.fixedCreateMany, deleteMany: mocks.fixedDeleteMany, findMany: mocks.fixedFindMany },
  attendanceScheduleOverride: { findMany: mocks.overrideFindMany },
  attendanceRosterWeek: { create: mocks.rosterCreate, deleteMany: mocks.rosterDeleteMany, findFirst: mocks.rosterFindFirst, findMany: mocks.rosterFindMany, findUnique: mocks.rosterFindUnique, update: mocks.rosterUpdate },
  attendanceShiftTemplate: { create: mocks.templateCreate, findFirst: mocks.templateFindFirst, findMany: mocks.templateFindMany, update: mocks.templateUpdate },
  outlet: { findFirst: mocks.outletFindFirst, update: mocks.outletUpdate },
  userOutletAssignment: { findMany: mocks.assignmentFindMany },
  user: { findMany: mocks.userFindMany },
};

describe("attendance roster service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation(async (callback) => callback(transactionClient));
    mocks.outletFindFirst.mockResolvedValue(outlet);
    mocks.auditCreate.mockResolvedValue({ id: "audit-1" });
    mocks.fixedFindMany.mockResolvedValue([]);
    mocks.overrideFindMany.mockResolvedValue([]);
  });

  afterEach(() => vi.useRealTimers());

  it("scopes manager templates to an assigned active outlet and audits creation", async () => {
    mocks.templateCreate.mockResolvedValue({ id: "shift-1", name: "Pagi", startMinute: 480, endMinute: 960, status: StaffPositionStatus.ACTIVE });

    await createShiftTemplate({ outletId: outlet.id, name: "Pagi", startTime: "08:00", endTime: "16:00" }, actor);

    expect(mocks.outletFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ assignments: { some: { userId: actor.id } } }) }));
    expect(mocks.templateCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ outletId: outlet.id, startMinute: 480, endMinute: 960 }) });
    expect(mocks.auditCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "SHIFT_TEMPLATE_CREATE" }) }));
  });

  it("stores timezone, position, shift, and tolerance snapshots in one draft transaction", async () => {
    mocks.rosterFindUnique.mockResolvedValue(null);
    mocks.userFindMany.mockResolvedValue([{ id: "staff-1", jobPositionId: "position-1", jobPosition: { name: "Pelayan", status: StaffPositionStatus.ACTIVE } }]);
    mocks.templateFindMany.mockResolvedValue([{ id: "shift-1", name: "Pagi", startMinute: 480, endMinute: 960 }]);
    mocks.rosterCreate.mockResolvedValue({ id: "week-1", status: AttendanceRosterStatus.DRAFT });

    await saveRosterDraft({ outletId: outlet.id, weekStart: "2026-08-10", expectedUpdatedAt: null, entries: [{ userId: "staff-1", workDate: "2026-08-10", shiftTemplateId: "shift-1" }] }, actor);

    expect(mocks.rosterCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ outletId: outlet.id, entries: { create: [expect.objectContaining({ timezone: "Asia/Jakarta", positionId: "position-1", positionName: "Pelayan", shiftName: "Pagi", lateGraceMinutes: 15, earlyLeaveGraceMinutes: 15, scheduledStartAt: new Date("2026-08-10T01:00:00.000Z"), scheduledEndAt: new Date("2026-08-10T09:00:00.000Z") })] } }) });
    expect(mocks.transaction).toHaveBeenCalledOnce();
  });

  it("updates and archives templates with optimistic versions and audit snapshots", async () => {
    const current = { id: "shift-1", outletId: outlet.id, name: "Pagi", startMinute: 480, endMinute: 960, status: StaffPositionStatus.ACTIVE, updatedAt };
    mocks.templateFindFirst.mockResolvedValue(current);
    mocks.templateUpdate.mockResolvedValueOnce({ ...current, name: "Pagi awal", startMinute: 420 }).mockResolvedValueOnce({ ...current, status: StaffPositionStatus.ARCHIVED });

    await updateShiftTemplate({ id: current.id, outletId: outlet.id, expectedUpdatedAt: updatedAt.toISOString(), name: "Pagi awal", startTime: "07:00", endTime: "16:00" }, actor);
    await changeShiftTemplateStatus({ id: current.id, outletId: outlet.id, expectedUpdatedAt: updatedAt.toISOString() }, StaffPositionStatus.ARCHIVED, actor);

    expect(mocks.templateUpdate).toHaveBeenNthCalledWith(1, expect.objectContaining({ data: expect.objectContaining({ name: "Pagi awal", startMinute: 420 }) }));
    expect(mocks.templateUpdate).toHaveBeenNthCalledWith(2, expect.objectContaining({ data: expect.objectContaining({ status: StaffPositionStatus.ARCHIVED }) }));
    expect(mocks.auditCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "SHIFT_TEMPLATE_UPDATE" }) }));
    expect(mocks.auditCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "SHIFT_TEMPLATE_ARCHIVE" }) }));
  });

  it("publishes a valid draft and its audit atomically", async () => {
    mocks.rosterFindUnique.mockResolvedValue({ id: "week-1", status: AttendanceRosterStatus.DRAFT, updatedAt, entries: [{ shiftTemplate: { status: StaffPositionStatus.ACTIVE }, user: { banned: false, outletAssignments: [{ outletId: outlet.id }] } }] });
    mocks.rosterUpdate.mockResolvedValue({ id: "week-1", status: AttendanceRosterStatus.PUBLISHED });

    await publishRosterWeek({ outletId: outlet.id, weekStart: "2026-08-10", expectedUpdatedAt: updatedAt.toISOString() }, actor);

    expect(mocks.rosterUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: AttendanceRosterStatus.PUBLISHED, publishedByUserId: actor.id }) }));
    expect(mocks.auditCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "ROSTER_PUBLISH" }) }));
    expect(mocks.transaction).toHaveBeenCalledOnce();
  });

  it("revises only a future published shift and records the mandatory reason", async () => {
    const entry = { id: "entry-1", outletId: outlet.id, workDate: new Date("2099-08-10T00:00:00.000Z"), timezone: "Asia/Jakarta", shiftTemplateId: "shift-old", shiftName: "Pagi", scheduledStartAt: new Date("2099-08-10T01:00:00.000Z"), scheduledEndAt: new Date("2099-08-10T09:00:00.000Z"), updatedAt, rosterWeek: { status: AttendanceRosterStatus.PUBLISHED }, outlet, user: {} };
    mocks.entryFindUnique.mockResolvedValue(entry);
    mocks.templateFindFirst.mockResolvedValue({ id: "shift-new", name: "Siang", startMinute: 720, endMinute: 1200, status: StaffPositionStatus.ACTIVE });
    mocks.entryUpdate.mockResolvedValue({ ...entry, shiftTemplateId: "shift-new", shiftName: "Siang", scheduledStartAt: new Date("2099-08-10T05:00:00.000Z"), scheduledEndAt: new Date("2099-08-10T13:00:00.000Z") });

    await updatePublishedRosterEntry({ entryId: entry.id, shiftTemplateId: "shift-new", expectedUpdatedAt: updatedAt.toISOString(), reason: "Pertukaran jadwal staf" }, actor);

    expect(mocks.entryUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ shiftTemplateId: "shift-new", shiftName: "Siang" }) }));
    expect(mocks.auditCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ after: expect.objectContaining({ reason: "Pertukaran jadwal staf" }) }) }));
  });

  it("changes a future published shift to Libur without mutating its audit history", async () => {
    const entry = { id: "entry-1", outletId: outlet.id, workDate: new Date("2099-08-10T00:00:00.000Z"), timezone: "Asia/Jakarta", shiftTemplateId: "shift-old", shiftName: "Pagi", scheduledStartAt: new Date("2099-08-10T01:00:00.000Z"), scheduledEndAt: new Date("2099-08-10T09:00:00.000Z"), updatedAt, rosterWeek: { status: AttendanceRosterStatus.PUBLISHED } };
    mocks.entryFindUnique.mockResolvedValue(entry);
    mocks.entryDelete.mockResolvedValue(entry);

    await updatePublishedRosterEntry({ entryId: entry.id, shiftTemplateId: null, expectedUpdatedAt: updatedAt.toISOString(), reason: "Staf mendapat jadwal libur" }, actor);

    expect(mocks.entryDelete).toHaveBeenCalledWith({ where: { id: entry.id } });
    expect(mocks.auditCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ before: expect.objectContaining({ shiftName: "Pagi" }), after: { status: "DAY_OFF", reason: "Staf mendapat jadwal libur" } }) }));
  });

  it("adds a future shift to a published Libur cell and bumps the week version", async () => {
    const week = { id: "week-1", outletId: outlet.id, weekStart: new Date("2099-08-10T00:00:00.000Z"), status: AttendanceRosterStatus.PUBLISHED, updatedAt };
    mocks.rosterFindFirst.mockResolvedValue(week);
    mocks.userFindMany.mockResolvedValue([{ id: "staff-1", jobPositionId: "position-1", jobPosition: { name: "Pelayan", status: StaffPositionStatus.ACTIVE } }]);
    mocks.templateFindMany.mockResolvedValue([{ id: "shift-1", name: "Pagi", startMinute: 480, endMinute: 960 }]);
    mocks.entryCreate.mockImplementation(async ({ data }) => ({ id: "entry-new", ...data }));
    mocks.rosterUpdate.mockResolvedValue({ ...week, updatedAt: new Date() });

    await addPublishedRosterEntry({ rosterWeekId: week.id, outletId: outlet.id, userId: "staff-1", workDate: "2099-08-10", shiftTemplateId: "shift-1", expectedWeekUpdatedAt: updatedAt.toISOString(), reason: "Menggantikan staf yang izin" }, actor);

    expect(mocks.entryCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ rosterWeekId: week.id, userId: "staff-1", shiftName: "Pagi" }) });
    expect(mocks.rosterUpdate).toHaveBeenCalledWith({ where: { id: week.id }, data: { updatedAt: expect.any(Date) } });
    expect(mocks.auditCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ before: { status: "DAY_OFF", userId: "staff-1", workDate: "2099-08-10" }, after: expect.objectContaining({ reason: "Menggantikan staf yang izin" }) }) }));
  });

  it("locks adding a shift to a published date after its start time", async () => {
    const week = { id: "week-old", outletId: outlet.id, weekStart: new Date("2020-08-10T00:00:00.000Z"), status: AttendanceRosterStatus.PUBLISHED, updatedAt };
    mocks.rosterFindFirst.mockResolvedValue(week);
    mocks.userFindMany.mockResolvedValue([{ id: "staff-1", jobPositionId: "position-1", jobPosition: { name: "Pelayan", status: StaffPositionStatus.ACTIVE } }]);
    mocks.templateFindMany.mockResolvedValue([{ id: "shift-1", name: "Pagi", startMinute: 480, endMinute: 960 }]);

    await expect(addPublishedRosterEntry({ rosterWeekId: week.id, outletId: outlet.id, userId: "staff-1", workDate: "2020-08-10", shiftTemplateId: "shift-1", expectedWeekUpdatedAt: updatedAt.toISOString(), reason: "Koreksi jadwal yang terlewat" }, actor)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(mocks.entryCreate).not.toHaveBeenCalled();
  });

  it("locks a published shift after it has started", async () => {
    mocks.entryFindUnique.mockResolvedValue({ id: "entry-1", outletId: outlet.id, updatedAt, scheduledStartAt: new Date("2020-01-01T00:00:00.000Z"), rosterWeek: { status: AttendanceRosterStatus.PUBLISHED } });

    await expect(updatePublishedRosterEntry({ entryId: "entry-1", shiftTemplateId: "shift-new", expectedUpdatedAt: updatedAt.toISOString(), reason: "Pertukaran jadwal staf" }, actor)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(mocks.templateFindFirst).not.toHaveBeenCalled();
    expect(mocks.entryUpdate).not.toHaveBeenCalled();
  });

  it("maps the global staff-date constraint to a roster conflict", async () => {
    mocks.transaction.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("duplicate", { code: "P2002", clientVersion: "test" }));

    await expect(saveRosterDraft({ outletId: outlet.id, weekStart: "2026-08-10", expectedUpdatedAt: null, entries: [] }, actor)).rejects.toMatchObject({ code: "DUPLICATE" });
  });

  it("replaces an outlet fixed pattern and records its audit atomically", async () => {
    mocks.userFindMany.mockResolvedValue([{ id: "staff-1" }]);
    mocks.templateFindMany.mockResolvedValue([{ id: "shift-1" }]);
    mocks.fixedFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    mocks.outletUpdate.mockResolvedValue({ ...outlet, updatedAt: new Date("2026-08-11T02:00:00.000Z") });

    await saveFixedSchedules({ outletId: outlet.id, expectedUpdatedAt: outlet.updatedAt.toISOString(), entries: [{ userId: "staff-1", weekday: 1, shiftTemplateId: "shift-1" }] }, actor);

    expect(mocks.fixedDeleteMany).toHaveBeenCalledWith({ where: { outletId: outlet.id } });
    expect(mocks.fixedCreateMany).toHaveBeenCalledWith({ data: [{ outletId: outlet.id, userId: "staff-1", weekday: 1, shiftTemplateId: "shift-1" }] });
    expect(mocks.auditCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "FIXED_SCHEDULE_UPDATE" }) }));
  });

  it("activates fixed mode on the next free Monday and materializes two published weeks", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-11T03:00:00.000Z"));
    const fixedOutlet = { ...outlet, attendanceScheduleMode: "FIXED" as const, attendanceScheduleEffectiveFrom: new Date("2026-08-17T00:00:00.000Z") };
    mocks.outletFindFirst.mockResolvedValueOnce(outlet).mockResolvedValue(fixedOutlet);
    mocks.assignmentFindMany.mockResolvedValue([{ userId: "staff-1" }]);
    mocks.fixedFindMany.mockResolvedValueOnce([{ userId: "staff-1" }]).mockResolvedValue([{ userId: "staff-1", weekday: 1, shiftTemplateId: "shift-1" }]);
    mocks.rosterFindFirst.mockResolvedValue(null);
    mocks.rosterFindUnique.mockResolvedValue(null);
    mocks.userFindMany.mockResolvedValue([{ id: "staff-1", jobPositionId: "position-1", jobPosition: { name: "Pelayan", status: StaffPositionStatus.ACTIVE } }]);
    mocks.templateFindMany.mockResolvedValue([{ id: "shift-1", name: "Pagi", startMinute: 480, endMinute: 960 }]);
    mocks.outletUpdate.mockResolvedValue(fixedOutlet);
    mocks.rosterCreate.mockImplementation(async ({ data }) => ({ id: `week-${data.weekStart.toISOString()}`, ...data }));

    await updateScheduleMode({ outletId: outlet.id, expectedUpdatedAt: outlet.updatedAt.toISOString(), mode: "FIXED" }, actor);

    expect(mocks.outletUpdate).toHaveBeenCalledWith({ where: { id: outlet.id }, data: { attendanceScheduleMode: "FIXED", attendanceScheduleEffectiveFrom: new Date("2026-08-17T00:00:00.000Z") } });
    expect(mocks.rosterCreate).toHaveBeenCalledTimes(2);
    expect(mocks.rosterCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ source: "FIXED", status: "PUBLISHED", weekStart: new Date("2026-08-17T00:00:00.000Z") }) });
  });

  it("blocks fixed mode while an active staff member has no recurring shift", async () => {
    mocks.assignmentFindMany.mockResolvedValue([{ userId: "staff-1" }, { userId: "staff-2" }]);
    mocks.fixedFindMany.mockResolvedValue([{ userId: "staff-1" }]);

    await expect(updateScheduleMode({ outletId: outlet.id, expectedUpdatedAt: outlet.updatedAt.toISOString(), mode: "FIXED" }, actor)).rejects.toMatchObject({ code: "INVALID" });
    expect(mocks.outletUpdate).not.toHaveBeenCalled();
  });
});
