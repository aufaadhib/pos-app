import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  attemptFindUnique: vi.fn(),
  attemptCreate: vi.fn(),
  attendanceSessionFindUnique: vi.fn(),
  auditCreate: vi.fn(),
  exceptionFindUnique: vi.fn(),
  exceptionUpdate: vi.fn(),
  outletFindFirst: vi.fn(),
  outletUpdate: vi.fn(),
  transaction: vi.fn(),
  uploadEvidence: vi.fn(),
  deleteEvidence: vi.fn(),
  verificationFindFirst: vi.fn(),
  verificationCreate: vi.fn(),
  verificationUpdate: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/attendance/evidence", () => ({ uploadAttendanceEvidence: mocks.uploadEvidence, deleteAttendanceEvidence: mocks.deleteEvidence }));
vi.mock("@/lib/prisma", () => ({ prisma: { attendanceAttempt: { findUnique: mocks.attemptFindUnique }, $transaction: mocks.transaction } }));

import { AttendanceError, createAttendanceChallenge, enrollFaceProfile, reviewAttendanceException, updateAttendanceSettings, verifyAttendance } from "@/lib/attendance/service";
import { hashAttendanceNonce } from "@/lib/attendance/crypto";

const actor = { id: "manager-1", name: "Manajer", email: "manager@example.com", role: "manager" as const };
const transactionClient = {
  attendanceAttempt: { create: mocks.attemptCreate },
  attendanceAuditLog: { create: mocks.auditCreate },
  attendanceExceptionRequest: { findUnique: mocks.exceptionFindUnique, update: mocks.exceptionUpdate },
  attendanceSession: { findUnique: mocks.attendanceSessionFindUnique },
  attendanceVerification: { create: mocks.verificationCreate, findFirst: mocks.verificationFindFirst, update: mocks.verificationUpdate },
  outlet: { findFirst: mocks.outletFindFirst, update: mocks.outletUpdate },
};

describe("attendance service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation(async (callback) => callback(transactionClient));
    mocks.uploadEvidence.mockResolvedValue("attendance/user/evidence.jpg");
    mocks.attemptFindUnique.mockResolvedValue(null);
    mocks.attendanceSessionFindUnique.mockResolvedValue(null);
    mocks.verificationFindFirst.mockResolvedValue(null);
  });

  it("allows an owner to start attendance at any active outlet without assignment", async () => {
    const owner = { id: "owner-1", name: "Pemilik", email: "owner@example.com", role: "owner" as const };
    mocks.outletFindFirst.mockResolvedValue({ id: "outlet-1", attendanceEnabled: true });
    mocks.verificationCreate.mockResolvedValue({ id: "verification-1", challengeAction: "TURN_LEFT", expiresAt: new Date(Date.now() + 60_000), attemptCount: 0 });

    await createAttendanceChallenge({ outletId: "outlet-1", kind: "CHECK_IN" }, owner);

    expect(mocks.outletFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "outlet-1", status: "ACTIVE" } }));
    expect(mocks.verificationCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ outletId: "outlet-1", userId: owner.id }) }));
  });

  it("continues to require an outlet assignment for managers", async () => {
    mocks.outletFindFirst.mockResolvedValue(null);

    await expect(createAttendanceChallenge({ outletId: "outlet-2", kind: "CHECK_IN" }, actor)).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(mocks.outletFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ assignments: { some: { userId: actor.id } } }) }));
    expect(mocks.verificationCreate).not.toHaveBeenCalled();
  });

  it("updates only an assigned outlet and writes settings audit atomically", async () => {
    mocks.outletFindFirst.mockResolvedValue({ id: "outlet-1", attendanceEnabled: false, attendanceLatitude: null, attendanceLongitude: null, attendanceRadiusMeters: 100 });
    await updateAttendanceSettings({ outletId: "outlet-1", attendanceEnabled: true, latitude: -6.2, longitude: 106.8, radiusMeters: 150 }, actor);
    expect(mocks.outletFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ assignments: { some: { userId: actor.id } } }) }));
    expect(mocks.outletUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ attendanceRadiusMeters: 150 }) }));
    expect(mocks.auditCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "SETTINGS_UPDATE" }) }));
  });

  it("returns a clear configuration error before enrollment when the AES key is missing", async () => {
    const previousKey = process.env.ATTENDANCE_EMBEDDING_KEY;
    delete process.env.ATTENDANCE_EMBEDDING_KEY;
    await expect(enrollFaceProfile({ samples: [embedding, embedding, embedding], modelVersion: "human-3.3.6", consent: true }, actor)).rejects.toMatchObject({ code: "NOT_CONFIGURED" });
    if (previousKey === undefined) delete process.env.ATTENDANCE_EMBEDDING_KEY;
    else process.env.ATTENDANCE_EMBEDDING_KEY = previousKey;
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects manager self-approval before creating an attendance session", async () => {
    mocks.exceptionFindUnique.mockResolvedValue({ id: "request-1", userId: actor.id, status: "PENDING", verification: { outletId: "outlet-1", kind: "CHECK_IN", outlet: {} }, attempt: {} });
    await expect(reviewAttendanceException({ requestId: "request-1", decision: "APPROVED", reason: "Lokasi telah diverifikasi" }, actor)).rejects.toBeInstanceOf(AttendanceError);
    expect(mocks.exceptionUpdate).not.toHaveBeenCalled();
  });

  it("opens exception access on the third failed liveness attempt", async () => {
    const nonce = "n".repeat(32);
    mocks.verificationFindFirst.mockResolvedValue({
      id: "verification-1",
      userId: actor.id,
      outletId: "outlet-1",
      kind: "CHECK_IN",
      status: "ACTIVE",
      attemptCount: 2,
      expiresAt: new Date(Date.now() + 60_000),
      nonceHash: hashAttendanceNonce(nonce),
      outlet: { id: "outlet-1", name: "Pusat", timezone: "Asia/Jakarta", status: "ACTIVE", attendanceEnabled: true, attendanceLatitude: { toString: () => "-6.2", valueOf: () => -6.2 }, attendanceLongitude: { toString: () => "106.8", valueOf: () => 106.8 }, attendanceRadiusMeters: 100, assignments: [{ userId: actor.id }] },
    });
    mocks.attemptCreate.mockResolvedValue({ id: "attempt-3" });
    const result = await verifyAttendance({ verificationId: "verification-1", nonce, idempotencyKey: "request-123", embedding, livenessPassed: false, location: { latitude: -6.2, longitude: 106.8, accuracyMeters: 10 } }, new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], "evidence.jpg", { type: "image/jpeg" }), actor);
    expect(result).toEqual(expect.objectContaining({ success: false, attemptCount: 3, exceptionAvailable: true }));
    expect(mocks.verificationUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "EXCEPTION_AVAILABLE", attemptCount: 3 }) }));
  });
});

const embedding = Array.from({ length: 32 }, () => 0.1);
