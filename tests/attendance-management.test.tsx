import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/attendance/manage/actions", () => ({
  correctAttendanceSessionAction: vi.fn(),
  reviewAttendanceExceptionAction: vi.fn(),
  revokeFaceProfileAction: vi.fn(),
}));

import { AttendanceManagement } from "@/components/attendance/attendance-management";

describe("attendance management", () => {
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
        originalCheckInAt: "2026-08-10T12:30:00.000Z",
        originalCheckOutAt: "2026-08-10T13:30:00.000Z",
        outlet: { code: "TMR", name: "Timur", timezone: "Asia/Jayapura" },
        checkInEvidence: { attemptId: "attempt-in", available: true },
        checkOutEvidence: { attemptId: "attempt-out", available: false },
        correction: null,
      }]}
      staffProfiles={[]}
      timezone="Asia/Jayapura"
    />);

    expect(screen.getByLabelText("Dari")).toHaveClass("ios-date-input");
    expect(screen.getByLabelText("Sampai")).toHaveClass("ios-date-input");
    expect(screen.getAllByText(/21\.30 WIT/).length).toBeGreaterThan(0);
    for (const link of screen.getAllByRole("button", { name: "Foto masuk" })) {
      expect(link).toHaveAttribute("href", "/api/attendance/evidence/attempt-in");
    }
    for (const button of screen.getAllByRole("button", { name: "Foto pulang" })) {
      expect(button).toBeDisabled();
    }
  });
});
