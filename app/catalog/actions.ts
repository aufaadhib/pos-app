"use server";

import { revalidatePath } from "next/cache";
import type { ZodType } from "zod";

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
import type { CatalogActionState, CatalogActor } from "@/lib/catalog/types";
import {
  catalogMutationTargetSchema,
  createCategorySchema,
  createProductSchema,
  updateCategorySchema,
  updateProductSchema,
} from "@/lib/catalog/validation";
import { requirePermission } from "@/lib/auth/session";

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

async function executeCatalogAction<Input>(
  schema: ZodType<Input>,
  formData: FormData,
  mutation: (input: Input, actor: CatalogActor) => Promise<unknown>,
  successMessage: string,
): Promise<CatalogActionState> {
  const session = await requirePermission({ catalog: ["manage"] });
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
