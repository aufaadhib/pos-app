import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PosRegister } from "@/components/pos/pos-register";
import type { PosMenu } from "@/lib/pos/types";

const mocks = vi.hoisted(() => ({ checkoutSaleAction: vi.fn() }));

vi.mock("@/app/pos/actions", () => ({ checkoutSaleAction: mocks.checkoutSaleAction }));

const menu: PosMenu = {
  outlet: { id: "outlet-1", code: "GLT", name: "Glutong Pusat", timezone: "Asia/Jakarta", taxRate: "10.00", serviceChargeRate: "5.00", pricesIncludeTax: false },
  deliveryChannels: [],
  categories: [{ id: "category-1", name: "Kopi" }],
  products: [{ id: "product-1", categoryId: "category-1", categoryName: "Kopi", name: "Kopi Susu", sku: "KOP-1", description: null, imageUrl: null, imagePositionX: 50, imagePositionY: 50, effectiveBasePrice: "25000.00", channelBasePrices: [], variantGroups: [], modifierGroups: [] }],
  truncated: false,
};

describe("POS register layout", () => {
  beforeEach(() => vi.clearAllMocks());

  it("hides and restores the desktop category rail", async () => {
    const user = userEvent.setup();
    render(<PosRegister menu={menu} />);

    const categoryRail = screen.getByRole("complementary", { name: "Kategori menu" });
    expect(categoryRail).toBeInTheDocument();
    expect(within(categoryRail).getByRole("button", { name: "Kopi" }).parentElement).toHaveClass("overflow-x-hidden");
    await user.click(screen.getByRole("button", { name: "Sembunyikan kategori" }));
    expect(screen.queryByRole("complementary", { name: "Kategori menu" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Tampilkan kategori" }));
    expect(screen.getByRole("complementary", { name: "Kategori menu" })).toBeInTheDocument();
  });

  it("keeps the product menu inside its own desktop scroll region", () => {
    render(<PosRegister menu={menu} />);
    expect(screen.getByRole("region", { name: "Daftar menu" })).toHaveClass("h-full", "min-h-0", "overflow-y-auto", "overscroll-contain");
  });

  it("hides the open-order list when the outlet feature is disabled", () => {
    const { rerender } = render(<PosRegister menu={menu} openOrders={[]} />);
    expect(screen.queryByRole("button", { name: "Buka pesanan tersimpan" })).not.toBeInTheDocument();

    rerender(<PosRegister menu={{ ...menu, outlet: { ...menu.outlet, openOrdersEnabled: true } }} openOrders={[]} />);
    expect(screen.getByRole("button", { name: "Buka pesanan tersimpan" })).toBeVisible();
  });

  it("merges an identical product and shows its quantity on the menu card", async () => {
    const user = userEvent.setup();
    render(<PosRegister menu={menu} />);

    const productButton = screen.getByRole("button", { name: "Tambah Kopi Susu ke pesanan" });
    await user.click(productButton);
    await user.click(productButton);

    expect(screen.getByLabelText("2 Kopi Susu dalam pesanan")).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(1);
  });

  it("renders the stored product image with a meaningful label", () => {
    render(<PosRegister menu={{ ...menu, products: [{ ...menu.products[0], imageUrl: "https://store.public.blob.vercel-storage.com/products/product-1/cover.jpg" }] }} />);
    expect(screen.getByRole("img", { name: "Foto produk Kopi Susu" })).toBeVisible();
  });

  it("keeps the paid receipt in the register and prints it", async () => {
    const user = userEvent.setup();
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    mocks.checkoutSaleAction.mockResolvedValue({
      status: "success",
      message: "Transaksi GLT-20260808-0001 berhasil disimpan.",
      saleId: "sale-1",
      receiptNumber: "GLT-20260808-0001",
      total: "28875.00",
      changeAmount: "21125.00",
    });
    render(<PosRegister menu={menu} />);

    await user.click(screen.getByRole("button", { name: "Tambah Kopi Susu ke pesanan" }));
    await user.click(screen.getByRole("button", { name: "Bayar sekarang" }));
    await user.type(screen.getByLabelText(/Nomor atau nama meja/), "A-07");
    await user.type(screen.getByLabelText(/Uang diterima/), "50000");
    await user.click(screen.getByRole("button", { name: "Konfirmasi pembayaran" }));

    const receipt = await screen.findByRole("article", { name: "Struk transaksi GLT-20260808-0001" });
    expect(receipt).toHaveClass("thermal-receipt");
    expect(receipt).toHaveTextContent("Kopi Susu");
    expect(receipt).toHaveTextContent("Meja A-07");
    await user.click(screen.getByRole("button", { name: "Cetak struk" }));
    expect(print).toHaveBeenCalledOnce();
  });

  it("records a delivery-platform order with its channel price and pending settlement", async () => {
    const user = userEvent.setup();
    mocks.checkoutSaleAction.mockResolvedValue({
      status: "success",
      message: "Transaksi berhasil disimpan.",
      saleId: "sale-delivery-1",
      receiptNumber: "GLT-20260808-0002",
      total: "30000.00",
      changeAmount: null,
    });
    const deliveryMenu: PosMenu = {
      ...menu,
      deliveryChannels: [{ id: "channel-gofood", provider: "GOFOOD", label: "GoFood", markupRate: "20.00", estimatedFeeRate: "20.00", settlementDelayHours: 24 }],
      products: [{ ...menu.products[0], channelBasePrices: [{ channelId: "channel-gofood", basePrice: "30000.00" }] }],
    };
    render(<PosRegister menu={deliveryMenu} />);

    await user.click(screen.getByRole("button", { name: "GoFood" }));
    await user.click(screen.getByRole("button", { name: "Tambah Kopi Susu ke pesanan" }));
    await user.click(screen.getByRole("button", { name: "Bayar sekarang" }));
    await user.type(screen.getByLabelText(/Nomor order platform/), "GF-12345");
    await user.click(screen.getByRole("button", { name: "Konfirmasi pembayaran" }));

    expect(mocks.checkoutSaleAction).toHaveBeenCalledWith(expect.objectContaining({
      source: { type: "DELIVERY_PLATFORM", channelId: "channel-gofood", externalOrderId: "GF-12345" },
      orderType: "DELIVERY",
      payment: undefined,
      items: [expect.objectContaining({ expectedUnitPrice: "30000.00" })],
    }));
    expect(await screen.findByText("Menunggu settlement platform")).toBeVisible();
  });
});
