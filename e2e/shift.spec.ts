import { expect, test, type Page } from "@playwright/test";

const email = process.env.E2E_SHIFT_EMAIL;
const password = process.env.E2E_SHIFT_PASSWORD;
const outletName = process.env.E2E_SHIFT_OUTLET_NAME;
const productName = process.env.E2E_SHIFT_PRODUCT_NAME;
const enabled = Boolean(process.env.E2E_SHIFT_LIVE === "true" && email && password && outletName && productName);

/** Signs in and selects the isolated outlet created by the guarded runner. */
async function signIn(page: Page) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email!);
  await page.getByLabel("Kata sandi", { exact: true }).fill(password!);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL(/\/(workspace|select-outlet)$/, { timeout: 30_000 });
  if (new URL(page.url()).pathname !== "/select-outlet") await page.goto("/select-outlet");
  await page.getByRole("button", { name: new RegExp(outletName!) }).click();
  await expect(page).toHaveURL(/\/workspace$/, { timeout: 30_000 });
}

/** Completes one direct checkout using the selected payment method. */
async function checkout(page: Page, method: "Tunai" | "QRIS") {
  await page.getByRole("button", { name: `Tambah ${productName} ke pesanan` }).click();
  await page.getByRole("button", { name: "Bayar sekarang" }).click();
  await page.getByRole("button", { name: "Takeaway" }).click();
  await page.getByRole("button", { name: method, exact: true }).click();
  if (method === "Tunai") await page.getByLabel("Uang diterima (Rp)").fill("25000");
  await page.getByRole("button", { name: "Konfirmasi pembayaran" }).click();
  await expect(page.getByText("Pembayaran berhasil")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(method, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Pesanan baru" }).click();
}

test("cashier shift reconciles cash while summarizing non-cash payments", async ({ page }) => {
  test.skip(!enabled, "Requires the guarded shift E2E runner.");
  test.setTimeout(180_000);
  await signIn(page);

  await page.goto("/pos");
  await expect(page.getByRole("heading", { name: "Buka shift kasir" })).toBeVisible();
  await page.getByLabel("Saldo awal kas (Rp)").fill("100000");
  await page.getByRole("button", { name: "Buka shift" }).click();
  await expect(page.getByRole("button", { name: `Tambah ${productName} ke pesanan` })).toBeVisible({ timeout: 30_000 });

  for (const viewport of [{ width: 1280, height: 720 }, { width: 820, height: 1180 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1)).toBe(true);
    if (viewport.width === 1280) {
      const categoryRail = page.getByLabel("Kategori menu");
      expect(await categoryRail.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    }
  }
  await page.setViewportSize({ width: 1280, height: 720 });

  await checkout(page, "Tunai");
  await checkout(page, "QRIS");

  await page.goto("/shifts");
  await page.getByRole("button", { name: "Kas masuk" }).click();
  await page.getByLabel("Nominal (Rp)").fill("10000");
  await page.getByLabel("Alasan").fill("Tambahan uang kembalian");
  await page.getByRole("button", { name: "Simpan movement" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 30_000 });

  await page.getByRole("button", { name: "Tutup shift" }).first().click();
  await expect(page.getByText(/Hitung uang fisik tanpa melihat saldo seharusnya/)).toBeVisible();
  await expect(page.getByText("Kas seharusnya", { exact: true })).toHaveCount(0);
  await page.getByLabel("Kas fisik aktual (Rp)").fill("135000");
  await page.getByRole("button", { name: "Konfirmasi tutup shift" }).click();
  await expect(page.getByText("Belum ada shift pribadi")).toBeVisible({ timeout: 30_000 });

  const closedShift = page.locator('a[href^="/shifts/"]').filter({ hasText: "Selisih" }).first();
  await expect(closedShift).toContainText(/Rp\s*0/u);
  await closedShift.click();
  const cashSummary = page.getByLabel("Ringkasan kas");
  await expect(cashSummary).toBeVisible({ timeout: 30_000 });
  await expect(cashSummary.getByText(/Rp\s*100\.000/u)).toBeVisible();
  await expect(cashSummary.getByText(/Rp\s*25\.000/u)).toBeVisible();
  await expect(cashSummary.getByText(/Rp\s*10\.000 \/ Rp\s*0/u)).toBeVisible();
  await expect(cashSummary.getByText(/Rp\s*135\.000 \/ Rp\s*0/u)).toBeVisible();
  await expect(page.getByText("QRIS", { exact: true })).toBeVisible();

  for (const viewport of [{ name: "tablet", width: 820, height: 1180 }, { name: "mobile", width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await expect(page.locator("main")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ fullPage: true, path: `.artifacts/shifts/detail-${viewport.name}.png` });
  }
});
