import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ cleanup: vi.fn(), materialize: vi.fn() }));

vi.mock("@/lib/attendance/service", () => ({ cleanupExpiredAttendanceEvidence: mocks.cleanup }));
vi.mock("@/lib/attendance/roster-service", () => ({ materializeUpcomingFixedRosters: mocks.materialize }));

import { GET } from "@/app/api/cron/attendance-maintenance/route";

describe("attendance maintenance cron", () => {
  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.CRON_SECRET;
  });

  it("denies an invalid cron secret", async () => {
    process.env.CRON_SECRET = "attendance-cron-secret";
    const response = await GET(new Request("http://localhost/api/cron/attendance-maintenance"));
    expect(response.status).toBe(401);
    expect(mocks.cleanup).not.toHaveBeenCalled();
    expect(mocks.materialize).not.toHaveBeenCalled();
  });

  it("cleans evidence and materializes fixed rosters", async () => {
    process.env.CRON_SECRET = "attendance-cron-secret";
    mocks.cleanup.mockResolvedValue({ scanned: 4, deleted: 3 });
    mocks.materialize.mockResolvedValue({ scanned: 2, materialized: 2 });
    const response = await GET(new Request("http://localhost/api/cron/attendance-maintenance", { headers: { authorization: "Bearer attendance-cron-secret" } }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ evidence: { scanned: 4, deleted: 3 }, rosters: { scanned: 2, materialized: 2 } });
  });
});
