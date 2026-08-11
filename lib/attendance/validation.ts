import { z } from "zod";

const embeddingSchema = z.array(z.number().finite()).min(32).max(2048);
const coordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracyMeters: z.number().positive().max(10_000),
});

export const attendanceEnrollmentSchema = z.object({
  samples: z.array(embeddingSchema).length(3),
  modelVersion: z.string().trim().min(1).max(80),
  consent: z.literal(true),
});

export const attendanceChallengeSchema = z.object({
  outletId: z.string().trim().min(1),
  kind: z.enum(["CHECK_IN", "CHECK_OUT"]),
  unscheduledAcknowledged: z.boolean().default(false),
});

export const attendanceVerificationSchema = z.object({
  verificationId: z.string().trim().min(1),
  nonce: z.string().trim().min(32).max(100),
  idempotencyKey: z.string().trim().min(8).max(80),
  embedding: embeddingSchema,
  livenessPassed: z.boolean(),
  location: coordinatesSchema,
});

export const attendanceExceptionSchema = z.object({
  verificationId: z.string().trim().min(1),
  reason: z.string().trim().min(8, "Alasan minimal 8 karakter.").max(240),
});

export const attendanceSettingsSchema = z.object({
  outletId: z.string().trim().min(1),
  attendanceEnabled: z.boolean(),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
  radiusMeters: z.number().int().min(50).max(500),
  lateGraceMinutes: z.number().int().min(0).max(120),
  earlyLeaveGraceMinutes: z.number().int().min(0).max(120),
}).superRefine((value, context) => {
  if ((value.latitude === null) !== (value.longitude === null) || (value.attendanceEnabled && value.latitude === null)) {
    context.addIssue({ code: "custom", message: "Tentukan titik pusat outlet sebelum mengaktifkan absensi." });
  }
});

export const attendanceReviewSchema = z.object({
  requestId: z.string().trim().min(1),
  decision: z.enum(["APPROVED", "REJECTED"]),
  reason: z.string().trim().min(8, "Catatan review minimal 8 karakter.").max(240),
});

export const attendanceCorrectionSchema = z.object({
  sessionId: z.string().trim().min(1),
  correctedCheckInAt: z.iso.datetime().nullable(),
  correctedCheckOutAt: z.iso.datetime().nullable(),
  reason: z.string().trim().min(8, "Alasan koreksi minimal 8 karakter.").max(240),
}).superRefine((value, context) => {
  if (!value.correctedCheckInAt && !value.correctedCheckOutAt) context.addIssue({ code: "custom", message: "Isi minimal satu waktu koreksi." });
  if (value.correctedCheckInAt && value.correctedCheckOutAt && value.correctedCheckOutAt < value.correctedCheckInAt) {
    context.addIssue({ code: "custom", message: "Waktu pulang tidak boleh sebelum waktu masuk." });
  }
});

export const attendanceReportSearchSchema = z.object({
  outletId: z.string().trim().min(1).optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  page: z.coerce.number().int().min(1).catch(1),
});

export type AttendanceEnrollmentInput = z.infer<typeof attendanceEnrollmentSchema>;
export type AttendanceChallengeInput = z.infer<typeof attendanceChallengeSchema>;
export type AttendanceVerificationInput = z.infer<typeof attendanceVerificationSchema>;
export type AttendanceSettingsInput = z.infer<typeof attendanceSettingsSchema>;
export type AttendanceReviewInput = z.infer<typeof attendanceReviewSchema>;
export type AttendanceCorrectionInput = z.infer<typeof attendanceCorrectionSchema>;
