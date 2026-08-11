import { describe, expect, it } from "vitest";

import { addIsoDays, attendanceDisplay, hasMissedCheckoutDeadlinePassed, isWithinScheduledWindow, mondayOf, scheduledRange } from "@/lib/attendance/roster";
import { addPublishedRosterEntrySchema, saveRosterDraftSchema, updatePublishedRosterEntrySchema } from "@/lib/attendance/roster-validation";

describe("attendance roster domain", () => {
  it("uses a stable Monday-to-Sunday week without browser timezone drift", () => {
    expect(mondayOf("2026-08-13")).toBe("2026-08-10");
    expect(addIsoDays("2026-08-10", 6)).toBe("2026-08-16");
  });

  it("moves an overnight shift end to the following local date", () => {
    const range = scheduledRange("2026-08-10", 22 * 60, 6 * 60, "Asia/Jakarta");
    expect(range.scheduledStartAt.toISOString()).toBe("2026-08-10T15:00:00.000Z");
    expect(range.scheduledEndAt.toISOString()).toBe("2026-08-10T23:00:00.000Z");
  });

  it("opens check-in exactly two hours early and closes it after shift end", () => {
    const start = new Date("2026-08-10T01:00:00.000Z");
    const end = new Date("2026-08-10T09:00:00.000Z");
    expect(isWithinScheduledWindow(new Date("2026-08-09T23:00:00.000Z"), start, end)).toBe(true);
    expect(isWithinScheduledWindow(new Date("2026-08-09T22:59:59.999Z"), start, end)).toBe(false);
    expect(isWithinScheduledWindow(new Date("2026-08-10T09:00:00.001Z"), start, end)).toBe(false);
  });

  it("treats the grace boundary as on time and the next minute as late", () => {
    const scheduledStartAt = new Date("2026-08-10T01:00:00.000Z");
    const scheduledEndAt = new Date("2026-08-10T09:00:00.000Z");
    const base = { now: scheduledEndAt, scheduledStartAt, scheduledEndAt, lateGraceMinutes: 15, earlyLeaveGraceMinutes: 15 };
    expect(attendanceDisplay({ ...base, checkInAt: new Date("2026-08-10T01:15:00.000Z"), checkOutAt: scheduledEndAt }).status).toBe("ON_TIME");
    expect(attendanceDisplay({ ...base, checkInAt: new Date("2026-08-10T01:16:00.000Z"), checkOutAt: scheduledEndAt }).status).toBe("LATE");
    expect(attendanceDisplay({ ...base, checkInAt: scheduledStartAt, checkOutAt: new Date("2026-08-10T08:44:00.000Z") }).status).toBe("EARLY_LEAVE");
  });

  it.each([
    [new Date("2026-08-10T00:00:00.000Z"), null, null, false, "SCHEDULED"],
    [new Date("2026-08-10T02:00:00.000Z"), null, null, false, "NOT_CLOCKED_IN"],
    [new Date("2026-08-10T10:00:00.000Z"), null, null, false, "ABSENT"],
    [new Date("2026-08-10T10:00:00.000Z"), new Date("2026-08-10T01:00:00.000Z"), null, true, "MISSED_CHECKOUT"],
  ])("derives scheduled lifecycle status %s", (now, checkInAt, checkOutAt, sessionOpen, expected) => {
    expect(attendanceDisplay({ now, scheduledStartAt: new Date("2026-08-10T01:00:00.000Z"), scheduledEndAt: new Date("2026-08-10T09:00:00.000Z"), checkInAt, checkOutAt, sessionOpen }).status).toBe(expected);
  });

  it("keeps a missing checkout uncounted after the session is administratively closed", () => {
    const result = attendanceDisplay({ now: new Date("2026-08-11T00:00:00.000Z"), scheduledStartAt: new Date("2026-08-10T01:00:00.000Z"), scheduledEndAt: new Date("2026-08-10T09:00:00.000Z"), checkInAt: new Date("2026-08-10T01:00:00.000Z"), checkOutAt: null, sessionOpen: false });
    expect(result).toEqual(expect.objectContaining({ status: "MISSED_CHECKOUT", totalMinutes: 0 }));
  });

  it("uses the outlet-local day after the scheduled end as the missed-checkout boundary", () => {
    const base = { businessDate: new Date("2026-08-10T00:00:00.000Z"), timezone: "Asia/Jakarta", scheduledEndAt: new Date("2026-08-10T23:00:00.000Z") };
    expect(hasMissedCheckoutDeadlinePassed({ ...base, now: new Date("2026-08-11T16:59:59.000Z") })).toBe(false);
    expect(hasMissedCheckoutDeadlinePassed({ ...base, now: new Date("2026-08-11T17:00:00.000Z") })).toBe(true);
    expect(hasMissedCheckoutDeadlinePassed({ now: new Date("2026-08-10T17:00:00.000Z"), businessDate: base.businessDate, timezone: base.timezone })).toBe(true);
  });

  it("marks sessions without a matching published roster as unscheduled", () => {
    expect(attendanceDisplay({ now: new Date(), unscheduled: true }).status).toBe("UNSCHEDULED");
  });

  it("rejects duplicate staff dates and dates outside the selected week", () => {
    const input = { outletId: "outlet-1", weekStart: "2026-08-10", expectedUpdatedAt: null, entries: [
      { userId: "staff-1", workDate: "2026-08-10", shiftTemplateId: "shift-1" },
      { userId: "staff-1", workDate: "2026-08-10", shiftTemplateId: "shift-2" },
      { userId: "staff-2", workDate: "2026-08-17", shiftTemplateId: "shift-1" },
    ] };
    const result = saveRosterDraftSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.map((issue) => issue.message)).toEqual(expect.arrayContaining(["Satu staf hanya boleh memiliki satu shift per tanggal.", "Tanggal berada di luar minggu roster."]));
  });

  it("requires a meaningful reason for published additions and Libur revisions", () => {
    expect(addPublishedRosterEntrySchema.safeParse({ rosterWeekId: "week-1", outletId: "outlet-1", userId: "staff-1", workDate: "2099-08-10", shiftTemplateId: "shift-1", expectedWeekUpdatedAt: "2026-08-11T01:00:00.000Z", reason: "izin" }).success).toBe(false);
    expect(updatePublishedRosterEntrySchema.safeParse({ entryId: "entry-1", shiftTemplateId: null, expectedUpdatedAt: "2026-08-11T01:00:00.000Z", reason: "Staf mendapat jadwal libur" }).success).toBe(true);
  });
});
