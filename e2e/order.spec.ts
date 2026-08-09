import { expect, test, type Browser, type Page } from "@playwright/test";

const ownerEmail = process.env.E2E_ORDER_OWNER_EMAIL;
const ownerPassword = process.env.E2E_ORDER_OWNER_PASSWORD;
const cashierEmail = process.env.E2E_ORDER_CASHIER_EMAIL;
const cashierPassword = process.env.E2E_ORDER_CASHIER_PASSWORD;
const outletName = process.env.E2E_ORDER_OUTLET_NAME;
const productName = process.env.E2E_ORDER_PRODUCT_NAME;
const enabled = Boolean(process.env.E2E_ORDER_LIVE === "true" && ownerEmail && ownerPassword && cashierEmail && cashierPassword && outletName && productName);

/** Signs one isolated browser page in and selects the runner-created outlet. */
async function signIn(page: Page, email: string, password: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Kata sandi", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL(/\/(workspace|select-outlet)$/, { timeout: 30_000 });
  if (new URL(page.url()).pathname !== "/select-outlet") await page.goto("/select-outlet");
  await page.getByRole("button", { name: new RegExp(outletName!) }).click();
  await expect(page).toHaveURL(/\/workspace$/, { timeout: 30_000 });
}

/** Opens a zero-cash shift when the POS gate is visible. */
async function openShift(page: Page) {
  await page.goto("/pos");
  const gate = page.getByRole("heading", { name: "Buka shift kasir" });
  if (await gate.isVisible()) {
    await page.getByLabel("Saldo awal kas (Rp)").fill("0");
    await page.getByRole("button", { name: "Buka shift" }).click();
  }
  await expect(page.getByRole("button", { name: `Tambah ${productName} ke pesanan` })).toBeVisible({ timeout: 30_000 });
}

/** Saves one dine-in order and leaves its latest revision ready for kitchen delivery. */
async function saveDineIn(page: Page, table: string, note = "") {
  await page.getByRole("button", { name: `Tambah ${productName} ke pesanan` }).click();
  if (note) {
    await page.getByRole("button", { name: `Ubah catatan ${productName}` }).click();
    await page.getByLabel(/Catatan item/).fill(note);
    await page.getByRole("button", { name: "Simpan catatan" }).click();
  }
  await page.getByRole("button", { name: "Simpan order" }).click();
  await page.getByLabel("Nomor atau nama meja").fill(table);
  await page.getByRole("button", { name: "Simpan order", exact: true }).last().click();
  await expect(page.getByRole("button", { name: "Kirim dapur" })).toBeVisible({ timeout: 30_000 });
}

/** Loads one named table order from the shared outlet queue. */
async function resumeOrder(page: Page, table: string) {
  await page.goto("/pos");
  await page.getByRole("button", { name: "Buka pesanan tersimpan" }).click();
  const card = page.getByRole("article").filter({ hasText: `Meja ${table}` });
  await expect(card).toBeVisible({ timeout: 30_000 });
  await card.getByRole("button", { name: "Lanjutkan" }).click();
  await expect(page.getByText(`Open order · Meja ${table}`)).toBeVisible();
}

/** Replaces the resumed item note and persists the optimistic order revision. */
async function editAndSaveNote(page: Page, note: string) {
  await page.getByRole("button", { name: `Ubah catatan ${productName}` }).click();
  await page.getByLabel(/Catatan item/).fill(note);
  await page.getByRole("button", { name: "Simpan catatan" }).click();
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await page.getByRole("button", { name: "Simpan order", exact: true }).last().click();
}

/** Creates a second signed-in page for concurrent order editing. */
async function ownerPage(browser: Browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signIn(page, ownerEmail!, ownerPassword!);
  return { context, page };
}

