import "server-only";

import { del, put } from "@vercel/blob";

import { CatalogAuditAction, CatalogEntityType } from "@/generated/prisma/client";
import type { CatalogActor } from "@/lib/catalog/types";
import { prisma } from "@/lib/prisma";

const maxProductImageBytes = 3 * 1024 * 1024;
const imageExtensions = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

type ProductImageContentType = keyof typeof imageExtensions;
type ProductImageErrorCode = "INVALID_IMAGE" | "NOT_CONFIGURED" | "NOT_FOUND" | "CONFLICT" | "UPLOAD_FAILED";

export class ProductImageError extends Error {
  constructor(
    public readonly code: ProductImageErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ProductImageError";
  }
}

/** Validates the product image size, declared MIME type, and binary signature. */
export async function validateProductImage(file: File) {
  if (file.size === 0) {
    throw new ProductImageError("INVALID_IMAGE", "Pilih gambar produk terlebih dahulu.");
  }
  if (file.size > maxProductImageBytes) {
    throw new ProductImageError("INVALID_IMAGE", "Ukuran gambar setelah kompresi maksimal 3 MB.");
  }
  if (!(file.type in imageExtensions)) {
    throw new ProductImageError("INVALID_IMAGE", "Gunakan gambar JPEG, PNG, atau WebP.");
  }

  const contentType = file.type as ProductImageContentType;
  const signature = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (!hasValidImageSignature(contentType, signature)) {
    throw new ProductImageError("INVALID_IMAGE", "Isi file tidak sesuai dengan format gambarnya.");
  }

  return { contentType, extension: imageExtensions[contentType] };
}

/** Uploads a replacement image, commits its URL and audit atomically, then removes the old blob. */
export async function saveProductImage(productId: string, file: File, actor: CatalogActor) {
  const image = await validateProductImage(file);
  const token = requireBlobToken();
  const exists = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
  if (!exists) {
    throw new ProductImageError("NOT_FOUND", "Produk tidak ditemukan.");
  }

  let blob;
  try {
    blob = await put(`products/${productId}/cover.${image.extension}`, file, {
      access: "public",
      addRandomSuffix: true,
      contentType: image.contentType,
      token,
    });
  } catch (error) {
    console.error("Product image blob upload failed", error);
    throw new ProductImageError(
      "UPLOAD_FAILED",
      "Upload ke penyimpanan gambar gagal. Periksa koneksi lalu coba kembali.",
    );
  }

  let previousImageUrl: string | null = null;
  try {
    await prisma.$transaction(async (transaction) => {
      const current = await transaction.product.findUnique({
        where: { id: productId },
        select: { id: true, imageUrl: true, imagePositionX: true, imagePositionY: true, updatedAt: true },
      });
      if (!current) {
        throw new ProductImageError("NOT_FOUND", "Produk tidak ditemukan.");
      }
      const update = await transaction.product.updateMany({
        where: { id: productId, updatedAt: current.updatedAt },
        data: { imageUrl: blob.url, imagePositionX: 50, imagePositionY: 50 },
      });
      if (update.count !== 1) {
        throw new ProductImageError("CONFLICT", "Produk telah diubah. Muat ulang lalu coba kembali.");
      }
      await transaction.catalogAuditLog.create({
        data: {
          entityType: CatalogEntityType.PRODUCT,
          entityId: productId,
          action: CatalogAuditAction.IMAGE_CHANGE,
          actorUserId: actor.id,
          actorEmail: actor.email,
          before: { imageUrl: current.imageUrl, imagePositionX: current.imagePositionX, imagePositionY: current.imagePositionY },
          after: { imageUrl: blob.url, imagePositionX: 50, imagePositionY: 50 },
        },
      });
      previousImageUrl = current.imageUrl;
    });
  } catch (error) {
    await deleteBlobBestEffort(blob.url, token);
    throw error;
  }

  if (previousImageUrl && previousImageUrl !== blob.url) {
    await deleteBlobBestEffort(previousImageUrl, token);
  }
  return blob.url;
}

