import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/catalog/actions", () => ({
  archiveCategoryAction: vi.fn(),
  archiveProductAction: vi.fn(),
  createCategoryAction: vi.fn(),
  createProductAction: vi.fn(),
  restoreCategoryAction: vi.fn(),
  restoreProductAction: vi.fn(),
  updateCategoryAction: vi.fn(),
  updateProductAction: vi.fn(),
}));

import { CategoryFormDialog, ProductFormDialog } from "@/components/catalog/catalog-dialogs";

const category = {
  id: "category-1",
  name: "Kopi",
  description: null,
  displayOrder: 0,
  status: "ACTIVE" as const,
  updatedAt: "2026-08-06T08:00:00.000Z",
  activeProductCount: 0,
  totalProductCount: 0,
};

describe("catalog dialogs", () => {
  it("connects category labels to their fields", async () => {
    render(<CategoryFormDialog />);
    await userEvent.click(screen.getByRole("button", { name: "Kategori baru" }));
    expect(screen.getByRole("textbox", { name: "Nama kategori" })).toBeVisible();
    expect(screen.getByRole("spinbutton", { name: "Urutan tampil" })).toBeVisible();
  });

  it("shows the Rupiah input and an accessible category selector", async () => {
    render(<ProductFormDialog categories={[category]} />);
    await userEvent.click(screen.getByRole("button", { name: "Produk baru" }));
    expect(screen.getByRole("textbox", { name: "Nama produk" })).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Harga dasar (Rp)" })).toHaveAttribute("inputmode", "numeric");
    expect(screen.getByRole("combobox", { name: "Kategori" })).toBeVisible();
  });
});
