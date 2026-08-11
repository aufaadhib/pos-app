import "server-only";

import {
  AttendanceAttemptResult,
  AttendanceAuditAction,
  AttendanceExceptionStatus,
  AttendanceFailureReason,
  AttendanceKind,
  AttendanceSessionStatus,
  AttendanceVerificationStatus,
  FaceReenrollmentStatus,
  OutletStatus,
  Prisma,
} from "@/generated/prisma/client";
import {
  attendanceChallengeLabels,
  attendanceEvidenceRetentionDays,
  attendanceMaxGpsAccuracyMeters,
  attendanceSimilarityThreshold,
  attendanceVerificationMinutes,
  type AttendanceChallengeAction,
} from "@/lib/attendance/constants";
import { createAttendanceNonce, decryptEmbedding, encryptEmbedding, hashAttendanceNonce } from "@/lib/attendance/crypto";
import { deleteAttendanceEvidence, uploadAttendanceEvidence } from "@/lib/attendance/evidence";
import { averageEmbeddings, faceSimilarity, normalizeEmbedding } from "@/lib/attendance/face";
import { businessDateAt, distanceInMeters } from "@/lib/attendance/geofence";
import { addIsoDays, hasMissedCheckoutDeadlinePassed, isWithinScheduledWindow } from "@/lib/attendance/roster";
import type { AttendanceActor } from "@/lib/attendance/types";
import type {
  AttendanceChallengeInput,
  AttendanceCorrectionInput,
  AttendanceEnrollmentInput,
  AttendanceReviewInput,
  AttendanceSettingsInput,
  AttendanceVerificationInput,
} from "@/lib/attendance/validation";
import { prisma } from "@/lib/prisma";

export type AttendanceErrorCode = "FORBIDDEN" | "INVALID" | "NOT_FOUND" | "CONFLICT" | "NOT_CONFIGURED";

export class AttendanceError extends Error {
  constructor(public readonly code: AttendanceErrorCode, message: string) {
    super(message);
    this.name = "AttendanceError";
  }
}

/** Enrolls a first profile directly, while cashier/staff reenrollment waits for manager approval. */
export async function enrollFaceProfile(input: AttendanceEnrollmentInput, actor: AttendanceActor) {
  let template: number[];
  try {
    template = averageEmbeddings(input.samples);
  } catch (error) {
    throw new AttendanceError("INVALID", error instanceof Error ? error.message : "Sampel wajah tidak valid.");
  }
  let encrypted: ReturnType<typeof encryptEmbedding>;
  try {
    encrypted = encryptEmbedding(template);
  } catch {
    throw new AttendanceError("NOT_CONFIGURED", "Kunci enkripsi absensi belum valid. Periksa ATTENDANCE_EMBEDDING_KEY lalu coba kembali.");
  }
  try {
    return await prisma.$transaction(async (transaction) => {
      const pending = await transaction.faceReenrollmentRequest.findUnique({ where: { pendingUserKey: actor.id }, select: { id: true } });
      if (pending) throw new AttendanceError("CONFLICT", "Permintaan daftar ulang wajah masih menunggu persetujuan.");
      const active = await transaction.faceProfile.findUnique({ where: { activeUserKey: actor.id } });
      const consentAt = new Date();
      if (active && (actor.role === "cashier" || actor.role === "staff")) {
        const request = await transaction.faceReenrollmentRequest.create({
          data: {
            userId: actor.id,
            pendingUserKey: actor.id,
            embeddingCiphertext: encrypted.ciphertext,
            embeddingIv: encrypted.iv,
            embeddingLength: encrypted.length,
            modelVersion: input.modelVersion,
            consentAt,
          },
        });
        await writeAttendanceAudit(transaction, "FACE_REENROLLMENT", request.id, AttendanceAuditAction.REENROLL_REQUEST, actor, null, {
          userId: actor.id,
          modelVersion: request.modelVersion,
          embeddingLength: request.embeddingLength,
          requestedAt: request.requestedAt.toISOString(),
        });
        return { pendingApproval: true as const, requestId: request.id, requestedAt: request.requestedAt.toISOString() };
      }
      if (active) {
        await transaction.faceProfile.update({
          where: { id: active.id },
          data: { activeUserKey: null, embeddingCiphertext: null, embeddingIv: null, revokedAt: consentAt },
        });
      }
      const profile = await transaction.faceProfile.create({
        data: {
          userId: actor.id,
          activeUserKey: actor.id,
          embeddingCiphertext: encrypted.ciphertext,
          embeddingIv: encrypted.iv,
          embeddingLength: encrypted.length,
          modelVersion: input.modelVersion,
          consentAt,
        },
      });
      await writeAttendanceAudit(transaction, "FACE_PROFILE", profile.id, AttendanceAuditAction.ENROLL, actor, null, {
        modelVersion: profile.modelVersion,
        embeddingLength: profile.embeddingLength,
        consentAt: profile.consentAt.toISOString(),
      });
      return { pendingApproval: false as const, profileId: profile.id, enrolledAt: profile.enrolledAt.toISOString() };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof AttendanceError) throw error;
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AttendanceError("CONFLICT", "Pendaftaran wajah lain sedang diproses. Muat ulang lalu coba kembali.");
    }
    throw error;
  }
}

