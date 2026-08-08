import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { CurrencyInput } from "@/components/ui/currency-input";

describe("CurrencyInput", () => {
  it("formats thousands with dots and submits raw digits", async () => {
    const user = userEvent.setup();
    const { container } = render(<CurrencyInput aria-label="Saldo awal" name="openingCash" />);

    await user.type(screen.getByLabelText("Saldo awal"), "100000");

    expect(screen.getByLabelText("Saldo awal")).toHaveValue("100.000");
    expect(container.querySelector('input[name="openingCash"]')).toHaveValue("100000");
  });
});
