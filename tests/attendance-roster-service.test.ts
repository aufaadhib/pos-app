import { beforeEach, describe, expect, it, vi } from "vitest";

import { AttendanceRosterStatus, Prisma, StaffPositionStatus } from "@/generated/prisma/client";

const mocks = vi.hoisted(() => ({
  auditCreate: vi.fn(),
  entryFindUnique: vi.fn(),
  entryUpdate: vi.fn(),
  outletFindFirst: vi.fn(),
  rosterCreate: vi.fn(),
  rosterFindUnique: vi.fn(),
  rosterUpdate: vi.fn(),
  templateCreate: vi.fn(),
  templateFindFirst: vi.fn(),
  templateFindMany: vi.fn(),
  transaction: vi.fn(),
  userFindMany: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));

import { createShiftTemplate, publishRosterWeek, saveRosterDraft, updatePublishedRosterEntry } from "@/lib/attendance/roster-service";

const actor = { id: "manager-1", name: "Manajer", email: "manager@example.com", role: "manager" as const };
const outlet = { id: "outlet-1", timezone: "Asia/Jakarta", attendanceLateGraceMinutes: 15, attendanceEarlyLeaveGraceMinutes: 15 };
const updatedAt = new Date("2026-08-11T01:00:00.000Z");
const transactionClient = {
  attendanceAuditLog: { create: mocks.auditCreate },
  attendanceRosterEntry: { findUnique: mocks.entryFindUnique, update: mocks.entryUpdate },
  attendanceRosterWeek: { create: mocks.rosterCreate, findUnique: mocks.rosterFindUnique, update: mocks.rosterUpdate },
  attendanceShiftTemplate: { create: mocks.templateCreate, findFirst: mocks.templateFindFirst, findMany: mocks.templateFindMany },
  outlet: { findFirst: mocks.outletFindFirst },
  user: { findMany: mocks.userFindMany },
};

describe("attendance roster service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation(async (callback) => callback(transactionClient));
    mocks.outletFindFirst.mockResolvedValue(outlet);
    mocks.auditCreate.mockResolvedValue({ id: "audit-1" });
  });

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
});
