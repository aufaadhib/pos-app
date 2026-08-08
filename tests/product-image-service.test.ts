import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auditCreate: vi.fn(),
  blobDelete: vi.fn(),
  blobPut: vi.fn(),
  productFind: vi.fn(),
  productUpdate: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@vercel/blob", () => ({ del: mocks.blobDelete, put: mocks.blobPut }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    product: { findUnique: mocks.productFind },
    $transaction: mocks.transaction,
  },
}));

import {
  removeProductImage,
  saveProductImage,
  saveProductImagePosition,
  validateProductImage,
} from "@/lib/catalog/product-image-service";

const actor = { id: "owner-1", email: "owner@example.com" };
const oldUrl = "https://store.public.blob.vercel-storage.com/products/product-1/old.jpg";
const newUrl = "https://store.public.blob.vercel-storage.com/products/product-1/new.jpg";

/** Creates a minimal browser File with the supplied MIME type and signature bytes. */
function imageFile(type = "image/jpeg", bytes = [0xff, 0xd8, 0xff, 0x00]) {
  return new File([new Uint8Array(bytes)], "cover", { type });
}

describe("product image service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.BLOB_READ_WRITE_TOKEN = "blob-token";
    mocks.productFind.mockResolvedValue({ id: "product-1", imageUrl: oldUrl });
    mocks.blobPut.mockResolvedValue({ url: newUrl });
    mocks.blobDelete.mockResolvedValue(undefined);
    mocks.productUpdate.mockResolvedValue({ count: 1 });
    mocks.auditCreate.mockResolvedValue({ id: "audit-1" });
    mocks.transaction.mockImplementation(async (callback) => callback({
      product: {
        findUnique: vi.fn().mockResolvedValue({ id: "product-1", imageUrl: oldUrl, imagePositionX: 50, imagePositionY: 50, updatedAt: new Date("2026-08-07T08:00:00.000Z") }),
        updateMany: mocks.productUpdate,
      },
      catalogAuditLog: { create: mocks.auditCreate },
    }));
  });

  it("rejects a file whose content does not match its declared image type", async () => {
    await expect(validateProductImage(imageFile("image/png", [0xff, 0xd8, 0xff])))
      .rejects.toMatchObject({ code: "INVALID_IMAGE" });
  });

  it("rejects images larger than 3 MB before upload", async () => {
    const oversized = new File([new Uint8Array(3 * 1024 * 1024 + 1)], "cover.jpg", { type: "image/jpeg" });
    await expect(validateProductImage(oversized)).rejects.toMatchObject({ code: "INVALID_IMAGE" });
    expect(mocks.blobPut).not.toHaveBeenCalled();
  });

  it("uploads, audits, and removes the previous image after commit", async () => {
    await expect(saveProductImage("product-1", imageFile(), actor)).resolves.toBe(newUrl);
    expect(mocks.blobPut).toHaveBeenCalledWith(
      "products/product-1/cover.jpg",
      expect.any(File),
      expect.objectContaining({ access: "public", addRandomSuffix: true, token: "blob-token" }),
    );
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "IMAGE_CHANGE", before: { imageUrl: oldUrl, imagePositionX: 50, imagePositionY: 50 }, after: { imageUrl: newUrl, imagePositionX: 50, imagePositionY: 50 } }),
    });
    expect(mocks.blobDelete).toHaveBeenCalledWith(oldUrl, { token: "blob-token" });
  });

  it("removes the newly uploaded blob when the database transaction fails", async () => {
    mocks.transaction.mockRejectedValueOnce(new Error("database unavailable"));
    await expect(saveProductImage("product-1", imageFile(), actor)).rejects.toThrow("database unavailable");
    expect(mocks.blobDelete).toHaveBeenCalledWith(newUrl, { token: "blob-token" });
  });

  it("clears and audits an existing image before deleting its blob", async () => {
    await removeProductImage("product-1", actor);
    expect(mocks.productUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ imageUrl: null }) }));
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "IMAGE_CHANGE", before: { imageUrl: oldUrl, imagePositionX: 50, imagePositionY: 50 }, after: { imageUrl: null, imagePositionX: 50, imagePositionY: 50 } }),
    });
    expect(mocks.blobDelete).toHaveBeenCalledWith(oldUrl, { token: "blob-token" });
  });

  it("saves and audits a bounded responsive focal point", async () => {
    await saveProductImagePosition("product-1", 35, 72, actor);
    expect(mocks.productUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { imagePositionX: 35, imagePositionY: 72 } }));
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "IMAGE_CHANGE",
        before: { imageUrl: oldUrl, imagePositionX: 50, imagePositionY: 50 },
        after: { imageUrl: oldUrl, imagePositionX: 35, imagePositionY: 72 },
      }),
    });
  });
});
