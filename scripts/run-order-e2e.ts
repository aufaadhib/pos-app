import "dotenv/config";

import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";

import { createAuth } from "../lib/auth/factory";
import type { AppRole } from "../lib/auth/permissions";
import { normalizeCatalogName } from "../lib/catalog/normalization";
import { normalizeOutletName } from "../lib/outlets/normalization";
import { prisma } from "../lib/prisma-core";

type TestAccount = { role: AppRole; email: string; password: string; id?: string };

/** Creates isolated order fixtures, runs the guarded browser journey, and always removes its data. */
export async function runOrderE2E() {
  if (process.env.E2E_ALLOW_TEST_USERS !== "true") {
    throw new Error("Set E2E_ALLOW_TEST_USERS=true hanya saat Anda menyetujui pembuatan fixture sementara pada database target.");
  }

  const runId = `${Date.now()}-${randomBytes(3).toString("hex")}`;
  const port = String(3600 + (Number(runId.slice(0, 6)) % 300));
  const password = randomBytes(18).toString("base64url");
  const accounts: TestAccount[] = (["owner", "cashier"] as const).map((role) => ({ role, email: `e2e-order-${role}-${runId}@glutong.invalid`, password }));
  const outletName = `E2E Order ${runId}`;
  const categoryName = `E2E Order Category ${runId}`;
  const productName = `E2E Order Product ${runId}`;

  try {
    for (const account of accounts) await createTemporaryAccount(account);
    const owner = accounts.find((account) => account.role === "owner")!;
    const cashier = accounts.find((account) => account.role === "cashier")!;
    const [outlet, category] = await prisma.$transaction([
      prisma.outlet.create({
        data: {
          code: `EO${runId.slice(-6).toUpperCase()}`,
          name: outletName,
          normalizedName: normalizeOutletName(outletName),
          timezone: "Asia/Jakarta",
          provinceCode: "31",
          provinceName: "Daerah Khusus Ibukota Jakarta",
          cityCode: "3174",
          cityName: "Kota Jakarta Selatan",
          openOrdersEnabled: true,
        },
      }),
      prisma.category.create({ data: { name: categoryName, normalizedName: normalizeCatalogName(categoryName) } }),
    ], { maxWait: 10_000, timeout: 30_000 });
    await prisma.$transaction([
      prisma.userOutletAssignment.create({ data: { userId: cashier.id!, outletId: outlet.id, assignedByUserId: owner.id! } }),
      prisma.product.create({
        data: {
          categoryId: category.id,
          name: productName,
          normalizedName: normalizeCatalogName(productName),
          sku: `EO-${runId.slice(-8).toUpperCase()}`,
          basePrice: "25000.00",
        },
      }),
    ], { maxWait: 10_000, timeout: 30_000 });

    const result = spawnSync("npx", ["playwright", "test", "e2e/order.spec.ts", "--project=desktop", "--workers=1"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        E2E_ORDER_LIVE: "true",
        E2E_ORDER_OWNER_EMAIL: owner.email,
        E2E_ORDER_OWNER_PASSWORD: password,
        E2E_ORDER_CASHIER_EMAIL: cashier.email,
        E2E_ORDER_CASHIER_PASSWORD: password,
        E2E_ORDER_OUTLET_NAME: outlet.name,
        E2E_ORDER_PRODUCT_NAME: productName,
        BETTER_AUTH_URL: `http://localhost:${port}`,
        NEXT_DIST_DIR: ".next-order-e2e",
        NEXT_TSCONFIG_PATH: "tsconfig.e2e.json",
        PLAYWRIGHT_PORT: port,
      },
      shell: process.platform === "win32",
      stdio: "inherit",
    });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`Playwright order selesai dengan exit code ${result.status ?? "unknown"}.`);
  } finally {
    await cleanupOrderFixtures(runId);
    await prisma.$disconnect();
  }
}

