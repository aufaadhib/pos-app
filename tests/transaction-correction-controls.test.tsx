import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/transactions/actions", () => ({
  voidSaleAction: vi.fn(),
  refundSaleAction: vi.fn(),
}));

import { TransactionCorrectionControls } from "@/components/pos/transaction-correction-controls";

const sale = {
  id: "sale-1",
  receiptNumber: "GLT-20260809-0001",
  paymentMethod: "CASH" as const,
  status: "COMPLETED" as const,
  settlementStatus: "NOT_APPLICABLE" as const,
  items: [{
    id: "item-1",
    productName: "Kopi Susu",
    sku: null,
    quantity: 2,
    refundedQuantity: 0,
    note: null,
    unitPrice: "25000.00",
    lineTotal: "50000.00",
    variants: [],
    modifiers: [],
  }],
};

describe("transaction correction controls", () => {
  it("shows same-day void and item refund actions", () => {
    render(<TransactionCorrectionControls canVoid outletId="outlet-1" sale={sale} />);
    expect(screen.getByRole("button", { name: /void penuh/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /refund item/i })).toBeInTheDocument();
  });

  it("hides void for older or partially-refunded sales", () => {
    render(<TransactionCorrectionControls canVoid={false} outletId="outlet-1" sale={{ ...sale, status: "PARTIALLY_REFUNDED" }} />);
    expect(screen.queryByRole("button", { name: /void penuh/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /refund item/i })).toBeInTheDocument();
  });

  it("hides all correction actions after settlement", () => {
    const { container } = render(<TransactionCorrectionControls canVoid outletId="outlet-1" sale={{ ...sale, paymentMethod: "DELIVERY_PLATFORM", settlementStatus: "SETTLED" }} />);
    expect(container).toBeEmptyDOMElement();
  });
});
