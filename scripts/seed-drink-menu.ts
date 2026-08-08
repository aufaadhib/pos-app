import "dotenv/config";

import {
  CatalogAuditAction,
  CatalogEntityType,
  CatalogStatus,
  Prisma,
} from "../generated/prisma/client";
import { normalizeCatalogName } from "../lib/catalog/normalization";
import { prisma } from "../lib/prisma-core";

const drinks = [
  { name: "Es Teh Manis", sku: "MNM-001", price: "6000", description: "Teh manis dingin dengan es batu." },
  { name: "Teh Manis Hangat", sku: "MNM-002", price: "5000", description: "Teh manis hangat." },
  { name: "Es Teh Tawar", sku: "MNM-003", price: "4000", description: "Teh tawar dingin dengan es batu." },
  { name: "Teh Tawar Hangat", sku: "MNM-004", price: "3000", description: "Teh tawar hangat." },
  { name: "Es Jeruk", sku: "MNM-005", price: "10000", description: "Perasan jeruk segar dingin." },
  { name: "Jeruk Hangat", sku: "MNM-006", price: "9000", description: "Perasan jeruk segar hangat." },
  { name: "Air Mineral 600 ml", sku: "MNM-007", price: "5000", description: "Air mineral kemasan 600 ml." },
  { name: "Kopi Hitam", sku: "MNM-008", price: "7000", description: "Kopi hitam panas dengan gula terpisah." },
  { name: "Es Kelapa Muda", sku: "MNM-009", price: "12000", description: "Kelapa muda dengan es dan gula cair." },
] as const;

/** Adds a minimal satay-restaurant drink menu without changing existing catalog records. */
export async function seedDrinkMenu() {
  if (!process.argv.includes("--development") || process.env.NODE_ENV === "production") {
    throw new Error("Seed minuman hanya boleh dijalankan dengan flag --development di environment non-production.");
  }

  const owner = await prisma.user.findFirst({
    where: { role: "owner" },
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true },
  });
  if (!owner) throw new Error("Seed dibatalkan: buat akun owner terlebih dahulu.");

  const result = await prisma.$transaction(async (transaction) => {
    const normalizedCategoryName = normalizeCatalogName("Minuman");
    let category = await transaction.category.findUnique({ where: { normalizedName: normalizedCategoryName } });
    let categoryCreated = false;
    if (!category) {
      category = await transaction.category.create({
        data: { name: "Minuman", normalizedName: normalizedCategoryName, description: "Minuman pendamping menu sate.", displayOrder: 30 },
      });
      categoryCreated = true;
      await transaction.catalogAuditLog.create({
        data: {
          entityType: CatalogEntityType.CATEGORY,
          entityId: category.id,
          action: CatalogAuditAction.CREATE,
          actorUserId: owner.id,
          actorEmail: owner.email,
          after: { name: category.name, description: category.description, displayOrder: category.displayOrder, source: "seed:drinks" },
        },
      });
    } else if (category.status !== CatalogStatus.ACTIVE) {
      throw new Error("Seed dibatalkan: kategori Minuman sedang diarsipkan.");
    }

    let created = 0;
    let skipped = 0;
    for (const [displayOrder, drink] of drinks.entries()) {
      const normalizedName = normalizeCatalogName(drink.name);
      const existing = await transaction.product.findUnique({
        where: { categoryId_normalizedName: { categoryId: category.id, normalizedName } },
        select: { id: true },
      });
      if (existing) {
        skipped += 1;
        continue;
      }

      const product = await transaction.product.create({
        data: {
          categoryId: category.id,
          name: drink.name,
          normalizedName,
          sku: drink.sku,
          description: drink.description,
          basePrice: new Prisma.Decimal(drink.price),
          displayOrder: displayOrder * 10,
        },
      });
      await transaction.catalogAuditLog.create({
        data: {
          entityType: CatalogEntityType.PRODUCT,
          entityId: product.id,
          action: CatalogAuditAction.CREATE,
          actorUserId: owner.id,
          actorEmail: owner.email,
          after: { categoryId: category.id, name: product.name, sku: product.sku, basePrice: product.basePrice.toFixed(2), source: "seed:drinks" },
        },
      });
      created += 1;
    }
    return { categoryCreated, created, skipped };
  }, { timeout: 30_000 });

  console.info(`Seed minuman selesai: ${result.created} produk dibuat, ${result.skipped} dilewati, kategori ${result.categoryCreated ? "dibuat" : "sudah ada"}.`);
  return result;
}

seedDrinkMenu()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
