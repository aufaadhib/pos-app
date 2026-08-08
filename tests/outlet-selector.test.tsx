import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { OutletSelector } from "@/components/outlets/outlet-selector";
import type { OutletItem } from "@/lib/outlets/types";

vi.mock("@/app/select-outlet/actions", () => ({
  selectOutletAction: vi.fn(async () => ({ status: "success", message: "Outlet dipilih." })),
}));

const outlet = (id: string, name: string): OutletItem => ({
  id,
  code: id.toUpperCase(),
  name,
  timezone: "Asia/Jakarta",
  addressLine: null,
  provinceCode: "31",
  provinceName: "DKI Jakarta",
  cityCode: "3174",
  cityName: "Jakarta Selatan",
  taxRate: "0.00",
  serviceChargeRate: "0.00",
  pricesIncludeTax: false,
  status: "ACTIVE",
  staffCount: 1,
  updatedAt: "2026-08-08T00:00:00.000Z",
});

describe("OutletSelector", () => {
  it("marks the active-shift outlet and locks other outlets", () => {
    render(<OutletSelector activeShiftOutletId="pusat" outlets={[outlet("pusat", "Gerai Pusat"), outlet("timur", "Gerai Timur")]} />);

    expect(screen.getByRole("button", { name: /Gerai Pusat.*Shift aktif/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Gerai Timur/ })).toBeDisabled();
  });
});
