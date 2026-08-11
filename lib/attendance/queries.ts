import "server-only";

import { AttendanceExceptionStatus, OutletStatus, Prisma } from "@/generated/prisma/client";
import type { AttendanceActor } from "@/lib/attendance/types";
import { getPublishedRosterForUser } from "@/lib/attendance/roster-queries";
import { attendanceDisplay, attendanceStatusLabels } from "@/lib/attendance/roster";
import { prisma } from "@/lib/prisma";

const attendancePageSize = 20;

/** Loads the signed-in employee's profile, available outlets, open state, and recent records. */
export async function getAttendanceHome(userId: string, role: AttendanceActor["role"]) {
  const [profile, pendingReenrollment, outlets, openSession, recentSessions, roster] = await Promise.all([
    prisma.faceProfile.findUnique({ where: { activeUserKey: userId }, select: { id: true, enrolledAt: true, modelVersion: true } }),
    prisma.faceReenrollmentRequest.findUnique({ where: { pendingUserKey: userId }, select: { id: true, requestedAt: true } }),
    prisma.outlet.findMany({
      where: { status: OutletStatus.ACTIVE, ...(role === "owner" ? {} : { assignments: { some: { userId } } }) },
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true, timezone: true, attendanceEnabled: true, attendanceLatitude: true, attendanceLongitude: true, attendanceRadiusMeters: true },
    }),
    prisma.attendanceSession.findUnique({ where: { openUserKey: userId }, include: { outlet: { select: { id: true, code: true, name: true, timezone: true } } } }),
    prisma.attendanceSession.findMany({
      where: { userId },
      orderBy: { checkInAt: "desc" },
      take: 10,
      include: { outlet: { select: { code: true, name: true, timezone: true } }, checkInAttempt: { select: { id: true, similarity: true, evidencePath: true, evidenceExpiresAt: true, evidenceDeletedAt: true } }, checkOutAttempt: { select: { id: true, similarity: true, evidencePath: true, evidenceExpiresAt: true, evidenceDeletedAt: true } }, corrections: { orderBy: { createdAt: "desc" }, take: 1 } },
    }),
    getPublishedRosterForUser(userId),
  ]);
  return {
    profile: profile ? { ...profile, enrolledAt: profile.enrolledAt.toISOString() } : null,
    pendingReenrollment: pendingReenrollment ? { id: pendingReenrollment.id, requestedAt: pendingReenrollment.requestedAt.toISOString() } : null,
    outlets: outlets.map((outlet) => ({ ...outlet, attendanceLatitude: outlet.attendanceLatitude?.toNumber() ?? null, attendanceLongitude: outlet.attendanceLongitude?.toNumber() ?? null })),
    openSession: openSession ? { id: openSession.id, outlet: openSession.outlet, checkInAt: openSession.checkInAt.toISOString() } : null,
    recentSessions: recentSessions.map((session) => serializeAttendanceSession(session)),
    roster,
  };
}