/** Revokes a user's active face profile and erases its encrypted biometric payload. */
export async function revokeFaceProfile(userId: string, actor: AttendanceActor) {
  assertManager(actor);
  return prisma.$transaction(async (transaction) => {
    await assertUserInActorScope(transaction, userId, actor);
    const pending = await transaction.faceReenrollmentRequest.findUnique({ where: { pendingUserKey: userId }, select: { id: true } });
    if (pending) throw new AttendanceError("CONFLICT", "Tinjau permintaan daftar ulang sebelum membatalkan profil wajah.");
    const profile = await transaction.faceProfile.findUnique({ where: { activeUserKey: userId } });
    if (!profile) throw new AttendanceError("NOT_FOUND", "Profil wajah aktif tidak ditemukan.");
    await transaction.faceProfile.update({
      where: { id: profile.id },
      data: { activeUserKey: null, embeddingCiphertext: null, embeddingIv: null, revokedAt: new Date() },
    });
    await writeAttendanceAudit(transaction, "FACE_PROFILE", profile.id, AttendanceAuditAction.REVOKE, actor, { userId }, { revoked: true });
  });
}

/** Approves or rejects one cashier/staff reenrollment request and erases its pending payload. */
export async function reviewFaceReenrollment(input: AttendanceReviewInput, actor: AttendanceActor) {
  assertManager(actor);
  return prisma.$transaction(async (transaction) => {
    const request = await transaction.faceReenrollmentRequest.findUnique({ where: { id: input.requestId } });
    if (!request || request.status !== FaceReenrollmentStatus.PENDING || !request.embeddingCiphertext || !request.embeddingIv) {
      throw new AttendanceError("NOT_FOUND", "Permintaan daftar ulang wajah tidak ditemukan atau sudah ditinjau.");
    }
    await assertUserInActorScope(transaction, request.userId, actor);
    const reviewedAt = new Date();
    let profileId: string | null = null;
    if (input.decision === FaceReenrollmentStatus.APPROVED) {
      const active = await transaction.faceProfile.findUnique({ where: { activeUserKey: request.userId } });
      if (active) {
        await transaction.faceProfile.update({
          where: { id: active.id },
          data: { activeUserKey: null, embeddingCiphertext: null, embeddingIv: null, revokedAt: reviewedAt },
        });
      }
      const profile = await transaction.faceProfile.create({
        data: {
          userId: request.userId,
          activeUserKey: request.userId,
          embeddingCiphertext: request.embeddingCiphertext,
          embeddingIv: request.embeddingIv,
          embeddingLength: request.embeddingLength,
          modelVersion: request.modelVersion,
          consentAt: request.consentAt,
        },
      });
      profileId = profile.id;
    }
    const updated = await transaction.faceReenrollmentRequest.update({
      where: { id: request.id },
      data: {
        pendingUserKey: null,
        status: input.decision,
        embeddingCiphertext: null,
        embeddingIv: null,
        reviewedByUserId: actor.id,
        reviewedByName: actor.name,
        reviewedByEmail: actor.email,
        reviewReason: input.reason,
        reviewedAt,
      },
    });
    const action = input.decision === FaceReenrollmentStatus.APPROVED ? AttendanceAuditAction.REENROLL_APPROVE : AttendanceAuditAction.REENROLL_REJECT;
    await writeAttendanceAudit(transaction, "FACE_REENROLLMENT", request.id, action, actor, { status: request.status, userId: request.userId }, { status: updated.status, profileId, reviewReason: input.reason });
    return { approved: input.decision === FaceReenrollmentStatus.APPROVED, profileId };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

/** Starts or rotates a short-lived single-use verification challenge for an available outlet. */
export async function createAttendanceChallenge(input: AttendanceChallengeInput, actor: AttendanceActor) {
  const nonce = createAttendanceNonce();
  const nonceHash = hashAttendanceNonce(nonce);
  const challengeAction = randomChallengeAction();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + attendanceVerificationMinutes * 60_000);
  const verification = await prisma.$transaction(async (transaction) => {
    const scopedOutlet = await assertClockScope(transaction, input.outletId, actor);
    let openSession = await transaction.attendanceSession.findUnique({ where: { openUserKey: actor.id }, select: { id: true, outletId: true, businessDate: true, rosterEntryId: true, scheduleMatch: true, outlet: { select: { timezone: true } }, rosterEntry: { select: { scheduledEndAt: true } } } });
    if (openSession && hasMissedCheckoutDeadlinePassed({ now, businessDate: openSession.businessDate, timezone: openSession.outlet.timezone, scheduledEndAt: openSession.rosterEntry?.scheduledEndAt })) {
      await transaction.attendanceSession.update({ where: { id: openSession.id }, data: { status: AttendanceSessionStatus.CLOSED, openUserKey: null } });
      await writeAttendanceAudit(transaction, "ATTENDANCE_SESSION", openSession.id, AttendanceAuditAction.MISSED_CHECKOUT, actor, { status: AttendanceSessionStatus.OPEN, checkOutAt: null }, { status: AttendanceSessionStatus.CLOSED, checkOutAt: null, reason: "Tanggal absensi berikutnya dimulai tanpa absen pulang." });
      openSession = null;
    }
    if (input.kind === AttendanceKind.CHECK_IN && openSession) throw new AttendanceError("CONFLICT", "Anda masih memiliki absensi masuk yang belum ditutup.");
    if (input.kind === AttendanceKind.CHECK_OUT && !openSession) throw new AttendanceError("CONFLICT", "Belum ada absensi masuk yang dapat ditutup.");
    if (input.kind === AttendanceKind.CHECK_OUT && openSession?.outletId !== input.outletId) throw new AttendanceError("CONFLICT", "Absensi pulang harus dilakukan pada outlet tempat Anda masuk.");
    const schedule = input.kind === AttendanceKind.CHECK_IN
      ? await resolveCheckInSchedule(transaction, actor.id, input.outletId, scopedOutlet.timezone, now, input.unscheduledAcknowledged)
      : { rosterEntryId: openSession?.rosterEntryId ?? null, scheduleMatch: openSession?.scheduleMatch ?? null };
    const current = await transaction.attendanceVerification.findFirst({
      where: { userId: actor.id, outletId: input.outletId, kind: input.kind, status: AttendanceVerificationStatus.ACTIVE, expiresAt: { gt: now } },
      orderBy: { createdAt: "desc" },
    });
    if (current) {
      return transaction.attendanceVerification.update({ where: { id: current.id }, data: { nonceHash, challengeAction, ...schedule } });
    }
    return transaction.attendanceVerification.create({
      data: { userId: actor.id, outletId: input.outletId, kind: input.kind, nonceHash, challengeAction, expiresAt, ...schedule },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  return {
    verificationId: verification.id,
    nonce,
    action: verification.challengeAction as AttendanceChallengeAction,
    actionLabel: attendanceChallengeLabels[verification.challengeAction as AttendanceChallengeAction],
    expiresAt: verification.expiresAt.toISOString(),
    attemptCount: verification.attemptCount,
    scheduleMatch: verification.scheduleMatch,
  };
}

/** Verifies nonce, identity, liveness, and geofence, then atomically clocks in or out. */
export async function verifyAttendance(
  input: AttendanceVerificationInput,
  evidence: File,
  actor: AttendanceActor,
) {
  const existing = await prisma.attendanceAttempt.findUnique({ where: { idempotencyKey: input.idempotencyKey }, select: { id: true, result: true } });
  if (existing) return { success: existing.result === AttendanceAttemptResult.SUCCESS, replayed: true };

  const evidencePath = await uploadAttendanceEvidence(evidence, actor.id);
  try {
    return await prisma.$transaction(async (transaction) => {
      const verification = await transaction.attendanceVerification.findFirst({
        where: { id: input.verificationId, userId: actor.id },
        include: {
          outlet: { select: { id: true, name: true, timezone: true, status: true, attendanceEnabled: true, attendanceLatitude: true, attendanceLongitude: true, attendanceRadiusMeters: true, assignments: { where: { userId: actor.id }, select: { userId: true } } } },
        },
      });
      if (!verification) throw new AttendanceError("NOT_FOUND", "Sesi verifikasi tidak ditemukan.");
      const now = new Date();
      if (verification.status !== AttendanceVerificationStatus.ACTIVE || verification.expiresAt <= now || verification.nonceHash !== hashAttendanceNonce(input.nonce)) {
        throw new AttendanceError("CONFLICT", "Challenge sudah digunakan atau kedaluwarsa. Muat challenge baru.");
      }
      const evaluation = await evaluateAttendanceAttempt(transaction, verification, input, actor);
      const failure = evaluation.failure;
      const attemptCount = Math.min(3, verification.attemptCount + (failure ? 1 : 0));
      const attempt = await transaction.attendanceAttempt.create({
        data: {
          verificationId: verification.id,
          userId: actor.id,
          outletId: verification.outletId,
          kind: verification.kind,
          result: failure ? AttendanceAttemptResult.FAILED : AttendanceAttemptResult.SUCCESS,
          failureReason: failure?.reason,
          similarity: evaluation.similarity ?? null,
          livenessPassed: input.livenessPassed,
          latitude: input.location.latitude,
          longitude: input.location.longitude,
          accuracyMeters: input.location.accuracyMeters,
          distanceMeters: evaluation.distance ?? calculateDistance(verification.outlet, input),
          evidencePath,
          evidenceExpiresAt: new Date(now.getTime() + attendanceEvidenceRetentionDays * 86_400_000),
          idempotencyKey: input.idempotencyKey,
        },
      });
      if (failure) {
        const status = attemptCount >= 3 ? AttendanceVerificationStatus.EXCEPTION_AVAILABLE : AttendanceVerificationStatus.ACTIVE;
        await transaction.attendanceVerification.update({
          where: { id: verification.id },
          data: { attemptCount, status, nonceHash: hashAttendanceNonce(createAttendanceNonce()), completedAt: status === AttendanceVerificationStatus.EXCEPTION_AVAILABLE ? now : null },
        });
        return { success: false, replayed: false, attemptCount, exceptionAvailable: attemptCount >= 3, message: failure.message };
      }
      const attendanceSession = await applyAttendanceEvent(transaction, verification.kind, actor.id, verification.outlet, attempt.id, now, verification.rosterEntryId, verification.scheduleMatch);
      await transaction.attendanceVerification.update({ where: { id: verification.id }, data: { status: AttendanceVerificationStatus.VERIFIED, completedAt: now, nonceHash: hashAttendanceNonce(createAttendanceNonce()) } });
      await writeAttendanceAudit(transaction, "ATTENDANCE_SESSION", attendanceSession.id, verification.kind === AttendanceKind.CHECK_IN ? AttendanceAuditAction.CHECK_IN : AttendanceAuditAction.CHECK_OUT, actor, null, { attemptId: attempt.id, at: now.toISOString() });
      return { success: true, replayed: false, attendanceSessionId: attendanceSession.id, kind: verification.kind };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    await deleteEvidenceBestEffort(evidencePath);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const replay = await prisma.attendanceAttempt.findUnique({ where: { idempotencyKey: input.idempotencyKey }, select: { result: true } });
      if (replay) return { success: replay.result === AttendanceAttemptResult.SUCCESS, replayed: true };
      throw new AttendanceError("CONFLICT", "Absensi bersamaan terdeteksi. Muat ulang status.");
    }
    throw error;
  }
}

/** Creates one auditable exception request after the third failure in a verification session. */
export async function requestAttendanceException(verificationId: string, reason: string, actor: AttendanceActor) {
  return prisma.$transaction(async (transaction) => {
    const verification = await transaction.attendanceVerification.findFirst({
      where: { id: verificationId, userId: actor.id, status: AttendanceVerificationStatus.EXCEPTION_AVAILABLE, attemptCount: { gte: 3 } },
      include: { attempts: { orderBy: { attemptedAt: "desc" }, take: 1 } },
    });
    const attempt = verification?.attempts[0];
    if (!verification || !attempt) throw new AttendanceError("FORBIDDEN", "Pengecualian belum tersedia untuk sesi ini.");
    const request = await transaction.attendanceExceptionRequest.create({
      data: { verificationId, attemptId: attempt.id, userId: actor.id, reason },
    });
    await writeAttendanceAudit(transaction, "EXCEPTION", request.id, AttendanceAuditAction.EXCEPTION_REQUEST, actor, null, { verificationId, reason });
    return request;
  });
}

/** Approves or rejects an exception in actor scope and never permits self-approval. */
export async function reviewAttendanceException(input: AttendanceReviewInput, actor: AttendanceActor) {
  assertManager(actor);
  return prisma.$transaction(async (transaction) => {
    const request = await transaction.attendanceExceptionRequest.findUnique({
      where: { id: input.requestId },
      include: { verification: { include: { outlet: true } }, attempt: true },
    });
    if (!request || request.status !== AttendanceExceptionStatus.PENDING) throw new AttendanceError("NOT_FOUND", "Permintaan pending tidak ditemukan.");
    if (request.userId === actor.id) throw new AttendanceError("FORBIDDEN", "Anda tidak dapat meninjau pengecualian sendiri.");
    await assertOutletInActorScope(transaction, request.verification.outletId, actor);
    let createdSessionId: string | null = null;
    if (input.decision === AttendanceExceptionStatus.APPROVED) {
      const session = await applyAttendanceEvent(transaction, request.verification.kind, request.userId, request.verification.outlet, request.attemptId, request.attempt.attemptedAt, request.verification.rosterEntryId, request.verification.scheduleMatch);
      createdSessionId = session.id;
    }
    const updated = await transaction.attendanceExceptionRequest.update({
      where: { id: request.id },
      data: { status: input.decision, reviewReason: input.reason, reviewedAt: new Date(), reviewedByUserId: actor.id, reviewedByName: actor.name, reviewedByEmail: actor.email, createdSessionId },
    });
    await writeAttendanceAudit(transaction, "EXCEPTION", request.id, input.decision === AttendanceExceptionStatus.APPROVED ? AttendanceAuditAction.EXCEPTION_APPROVE : AttendanceAuditAction.EXCEPTION_REJECT, actor, { status: request.status }, { status: updated.status, reviewReason: input.reason, createdSessionId });
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

/** Appends corrected timestamps without overwriting the original attendance session. */
export async function correctAttendanceSession(input: AttendanceCorrectionInput, actor: AttendanceActor) {
  assertManager(actor);
  return prisma.$transaction(async (transaction) => {
    const session = await transaction.attendanceSession.findUnique({ where: { id: input.sessionId } });
    if (!session) throw new AttendanceError("NOT_FOUND", "Catatan absensi tidak ditemukan.");
    await assertOutletInActorScope(transaction, session.outletId, actor);
    const previous = await transaction.attendanceCorrection.findFirst({ where: { attendanceSessionId: session.id }, orderBy: { createdAt: "desc" } });
    const correctedCheckInAt = input.correctedCheckInAt ? new Date(input.correctedCheckInAt) : previous?.correctedCheckInAt ?? session.checkInAt;
    const correctedCheckOutAt = input.correctedCheckOutAt ? new Date(input.correctedCheckOutAt) : previous?.correctedCheckOutAt ?? session.checkOutAt;
    if (correctedCheckOutAt && correctedCheckOutAt < correctedCheckInAt) throw new AttendanceError("INVALID", "Waktu pulang tidak boleh sebelum waktu masuk efektif.");
    const correction = await transaction.attendanceCorrection.create({
      data: { attendanceSessionId: session.id, correctedCheckInAt, correctedCheckOutAt, reason: input.reason, actorUserId: actor.id, actorName: actor.name, actorEmail: actor.email },
    });
    await writeAttendanceAudit(transaction, "ATTENDANCE_SESSION", session.id, AttendanceAuditAction.CORRECT, actor, { checkInAt: session.checkInAt.toISOString(), checkOutAt: session.checkOutAt?.toISOString() ?? null }, { correctedCheckInAt: correctedCheckInAt?.toISOString() ?? null, correctedCheckOutAt: correctedCheckOutAt?.toISOString() ?? null, reason: input.reason });
    return correction;
  });
}

/** Updates the assigned active outlet geofence and records before/after values atomically. */
export async function updateAttendanceSettings(input: AttendanceSettingsInput, actor: AttendanceActor) {
  assertManager(actor);
  return prisma.$transaction(async (transaction) => {
    const outlet = await transaction.outlet.findFirst({
      where: { id: input.outletId, status: OutletStatus.ACTIVE, ...(actor.role === "owner" ? {} : { assignments: { some: { userId: actor.id } } }) },
      select: { id: true, attendanceEnabled: true, attendanceLatitude: true, attendanceLongitude: true, attendanceRadiusMeters: true, attendanceLateGraceMinutes: true, attendanceEarlyLeaveGraceMinutes: true },
    });
    if (!outlet) throw new AttendanceError("FORBIDDEN", "Outlet tidak tersedia untuk akun Anda.");
    await transaction.outlet.update({ where: { id: outlet.id }, data: { attendanceEnabled: input.attendanceEnabled, attendanceLatitude: input.latitude, attendanceLongitude: input.longitude, attendanceRadiusMeters: input.radiusMeters, attendanceLateGraceMinutes: input.lateGraceMinutes, attendanceEarlyLeaveGraceMinutes: input.earlyLeaveGraceMinutes } });
    await writeAttendanceAudit(transaction, "OUTLET", outlet.id, AttendanceAuditAction.SETTINGS_UPDATE, actor, attendanceSettingsSnapshot(outlet), { attendanceEnabled: input.attendanceEnabled, latitude: input.latitude, longitude: input.longitude, radiusMeters: input.radiusMeters, lateGraceMinutes: input.lateGraceMinutes, earlyLeaveGraceMinutes: input.earlyLeaveGraceMinutes });
  });
}

/** Removes expired private photos in small batches and marks each successful deletion. */
export async function cleanupExpiredAttendanceEvidence(limit = 100) {
  const attempts = await prisma.attendanceAttempt.findMany({
    where: { evidencePath: { not: null }, evidenceExpiresAt: { lte: new Date() }, evidenceDeletedAt: null },
    orderBy: { evidenceExpiresAt: "asc" },
    take: Math.min(Math.max(limit, 1), 500),
    select: { id: true, evidencePath: true },
  });
  let deleted = 0;
  for (const attempt of attempts) {
    if (!attempt.evidencePath) continue;
    try {
      await deleteAttendanceEvidence(attempt.evidencePath);
      await prisma.$transaction([
        prisma.attendanceAttempt.update({ where: { id: attempt.id }, data: { evidenceDeletedAt: new Date() } }),
        prisma.attendanceAuditLog.create({ data: { entityType: "ATTEMPT", entityId: attempt.id, action: AttendanceAuditAction.EVIDENCE_DELETE, actorUserId: "system", actorEmail: "cron@glutong.local", after: { evidencePath: attempt.evidencePath } } }),
      ]);
      deleted += 1;
    } catch (error) {
      console.warn("Attendance evidence cleanup failed", { attemptId: attempt.id, error });
    }
  }
  return { scanned: attempts.length, deleted };
}

/** Evaluates one attempt and retains successful face/location metrics for device calibration. */
async function evaluateAttendanceAttempt(
  transaction: Prisma.TransactionClient,
  verification: VerificationWithOutlet,
  input: AttendanceVerificationInput,
  actor: AttendanceActor,
): Promise<{ failure: { reason: AttendanceFailureReason; message: string } | null; similarity?: number; distance?: number }> {
  const outlet = verification.outlet;
  if (outlet.status !== OutletStatus.ACTIVE || (actor.role !== "owner" && outlet.assignments.length === 0)) return { failure: { reason: AttendanceFailureReason.CONFIGURATION_MISSING, message: "Outlet tidak tersedia untuk akun Anda." } };
  if (!outlet.attendanceEnabled || outlet.attendanceLatitude === null || outlet.attendanceLongitude === null) return { failure: { reason: AttendanceFailureReason.CONFIGURATION_MISSING, message: "Absensi outlet belum dikonfigurasi." } };
  if (input.location.accuracyMeters > attendanceMaxGpsAccuracyMeters) return { failure: { reason: AttendanceFailureReason.LOCATION_INACCURATE, message: "Akurasi lokasi harus 100 meter atau lebih baik." } };
  const distance = calculateDistance(outlet, input);
  if (distance > outlet.attendanceRadiusMeters) return { failure: { reason: AttendanceFailureReason.LOCATION_OUTSIDE, message: `Lokasi berada ${Math.round(distance)} meter dari outlet.` }, distance };
  if (!input.livenessPassed) return { failure: { reason: AttendanceFailureReason.LIVENESS_FAILED, message: "Gerakan liveness belum terdeteksi." }, distance };
  const profile = await transaction.faceProfile.findUnique({ where: { activeUserKey: actor.id } });
  if (!profile?.embeddingCiphertext || !profile.embeddingIv) return { failure: { reason: AttendanceFailureReason.FACE_PROFILE_MISSING, message: "Daftarkan wajah terlebih dahulu." }, distance };
  let similarity: number;
  try {
    similarity = faceSimilarity(normalizeEmbedding(input.embedding), decryptEmbedding(profile.embeddingCiphertext, profile.embeddingIv, profile.embeddingLength));
  } catch {
    return { failure: { reason: AttendanceFailureReason.FACE_INVALID, message: "Template wajah tidak dapat dibandingkan." }, distance };
  }
  if (similarity < attendanceSimilarityThreshold) return { failure: { reason: AttendanceFailureReason.FACE_MISMATCH, message: "Wajah tidak cocok dengan akun yang sedang login." }, similarity, distance };
  const open = await transaction.attendanceSession.findUnique({ where: { openUserKey: actor.id }, select: { outletId: true } });
  if (verification.kind === AttendanceKind.CHECK_IN && open) return { failure: { reason: AttendanceFailureReason.ALREADY_CHECKED_IN, message: "Anda sudah memiliki absensi masuk aktif." }, similarity, distance };
  if (verification.kind === AttendanceKind.CHECK_OUT && !open) return { failure: { reason: AttendanceFailureReason.SESSION_MISSING, message: "Absensi masuk aktif tidak ditemukan." }, similarity, distance };
  if (verification.kind === AttendanceKind.CHECK_OUT && open?.outletId !== verification.outletId) return { failure: { reason: AttendanceFailureReason.OUTLET_MISMATCH, message: "Absensi pulang harus dilakukan pada outlet tempat Anda masuk." }, similarity, distance };
  return { failure: null, similarity, distance };
}

type VerificationWithOutlet = {
  id: string;
  userId: string;
  outletId: string;
  kind: AttendanceKind;
  outlet: {
    id: string;
    name: string;
    timezone: string;
    status: OutletStatus;
    attendanceEnabled: boolean;
    attendanceLatitude: Prisma.Decimal | null;
    attendanceLongitude: Prisma.Decimal | null;
    attendanceRadiusMeters: number;
    assignments: Array<{ userId: string }>;
  };
};

async function applyAttendanceEvent(transaction: Prisma.TransactionClient, kind: AttendanceKind, userId: string, outlet: { id: string; timezone: string }, attemptId: string, at: Date, rosterEntryId: string | null, scheduleMatch: "SCHEDULED" | "UNSCHEDULED" | null) {
  if (kind === AttendanceKind.CHECK_IN) {
    return transaction.attendanceSession.create({ data: { userId, outletId: outlet.id, businessDate: businessDateAt(at, outlet.timezone), openUserKey: userId, checkInAt: at, checkInAttemptId: attemptId, rosterEntryId, scheduleMatch: scheduleMatch ?? "UNSCHEDULED" } });
  }
  const open = await transaction.attendanceSession.findUnique({ where: { openUserKey: userId } });
  if (!open) throw new AttendanceError("CONFLICT", "Absensi masuk aktif tidak ditemukan.");
  if (open.outletId !== outlet.id) throw new AttendanceError("CONFLICT", "Absensi pulang harus dilakukan pada outlet tempat Anda masuk.");
  return transaction.attendanceSession.update({ where: { id: open.id }, data: { status: AttendanceSessionStatus.CLOSED, openUserKey: null, checkOutAt: at, checkOutAttemptId: attemptId } });
}

async function assertClockScope(transaction: Prisma.TransactionClient, outletId: string, actor: AttendanceActor) {
  const outlet = await transaction.outlet.findFirst({ where: { id: outletId, status: OutletStatus.ACTIVE, ...(actor.role === "owner" ? {} : { assignments: { some: { userId: actor.id } } }) }, select: { id: true, attendanceEnabled: true, timezone: true } });
  if (!outlet) throw new AttendanceError("FORBIDDEN", "Outlet tidak tersedia untuk akun Anda.");
  if (!outlet.attendanceEnabled) throw new AttendanceError("NOT_CONFIGURED", "Absensi belum diaktifkan untuk outlet ini.");
  return outlet;
}

async function assertOutletInActorScope(transaction: Prisma.TransactionClient, outletId: string, actor: AttendanceActor) {
  const outlet = await transaction.outlet.findFirst({ where: { id: outletId, ...(actor.role === "owner" ? {} : { assignments: { some: { userId: actor.id } } }) }, select: { id: true } });
  if (!outlet) throw new AttendanceError("FORBIDDEN", "Outlet berada di luar cakupan Anda.");
}

async function assertUserInActorScope(transaction: Prisma.TransactionClient, userId: string, actor: AttendanceActor) {
  if (actor.role === "owner") {
    const user = await transaction.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw new AttendanceError("NOT_FOUND", "Staf tidak ditemukan.");
    return;
  }
  const assignment = await transaction.userOutletAssignment.findFirst({ where: { userId, outlet: { assignments: { some: { userId: actor.id } } } }, select: { userId: true } });
  if (!assignment) throw new AttendanceError("FORBIDDEN", "Staf berada di luar cakupan Anda.");
}

function assertManager(actor: AttendanceActor) {
  if (actor.role !== "owner" && actor.role !== "manager") throw new AttendanceError("FORBIDDEN", "Akun ini tidak dapat mengelola absensi.");
}

function calculateDistance(outlet: { attendanceLatitude: Prisma.Decimal | null; attendanceLongitude: Prisma.Decimal | null }, input: AttendanceVerificationInput) {
  if (outlet.attendanceLatitude === null || outlet.attendanceLongitude === null) return 0;
  return distanceInMeters({ latitude: Number(outlet.attendanceLatitude), longitude: Number(outlet.attendanceLongitude) }, input.location);
}

function attendanceSettingsSnapshot(outlet: { attendanceEnabled: boolean; attendanceLatitude: Prisma.Decimal | null; attendanceLongitude: Prisma.Decimal | null; attendanceRadiusMeters: number; attendanceLateGraceMinutes: number; attendanceEarlyLeaveGraceMinutes: number }) {
  return { attendanceEnabled: outlet.attendanceEnabled, latitude: outlet.attendanceLatitude?.toString() ?? null, longitude: outlet.attendanceLongitude?.toString() ?? null, radiusMeters: outlet.attendanceRadiusMeters, lateGraceMinutes: outlet.attendanceLateGraceMinutes, earlyLeaveGraceMinutes: outlet.attendanceEarlyLeaveGraceMinutes };
}

async function resolveCheckInSchedule(transaction: Prisma.TransactionClient, userId: string, outletId: string, timezone: string, now: Date, unscheduledAcknowledged: boolean) {
  const workDate = businessDateAt(now, timezone);
  const dateValue = workDate.toISOString().slice(0, 10);
  const entries = await Promise.all([dateValue, addIsoDays(dateValue, -1)].map((candidate) => transaction.attendanceRosterEntry.findUnique({ where: { userId_workDate: { userId, workDate: new Date(`${candidate}T00:00:00.000Z`) } }, include: { rosterWeek: { select: { status: true } } } })));
  const entry = entries.find((candidate) => candidate?.outletId === outletId && candidate.rosterWeek.status === "PUBLISHED" && isWithinScheduledWindow(now, candidate.scheduledStartAt, candidate.scheduledEndAt));
  if (entry) return { rosterEntryId: entry.id, scheduleMatch: "SCHEDULED" as const };
  if (!unscheduledAcknowledged) throw new AttendanceError("INVALID", "Absensi ini berada di luar jadwal. Konfirmasikan masuk di luar jadwal untuk melanjutkan.");
  return { rosterEntryId: null, scheduleMatch: "UNSCHEDULED" as const };
}

function randomChallengeAction(): AttendanceChallengeAction {
  const actions = Object.keys(attendanceChallengeLabels) as AttendanceChallengeAction[];
  return actions[Math.floor(Math.random() * actions.length)];
}

async function writeAttendanceAudit(transaction: Prisma.TransactionClient, entityType: string, entityId: string, action: AttendanceAuditAction, actor: AttendanceActor, before: Prisma.InputJsonValue | null, after: Prisma.InputJsonValue | null) {
  await transaction.attendanceAuditLog.create({ data: { entityType, entityId, action, actorUserId: actor.id, actorEmail: actor.email, before: before ?? undefined, after: after ?? undefined } });
}

async function deleteEvidenceBestEffort(pathname: string) {
  try {
    await deleteAttendanceEvidence(pathname);
  } catch (error) {
    console.warn("Attendance compensating evidence cleanup failed", { pathname, error });
  }
}
