"use server";

import { revalidatePath } from "next/cache";
import { z, type ZodType } from "zod";

import {
  archiveCategory,
  archiveProduct,
  CatalogError,
  createCategory,
  createProduct,
  restoreCategory,
  restoreProduct,
  updateCategory,
  updateProduct,
} from "@/lib/catalog/service";
import {
  ProductImageError,
  removeProductImage,
  saveProductImage,
  saveProductImagePosition,
} from "@/lib/catalog/product-image-service";
import type { CatalogActionState, CatalogActor } from "@/lib/catalog/types";
import {
  catalogMutationTargetSchema,
  createCategorySchema,
  createProductSchema,
  updateCategorySchema,
  updateProductSchema,
} from "@/lib/catalog/validation";
import { requirePermission } from "@/lib/auth/session";

const productImageTargetSchema = z.object({
  productId: z.string().trim().min(1, "Produk wajib dipilih."),
});
const productImagePositionSchema = productImageTargetSchema.extend({
  positionX: z.coerce.number().int().min(0).max(100),
  positionY: z.coerce.number().int().min(0).max(100),
});

export async function createCategoryAction(
  _previousState: CatalogActionState,
  formData: FormData,
) {
  return executeCatalogAction(createCategorySchema, formData, createCategory, "Kategori berhasil dibuat.");
}

export async function updateCategoryAction(
  _previousState: CatalogActionState,
  formData: FormData,
) {
  return executeCatalogAction(updateCategorySchema, formData, updateCategory, "Kategori berhasil diperbarui.");
}

export async function archiveCategoryAction(
  _previousState: CatalogActionState,
  formData: FormData,
) {
  return executeCatalogAction(catalogMutationTargetSchema, formData, archiveCategory, "Kategori berhasil diarsipkan.");
}

export async function restoreCategoryAction(
  _previousState: CatalogActionState,
  formData: FormData,
) {
  return executeCatalogAction(catalogMutationTargetSchema, formData, restoreCategory, "Kategori berhasil dipulihkan.");
}

export async function createProductAction(
  _previousState: CatalogActionState,
  formData: FormData,
) {
  return executeCatalogAction(createProductSchema, formData, createProduct, "Produk berhasil dibuat.");
}

export async function updateProductAction(
  _previousState: CatalogActionState,
  formData: FormData,
) {
  return executeCatalogAction(updateProductSchema, formData, updateProduct, "Produk berhasil diperbarui.");
}

export async function archiveProductAction(
  _previousState: CatalogActionState,
  formData: FormData,
) {
  return executeCatalogAction(catalogMutationTargetSchema, formData, archiveProduct, "Produk berhasil diarsipkan.");
}

export async function restoreProductAction(
  _previousState: CatalogActionState,
  formData: FormData,
) {
  return executeCatalogAction(catalogMutationTargetSchema, formData, restoreProduct, "Produk berhasil dipulihkan.");
}

/** Validates permission and uploads one master product image through Vercel Blob. */
export async function saveProductImageAction(
  _previousState: CatalogActionState,
  formData: FormData,
): Promise<CatalogActionState> {
  const image = formData.get("image");
  if (!image || typeof image === "string") {
    return {
      status: "error",
      message: "Pilih gambar produk terlebih dahulu.",
      fieldErrors: { image: ["Pilih gambar produk terlebih dahulu."] },
    };
  }
  return executeProductImageAction(
    productImageTargetSchema,
    formData,
    (input, actor) => saveProductImage(input.productId, image, actor),
    "Gambar produk berhasil disimpan.",
  );
}

/** Validates permission and removes one master product image from the catalog. */
export async function removeProductImageAction(
  _previousState: CatalogActionState,
  formData: FormData,
): Promise<CatalogActionState> {
  return executeProductImageAction(
    productImageTargetSchema,
    formData,
    (input, actor) => removeProductImage(input.productId, actor),
    "Gambar produk berhasil dihapus.",
  );
}

/** Validates permission and saves the responsive crop focal point for a product image. */
export async function saveProductImagePositionAction(
  _previousState: CatalogActionState,
  formData: FormData,
): Promise<CatalogActionState> {
  return executeProductImageAction(
    productImagePositionSchema,
    formData,
    (input, actor) => saveProductImagePosition(input.productId, input.positionX, input.positionY, actor),
    "Posisi gambar berhasil disimpan.",
  );
}

async function executeCatalogAction<Input>(
  schema: ZodType<Input>,
  formData: FormData,
  mutation: (input: Input, actor: CatalogActor) => Promise<unknown>,
  successMessage: string,
): Promise<CatalogActionState> {
  const session = await requirePermission({ catalog: ["manageMaster"] });
  const parsed = schema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return {
      status: "error",
      message: "Periksa kembali data yang dimasukkan.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await mutation(parsed.data, {
      id: session.user.id,
      email: session.user.email,
    });
    revalidatePath("/catalog");
    return { status: "success", message: successMessage };
  } catch (error) {
    if (error instanceof CatalogError) {
      return {
        status: error.code === "CONFLICT" ? "conflict" : "error",
        message: error.message,
      };
    }
    console.error("Catalog mutation failed", error);
    return {
      status: "error",
      message: "Perubahan belum dapat disimpan. Coba beberapa saat lagi.",
    };
  }
}

/** Runs a product image mutation with owner permission, trusted actor data, and fresh route output. */
async function executeProductImageAction<Input>(
  schema: ZodType<Input>,
  formData: FormData,
  mutation: (input: Input, actor: CatalogActor) => Promise<unknown>,
  successMessage: string,
): Promise<CatalogActionState> {
  const session = await requirePermission({ catalog: ["manageMaster"] });
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      status: "error",
      message: "Produk tidak valid.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await mutation(parsed.data, {
      id: session.user.id,
      email: session.user.email,
    });
    revalidatePath("/catalog");
    revalidatePath("/pos");
    return { status: "success", message: successMessage };
  } catch (error) {
    if (error instanceof ProductImageError) {
      return {
        status: error.code === "CONFLICT" ? "conflict" : "error",
        message: error.message,
      };
    }
    console.error("Product image mutation failed", error);
    return {
      status: "error",
      message: "Gambar belum dapat disimpan. Coba beberapa saat lagi.",
    };
  }
}
