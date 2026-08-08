import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/shifts/actions", () => ({
  openCashShiftAction: vi.fn(async () => ({ status: "success", message: "Shift berhasil dibuka." })),
  addCashMovementAction: vi.fn(async () => ({ status: "success", message: "Movement tersimpan." })),
  closeCashShiftAction: vi.fn(async () => ({ status: "success", message: "Shift ditutup." })),
  forceCloseCashShiftAction: vi.fn(async () => ({ status: "success", message: "Shift ditutup." })),
}));

import { OpenShiftCard, PosShiftBar, WrongOutletShiftCard } from "@/components/shifts/shift-controls";

const shift = {
  id: "shift-1",
  outletId: "outlet-1",
  outletName: "Glutong Pusat",
  outletTimezone: "Asia/Jakarta",
  isCurrentUser: true,
  businessDate: "2026-08-08",
  status: "OPEN" as const,
  openingCash: "100000.00",
  openedByName: "Kasir",
  openedAt: "2026-08-08T01:00:00.000Z",
  closeMode: null,
  closedByName: null,
  closedAt: null,
  expectedCash: null,
  actualCash: null,
  cashDifference: null,
};

describe("cash shift controls", () => {
  it("shows a visible opening balance label and touch-sized submit action", () => {
    render(<OpenShiftCard outletId="outlet-1" outletName="Glutong Pusat" />);
    expect(screen.getByLabelText("Saldo awal kas (Rp)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Buka shift" })).toBeInTheDocument();
  });

  it("keeps expected cash hidden in the self-close dialog", async () => {
    const user = userEvent.setup();
    render(<PosShiftBar shift={shift} />);
    await user.click(screen.getByRole("button", { name: /tutup/i }));
    expect(screen.getByLabelText("Kas fisik aktual (Rp)")).toBeInTheDocument();
    expect(screen.queryByText(/Rp350\.000/)).not.toBeInTheDocument();
  });

  it("blocks POS when the active shift belongs to another outlet", () => {
    render(<WrongOutletShiftCard shift={{ ...shift, outletId: "outlet-2", outletName: "Glutong Timur" }} />);
    expect(screen.getByText("Shift masih aktif di Glutong Timur")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Buka rincian shift" })).toHaveAttribute("href", "/shifts/shift-1");
  });
});
