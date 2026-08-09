import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createAttendanceNonce, decryptEmbedding, encryptEmbedding, hashAttendanceNonce } from "@/lib/attendance/crypto";
import { averageEmbeddings, faceSimilarity, normalizeEmbedding } from "@/lib/attendance/face";
import { businessDateAt, distanceInMeters } from "@/lib/attendance/geofence";

describe("attendance domain", () => {
  it("averages normalized samples and compares cosine similarity", () => {
    const first = Array.from({ length: 32 }, (_, index) => index + 1);
    const second = first.map((value) => value * 2);
    const template = averageEmbeddings([first, second, first]);
    expect(Math.hypot(...template)).toBeCloseTo(1, 10);
    expect(faceSimilarity(template, normalizeEmbedding(first))).toBeCloseTo(1, 10);
    expect(() => averageEmbeddings([first, second])).toThrow("tepat tiga");
  });

  it("round-trips an AES-GCM face template and rejects the wrong key", () => {
    const key = Buffer.alloc(32, 3).toString("base64");
    const wrongKey = Buffer.alloc(32, 4).toString("base64");
    const embedding = Array.from({ length: 32 }, (_, index) => index / 100);
    const encrypted = encryptEmbedding(embedding, key);
    expect(decryptEmbedding(encrypted.ciphertext, encrypted.iv, encrypted.length, key)).toEqual(expect.arrayContaining([expect.closeTo(0.1, 5)]));
    expect(() => decryptEmbedding(encrypted.ciphertext, encrypted.iv, encrypted.length, wrongKey)).toThrow();
  });

  it("uses unpredictable single-use nonces and stable hashes", () => {
    const first = createAttendanceNonce();
    const second = createAttendanceNonce();
    expect(first).not.toBe(second);
    expect(hashAttendanceNonce(first)).toHaveLength(64);
    expect(hashAttendanceNonce(first)).toBe(hashAttendanceNonce(first));
  });

  it("calculates outlet distance and local business date", () => {
    expect(distanceInMeters({ latitude: -6.2, longitude: 106.816666 }, { latitude: -6.2, longitude: 106.816666 })).toBe(0);
    expect(distanceInMeters({ latitude: -6.2, longitude: 106.816666 }, { latitude: -6.2, longitude: 106.817566 })).toBeGreaterThan(90);
    expect(businessDateAt(new Date("2026-08-08T18:00:00.000Z"), "Asia/Jakarta").toISOString()).toBe("2026-08-09T00:00:00.000Z");
  });
});
