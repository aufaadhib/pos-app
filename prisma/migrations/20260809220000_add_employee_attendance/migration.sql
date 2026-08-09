CREATE TYPE "AttendanceKind" AS ENUM ('CHECK_IN', 'CHECK_OUT');
CREATE TYPE "AttendanceVerificationStatus" AS ENUM ('ACTIVE', 'VERIFIED', 'EXCEPTION_AVAILABLE', 'EXPIRED');
CREATE TYPE "AttendanceAttemptResult" AS ENUM ('SUCCESS', 'FAILED');
CREATE TYPE "AttendanceFailureReason" AS ENUM ('FACE_PROFILE_MISSING', 'FACE_MISMATCH', 'FACE_INVALID', 'LIVENESS_FAILED', 'CAMERA_UNAVAILABLE', 'LOCATION_UNAVAILABLE', 'LOCATION_INACCURATE', 'LOCATION_OUTSIDE', 'CHALLENGE_INVALID', 'CONFIGURATION_MISSING', 'ALREADY_CHECKED_IN', 'SESSION_MISSING', 'OUTLET_MISMATCH');
CREATE TYPE "AttendanceSessionStatus" AS ENUM ('OPEN', 'CLOSED');
CREATE TYPE "AttendanceExceptionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "AttendanceAuditAction" AS ENUM ('ENROLL', 'REVOKE', 'CHECK_IN', 'CHECK_OUT', 'EXCEPTION_REQUEST', 'EXCEPTION_APPROVE', 'EXCEPTION_REJECT', 'CORRECT', 'SETTINGS_UPDATE', 'EVIDENCE_DELETE');

ALTER TABLE "outlet"
  ADD COLUMN "attendanceEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "attendanceLatitude" DECIMAL(9,6),
  ADD COLUMN "attendanceLongitude" DECIMAL(9,6),
  ADD COLUMN "attendanceRadiusMeters" INTEGER NOT NULL DEFAULT 100,
  ADD CONSTRAINT "outlet_attendance_coordinate_pair_check" CHECK (("attendanceLatitude" IS NULL) = ("attendanceLongitude" IS NULL)),
  ADD CONSTRAINT "outlet_attendance_latitude_check" CHECK ("attendanceLatitude" IS NULL OR "attendanceLatitude" BETWEEN -90 AND 90),
  ADD CONSTRAINT "outlet_attendance_longitude_check" CHECK ("attendanceLongitude" IS NULL OR "attendanceLongitude" BETWEEN -180 AND 180),
  ADD CONSTRAINT "outlet_attendance_radius_check" CHECK ("attendanceRadiusMeters" BETWEEN 50 AND 500),
  ADD CONSTRAINT "outlet_attendance_enabled_location_check" CHECK (NOT "attendanceEnabled" OR "attendanceLatitude" IS NOT NULL);

CREATE TABLE "face_profile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "activeUserKey" TEXT,
  "embeddingCiphertext" BYTEA,
  "embeddingIv" BYTEA,
  "embeddingLength" INTEGER NOT NULL DEFAULT 1024,
  "modelVersion" VARCHAR(80) NOT NULL,
  "consentAt" TIMESTAMP(3) NOT NULL,
  "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "face_profile_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "face_profile_active_payload_check" CHECK (("activeUserKey" IS NULL AND "revokedAt" IS NOT NULL AND "embeddingCiphertext" IS NULL AND "embeddingIv" IS NULL) OR ("activeUserKey" = "userId" AND "revokedAt" IS NULL AND "embeddingCiphertext" IS NOT NULL AND "embeddingIv" IS NOT NULL))
);

CREATE TABLE "attendance_verification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "outletId" TEXT NOT NULL,
  "kind" "AttendanceKind" NOT NULL,
  "status" "AttendanceVerificationStatus" NOT NULL DEFAULT 'ACTIVE',
  "nonceHash" VARCHAR(64) NOT NULL,
  "challengeAction" VARCHAR(24) NOT NULL,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "attendance_verification_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "attendance_verification_attempt_count_check" CHECK ("attemptCount" BETWEEN 0 AND 3)
);

