import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ reviewFaceReenrollment: vi.fn() }));

vi.mock("@/app/attendance/manage/actions", () => ({
  correctAttendanceSessionAction: vi.fn(),
  reviewAttendanceExceptionAction: vi.fn(),
  reviewFaceReenrollmentAction: mocks.reviewFaceReenrollment,
  revokeFaceProfileAction: vi.fn(),
}));

import { AttendanceManagement } from "@/components/attendance/attendance-management";

describe("attendance management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.reviewFaceReenrollment.mockResolvedValue({ status: "success", message: "Daftar ulang wajah disetujui." });
  });

  it("shows private check-in evidence and formats records in the outlet timezone", () => {
    render(<AttendanceManagement
      currentUserId="owner-1"
      outletId="outlet-1"
      pendingRequests={[]}
      sessions={[{
        id: "session-1",
        userId: "staff-1",
        user: { id: "staff-1", name: "Staf Satu", email: "staf@example.com" },
        status: "CLOSED",
        checkInAt: "2026-08-10T12:30:00.000Z",
        checkOutAt: "2026-08-10T13:30:00.000Z",
        missedCheckout: false,
        originalCheckInAt: "2026-08-10T12:30:00.000Z",
        originalCheckOutAt: "2026-08-10T13:30:00.000Z",
        outlet: { code: "TMR", name: "Timur", timezone: "Asia/Jayapura" },
        checkInEvidence: { attemptId: "attempt-in", available: true, similarity: "0.87321" },
        checkOutEvidence: { attemptId: "attempt-out", available: false, similarity: "0.81234" },
        correction: null,
      }]}
      staffProfiles={[]}
      timezone="Asia/Jayapura"
    />);

    expect(screen.getByLabelText("Dari")).toHaveClass("ios-date-input");
    expect(screen.getByLabelText("Sampai")).toHaveClass("ios-date-input");
    expect(screen.getAllByText(/21\.30 WIT/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Wajah 87,3%").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Wajah 81,2%").length).toBeGreaterThan(0);
    for (const link of screen.getAllByRole("button", { name: "Foto masuk" })) {
      expect(link).toHaveAttribute("href", "/api/attendance/evidence/attempt-in");
    }
    for (const button of screen.getAllByRole("button", { name: "Foto pulang" })) {
      expect(button).toBeDisabled();
    }
  });

  it("lets a manager review a pending cashier face reenrollment", async () => {
    const user = userEvent.setup();
    render(<AttendanceManagement
      currentUserId="manager-1"
      outletId="outlet-1"
      pendingRequests={[]}
      sessions={[]}
      staffProfiles={[{ id: "cashier-1", name: "Kasir Satu", email: "cashier@example.com", banned: false, profile: { id: "profile-old", enrolledAt: "2026-08-10T12:30:00.000Z" }, reenrollmentRequest: { id: "face-request-1", requestedAt: "2026-08-11T01:00:00.000Z" } }]}
      timezone="Asia/Jakarta"
    />);

    await user.click(screen.getByRole("button", { name: "Tinjau daftar ulang" }));
    await user.type(screen.getByRole("textbox", { name: "Alasan review daftar ulang" }), "Wajah baru sudah diverifikasi");
    await user.click(screen.getByRole("button", { name: "Setujui" }));

    await waitFor(() => expect(mocks.reviewFaceReenrollment).toHaveBeenCalledWith({ requestId: "face-request-1", decision: "APPROVED", reason: "Wajah baru sudah diverifikasi" }));
  });
});
