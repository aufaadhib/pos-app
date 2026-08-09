import { describe, expect, it } from "vitest";

import { attendanceCorrectionSchema, attendanceEnrollmentSchema, attendanceSettingsSchema, attendanceVerificationSchema } from "@/lib/attendance/validation";

const embedding = Array.from({ length: 32 }, () => 0.1);

describe("attendance validation", () => {
  it("requires three face enrollment samples and explicit consent", () => {
    expect(attendanceEnrollmentSchema.safeParse({ samples: [embedding, embedding, embedding], modelVersion: "human-3.3.6", consent: true }).success).toBe(true);
    expect(attendanceEnrollmentSchema.safeParse({ samples: [embedding], modelVersion: "human-3.3.6", consent: true }).success).toBe(false);
    expect(attendanceEnrollmentSchema.safeParse({ samples: [embedding, embedding, embedding], modelVersion: "human-3.3.6", consent: false }).success).toBe(false);
  });

  it("bounds geofence radius and requires coordinates when enabled", () => {
    expect(attendanceSettingsSchema.safeParse({ outletId: "outlet-1", attendanceEnabled: true, latitude: -6.2, longitude: 106.8, radiusMeters: 100 }).success).toBe(true);
    expect(attendanceSettingsSchema.safeParse({ outletId: "outlet-1", attendanceEnabled: true, latitude: null, longitude: null, radiusMeters: 100 }).success).toBe(false);
    expect(attendanceSettingsSchema.safeParse({ outletId: "outlet-1", attendanceEnabled: false, latitude: -6.2, longitude: 106.8, radiusMeters: 501 }).success).toBe(false);
  });

  it("rejects invalid accuracy, identifiers, and reversed corrections", () => {
    expect(attendanceVerificationSchema.safeParse({ verificationId: "v1", nonce: "a".repeat(32), idempotencyKey: "request-1", embedding, livenessPassed: true, location: { latitude: -6.2, longitude: 106.8, accuracyMeters: 15 } }).success).toBe(true);
    expect(attendanceVerificationSchema.safeParse({ verificationId: "v1", nonce: "a".repeat(32), idempotencyKey: "short", embedding, livenessPassed: true, location: { latitude: -6.2, longitude: 106.8, accuracyMeters: -1 } }).success).toBe(false);
    expect(attendanceCorrectionSchema.safeParse({ sessionId: "s1", correctedCheckInAt: "2026-08-09T09:00:00.000Z", correctedCheckOutAt: "2026-08-09T08:00:00.000Z", reason: "Koreksi manual" }).success).toBe(false);
  });
});
