import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SignOutButton } from "@/components/sign-out-button";

const { signOut, toastError } = vi.hoisted(() => ({
  signOut: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/lib/auth/client", () => ({
  authClient: { signOut },
}));

vi.mock("react-toastify", () => ({
  toast: { error: toastError },
}));

describe("SignOutButton", () => {
  beforeEach(() => {
    signOut.mockReset();
    toastError.mockReset();
  });

  it("keeps loading active after a successful sign-out starts navigation", async () => {
    const user = userEvent.setup();
    signOut.mockResolvedValue({ error: null });

    render(<SignOutButton />);
    await user.click(screen.getByRole("button", { name: "Keluar dari Glutong POS" }));

    expect(signOut).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Sedang keluar dari Glutong POS" })).toBeDisabled();
  });

  it("restores the button when sign-out fails", async () => {
    const user = userEvent.setup();
    signOut.mockResolvedValue({ error: { message: "FAILED" } });

    render(<SignOutButton />);
    await user.click(screen.getByRole("button", { name: "Keluar dari Glutong POS" }));

    expect(await screen.findByRole("button", { name: "Keluar dari Glutong POS" })).toBeEnabled();
    expect(toastError).toHaveBeenCalledWith("Sesi belum dapat diakhiri. Coba lagi.");
  });
});
