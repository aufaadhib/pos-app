import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentSession: vi.fn(),
  getReportDataset: vi.fn(),
  getReportOutlets: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ getCurrentSession: mocks.getCurrentSession }));
vi.mock("@/lib/reports/queries", () => ({
  getReportDataset: mocks.getReportDataset,
  getReportOutlets: mocks.getReportOutlets,
  selectReportOutlets: (outlets: Array<{ id: string }>, requestedOutletId: string) => requestedOutletId === "all" ? outlets : outlets.filter((outlet) => outlet.id === requestedOutletId),
}));

import { GET } from "@/app/api/reports/export/route";
import { NextRequest } from "next/server";

const url = "http://localhost/api/reports/export?view=products&from=2026-08-09&to=2026-08-09&outletId=outlet-1";

describe("report CSV route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getReportOutlets.mockResolvedValue([{ id: "outlet-1", code: "GLT", name: "Glutong", timezone: "Asia/Jakarta" }]);
    mocks.getReportDataset.mockResolvedValue({ view: "products", data: [] });
  });

  it("denies cashiers before querying report data", async () => {
    mocks.getCurrentSession.mockResolvedValue({ user: { id: "cashier-1", role: "cashier" }, session: { activeOutletId: "outlet-1" } });
    const response = await GET(new NextRequest(url));
    expect(response.status).toBe(403);
    expect(mocks.getReportDataset).not.toHaveBeenCalled();
  });

  it("denies a manager requesting an unassigned outlet", async () => {
    mocks.getCurrentSession.mockResolvedValue({ user: { id: "manager-1", role: "manager" }, session: { activeOutletId: "outlet-1" } });
    const response = await GET(new NextRequest(url.replace("outlet-1", "outlet-2")));
    expect(response.status).toBe(403);
    expect(mocks.getReportDataset).not.toHaveBeenCalled();
  });

  it("returns a non-cached UTF-8 CSV for an authorized manager", async () => {
    mocks.getCurrentSession.mockResolvedValue({ user: { id: "manager-1", role: "manager" }, session: { activeOutletId: "outlet-1" } });
    const response = await GET(new NextRequest(url));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect([...new Uint8Array(await response.arrayBuffer()).slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  });
});