/** Loads active-outlet exception queue and paginated attendance records in manager scope. */
export async function getAttendanceManagement(outletId: string, actor: AttendanceActor, page = 1) {
  await assertManagementOutlet(outletId, actor);
  const where: Prisma.AttendanceSessionWhereInput = { outletId };
  const [pending, totalItems, staffProfiles] = await Promise.all([
    prisma.attendanceExceptionRequest.findMany({
      where: { status: AttendanceExceptionStatus.PENDING, verification: { outletId } },
      orderBy: { requestedAt: "asc" },
      include: { user: { select: { id: true, name: true, email: true } }, verification: { select: { kind: true } }, attempt: { select: { id: true, attemptedAt: true, failureReason: true, similarity: true, evidencePath: true, evidenceExpiresAt: true, evidenceDeletedAt: true } } },
    }),
    prisma.attendanceSession.count({ where }),
    prisma.userOutletAssignment.findMany({
      where: { outletId },
      orderBy: { user: { name: "asc" } },
      select: { user: { select: { id: true, name: true, email: true, banned: true, faceProfiles: { where: { activeUserKey: { not: null } }, select: { id: true, enrolledAt: true }, take: 1 }, faceReenrollmentRequests: { where: { pendingUserKey: { not: null } }, select: { id: true, requestedAt: true }, take: 1 } } } },
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalItems / attendancePageSize));
  const currentPage = Math.min(Math.max(page, 1), totalPages);
  const sessions = await prisma.attendanceSession.findMany({
    where,
    orderBy: { checkInAt: "desc" },
    skip: (currentPage - 1) * attendancePageSize,
    take: attendancePageSize,
    include: { user: { select: { id: true, name: true, email: true } }, outlet: { select: { code: true, name: true, timezone: true } }, checkInAttempt: { select: { id: true, similarity: true, evidencePath: true, evidenceExpiresAt: true, evidenceDeletedAt: true } }, checkOutAttempt: { select: { id: true, similarity: true, evidencePath: true, evidenceExpiresAt: true, evidenceDeletedAt: true } }, corrections: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  return {
    pending: pending.map((request) => ({ ...request, requestedAt: request.requestedAt.toISOString(), attempt: { id: request.attempt.id, attemptedAt: request.attempt.attemptedAt.toISOString(), failureReason: request.attempt.failureReason, similarity: request.attempt.similarity?.toString() ?? null, evidenceAvailable: isAttendanceEvidenceAvailable(request.attempt) } })),
    staffProfiles: staffProfiles.map(({ user }) => ({ id: user.id, name: user.name, email: user.email, banned: user.banned, profile: user.faceProfiles[0] ? { ...user.faceProfiles[0], enrolledAt: user.faceProfiles[0].enrolledAt.toISOString() } : null, reenrollmentRequest: user.faceReenrollmentRequests[0] ? { id: user.faceReenrollmentRequests[0].id, requestedAt: user.faceReenrollmentRequests[0].requestedAt.toISOString() } : null })),
    sessions: sessions.map(serializeAttendanceSession),
    page: currentPage,
    pageSize: attendancePageSize,
    totalItems,
    totalPages,
  };
}

/** Loads fresh geofence settings for an active outlet in manager scope. */
export async function getAttendanceSettings(outletId: string, actor: AttendanceActor) {
  const outlet = await prisma.outlet.findFirst({
    where: { id: outletId, status: OutletStatus.ACTIVE, ...(actor.role === "owner" ? {} : { assignments: { some: { userId: actor.id } } }) },
    select: { id: true, code: true, name: true, addressLine: true, cityName: true, attendanceEnabled: true, attendanceLatitude: true, attendanceLongitude: true, attendanceRadiusMeters: true, attendanceLateGraceMinutes: true, attendanceEarlyLeaveGraceMinutes: true },
  });
  if (!outlet) return null;
  return { ...outlet, attendanceLatitude: outlet.attendanceLatitude?.toNumber() ?? null, attendanceLongitude: outlet.attendanceLongitude?.toNumber() ?? null };
}

/** Authorizes private evidence for its owner or a manager assigned to the attempt outlet. */
export async function getAttendanceEvidencePath(attemptId: string, actor: AttendanceActor) {
  const attempt = await prisma.attendanceAttempt.findFirst({
    where: {
      id: attemptId,
      evidencePath: { not: null },
      evidenceExpiresAt: { gt: new Date() },
      evidenceDeletedAt: null,
      OR: [
        { userId: actor.id },
        ...(actor.role === "owner" ? [{}] : actor.role === "manager" ? [{ outlet: { assignments: { some: { userId: actor.id } } } }] : []),
      ],
    },
    select: { evidencePath: true },
  });
  return attempt?.evidencePath ?? null;
}

/** Returns attendance rows for a bounded, authorized CSV export. */
export async function getAttendanceExportRows(outletId: string, from: Date, to: Date, actor: AttendanceActor, limit = 10_001) {
  await assertManagementOutlet(outletId, actor);
  const [rosterEntries, unscheduled] = await Promise.all([
    prisma.attendanceRosterEntry.findMany({ where: { outletId, workDate: { gte: from, lte: to }, rosterWeek: { status: "PUBLISHED" } }, orderBy: { workDate: "asc" }, take: limit, include: { user: { select: { name: true, email: true } }, outlet: { select: { code: true, name: true } }, session: { include: { corrections: { orderBy: { createdAt: "desc" }, take: 1 } } } } }),
    prisma.attendanceSession.findMany({ where: { outletId, businessDate: { gte: from, lte: to }, scheduleMatch: "UNSCHEDULED" }, orderBy: { businessDate: "asc" }, take: limit, include: { user: { select: { name: true, email: true, jobPosition: { select: { name: true } } } }, outlet: { select: { code: true, name: true } }, corrections: { orderBy: { createdAt: "desc" }, take: 1 } } }),
  ]);
  const now = new Date();
  const scheduledRows = rosterEntries.map((entry) => {
    const correction = entry.session?.corrections[0];
    const checkInAt = correction?.correctedCheckInAt ?? entry.session?.checkInAt ?? null;
    const checkOutAt = correction?.correctedCheckOutAt ?? entry.session?.checkOutAt ?? null;
    const display = attendanceDisplay({ now, scheduledStartAt: entry.scheduledStartAt, scheduledEndAt: entry.scheduledEndAt, lateGraceMinutes: entry.lateGraceMinutes, earlyLeaveGraceMinutes: entry.earlyLeaveGraceMinutes, checkInAt, checkOutAt, sessionOpen: entry.session?.status === "OPEN" });
    return { businessDate: entry.workDate, outlet: entry.outlet, user: entry.user, positionName: entry.positionName, scheduledStartAt: entry.scheduledStartAt, scheduledEndAt: entry.scheduledEndAt, checkInAt, checkOutAt, status: attendanceStatusLabels[display.status], lateMinutes: display.lateMinutes, earlyLeaveMinutes: display.earlyLeaveMinutes, totalMinutes: display.totalMinutes, correctionReason: correction?.reason ?? "" };
  });
  const unscheduledRows = unscheduled.map((session) => { const correction = session.corrections[0]; const checkInAt = correction?.correctedCheckInAt ?? session.checkInAt; const checkOutAt = correction?.correctedCheckOutAt ?? session.checkOutAt; return { businessDate: session.businessDate, outlet: session.outlet, user: session.user, positionName: session.user.jobPosition?.name ?? "", scheduledStartAt: null, scheduledEndAt: null, checkInAt, checkOutAt, status: attendanceStatusLabels.UNSCHEDULED, lateMinutes: 0, earlyLeaveMinutes: 0, totalMinutes: checkOutAt ? Math.max(0, Math.floor((checkOutAt.getTime() - checkInAt.getTime()) / 60_000)) : 0, correctionReason: correction?.reason ?? "" }; });
  return [...scheduledRows, ...unscheduledRows].sort((left, right) => left.businessDate.getTime() - right.businessDate.getTime()).slice(0, limit);
}

async function assertManagementOutlet(outletId: string, actor: AttendanceActor) {
  if (actor.role !== "owner" && actor.role !== "manager") throw new Error("FORBIDDEN");
  const outlet = await prisma.outlet.findFirst({ where: { id: outletId, ...(actor.role === "owner" ? {} : { assignments: { some: { userId: actor.id } } }) }, select: { id: true } });
  if (!outlet) throw new Error("FORBIDDEN");
}

function serializeAttendanceSession(session: {
  id: string;
  userId: string;
  outletId: string;
  businessDate: Date;
  status: "OPEN" | "CLOSED";
  checkInAt: Date;
  checkOutAt: Date | null;
  user?: { id?: string; name: string; email: string };
  outlet: { code: string; name: string; timezone: string };
  checkInAttempt: AttendanceEvidenceAttempt;
  checkOutAttempt: AttendanceEvidenceAttempt | null;
  corrections: Array<{ id: string; correctedCheckInAt: Date | null; correctedCheckOutAt: Date | null; reason: string; actorName: string; createdAt: Date }>;
}) {
  const correction = session.corrections[0];
  return {
    id: session.id,
    userId: session.userId,
    user: session.user,
    outletId: session.outletId,
    outlet: session.outlet,
    businessDate: session.businessDate.toISOString().slice(0, 10),
    status: session.status,
    originalCheckInAt: session.checkInAt.toISOString(),
    originalCheckOutAt: session.checkOutAt?.toISOString() ?? null,
    checkInAt: (correction?.correctedCheckInAt ?? session.checkInAt).toISOString(),
    checkOutAt: (correction?.correctedCheckOutAt ?? session.checkOutAt)?.toISOString() ?? null,
    checkInEvidence: serializeAttendanceEvidence(session.checkInAttempt),
    checkOutEvidence: serializeAttendanceEvidence(session.checkOutAttempt),
    correction: correction ? { ...correction, correctedCheckInAt: correction.correctedCheckInAt?.toISOString() ?? null, correctedCheckOutAt: correction.correctedCheckOutAt?.toISOString() ?? null, createdAt: correction.createdAt.toISOString() } : null,
  };
}

type AttendanceEvidenceAttempt = { id: string; similarity: Prisma.Decimal | null; evidencePath: string | null; evidenceExpiresAt: Date | null; evidenceDeletedAt: Date | null };

/** Returns whether a private attendance photo is still present and within retention. */
function isAttendanceEvidenceAvailable(attempt: Omit<AttendanceEvidenceAttempt, "id">) {
  return Boolean(attempt.evidencePath && !attempt.evidenceDeletedAt && attempt.evidenceExpiresAt && attempt.evidenceExpiresAt.getTime() > Date.now());
}

/** Serializes evidence metadata without exposing its private Blob pathname. */
function serializeAttendanceEvidence(attempt: AttendanceEvidenceAttempt | null) {
  return attempt ? { attemptId: attempt.id, available: isAttendanceEvidenceAvailable(attempt), similarity: attempt.similarity?.toString() ?? null } : null;
}
