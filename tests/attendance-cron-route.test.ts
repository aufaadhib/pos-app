import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ cleanup: vi.fn() }));

vi.mock("@/lib/attendance/service", () => ({ cleanupExpiredAttendanceEvidence: mocks.cleanup }));

import { GET } from "@/app/api/cron/attendance-evidence-cleanup/route";

describe("attendance evidence cleanup cron", () => {
  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.CRON_SECRET;
  });

  it("denies missing or invalid cron authorization", async () => {
    process.env.CRON_SECRET = "attendance-cron-secret";

    const response = await GET(new Request("http://localhost/api/cron/attendance-evidence-cleanup"));

    expect(response.status).toBe(401);
    expect(mocks.cleanup).not.toHaveBeenCalled();
  });

  it("runs bounded cleanup with the configured bearer secret", async () => {
    process.env.CRON_SECRET = "attendance-cron-secret";
    mocks.cleanup.mockResolvedValue({ scanned: 4, deleted: 3 });

    const response = await GET(new Request("http://localhost/api/cron/attendance-evidence-cleanup", { headers: { authorization: "Bearer attendance-cron-secret" } }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ scanned: 4, deleted: 3 });
    expect(mocks.cleanup).toHaveBeenCalledOnce();
  });
});
