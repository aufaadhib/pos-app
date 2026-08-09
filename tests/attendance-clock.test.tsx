import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/attendance/actions", () => ({ requestAttendanceExceptionAction: vi.fn() }));
vi.mock("@/lib/auth/client", () => ({ authClient: { signOut: vi.fn() } }));

import { AttendanceClock } from "@/components/attendance/attendance-clock";
import { attendanceSharedDeviceKey } from "@/lib/attendance/constants";

const outlet = { id: "outlet-1", code: "PST", name: "Pusat", attendanceEnabled: true, attendanceLatitude: -6.2, attendanceLongitude: 106.8, attendanceRadiusMeters: 100 };

describe("attendance clock", () => {
  beforeEach(() => localStorage.clear());

  it("keeps verification disabled until the signed-in account has a face profile", () => {
    render(<AttendanceClock openSession={null} outlets={[outlet]} profile={null} recentSessions={[]} user={{ name: "Kasir Satu", email: "kasir@example.com" }} />);
    expect(screen.getByText("Kasir Satu")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Absensi masuk" })).toBeDisabled();
  });

  it("stores shared-tablet logout preference only in this browser", async () => {
    const user = userEvent.setup();
    render(<AttendanceClock openSession={null} outlets={[outlet]} profile={{ enrolledAt: new Date().toISOString(), modelVersion: "human-3.3.6" }} recentSessions={[]} user={{ name: "Kasir Satu", email: "kasir@example.com" }} />);
    await user.click(screen.getByRole("switch", { name: "Logout otomatis pada tablet bersama" }));
    expect(localStorage.getItem(attendanceSharedDeviceKey)).toBe("1");
  });

  it("stays in manual logout mode when local storage is unavailable", async () => {
    const user = userEvent.setup();
    const storage = vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => { throw new Error("blocked"); });
    render(<AttendanceClock openSession={null} outlets={[outlet]} profile={{ enrolledAt: new Date().toISOString(), modelVersion: "human-3.3.6" }} recentSessions={[]} user={{ name: "Kasir Satu", email: "kasir@example.com" }} />);
    const toggle = screen.getByRole("switch", { name: "Logout otomatis pada tablet bersama" });
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(localStorage.getItem(attendanceSharedDeviceKey)).toBeNull();
    storage.mockRestore();
  });
});