/** Deletes only rows connected to the unique outlet, users, and catalog created by this run. */
async function cleanupOrderFixtures(runId: string) {
  const [users, outlets, categories] = await Promise.all([
    prisma.user.findMany({ where: { email: { contains: runId } }, select: { id: true } }),
    prisma.outlet.findMany({ where: { name: { contains: runId } }, select: { id: true } }),
    prisma.category.findMany({ where: { name: { contains: runId } }, select: { id: true } }),
  ]);
  const userIds = users.map(({ id }) => id);
  const outletIds = outlets.map(({ id }) => id);
  const categoryIds = categories.map(({ id }) => id);
  const sales = await prisma.sale.findMany({ where: { outletId: { in: outletIds } }, select: { id: true } });
  const saleIds = sales.map(({ id }) => id);
  const saleItems = await prisma.saleItem.findMany({ where: { saleId: { in: saleIds } }, select: { id: true } });
  const saleItemIds = saleItems.map(({ id }) => id);
  const shifts = await prisma.cashShift.findMany({ where: { outletId: { in: outletIds } }, select: { id: true } });
  const shiftIds = shifts.map(({ id }) => id);
  const orders = await prisma.order.findMany({ where: { outletId: { in: outletIds } }, select: { id: true } });
  const orderIds = orders.map(({ id }) => id);
  const tickets = await prisma.kitchenTicket.findMany({ where: { orderId: { in: orderIds } }, select: { id: true } });
  const ticketIds = tickets.map(({ id }) => id);

  await prisma.$transaction([
    prisma.platformSettlementItem.deleteMany({ where: { salePayment: { saleId: { in: saleIds } } } }),
    prisma.saleRefundItem.deleteMany({ where: { refund: { saleId: { in: saleIds } } } }),
    prisma.saleRefund.deleteMany({ where: { saleId: { in: saleIds } } }),
    prisma.saleItemVariant.deleteMany({ where: { saleItemId: { in: saleItemIds } } }),
    prisma.saleItemModifier.deleteMany({ where: { saleItemId: { in: saleItemIds } } }),
    prisma.salePayment.deleteMany({ where: { saleId: { in: saleIds } } }),
    prisma.saleAuditLog.deleteMany({ where: { saleId: { in: saleIds } } }),
    prisma.saleItem.deleteMany({ where: { saleId: { in: saleIds } } }),
    prisma.sale.deleteMany({ where: { id: { in: saleIds } } }),
    prisma.kitchenTicketLine.deleteMany({ where: { ticketId: { in: ticketIds } } }),
    prisma.kitchenTicket.deleteMany({ where: { id: { in: ticketIds } } }),
    prisma.orderAuditLog.deleteMany({ where: { orderId: { in: orderIds } } }),
    prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } }),
    prisma.order.deleteMany({ where: { id: { in: orderIds } } }),
    prisma.receiptSequence.deleteMany({ where: { outletId: { in: outletIds } } }),
    prisma.cashMovement.deleteMany({ where: { shiftId: { in: shiftIds } } }),
    prisma.cashShiftAuditLog.deleteMany({ where: { shiftId: { in: shiftIds } } }),
    prisma.cashShift.deleteMany({ where: { id: { in: shiftIds } } }),
    prisma.adminAuditLog.deleteMany({ where: { OR: [{ actorUserId: { in: userIds } }, { entityId: { in: [...userIds, ...outletIds] } }] } }),
    prisma.userOutletAssignment.deleteMany({ where: { OR: [{ userId: { in: userIds } }, { outletId: { in: outletIds } }] } }),
    prisma.session.updateMany({ where: { activeOutletId: { in: outletIds } }, data: { activeOutletId: null } }),
    prisma.user.deleteMany({ where: { id: { in: userIds } } }),
    prisma.product.deleteMany({ where: { categoryId: { in: categoryIds } } }),
    prisma.category.deleteMany({ where: { id: { in: categoryIds } } }),
    prisma.outlet.deleteMany({ where: { id: { in: outletIds } } }),
  ], { maxWait: 10_000, timeout: 30_000 });
}

/** Creates one temporary Better Auth credential account with retry for transient Neon starts. */
async function createTemporaryAccount(account: TestAccount) {
  const auth = createAuth({ allowSignUp: true, defaultRole: account.role });
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const result = await auth.api.signUpEmail({ body: { name: `E2E Order ${account.role}`, email: account.email, password: account.password } });
      account.id = result.user.id;
      return;
    } catch (error) {
      const existing = await prisma.user.findUnique({ where: { email: account.email }, select: { id: true, role: true, accounts: { where: { providerId: "credential" }, select: { id: true } } } });
      if (existing?.role === account.role && existing.accounts.length > 0) {
        account.id = existing.id;
        return;
      }
      if (existing) await prisma.user.delete({ where: { id: existing.id } });
      if (attempt === 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 1_000));
    }
  }
}

const cleanupRunId = process.env.E2E_ORDER_CLEANUP_RUN_ID;
if (cleanupRunId && !/^\d{13}-[a-f0-9]{6}$/.test(cleanupRunId)) throw new Error("E2E_ORDER_CLEANUP_RUN_ID tidak valid.");
const operation = cleanupRunId
  ? cleanupOrderFixtures(cleanupRunId).then(() => console.log(`Fixture order ${cleanupRunId} dibersihkan.`)).finally(() => prisma.$disconnect())
  : runOrderE2E();

operation.catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "E2E order gagal.");
  process.exitCode = 1;
});
