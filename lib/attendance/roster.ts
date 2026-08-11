export const attendanceEarlyCheckInMinutes = 120;

export type AttendanceDisplayStatus = "SCHEDULED" | "NOT_CLOCKED_IN" | "ON_TIME" | "LATE" | "EARLY_LEAVE" | "LATE_EARLY" | "MISSED_CHECKOUT" | "ABSENT" | "UNSCHEDULED";

/** Returns the ISO Monday for the week containing an ISO date; it has no side effects. */
export function mondayOf(dateValue: string) {
  const date = isoDate(dateValue);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return date.toISOString().slice(0, 10);
}

/** Adds whole calendar days to an ISO date without using the browser timezone. */
export function addIsoDays(dateValue: string, days: number) { const date = isoDate(dateValue); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); }

/** Converts an outlet-local date and minute-of-day to a UTC instant. */
export function outletLocalToUtc(dateValue: string, minuteOfDay: number, timezone: string) {
  const hour = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;
  const [year, month, day] = dateValue.split("-").map(Number);
  let candidate = Date.UTC(year, month - 1, day, hour, minute);
  for (let iteration = 0; iteration < 2; iteration += 1) {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(candidate));
    const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
    const represented = Date.UTC(value("year"), value("month") - 1, value("day"), value("hour"), value("minute"));
    candidate += Date.UTC(year, month - 1, day, hour, minute) - represented;
  }
  return new Date(candidate);
}

/** Builds stable UTC start/end timestamps, advancing the end date for overnight shifts. */
export function scheduledRange(workDate: string, startMinute: number, endMinute: number, timezone: string) {
  const scheduledStartAt = outletLocalToUtc(workDate, startMinute, timezone);
  const endDate = endMinute <= startMinute ? addIsoDays(workDate, 1) : workDate;
  return { scheduledStartAt, scheduledEndAt: outletLocalToUtc(endDate, endMinute, timezone) };
}

/** Derives one human-readable attendance status from roster and effective session times. */
export function attendanceDisplay(input: { now: Date; scheduledStartAt?: Date | null; scheduledEndAt?: Date | null; lateGraceMinutes?: number; earlyLeaveGraceMinutes?: number; checkInAt?: Date | null; checkOutAt?: Date | null; sessionOpen?: boolean; unscheduled?: boolean }) {
  if (input.unscheduled || !input.scheduledStartAt || !input.scheduledEndAt) return { status: "UNSCHEDULED" as const, lateMinutes: 0, earlyLeaveMinutes: 0, totalMinutes: duration(input.checkInAt, input.checkOutAt) };
  if (!input.checkInAt) {
    const status: AttendanceDisplayStatus = input.now < input.scheduledStartAt ? "SCHEDULED" : input.now <= input.scheduledEndAt ? "NOT_CLOCKED_IN" : "ABSENT";
    return { status, lateMinutes: 0, earlyLeaveMinutes: 0, totalMinutes: 0 };
  }
  const lateMinutes = Math.max(0, Math.floor((input.checkInAt.getTime() - input.scheduledStartAt.getTime()) / 60_000));
  const earlyLeaveMinutes = input.checkOutAt ? Math.max(0, Math.floor((input.scheduledEndAt.getTime() - input.checkOutAt.getTime()) / 60_000)) : 0;
  if (input.sessionOpen && input.now > input.scheduledEndAt) return { status: "MISSED_CHECKOUT" as const, lateMinutes, earlyLeaveMinutes: 0, totalMinutes: 0 };
  const late = lateMinutes > (input.lateGraceMinutes ?? 15);
  const early = Boolean(input.checkOutAt) && earlyLeaveMinutes > (input.earlyLeaveGraceMinutes ?? 15);
  const status: AttendanceDisplayStatus = late && early ? "LATE_EARLY" : late ? "LATE" : early ? "EARLY_LEAVE" : "ON_TIME";
  return { status, lateMinutes, earlyLeaveMinutes, totalMinutes: duration(input.checkInAt, input.checkOutAt) };
}

/** Returns whether a check-in can attach to a roster entry under the fixed two-hour early window. */
export function isWithinScheduledWindow(now: Date, start: Date, end: Date) { return now.getTime() >= start.getTime() - attendanceEarlyCheckInMinutes * 60_000 && now <= end; }

function isoDate(value: string) { const date = new Date(`${value}T00:00:00.000Z`); if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error("Tanggal roster tidak valid."); return date; }
function duration(start?: Date | null, end?: Date | null) { return start && end ? Math.max(0, Math.floor((end.getTime() - start.getTime()) / 60_000)) : 0; }

export const attendanceStatusLabels: Record<AttendanceDisplayStatus, string> = { SCHEDULED: "Terjadwal", NOT_CLOCKED_IN: "Belum masuk", ON_TIME: "Tepat waktu", LATE: "Terlambat", EARLY_LEAVE: "Pulang cepat", LATE_EARLY: "Terlambat & pulang cepat", MISSED_CHECKOUT: "Belum checkout", ABSENT: "Tidak hadir", UNSCHEDULED: "Di luar jadwal" };
