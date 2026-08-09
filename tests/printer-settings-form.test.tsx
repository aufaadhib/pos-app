import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { updateSettings } = vi.hoisted(() => ({ updateSettings: vi.fn() }));
vi.mock("@/app/settings/printer-actions", () => ({ updatePrinterSettingsAction: updateSettings }));

import { PrinterSettingsForm } from "@/components/settings/printer-settings-form";
import { getAutoPrintStorageKey } from "@/lib/printers/device-preference";

const outlet = { id: "outlet-1", code: "GLT", name: "Glutong Pusat", receiptPaperSize: "MM80" as const, receiptFooter: "Terima kasih." };

describe("printer settings form", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    updateSettings.mockResolvedValue({ status: "success", message: "Pengaturan printer berhasil disimpan." });
  });

  it("changes paper size and keeps the shared preview in sync", async () => {
    const user = userEvent.setup();
    render(<PrinterSettingsForm outlet={outlet} />);
    const sheet = screen.getByTestId("receipt-preview-sheet");
    expect(sheet).toHaveAttribute("data-paper-size", "MM80");
    expect(sheet).toHaveClass("max-w-[24rem]", "px-[5%]", "bg-white");
    const paperSize = screen.getByRole("combobox", { name: "Ukuran kertas" });
    await user.click(paperSize);
    await user.keyboard("{ArrowUp}{Enter}");
    expect(screen.getByRole("article", { name: /Struk transaksi/ })).toHaveAttribute("data-paper-size", "MM58");
    expect(screen.getByRole("article", { name: /Struk transaksi/ })).toHaveClass("max-w-none", "bg-transparent");
    expect(sheet).toHaveAttribute("data-paper-size", "MM58");
    expect(sheet).toHaveClass("max-w-[18rem]", "px-[5.17%]");
    expect(screen.getByText("Kertas 58 mm · area cetak 52 mm")).toBeVisible();
  });

  it("hides an empty footer and saves its trimmed value", async () => {
    const user = userEvent.setup();
    render(<PrinterSettingsForm outlet={outlet} />);
    const footer = screen.getByLabelText(/Footer struk/);
    await user.clear(footer);
    expect(screen.queryByText("Terima kasih.")).not.toBeInTheDocument();
    await user.type(footer, "  Sampai jumpa.  ");
    await user.click(screen.getByRole("button", { name: "Simpan perubahan" }));
    expect(updateSettings).toHaveBeenCalledWith({ outletId: "outlet-1", receiptPaperSize: "MM80", receiptFooter: "  Sampai jumpa.  " });
  });

  it("stores auto-print for this outlet only", async () => {
    const user = userEvent.setup();
    render(<PrinterSettingsForm outlet={outlet} />);
    const toggle = screen.getByRole("switch", { name: /Buka dialog cetak browser otomatis/ });
    expect(screen.getByText("Nonaktif")).toBeVisible();
    expect(screen.getByText(/Nonaktif\. Dialog browser tidak akan terbuka otomatis/)).toHaveClass("text-destructive");
    await user.click(toggle);
    expect(window.localStorage.getItem(getAutoPrintStorageKey("outlet-1"))).toBe("true");
    expect(toggle).toBeChecked();
    expect(screen.getByText("Aktif")).toBeVisible();
    expect(screen.getByText(/Aktif\. Dialog browser akan terbuka otomatis/)).toHaveClass("text-success");
  });

  it("falls back to manual mode when browser storage is unavailable", async () => {
    const user = userEvent.setup();
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    render(<PrinterSettingsForm outlet={outlet} />);
    const toggle = screen.getByRole("switch", { name: /Buka dialog cetak browser otomatis/ });
    await user.click(toggle);
    expect(toggle).not.toBeChecked();
    setItem.mockRestore();
  });

  it("prints the example without creating a transaction", async () => {
    const user = userEvent.setup();
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    render(<PrinterSettingsForm outlet={outlet} />);
    await user.click(screen.getByRole("button", { name: "Cetak contoh" }));
    expect(print).toHaveBeenCalledOnce();
    expect(updateSettings).not.toHaveBeenCalled();
  });
});
