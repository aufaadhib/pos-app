import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/change-password/actions", () => ({
  changePasswordAction: vi.fn(),
}));

import { ChangePasswordForm } from "@/components/staff/change-password-form";

describe("ChangePasswordForm", () => {
  it("labels all password fields and toggles their visibility", async () => {
    const user = userEvent.setup();
    render(<ChangePasswordForm />);

    const current = screen.getByLabelText("Kata sandi sementara");
    const next = screen.getByLabelText("Kata sandi baru");
    const confirmation = screen.getByLabelText("Ulangi kata sandi baru");
    expect(current).toHaveAttribute("type", "password");
    expect(next).toHaveAttribute("autocomplete", "new-password");

    await user.click(screen.getByRole("button", { name: "Tampilkan kata sandi" }));
    expect(current).toHaveAttribute("type", "text");
    expect(next).toHaveAttribute("type", "text");
    expect(confirmation).toHaveAttribute("type", "text");
  });
});
