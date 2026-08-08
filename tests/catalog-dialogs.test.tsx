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
  removeProductImageAction: vi.fn(),
  saveProductImageAction: vi.fn(),
  saveProductImagePositionAction: vi.fn(),
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

const product = {
  id: "product-1",
  categoryId: category.id,
  categoryName: category.name,
  categoryStatus: "ACTIVE" as const,
  name: "Kopi Susu",
  sku: "KOP-1",
  description: null,
  imageUrl: "https://store.public.blob.vercel-storage.com/products/product-1/cover.jpg",
  imagePositionX: 50,
  imagePositionY: 50,
  basePrice: "25000.00",
  displayOrder: 0,
  status: "ACTIVE" as const,
  updatedAt: "2026-08-07T08:00:00.000Z",
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

  it("supports keyboard positioning for the responsive image focal point", async () => {
    const user = userEvent.setup();
    render(<ProductFormDialog categories={[category]} product={product} />);
    await user.click(screen.getByRole("button", { name: "Edit produk" }));
    const editor = screen.getByRole("button", { name: "Atur titik fokus gambar Kopi Susu" });
    expect(editor).toHaveClass("aspect-square");
    editor.focus();
    await user.keyboard("{ArrowRight}{ArrowDown}");
    expect(document.querySelector<HTMLInputElement>('input[name="positionX"]')?.value).toBe("49");
    expect(document.querySelector<HTMLInputElement>('input[name="positionY"]')?.value).toBe("49");
  });

  it("keeps an image below 3 MB eligible for upload without compression", async () => {
    const user = userEvent.setup();
    render(<ProductFormDialog categories={[category]} product={product} />);
    await user.click(screen.getByRole("button", { name: "Edit produk" }));
    const input = screen.getByLabelText("Pilih gambar");
    await user.upload(input, new File([new Uint8Array(2 * 1024 * 1024 + 1)], "large.jpg", { type: "image/jpeg" }));
    expect(screen.queryByText(/Ukuran gambar maksimal/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ganti gambar" })).toBeEnabled();
  });
});
