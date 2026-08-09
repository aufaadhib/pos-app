import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { updateStatus } = vi.hoisted(() => ({ updateStatus: vi.fn() }));
vi.mock("@/app/kitchen/actions", () => ({ updateKitchenTicketStatusAction: updateStatus }));

import { KitchenBoard } from "@/components/kitchen/kitchen-board";

describe("kitchen board", () => {
  beforeEach(() => updateStatus.mockResolvedValue({ status: "success", message: "Ticket mulai diproses." }));

  it("shows all queue states and advances a new ticket", async () => {
    const user = userEvent.setup();
    render(<KitchenBoard outletId="outlet-1" tickets={[{ id: "ticket-1", number: "12", kind: "INITIAL", status: "NEW", sentAt: new Date().toISOString(), sentByName: "Kasir", order: { orderType: "DINE_IN", tableLabel: "A-01", externalOrderId: null }, lines: [{ id: "line-1", action: "ADD", productName: "Kopi", quantity: 2, selectionLabel: null, note: null, reason: null }] }]} />);
    expect(screen.getByRole("heading", { name: "Baru" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Diproses" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Selesai" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Mulai proses" }));
    expect(updateStatus).toHaveBeenCalledWith({ ticketId: "ticket-1", outletId: "outlet-1", status: "PROCESSING" });
  });
});
