import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const { updateSetting } = vi.hoisted(() => ({ updateSetting: vi.fn() }));
vi.mock("@/app/settings/actions", () => ({ updateOpenOrderSettingAction: updateSetting }));

import { OutletOperationsForm } from "@/components/settings/outlet-operations-form";

describe("outlet operations form", () => {
  it("enables saving only after a setting changes", async () => {
    updateSetting.mockResolvedValue({ status: "success", message: "Simpan order diaktifkan." });
    const user = userEvent.setup();
    render(<OutletOperationsForm initialEnabled={false} outletId="outlet-1" />);
    const save = screen.getByRole("button", { name: "Simpan" });
    expect(save).toBeDisabled();
    await user.click(screen.getByRole("checkbox", { name: /Izinkan simpan order/i }));
    await user.click(save);
    expect(updateSetting).toHaveBeenCalledWith({ outletId: "outlet-1", openOrdersEnabled: true });
  });
});