CREATE TABLE "attendance_attempt" (
  "id" TEXT NOT NULL,
  "verificationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "outletId" TEXT NOT NULL,
  "kind" "AttendanceKind" NOT NULL,
  "result" "AttendanceAttemptResult" NOT NULL,
  "failureReason" "AttendanceFailureReason",
  "similarity" DECIMAL(6,5),
  "livenessPassed" BOOLEAN NOT NULL,
  "latitude" DECIMAL(9,6),
  "longitude" DECIMAL(9,6),
  "accuracyMeters" DECIMAL(8,2),
  "distanceMeters" DECIMAL(10,2),
  "evidencePath" VARCHAR(500),
  "evidenceExpiresAt" TIMESTAMP(3),
  "evidenceDeletedAt" TIMESTAMP(3),
  "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "idempotencyKey" VARCHAR(80) NOT NULL,
  CONSTRAINT "attendance_attempt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "attendance_attempt_result_check" CHECK (("result" = 'SUCCESS' AND "failureReason" IS NULL) OR ("result" = 'FAILED' AND "failureReason" IS NOT NULL)),
  CONSTRAINT "attendance_attempt_similarity_check" CHECK ("similarity" IS NULL OR "similarity" BETWEEN -1 AND 1)
);

CREATE TABLE "attendance_session" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "outletId" TEXT NOT NULL,
  "businessDate" DATE NOT NULL,
  "status" "AttendanceSessionStatus" NOT NULL DEFAULT 'OPEN',
  "openUserKey" TEXT,
  "checkInAt" TIMESTAMP(3) NOT NULL,
  "checkInAttemptId" TEXT NOT NULL,
  "checkOutAt" TIMESTAMP(3),
  "checkOutAttemptId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "attendance_session_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "attendance_session_state_check" CHECK (("status" = 'OPEN' AND "openUserKey" = "userId" AND "checkOutAt" IS NULL AND "checkOutAttemptId" IS NULL) OR ("status" = 'CLOSED' AND "openUserKey" IS NULL AND "checkOutAt" IS NOT NULL AND "checkOutAttemptId" IS NOT NULL AND "checkOutAt" >= "checkInAt"))
);

CREATE TABLE "attendance_exception_request" (
  "id" TEXT NOT NULL,
  "verificationId" TEXT NOT NULL,
  "attemptId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "reason" VARCHAR(240) NOT NULL,
  "status" "AttendanceExceptionStatus" NOT NULL DEFAULT 'PENDING',
  "reviewedByUserId" TEXT,
  "reviewedByName" TEXT,
  "reviewedByEmail" TEXT,
  "reviewReason" VARCHAR(240),
  "reviewedAt" TIMESTAMP(3),
  "createdSessionId" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "attendance_exception_request_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "attendance_exception_review_check" CHECK (("status" = 'PENDING' AND "reviewedByUserId" IS NULL AND "reviewedAt" IS NULL) OR ("status" <> 'PENDING' AND "reviewedByUserId" IS NOT NULL AND "reviewedAt" IS NOT NULL))
);

CREATE TABLE "attendance_correction" (
  "id" TEXT NOT NULL,
  "attendanceSessionId" TEXT NOT NULL,
  "correctedCheckInAt" TIMESTAMP(3),
  "correctedCheckOutAt" TIMESTAMP(3),
  "reason" VARCHAR(240) NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "actorName" TEXT NOT NULL,
  "actorEmail" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "attendance_correction_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "attendance_correction_value_check" CHECK ("correctedCheckInAt" IS NOT NULL OR "correctedCheckOutAt" IS NOT NULL),
  CONSTRAINT "attendance_correction_order_check" CHECK ("correctedCheckInAt" IS NULL OR "correctedCheckOutAt" IS NULL OR "correctedCheckOutAt" >= "correctedCheckInAt")
);

