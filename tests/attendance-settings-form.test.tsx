import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ update: vi.fn() }));

vi.mock("@/app/settings/attendance-actions", () => ({ updateAttendanceSettingsAction: mocks.update }));
vi.mock("next/dynamic", () => ({ default: () => function MockMap({ value, onChange }: { value: { latitude: number; longitude: number; radiusMeters: number }; onChange: (value: { latitude: number; longitude: number; radiusMeters: number }) => void }) {
  return <button onClick={() => onChange({ latitude: -7.25, longitude: 112.75, radiusMeters: 220 })} type="button">Peta {value.latitude} · {value.radiusMeters}</button>;
} }));

import { AttendanceSettingsForm } from "@/components/settings/attendance-settings-form";

const outlet = { id: "outlet-1", code: "SBY", name: "Surabaya", attendanceEnabled: false, attendanceLatitude: null, attendanceLongitude: null, attendanceRadiusMeters: 100 };

describe("attendance settings form", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.update.mockResolvedValue({ status: "success", message: "Tersimpan" });
  });

  it("synchronizes dragged map values into coordinate and radius fields", async () => {
    const user = userEvent.setup();
    render(<AttendanceSettingsForm outlet={outlet} />);
    await user.click(screen.getByRole("button", { name: /Peta/ }));
    expect(screen.getByLabelText("Latitude")).toHaveValue(-7.25);
    expect(screen.getByLabelText("Longitude")).toHaveValue(112.75);
    expect(screen.getByLabelText("Radius kehadiran")).toHaveValue(220);
  });

  it("uses current geolocation and submits the synchronized values", async () => {
    const user = userEvent.setup();
    const getCurrentPosition = vi.fn((success: PositionCallback) => success({ coords: { latitude: -6.91, longitude: 107.61, accuracy: 12 } } as GeolocationPosition));
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition } });
    render(<AttendanceSettingsForm outlet={outlet} />);
    await user.click(screen.getByRole("button", { name: "Gunakan lokasi saya" }));
    await waitFor(() => expect(screen.getByLabelText("Latitude")).toHaveValue(-6.91));
    fireEvent.click(screen.getByRole("switch", { name: /Aktifkan absensi outlet/ }));
    await user.click(screen.getByRole("button", { name: "Simpan pengaturan" }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ outletId: "outlet-1", attendanceEnabled: true, latitude: -6.91, longitude: 107.61, radiusMeters: 100 })));
  });
});
