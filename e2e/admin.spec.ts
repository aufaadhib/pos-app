import { expect, test, type Page } from "@playwright/test";

const runId = process.env.E2E_ADMIN_RUN_ID;
const ownerEmail = process.env.E2E_OWNER_EMAIL;
const ownerPassword = process.env.E2E_OWNER_PASSWORD;
const managerEmail = process.env.E2E_MANAGER_EMAIL;
const managerPassword = process.env.E2E_MANAGER_PASSWORD;
const cashierEmail = process.env.E2E_CASHIER_EMAIL;
const cashierPassword = process.env.E2E_CASHIER_PASSWORD;
const fixtureOutlet = process.env.E2E_ADMIN_OUTLET_NAME;
const enabled = Boolean(process.env.E2E_ADMIN_MUTATIONS === "true" && runId && fixtureOutlet);

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Kata sandi", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL(/\/select-outlet$/, { timeout: 30_000 });
  await page.getByRole("button", { name: new RegExp(fixtureOutlet!) }).click();
  await expect(page).toHaveURL(/\/workspace$/, { timeout: 30_000 });
}

test.describe("live outlet and staff administration", () => {
  test.skip(!enabled, "Requires the guarded admin E2E runner.");

  test("owner manages an outlet and creates a cashier with one-time credentials", async ({ page }) => {
    test.setTimeout(180_000);
    const suffix = runId!.slice(-6).toUpperCase();
    const outletName = `E2E Outlet ${runId}`;
    const updatedName = `${outletName} Revisi`;
    const staffName = `E2E Kasir ${runId}`;
    const staffEmail = `e2e-created-${runId}@glutong.invalid`;
    await signIn(page, ownerEmail!, ownerPassword!);

    await page.goto("/outlets");
    await page.getByRole("button", { name: "Outlet baru" }).click();
    await page.getByLabel("Nama outlet").fill(outletName);
    await page.getByLabel("Kode").fill(`UT-${suffix}`);
    await page.getByLabel("Alamat jalan (opsional)").fill("Jl. E2E No. 1");
    const provinceCombobox = page.getByRole("combobox", { name: "Provinsi" });
    await provinceCombobox.fill("Daerah Khusus");
    const provinceOption = page.getByRole("option", { name: "Daerah Khusus Ibukota Jakarta" });
    const [provinceBox, listboxBox] = await Promise.all([
      provinceCombobox.boundingBox(),
      page.getByRole("listbox").boundingBox(),
    ]);
    expect(listboxBox!.y).toBeGreaterThanOrEqual(provinceBox!.y + provinceBox!.height);
    await provinceOption.click();
    await expect(provinceCombobox).toHaveValue("Daerah Khusus Ibukota Jakarta");
    await page.getByRole("combobox", { name: "Kabupaten/kota" }).fill("Jakarta Selatan");
    await page.getByRole("option", { name: /Jakarta Selatan/ }).click();
    await expect(page.getByRole("combobox", { name: "Kabupaten/kota" })).toHaveValue(/Jakarta Selatan/);
    await page.getByRole("button", { name: "Simpan outlet" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 30_000 });
    await expect(page.getByRole("status")).toContainText("Outlet berhasil dibuat.");

    let card = page.locator('[data-slot="card"]').filter({ hasText: outletName });
    await card.getByRole("button", { name: `Edit ${outletName}` }).click();
    await page.getByLabel("Nama outlet").fill(updatedName);
    await page.getByRole("button", { name: "Simpan outlet" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 30_000 });
    await expect(page.getByRole("status")).toContainText("Outlet berhasil diperbarui.");
    card = page.locator('[data-slot="card"]').filter({ hasText: updatedName });
    await card.getByRole("button", { name: `Arsipkan ${updatedName}` }).click();
    await page.getByRole("button", { name: "Arsipkan outlet" }).click();
    await expect(card).toHaveCount(0, { timeout: 30_000 });
    await page.getByRole("combobox", { name: "Status outlet" }).click();
    await page.getByRole("option", { name: "Arsip", exact: true }).click();
    await page.getByRole("button", { name: "Terapkan" }).click();
    const archived = page.locator('[data-slot="card"]').filter({ hasText: updatedName });
    await archived.getByRole("button", { name: `Pulihkan ${updatedName}` }).click();
    await expect(archived).toHaveCount(0, { timeout: 30_000 });

    await page.goto("/staff");
    await page.getByRole("button", { name: "Staf baru" }).click();
    await page.getByLabel("Nama staf").fill(staffName);
    await page.getByLabel("Email login").fill(staffEmail);
    await page.getByRole("checkbox", { name: new RegExp(fixtureOutlet!) }).check();
    await page.getByRole("button", { name: "Buat staf" }).click();
    await expect(page.getByRole("region", { name: "Kredensial sementara" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("region", { name: "Kredensial sementara" }).getByText(staffEmail)).toBeVisible();
  });

  test("manager is constrained to cashier assignments and cashier is denied", async ({ page }) => {
    test.setTimeout(120_000);
    await signIn(page, managerEmail!, managerPassword!);
    await page.goto("/outlets");
    await expect(page.getByRole("button", { name: "Outlet baru" })).toHaveCount(0);
    await page.goto("/staff");
    await page.getByRole("button", { name: "Staf baru" }).click();
    await page.getByRole("combobox", { name: "Peran" }).click();
    await expect(page.getByRole("option", { name: "Manajer" })).toHaveCount(0);

    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Tutup dialog" }).click();
    await page.goto("/reports");
    await expect(page.getByRole("heading", { name: "Laporan usaha" })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Keluar dari Glutong POS" }).click();
    await expect(page).toHaveURL(/\/sign-in$/);
    await signIn(page, cashierEmail!, cashierPassword!);
    await page.goto("/staff");
    await expect(page).toHaveURL(/\/workspace\?access=denied$/);
    await expect(page.getByText("Akses dibatasi")).toBeVisible();
    await page.goto("/reports");
    await expect(page).toHaveURL(/\/workspace\?access=denied$/);
  });
});
