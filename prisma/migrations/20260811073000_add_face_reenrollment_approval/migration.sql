CREATE TYPE "FaceReenrollmentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TYPE "AttendanceAuditAction" ADD VALUE 'REENROLL_REQUEST';
ALTER TYPE "AttendanceAuditAction" ADD VALUE 'REENROLL_APPROVE';
ALTER TYPE "AttendanceAuditAction" ADD VALUE 'REENROLL_REJECT';

CREATE TABLE "face_reenrollment_request" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "pendingUserKey" TEXT,
  "status" "FaceReenrollmentStatus" NOT NULL DEFAULT 'PENDING',
  "embeddingCiphertext" BYTEA,
  "embeddingIv" BYTEA,
  "embeddingLength" INTEGER NOT NULL DEFAULT 1024,
  "modelVersion" VARCHAR(80) NOT NULL,
  "consentAt" TIMESTAMP(3) NOT NULL,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedByUserId" TEXT,
  "reviewedByName" TEXT,
  "reviewedByEmail" TEXT,
  "reviewReason" VARCHAR(240),
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "face_reenrollment_request_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "face_reenrollment_request_state_check" CHECK (
    ("status" = 'PENDING' AND "pendingUserKey" = "userId" AND "embeddingCiphertext" IS NOT NULL AND "embeddingIv" IS NOT NULL AND "reviewedByUserId" IS NULL AND "reviewedAt" IS NULL)
    OR
    ("status" <> 'PENDING' AND "pendingUserKey" IS NULL AND "embeddingCiphertext" IS NULL AND "embeddingIv" IS NULL AND "reviewedByUserId" IS NOT NULL AND "reviewReason" IS NOT NULL AND "reviewedAt" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX "face_reenrollment_request_pendingUserKey_key" ON "face_reenrollment_request"("pendingUserKey");
CREATE INDEX "face_reenrollment_request_status_requestedAt_idx" ON "face_reenrollment_request"("status", "requestedAt");
CREATE INDEX "face_reenrollment_request_userId_requestedAt_idx" ON "face_reenrollment_request"("userId", "requestedAt");

ALTER TABLE "face_reenrollment_request" ADD CONSTRAINT "face_reenrollment_request_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