test("open orders produce kitchen deltas, reject conflicts, and continue across shifts", async ({ browser, page }) => {
  test.skip(!enabled, "Requires the guarded order E2E runner.");
  test.setTimeout(420_000);
  const noteTable = "M3-NOTE";
  const cancelTable = "M3-CANCEL";
  const shiftTable = "M3-SHIFT";

  await signIn(page, ownerEmail!, ownerPassword!);
  await openShift(page);

  for (const viewport of [{ width: 1280, height: 720 }, { width: 820, height: 1180 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1)).toBe(true);
    if (viewport.height < 500) {
      expect((await page.locator(".pos-mobile-cart-trigger").boundingBox())?.width).toBeLessThanOrEqual(56);
      expect(await page.getByRole("region", { name: "Daftar menu" }).evaluate((element) => element.clientHeight)).toBeGreaterThan(100);
    }
  }
  await page.setViewportSize({ width: 1280, height: 720 });

  await saveDineIn(page, noteTable, "Sedikit gula");
  await page.getByRole("button", { name: "Kirim dapur" }).click();
  await expect(page.getByText("Ticket berhasil dikirim ke dapur.")).toBeVisible({ timeout: 30_000 });

  const concurrent = await ownerPage(browser);
  await openShift(concurrent.page);
  await concurrent.page.getByRole("button", { name: `Tambah ${productName} ke pesanan` }).click();
  await concurrent.page.getByRole("button", { name: "Simpan order" }).click();
  await concurrent.page.getByLabel("Nomor atau nama meja").fill(noteTable);
  await concurrent.page.getByRole("button", { name: "Simpan order", exact: true }).last().click();
  await expect(concurrent.page.getByText("Meja tersebut masih digunakan oleh pesanan aktif lain.")).toBeVisible({ timeout: 30_000 });

  await concurrent.page.goto("/pos");
  await resumeOrder(page, noteTable);
  await resumeOrder(concurrent.page, noteTable);
  await editAndSaveNote(page, "Tanpa gula");
  await expect(page.getByRole("button", { name: "Kirim dapur" })).toBeVisible({ timeout: 30_000 });
  await editAndSaveNote(concurrent.page, "Catatan konflik");
  await expect(concurrent.page.getByText("Pesanan sudah diubah staf lain. Muat ulang sebelum melanjutkan.")).toBeVisible({ timeout: 30_000 });
  await concurrent.context.close();

  await page.getByRole("button", { name: "Kirim dapur" }).click();
  await expect(page.getByText("Ticket berhasil dikirim ke dapur.")).toBeVisible({ timeout: 30_000 });
  await page.goto("/kitchen");
  const noteTickets = page.getByRole("article").filter({ hasText: `Meja ${noteTable}` });
  await expect(noteTickets).toHaveCount(2, { timeout: 30_000 });
  await expect(noteTickets.filter({ hasText: "Perubahan" })).toContainText("Catatan: Tanpa gula");
  await expect(page.getByText("Catatan konflik")).toHaveCount(0);
  const initialTicket = noteTickets.filter({ hasText: "Awal" });
  await initialTicket.getByRole("button", { name: "Mulai proses" }).click();
  await expect(initialTicket.getByRole("button", { name: "Tandai selesai" })).toBeVisible({ timeout: 30_000 });
  await initialTicket.getByRole("button", { name: "Tandai selesai" }).click();
  await expect(page.getByRole("region", { name: "Selesai" }).getByText(`Meja ${noteTable}`)).toBeVisible({ timeout: 30_000 });

  await page.goto("/pos");
  await saveDineIn(page, cancelTable);
  await page.getByRole("button", { name: "Kirim dapur" }).click();
  await page.goto("/pos");
  await page.getByRole("button", { name: "Buka pesanan tersimpan" }).click();
  const cancelCard = page.getByRole("article").filter({ hasText: `Meja ${cancelTable}` });
  await cancelCard.getByRole("button", { name: `Batalkan ${cancelTable}` }).click();
  await page.getByLabel("Alasan pembatalan").fill("Salah input pesanan");
  await page.getByRole("button", { name: "Batalkan pesanan" }).click();
  await expect(page.getByText("Pesanan berhasil dibatalkan.")).toBeVisible({ timeout: 30_000 });
  await page.goto("/kitchen");
  await expect(page.getByRole("article").filter({ hasText: `Meja ${cancelTable}` }).filter({ hasText: "Alasan: Salah input pesanan" })).toBeVisible({ timeout: 30_000 });

  await page.goto("/pos");
  await saveDineIn(page, shiftTable);
  await page.getByRole("button", { name: "Kirim dapur" }).click();
  await page.goto("/shifts");
  await page.getByRole("button", { name: "Tutup shift" }).first().click();
  await page.getByLabel("Kas fisik aktual (Rp)").fill("0");
  await page.getByRole("button", { name: "Konfirmasi tutup shift" }).click();
  await expect(page.getByText("Belum ada shift pribadi")).toBeVisible({ timeout: 30_000 });

  const cashierContext = await browser.newContext();
  const cashierPage = await cashierContext.newPage();
  await signIn(cashierPage, cashierEmail!, cashierPassword!);
  await openShift(cashierPage);
  await resumeOrder(cashierPage, shiftTable);
  await cashierPage.getByRole("button", { name: "Bayar sekarang" }).click();
  await cashierPage.getByRole("button", { name: "QRIS", exact: true }).click();
  await cashierPage.getByRole("button", { name: "Konfirmasi pembayaran" }).click();
  await expect(cashierPage.getByText("Pembayaran berhasil")).toBeVisible({ timeout: 30_000 });
  await cashierContext.close();
});