CREATE TABLE "attendance_audit_log" (
  "id" TEXT NOT NULL,
  "entityType" VARCHAR(40) NOT NULL,
  "entityId" TEXT NOT NULL,
  "action" "AttendanceAuditAction" NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "actorEmail" TEXT NOT NULL,
  "before" JSONB,
  "after" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "attendance_audit_log_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "face_profile_activeUserKey_key" ON "face_profile"("activeUserKey");
CREATE INDEX "face_profile_userId_enrolledAt_idx" ON "face_profile"("userId", "enrolledAt");
CREATE UNIQUE INDEX "attendance_verification_nonceHash_key" ON "attendance_verification"("nonceHash");
CREATE INDEX "attendance_verification_userId_status_expiresAt_idx" ON "attendance_verification"("userId", "status", "expiresAt");
CREATE INDEX "attendance_verification_outletId_createdAt_idx" ON "attendance_verification"("outletId", "createdAt");
CREATE UNIQUE INDEX "attendance_attempt_idempotencyKey_key" ON "attendance_attempt"("idempotencyKey");
CREATE INDEX "attendance_attempt_userId_attemptedAt_idx" ON "attendance_attempt"("userId", "attemptedAt");
CREATE INDEX "attendance_attempt_outletId_attemptedAt_idx" ON "attendance_attempt"("outletId", "attemptedAt");
CREATE INDEX "attendance_attempt_evidenceExpiresAt_evidenceDeletedAt_idx" ON "attendance_attempt"("evidenceExpiresAt", "evidenceDeletedAt");
CREATE UNIQUE INDEX "attendance_session_openUserKey_key" ON "attendance_session"("openUserKey");
CREATE UNIQUE INDEX "attendance_session_checkInAttemptId_key" ON "attendance_session"("checkInAttemptId");
CREATE UNIQUE INDEX "attendance_session_checkOutAttemptId_key" ON "attendance_session"("checkOutAttemptId");
CREATE INDEX "attendance_session_userId_checkInAt_idx" ON "attendance_session"("userId", "checkInAt");
CREATE INDEX "attendance_session_outletId_businessDate_idx" ON "attendance_session"("outletId", "businessDate");
CREATE UNIQUE INDEX "attendance_exception_request_verificationId_key" ON "attendance_exception_request"("verificationId");
CREATE INDEX "attendance_exception_request_status_requestedAt_idx" ON "attendance_exception_request"("status", "requestedAt");
CREATE INDEX "attendance_exception_request_userId_requestedAt_idx" ON "attendance_exception_request"("userId", "requestedAt");
CREATE INDEX "attendance_correction_attendanceSessionId_createdAt_idx" ON "attendance_correction"("attendanceSessionId", "createdAt");
CREATE INDEX "attendance_correction_actorUserId_createdAt_idx" ON "attendance_correction"("actorUserId", "createdAt");
CREATE INDEX "attendance_audit_log_entityType_entityId_createdAt_idx" ON "attendance_audit_log"("entityType", "entityId", "createdAt");
CREATE INDEX "attendance_audit_log_actorUserId_createdAt_idx" ON "attendance_audit_log"("actorUserId", "createdAt");

ALTER TABLE "face_profile" ADD CONSTRAINT "face_profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendance_verification" ADD CONSTRAINT "attendance_verification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendance_verification" ADD CONSTRAINT "attendance_verification_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "outlet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendance_attempt" ADD CONSTRAINT "attendance_attempt_verificationId_fkey" FOREIGN KEY ("verificationId") REFERENCES "attendance_verification"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendance_attempt" ADD CONSTRAINT "attendance_attempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendance_attempt" ADD CONSTRAINT "attendance_attempt_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "outlet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendance_session" ADD CONSTRAINT "attendance_session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendance_session" ADD CONSTRAINT "attendance_session_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "outlet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendance_session" ADD CONSTRAINT "attendance_session_checkInAttemptId_fkey" FOREIGN KEY ("checkInAttemptId") REFERENCES "attendance_attempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendance_session" ADD CONSTRAINT "attendance_session_checkOutAttemptId_fkey" FOREIGN KEY ("checkOutAttemptId") REFERENCES "attendance_attempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendance_exception_request" ADD CONSTRAINT "attendance_exception_request_verificationId_fkey" FOREIGN KEY ("verificationId") REFERENCES "attendance_verification"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendance_exception_request" ADD CONSTRAINT "attendance_exception_request_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "attendance_attempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendance_exception_request" ADD CONSTRAINT "attendance_exception_request_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendance_correction" ADD CONSTRAINT "attendance_correction_attendanceSessionId_fkey" FOREIGN KEY ("attendanceSessionId") REFERENCES "attendance_session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendance_correction" ADD CONSTRAINT "attendance_correction_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
