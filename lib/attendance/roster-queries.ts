import "server-only";

import { AttendanceRosterStatus, OutletStatus } from "@/generated/prisma/client";
import { addIsoDays, attendanceDisplay, mondayOf } from "@/lib/attendance/roster";
import type { AttendanceActor } from "@/lib/attendance/types";
import { prisma } from "@/lib/prisma";

/** Loads one outlet week, assignable staff, and active shift templates for the responsive roster editor. */
export async function getRosterWorkspace(outletId: string, actor: AttendanceActor, requestedWeek: string) {
  const weekStart = mondayOf(requestedWeek);
  const outlet = await scopedOutlet(outletId, actor);
  const [staff, templates, week] = await Promise.all([
    prisma.userOutletAssignment.findMany({ where: { outletId, user: { banned: false, role: { in: ["manager", "cashier", "staff"] }, jobPositionId: { not: null } } }, orderBy: { user: { name: "asc" } }, select: { user: { select: { id: true, name: true, email: true, role: true, jobPosition: { select: { id: true, name: true } } } } } }),
    prisma.attendanceShiftTemplate.findMany({ where: { outletId, status: "ACTIVE" }, orderBy: [{ startMinute: "asc" }, { name: "asc" }], select: { id: true, name: true, startMinute: true, endMinute: true, updatedAt: true } }),
    prisma.attendanceRosterWeek.findUnique({ where: { outletId_weekStart: { outletId, weekStart: date(weekStart) } }, include: { entries: { orderBy: [{ workDate: "asc" }, { user: { name: "asc" } }], select: { id: true, userId: true, workDate: true, shiftTemplateId: true, shiftName: true, scheduledStartAt: true, scheduledEndAt: true, updatedAt: true } } } }),
  ]);
  return {
    outlet,
    weekStart,
    weekEnd: addIsoDays(weekStart, 6),
    staff: staff.map(({ user }) => user),
    templates: templates.map((template) => ({ ...template, startTime: minuteLabel(template.startMinute), endTime: minuteLabel(template.endMinute), updatedAt: template.updatedAt.toISOString() })),
    week: week ? { id: week.id, status: week.status, publishedAt: week.publishedAt?.toISOString() ?? null, updatedAt: week.updatedAt.toISOString(), entries: week.entries.map((entry) => ({ ...entry, workDate: entry.workDate.toISOString().slice(0, 10), scheduledStartAt: entry.scheduledStartAt.toISOString(), scheduledEndAt: entry.scheduledEndAt.toISOString(), updatedAt: entry.updatedAt.toISOString() })) } : null,
  };
}

/** Returns published roster cards for the signed-in user's current and following week. */
export async function getPublishedRosterForUser(userId: string, now = new Date()) {
  const today = dateAt(now, "Asia/Jakarta");
  const weekStart = mondayOf(today);
  const entries = await prisma.attendanceRosterEntry.findMany({ where: { userId, workDate: { gte: date(addIsoDays(weekStart, -1)), lte: date(addIsoDays(weekStart, 13)) }, rosterWeek: { status: AttendanceRosterStatus.PUBLISHED } }, orderBy: { workDate: "asc" }, include: { outlet: { select: { id: true, code: true, name: true } }, session: { include: { corrections: { orderBy: { createdAt: "desc" }, take: 1 } } } } });
  return entries.filter((entry) => entry.workDate >= date(weekStart) || now <= entry.scheduledEndAt).map((entry) => serializeRosterEntry(entry, now));
}

