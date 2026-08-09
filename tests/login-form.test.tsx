import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LoginForm } from "@/components/login-form";

const { refresh, replace, signInEmail } = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
  signInEmail: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
}));

vi.mock("@/lib/auth/client", () => ({
  authClient: {
    signIn: { email: signInEmail },
  },
}));

describe("LoginForm", () => {
  beforeEach(() => {
    replace.mockReset();
    refresh.mockReset();
    signInEmail.mockReset();
  });

  it("provides accessible labels and toggles password visibility", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    const email = screen.getByLabelText("Email");
    const password = screen.getByLabelText("Kata sandi");

    expect(email).toHaveAttribute("type", "email");
    expect(password).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: "Tampilkan kata sandi" }));
    expect(password).toHaveAttribute("type", "text");
  });

  it("shows validation errors without sending a request", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText("Email"), "salah");
    await user.type(screen.getByLabelText("Kata sandi"), "pendek");
    await user.click(screen.getByRole("button", { name: "Masuk" }));

    expect(await screen.findByText("Masukkan alamat email yang valid.")).toBeVisible();
    expect(signInEmail).not.toHaveBeenCalled();
  });

  it("disables controls while pending and shows a generic credential error", async () => {
    const user = userEvent.setup();
    let resolveRequest: ((value: { error: { message: string } }) => void) | undefined;
    signInEmail.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    );

    render(<LoginForm />);
    await user.type(screen.getByLabelText("Email"), "nobody@example.com");
    await user.type(screen.getByLabelText("Kata sandi"), "not-the-password");
    await user.click(screen.getByRole("button", { name: "Masuk" }));

    expect(screen.getByRole("button", { name: "Memeriksa akses…" })).toBeDisabled();

    resolveRequest?.({ error: { message: "USER_NOT_FOUND" } });

    expect(
      await screen.findByText(
        "Email atau kata sandi tidak sesuai. Periksa kembali lalu coba lagi.",
      ),
    ).toBeVisible();
    expect(screen.queryByText("USER_NOT_FOUND")).not.toBeInTheDocument();
  });

  it("keeps the loading state active after scheduling a successful navigation", async () => {
    const user = userEvent.setup();
    signInEmail.mockResolvedValue({ error: null });

    render(<LoginForm />);
    await user.type(screen.getByLabelText("Email"), "owner@example.com");
    await user.type(screen.getByLabelText("Kata sandi"), "valid-password");
    await user.click(screen.getByRole("button", { name: "Masuk" }));

    expect(replace).toHaveBeenCalledWith("/workspace");
    expect(refresh).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Memeriksa akses…" })).toBeDisabled();
  });
});
