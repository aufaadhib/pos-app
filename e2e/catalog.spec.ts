import { expect, test } from "@playwright/test";
import { neon } from "@neondatabase/serverless";

const ownerEmail = process.env.E2E_OWNER_EMAIL;
const ownerPassword = process.env.E2E_OWNER_PASSWORD;
const managerEmail = process.env.E2E_MANAGER_EMAIL;
const managerPassword = process.env.E2E_MANAGER_PASSWORD;
const cashierEmail = process.env.E2E_CASHIER_EMAIL;
const cashierPassword = process.env.E2E_CASHIER_PASSWORD;
const canRunOwnerMutations = Boolean(
  process.env.E2E_CATALOG_MUTATIONS === "true" &&
    process.env.DATABASE_URL &&
    ownerEmail &&
    ownerPassword,
);
let fixtureCategoryName: string | undefined;

test.afterEach(async () => {
  if (fixtureCategoryName) {
    await cleanupCatalogFixture(fixtureCategoryName);
    fixtureCategoryName = undefined;
  }
});

async function signIn(page: import("@playwright/test").Page, email: string, password: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Kata sandi", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL(/\/(workspace|select-outlet)$/);
}

test("anonymous staff is redirected from the catalog", async ({ page }) => {
  await page.goto("/catalog");
  await expect(page).toHaveURL(/\/sign-in$/);
});

test.describe("live catalog role checks", () => {
  test("manager can manage only the assigned outlet catalog", async ({ page }) => {
    test.skip(!managerEmail || !managerPassword, "Requires E2E manager credentials.");
    await signIn(page, managerEmail!, managerPassword!);
    await page.goto("/catalog");
    await expect(page.getByRole("heading", { name: /Produk outlet/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Kategori baru" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Produk baru" })).toHaveCount(0);
    await expect(page.getByText(/Harga dan ketersediaan mewarisi katalog master/)).toBeVisible();
  });

  test("cashier sees only the active read-only catalog", async ({ page }) => {
    test.skip(!cashierEmail || !cashierPassword, "Requires E2E cashier credentials.");
    await signIn(page, cashierEmail!, cashierPassword!);
    await page.goto("/catalog?status=archived");
    await expect(page.getByText("Baca saja")).toBeVisible();
    await expect(page.getByRole("button", { name: "Kategori baru" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Produk baru" })).toHaveCount(0);
    await expect(page.getByRole("combobox", { name: "Filter status" })).toHaveCount(0);
  });

  test("owner can create, update, archive, and restore catalog data", async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    test.skip(testInfo.project.name !== "desktop", "Mutation journey runs once on the desktop project.");
    test.skip(!canRunOwnerMutations, "Requires explicit E2E_CATALOG_MUTATIONS=true and owner credentials.");
    const suffix = Date.now().toString(36).toUpperCase();
    const categoryName = `E2E Kategori ${suffix}`;
    const productName = `E2E Produk ${suffix}`;
    const sku = `E2E-${suffix}`;
    fixtureCategoryName = categoryName;

    await signIn(page, ownerEmail!, ownerPassword!);
    await page.goto("/catalog");

    await page.getByRole("button", { name: "Kategori baru" }).first().click();
    await page.getByRole("textbox", { name: "Nama kategori" }).fill(categoryName);
    await page.getByRole("button", { name: "Simpan kategori" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 30_000 });
    await expect(page.getByRole("status")).toContainText("Kategori berhasil dibuat.");

    await page.getByRole("button", { name: "Produk baru" }).first().click();
    await page.getByRole("combobox", { name: "Kategori" }).click();
    await page.getByRole("option", { name: categoryName }).click();
    await page.getByRole("textbox", { name: "Nama produk" }).fill(productName);
    await page.getByRole("textbox", { name: "SKU (opsional)" }).fill(sku);
    await page.getByRole("textbox", { name: "Harga dasar (Rp)" }).fill("25000");
    await page.getByRole("button", { name: "Simpan produk" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 30_000 });
    await expect(page.getByRole("status")).toContainText("Produk berhasil dibuat.");

    const row = page.getByRole("row").filter({ hasText: productName });
    await row.getByRole("button", { name: "Edit produk" }).click();
    await page.getByRole("textbox", { name: "Harga dasar (Rp)" }).fill("27500");
    await page.getByRole("button", { name: "Simpan produk" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 30_000 });
    await expect(page.getByRole("status")).toContainText("Produk berhasil diperbarui.");
    await expect(row.getByText(/27\.500/)).toBeVisible();

    await row.getByRole("button", { name: `Arsipkan ${productName}` }).click();
    await expect(row).toHaveCount(0, { timeout: 30_000 });
    await page.getByRole("combobox", { name: "Filter status" }).click();
    await page.getByRole("option", { name: "Diarsipkan", exact: true }).click();
    await page.getByRole("button", { name: "Terapkan" }).click();
    const archivedRow = page.getByRole("row").filter({ hasText: productName });
    await archivedRow.getByRole("button", { name: `Pulihkan ${productName}` }).click();
    await expect(archivedRow).toHaveCount(0, { timeout: 30_000 });

    await page.getByRole("combobox", { name: "Filter status" }).click();
    await page.getByRole("option", { name: "Aktif", exact: true }).click();
    await page.getByRole("button", { name: "Terapkan" }).click();
    const restoredRow = page.getByRole("row").filter({ hasText: productName });
    await restoredRow.getByRole("button", { name: `Arsipkan ${productName}` }).click();
    await expect(restoredRow).toHaveCount(0, { timeout: 30_000 });
    const archiveCategoryButton = page.getByRole("button", { name: `Arsipkan ${categoryName}` }).first();
    await archiveCategoryButton.click();
    const restoreCategoryButton = page.getByRole("button", { name: `Pulihkan ${categoryName}` }).first();
    await expect(restoreCategoryButton).toBeEnabled({ timeout: 30_000 });
    await restoreCategoryButton.click();
    await expect(page.getByRole("button", { name: `Arsipkan ${categoryName}` }).first()).toBeEnabled({ timeout: 30_000 });
  });
});

async function cleanupCatalogFixture(categoryName: string) {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return;
  const sql = neon(connectionString);
  await sql.transaction([
    sql`DELETE FROM "catalog_audit_log"
        WHERE ("entityType" = 'CATEGORY' AND "entityId" IN (
          SELECT "id" FROM "category" WHERE "name" = ${categoryName}
        )) OR ("entityType" = 'PRODUCT' AND "entityId" IN (
          SELECT "product"."id" FROM "product"
          INNER JOIN "category" ON "category"."id" = "product"."categoryId"
          WHERE "category"."name" = ${categoryName}
        ))`,
    sql`DELETE FROM "product" WHERE "categoryId" IN (
          SELECT "id" FROM "category" WHERE "name" = ${categoryName}
        )`,
    sql`DELETE FROM "category" WHERE "name" = ${categoryName}`,
  ]);
}