/** Builds today's manager summary including scheduled, missing, and unscheduled attendance. */
export async function getAttendanceRosterSummary(outletId: string, actor: AttendanceActor, now = new Date()) {
  const outlet = await scopedOutlet(outletId, actor);
  const workDate = dateAt(now, outlet.timezone);
  const [entries, unscheduled] = await Promise.all([
    prisma.attendanceRosterEntry.findMany({ where: { outletId, workDate: date(workDate), rosterWeek: { status: AttendanceRosterStatus.PUBLISHED } }, include: { user: { select: { id: true, name: true, email: true } }, session: { include: { corrections: { orderBy: { createdAt: "desc" }, take: 1 } } } }, orderBy: { scheduledStartAt: "asc" } }),
    prisma.attendanceSession.findMany({ where: { outletId, businessDate: date(workDate), scheduleMatch: "UNSCHEDULED" }, include: { user: { select: { id: true, name: true, email: true } }, corrections: { orderBy: { createdAt: "desc" }, take: 1 } }, orderBy: { checkInAt: "asc" } }),
  ]);
  const scheduledRows = entries.map((entry) => ({ ...serializeRosterEntry({ ...entry, outlet: { id: outlet.id, code: outlet.code, name: outlet.name } }, now), user: entry.user }));
  const unscheduledRows = unscheduled.map((session) => ({ id: session.id, workDate, user: session.user, outlet: { code: outlet.code, name: outlet.name }, shiftName: "Di luar jadwal", scheduledStartAt: null, scheduledEndAt: null, checkInAt: effective(session, "in")?.toISOString() ?? session.checkInAt.toISOString(), checkOutAt: effective(session, "out")?.toISOString() ?? session.checkOutAt?.toISOString() ?? null, status: "UNSCHEDULED" as const, lateMinutes: 0, earlyLeaveMinutes: 0, totalMinutes: 0 }));
  const rows = [...scheduledRows, ...unscheduledRows];
  const counts = rows.reduce<Record<string, number>>((result, row) => { result[row.status] = (result[row.status] ?? 0) + 1; return result; }, {});
  return { workDate, rows, counts };
}

async function scopedOutlet(outletId: string, actor: AttendanceActor) {
  if (actor.role !== "owner" && actor.role !== "manager") throw new Error("FORBIDDEN");
  const outlet = await prisma.outlet.findFirst({ where: { id: outletId, status: OutletStatus.ACTIVE, ...(actor.role === "owner" ? {} : { assignments: { some: { userId: actor.id } } }) }, select: { id: true, code: true, name: true, timezone: true, attendanceLateGraceMinutes: true, attendanceEarlyLeaveGraceMinutes: true } });
  if (!outlet) throw new Error("FORBIDDEN");
  return outlet;
}

function serializeRosterEntry(entry: { id: string; workDate: Date; timezone: string; shiftName: string; positionName: string; scheduledStartAt: Date; scheduledEndAt: Date; lateGraceMinutes: number; earlyLeaveGraceMinutes: number; outlet: { id?: string; code: string; name: string }; session: { status: "OPEN" | "CLOSED"; checkInAt: Date; checkOutAt: Date | null; corrections: Array<{ correctedCheckInAt: Date | null; correctedCheckOutAt: Date | null }> } | null }, now: Date) {
  const checkInAt = entry.session ? effective(entry.session, "in") ?? entry.session.checkInAt : null;
  const checkOutAt = entry.session ? effective(entry.session, "out") ?? entry.session.checkOutAt : null;
  const display = attendanceDisplay({ now, scheduledStartAt: entry.scheduledStartAt, scheduledEndAt: entry.scheduledEndAt, lateGraceMinutes: entry.lateGraceMinutes, earlyLeaveGraceMinutes: entry.earlyLeaveGraceMinutes, checkInAt, checkOutAt, sessionOpen: entry.session?.status === "OPEN" });
  return { id: entry.id, workDate: entry.workDate.toISOString().slice(0, 10), outlet: entry.outlet, timezone: entry.timezone, positionName: entry.positionName, shiftName: entry.shiftName, scheduledStartAt: entry.scheduledStartAt.toISOString(), scheduledEndAt: entry.scheduledEndAt.toISOString(), checkInAt: checkInAt?.toISOString() ?? null, checkOutAt: checkOutAt?.toISOString() ?? null, ...display };
}

function effective(session: { corrections: Array<{ correctedCheckInAt: Date | null; correctedCheckOutAt: Date | null }> }, kind: "in" | "out") { const correction = session.corrections[0]; return kind === "in" ? correction?.correctedCheckInAt : correction?.correctedCheckOutAt; }
function date(value: string) { return new Date(`${value}T00:00:00.000Z`); }
function minuteLabel(value: number) { return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`; }
function dateAt(value: Date, timezone: string) { const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value); const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value; return `${get("year")}-${get("month")}-${get("day")}`; }
