import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ detect: vi.fn(), fetch: vi.fn(), getCurrentPosition: vi.fn(), getUserMedia: vi.fn(), load: vi.fn(), play: vi.fn(), refresh: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/app/attendance/actions", () => ({ requestAttendanceExceptionAction: vi.fn() }));
vi.mock("@/lib/auth/client", () => ({ authClient: { signOut: vi.fn() } }));
vi.mock("@vladmandic/human", () => ({ default: class MockHuman { load = mocks.load; detect = mocks.detect; } }));

import { AttendanceClock } from "@/components/attendance/attendance-clock";
import { attendanceSharedDeviceKey } from "@/lib/attendance/constants";

const outlet = { id: "outlet-1", code: "PST", name: "Pusat", attendanceEnabled: true, attendanceLatitude: -6.2, attendanceLongitude: 106.8, attendanceRadiusMeters: 100 };

describe("attendance clock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mocks.getUserMedia.mockResolvedValue({ getTracks: () => [] });
    mocks.play.mockResolvedValue(undefined);
    mocks.getCurrentPosition.mockImplementation((success) => success({ coords: { accuracy: 12, latitude: -6.2, longitude: 106.8 } }));
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: mocks.getUserMedia } });
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition: mocks.getCurrentPosition } });
    vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(mocks.play);
    vi.spyOn(HTMLVideoElement.prototype, "videoWidth", "get").mockReturnValue(640);
    vi.spyOn(HTMLVideoElement.prototype, "videoHeight", "get").mockReturnValue(480);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: vi.fn() } as never);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) => callback(new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: "image/jpeg" })));
    vi.stubGlobal("fetch", mocks.fetch);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callback(0); return 1; });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

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

  it("requests location and submits attendance automatically after the liveness gesture", async () => {
    const user = userEvent.setup();
    mocks.fetch.mockImplementation(async (input: RequestInfo | URL) => {
      if (String(input).includes("/challenge")) return { ok: true, json: async () => ({ verificationId: "verification-1", nonce: "n".repeat(32), action: "BLINK", actionLabel: "Kedipkan kedua mata" }) } as Response;
      return { ok: true, json: async () => ({ success: true }) } as Response;
    });
    mocks.detect.mockResolvedValue({ face: [{ embedding: Array.from({ length: 32 }, () => 0.1), live: 0.9, real: 0.9 }], gesture: [{ gesture: "blink left eye" }] });
    render(<AttendanceClock openSession={null} outlets={[outlet]} profile={{ enrolledAt: new Date().toISOString(), modelVersion: "human-3.3.6" }} recentSessions={[]} user={{ name: "Kasir Satu", email: "kasir@example.com" }} />);

    await user.click(screen.getByRole("button", { name: "Absensi masuk" }));

    expect(screen.queryByRole("button", { name: "Ambil dan verifikasi" })).not.toBeInTheDocument();
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledWith("/api/attendance/verify", expect.objectContaining({ method: "POST" })), { timeout: 3_000 });
    const verificationRequest = mocks.fetch.mock.calls.find(([input]) => String(input).includes("/verify"));
    const payload = JSON.parse((verificationRequest?.[1]?.body as FormData).get("payload") as string);
    expect(payload).toEqual(expect.objectContaining({ livenessPassed: true, location: { accuracyMeters: 12, latitude: -6.2, longitude: 106.8 } }));
    expect(mocks.getCurrentPosition).toHaveBeenCalledTimes(2);
  });
});