/** Clears a product image and audit atomically, then removes the detached blob. */
export async function removeProductImage(productId: string, actor: CatalogActor) {
  const existing = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, imageUrl: true },
  });
  if (!existing) {
    throw new ProductImageError("NOT_FOUND", "Produk tidak ditemukan.");
  }
  if (!existing.imageUrl) return;

  const token = requireBlobToken();
  let previousImageUrl: string | null = null;
  await prisma.$transaction(async (transaction) => {
    const current = await transaction.product.findUnique({
      where: { id: productId },
      select: { id: true, imageUrl: true, imagePositionX: true, imagePositionY: true, updatedAt: true },
    });
    if (!current) {
      throw new ProductImageError("NOT_FOUND", "Produk tidak ditemukan.");
    }
    if (!current.imageUrl) return;
    const update = await transaction.product.updateMany({
      where: { id: productId, updatedAt: current.updatedAt },
      data: { imageUrl: null, imagePositionX: 50, imagePositionY: 50 },
    });
    if (update.count !== 1) {
      throw new ProductImageError("CONFLICT", "Produk telah diubah. Muat ulang lalu coba kembali.");
    }
    await transaction.catalogAuditLog.create({
      data: {
        entityType: CatalogEntityType.PRODUCT,
        entityId: productId,
        action: CatalogAuditAction.IMAGE_CHANGE,
        actorUserId: actor.id,
        actorEmail: actor.email,
        before: { imageUrl: current.imageUrl, imagePositionX: current.imagePositionX, imagePositionY: current.imagePositionY },
        after: { imageUrl: null, imagePositionX: 50, imagePositionY: 50 },
      },
    });
    previousImageUrl = current.imageUrl;
  });

  if (previousImageUrl) {
    await deleteBlobBestEffort(previousImageUrl, token);
  }
}

/** Saves the responsive crop focal point as bounded percentages and records the change atomically. */
export async function saveProductImagePosition(
  productId: string,
  positionX: number,
  positionY: number,
  actor: CatalogActor,
) {
  assertImagePosition(positionX, positionY);
  await prisma.$transaction(async (transaction) => {
    const current = await transaction.product.findUnique({
      where: { id: productId },
      select: { id: true, imageUrl: true, imagePositionX: true, imagePositionY: true, updatedAt: true },
    });
    if (!current) {
      throw new ProductImageError("NOT_FOUND", "Produk tidak ditemukan.");
    }
    if (!current.imageUrl) {
      throw new ProductImageError("INVALID_IMAGE", "Unggah gambar sebelum mengatur titik fokus.");
    }
    if (current.imagePositionX === positionX && current.imagePositionY === positionY) return;

    const update = await transaction.product.updateMany({
      where: { id: productId, updatedAt: current.updatedAt },
      data: { imagePositionX: positionX, imagePositionY: positionY },
    });
    if (update.count !== 1) {
      throw new ProductImageError("CONFLICT", "Produk telah diubah. Muat ulang lalu coba kembali.");
    }
    await transaction.catalogAuditLog.create({
      data: {
        entityType: CatalogEntityType.PRODUCT,
        entityId: productId,
        action: CatalogAuditAction.IMAGE_CHANGE,
        actorUserId: actor.id,
        actorEmail: actor.email,
        before: { imageUrl: current.imageUrl, imagePositionX: current.imagePositionX, imagePositionY: current.imagePositionY },
        after: { imageUrl: current.imageUrl, imagePositionX: positionX, imagePositionY: positionY },
      },
    });
  });
}

/** Returns the configured Blob credential only when image storage is invoked. */
function requireBlobToken() {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) {
    throw new ProductImageError(
      "NOT_CONFIGURED",
      "Penyimpanan gambar belum dikonfigurasi. Tambahkan BLOB_READ_WRITE_TOKEN.",
    );
  }
  return token;
}

/** Rejects focal-point percentages outside the database constraint range. */
function assertImagePosition(positionX: number, positionY: number) {
  if (![positionX, positionY].every((value) => Number.isInteger(value) && value >= 0 && value <= 100)) {
    throw new ProductImageError("INVALID_IMAGE", "Posisi gambar harus berada antara 0 dan 100.");
  }
}

/** Checks the minimum magic bytes for the three accepted image formats. */
function hasValidImageSignature(contentType: ProductImageContentType, bytes: Uint8Array) {
  if (contentType === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (contentType === "image/png") {
    return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
      .every((value, index) => bytes[index] === value);
  }
  return bytes[0] === 0x52
    && bytes[1] === 0x49
    && bytes[2] === 0x46
    && bytes[3] === 0x46
    && bytes[8] === 0x57
    && bytes[9] === 0x45
    && bytes[10] === 0x42
    && bytes[11] === 0x50;
}

/** Deletes an obsolete or compensating blob without rolling back a committed database change. */
async function deleteBlobBestEffort(url: string, token: string) {
  try {
    await del(url, { token });
  } catch (error) {
    console.warn("Product image blob cleanup failed", { url, error });
  }
}
