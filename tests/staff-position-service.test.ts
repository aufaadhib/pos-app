import { beforeEach, describe, expect, it, vi } from "vitest";

import { StaffPositionStatus } from "@/generated/prisma/client";

const mocks = vi.hoisted(() => ({ auditCreate: vi.fn(), positionCreate: vi.fn(), positionFindUnique: vi.fn(), positionUpdate: vi.fn(), transaction: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));

import { changeStaffPositionStatus, createStaffPosition, StaffPositionError } from "@/lib/staff/position-service";

const owner = { id: "owner-1", name: "Pemilik", email: "owner@example.com", role: "owner" as const };
const transactionClient = { adminAuditLog: { create: mocks.auditCreate }, staffPosition: { create: mocks.positionCreate, findUnique: mocks.positionFindUnique, update: mocks.positionUpdate } };

describe("staff position service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation(async (callback) => callback(transactionClient));
    mocks.auditCreate.mockResolvedValue({ id: "audit-1" });
  });

  it("creates a normalized owner-managed position with an audit", async () => {
    mocks.positionCreate.mockResolvedValue({ id: "position-1", name: "Barista", status: StaffPositionStatus.ACTIVE, archivedAt: null });
    await createStaffPosition({ name: "Barista" }, owner);
    expect(mocks.positionCreate).toHaveBeenCalledWith({ data: { name: "Barista", normalizedName: "barista" } });
    expect(mocks.auditCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ entityType: "STAFF_POSITION", action: "CREATE" }) }));
  });

  it("rejects manager position changes before opening a transaction", async () => {
    await expect(createStaffPosition({ name: "Barista" }, { ...owner, role: "manager" })).rejects.toBeInstanceOf(StaffPositionError);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("archives a position without deleting historical references", async () => {
    const current = { id: "position-1", name: "Barista", status: StaffPositionStatus.ACTIVE, archivedAt: null, updatedAt: new Date("2026-08-11T01:00:00.000Z") };
    mocks.positionFindUnique.mockResolvedValue(current);
    mocks.positionUpdate.mockResolvedValue({ ...current, status: StaffPositionStatus.ARCHIVED, archivedAt: new Date("2026-08-11T02:00:00.000Z") });

    await changeStaffPositionStatus({ id: current.id, expectedUpdatedAt: current.updatedAt.toISOString() }, StaffPositionStatus.ARCHIVED, owner);

    expect(mocks.positionUpdate).toHaveBeenCalledWith({ where: { id: current.id }, data: { status: StaffPositionStatus.ARCHIVED, archivedAt: expect.any(Date) } });
    expect(mocks.auditCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "ARCHIVE" }) }));
  });
});
