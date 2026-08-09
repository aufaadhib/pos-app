import "server-only";

import { AttendanceExceptionStatus, OutletStatus, Prisma } from "@/generated/prisma/client";
import type { AttendanceActor } from "@/lib/attendance/types";
import { prisma } from "@/lib/prisma";

const attendancePageSize = 20;

/** Loads the signed-in employee's profile, assigned outlets, open state, and recent records. */
export async function getAttendanceHome(userId: string) {
  const [profile, outlets, openSession, recentSessions] = await Promise.all([
    prisma.faceProfile.findUnique({ where: { activeUserKey: userId }, select: { id: true, enrolledAt: true, modelVersion: true } }),
    prisma.outlet.findMany({
      where: { status: OutletStatus.ACTIVE, assignments: { some: { userId } } },
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true, attendanceEnabled: true, attendanceLatitude: true, attendanceLongitude: true, attendanceRadiusMeters: true },
    }),
    prisma.attendanceSession.findUnique({ where: { openUserKey: userId }, include: { outlet: { select: { id: true, code: true, name: true } } } }),
    prisma.attendanceSession.findMany({
      where: { userId },
      orderBy: { checkInAt: "desc" },
      take: 10,
      include: { outlet: { select: { code: true, name: true, timezone: true } }, corrections: { orderBy: { createdAt: "desc" }, take: 1 } },
    }),
  ]);
  return {
    profile: profile ? { ...profile, enrolledAt: profile.enrolledAt.toISOString() } : null,
    outlets: outlets.map((outlet) => ({ ...outlet, attendanceLatitude: outlet.attendanceLatitude?.toNumber() ?? null, attendanceLongitude: outlet.attendanceLongitude?.toNumber() ?? null })),
    openSession: openSession ? { id: openSession.id, outlet: openSession.outlet, checkInAt: openSession.checkInAt.toISOString() } : null,
    recentSessions: recentSessions.map((session) => serializeAttendanceSession(session)),
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
      include: { user: { select: { id: true, name: true, email: true } }, verification: { select: { kind: true } }, attempt: { select: { id: true, attemptedAt: true, failureReason: true, evidenceDeletedAt: true } } },
    }),
    prisma.attendanceSession.count({ where }),
    prisma.userOutletAssignment.findMany({
      where: { outletId },
      orderBy: { user: { name: "asc" } },
      select: { user: { select: { id: true, name: true, email: true, banned: true, faceProfiles: { where: { activeUserKey: { not: null } }, select: { id: true, enrolledAt: true }, take: 1 } } } },
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalItems / attendancePageSize));
  const currentPage = Math.min(Math.max(page, 1), totalPages);
  const sessions = await prisma.attendanceSession.findMany({
    where,
    orderBy: { checkInAt: "desc" },
    skip: (currentPage - 1) * attendancePageSize,
    take: attendancePageSize,
    include: { user: { select: { id: true, name: true, email: true } }, outlet: { select: { code: true, name: true, timezone: true } }, corrections: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  return {
    pending: pending.map((request) => ({ ...request, requestedAt: request.requestedAt.toISOString(), attempt: { ...request.attempt, attemptedAt: request.attempt.attemptedAt.toISOString(), evidenceDeletedAt: request.attempt.evidenceDeletedAt?.toISOString() ?? null } })),
    staffProfiles: staffProfiles.map(({ user }) => ({ id: user.id, name: user.name, email: user.email, banned: user.banned, profile: user.faceProfiles[0] ? { ...user.faceProfiles[0], enrolledAt: user.faceProfiles[0].enrolledAt.toISOString() } : null })),
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
    select: { id: true, code: true, name: true, addressLine: true, cityName: true, attendanceEnabled: true, attendanceLatitude: true, attendanceLongitude: true, attendanceRadiusMeters: true },
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
  return prisma.attendanceSession.findMany({
    where: { outletId, checkInAt: { gte: from, lte: to } },
    orderBy: { checkInAt: "asc" },
    take: limit,
    include: { user: { select: { name: true, email: true } }, outlet: { select: { code: true, name: true, timezone: true } }, corrections: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
}

async function assertManagementOutlet(outletId: string, actor: AttendanceActor) {
  if (actor.role === "cashier") throw new Error("FORBIDDEN");
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
    correction: correction ? { ...correction, correctedCheckInAt: correction.correctedCheckInAt?.toISOString() ?? null, correctedCheckOutAt: correction.correctedCheckOutAt?.toISOString() ?? null, createdAt: correction.createdAt.toISOString() } : null,
  };
}
