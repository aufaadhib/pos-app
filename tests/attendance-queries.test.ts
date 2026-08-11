import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ attemptFindFirst: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: { attendanceAttempt: { findFirst: mocks.attemptFindFirst } } }));

import { getAttendanceEvidencePath } from "@/lib/attendance/queries";

describe("attendance evidence authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.attemptFindFirst.mockResolvedValue({ evidencePath: "attendance/staff/evidence.jpg" });
  });

  it("allows an owner to read evidence without an outlet or employee filter", async () => {
    await getAttendanceEvidencePath("attempt-1", { id: "owner-1", name: "Owner", email: "owner@example.com", role: "owner" });

    const { where } = mocks.attemptFindFirst.mock.calls[0][0];
    expect(where).not.toHaveProperty("OR");
    expect(where).not.toHaveProperty("userId");
  });

  it("limits a manager to their own evidence or an assigned outlet", async () => {
    await getAttendanceEvidencePath("attempt-1", { id: "manager-1", name: "Manager", email: "manager@example.com", role: "manager" });

    expect(mocks.attemptFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        OR: [
          { userId: "manager-1" },
          { outlet: { assignments: { some: { userId: "manager-1" } } } },
        ],
      }),
    }));
  });

  it("limits regular employees to their own evidence", async () => {
    await getAttendanceEvidencePath("attempt-1", { id: "staff-1", name: "Staff", email: "staff@example.com", role: "staff" });

    expect(mocks.attemptFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ userId: "staff-1" }),
    }));
  });
});
