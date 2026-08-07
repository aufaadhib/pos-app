"use server";

import { revalidatePath } from "next/cache";
import type { ZodType } from "zod";

import { isAppRole } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import {
  catalogEntityStatusSchema,
  modifierGroupSchema,
  modifierOptionSchema,
  outletProductOverrideSchema,
  outletVariantOverrideSchema,
  productModifierSchema,
  variantGroupSchema,
  variantOptionSchema,
} from "@/lib/catalog/advanced-validation";
import {
  AdvancedCatalogError,
  changeAdvancedCatalogStatus,
  saveModifierGroup,
  saveModifierOption,
  saveOutletProductOverride,
  saveOutletVariantOverride,
  saveProductModifier,
  saveVariantGroup,
  saveVariantOption,
} from "@/lib/catalog/advanced-service";
import type { CatalogActionState, CatalogActor } from "@/lib/catalog/types";

export async function saveVariantGroupAction(_state: CatalogActionState, formData: FormData) {
  return executeMasterAction(variantGroupSchema, formData, saveVariantGroup, "Grup varian berhasil disimpan.");
}

export async function saveVariantOptionAction(_state: CatalogActionState, formData: FormData) {
  return executeMasterAction(variantOptionSchema, formData, saveVariantOption, "Opsi varian berhasil disimpan.");
}

export async function saveModifierGroupAction(_state: CatalogActionState, formData: FormData) {
  return executeMasterAction(modifierGroupSchema, formData, saveModifierGroup, "Grup modifier berhasil disimpan.");
}

export async function saveModifierOptionAction(_state: CatalogActionState, formData: FormData) {
  return executeMasterAction(modifierOptionSchema, formData, saveModifierOption, "Opsi modifier berhasil disimpan.");
}

export async function saveProductModifierAction(_state: CatalogActionState, formData: FormData) {
  return executeMasterAction(productModifierSchema, formData, saveProductModifier, "Aturan modifier produk berhasil disimpan.");
}

export async function changeAdvancedCatalogStatusAction(_state: CatalogActionState, formData: FormData) {
  return executeMasterAction(catalogEntityStatusSchema, formData, changeAdvancedCatalogStatus, "Status katalog berhasil diperbarui.");
}

export async function saveOutletProductOverrideAction(_state: CatalogActionState, formData: FormData) {
  return executeOutletAction(outletProductOverrideSchema, formData, saveOutletProductOverride, "Pengaturan produk outlet berhasil disimpan.");
}

export async function saveOutletVariantOverrideAction(_state: CatalogActionState, formData: FormData) {
  return executeOutletAction(outletVariantOverrideSchema, formData, saveOutletVariantOverride, "Pengaturan varian outlet berhasil disimpan.");
}

/** Validates and authorizes one master-catalog mutation before invoking its audited service. */
async function executeMasterAction<Input>(
  schema: ZodType<Input>,
  formData: FormData,
  mutation: (input: Input, actor: CatalogActor) => Promise<unknown>,
  successMessage: string,
): Promise<CatalogActionState> {
  const session = await requirePermission({ catalog: ["manageMaster"] });
  return executeAdvancedAction(schema, formData, mutation, {
    id: session.user.id,
    email: session.user.email,
    role: "owner",
  }, successMessage);
}

/** Validates and authorizes one outlet override while retaining server-side outlet scope checks. */
async function executeOutletAction<Input>(
  schema: ZodType<Input>,
  formData: FormData,
  mutation: (input: Input, actor: CatalogActor) => Promise<unknown>,
  successMessage: string,
): Promise<CatalogActionState> {
  const session = await requirePermission({ catalog: ["manageOutlet"] });
  if (!isAppRole(session.user.role)) return { status: "error", message: "Peran akun tidak valid." };
  return executeAdvancedAction(schema, formData, mutation, {
    id: session.user.id,
    email: session.user.email,
    role: session.user.role,
  }, successMessage);
}

async function executeAdvancedAction<Input>(
  schema: ZodType<Input>,
  formData: FormData,
  mutation: (input: Input, actor: CatalogActor) => Promise<unknown>,
  actor: CatalogActor,
  successMessage: string,
): Promise<CatalogActionState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      status: "error",
      message: "Periksa kembali data katalog.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  try {
    await mutation(parsed.data, actor);
    revalidatePath("/catalog");
    revalidatePath("/catalog/products/[productId]", "page");
    revalidatePath("/catalog/modifiers");
    return { status: "success", message: successMessage };
  } catch (error) {
    if (error instanceof AdvancedCatalogError) {
      return { status: error.code === "CONFLICT" ? "conflict" : "error", message: error.message };
    }
    console.error("Advanced catalog mutation failed", error);
    return { status: "error", message: "Perubahan katalog belum dapat disimpan. Coba lagi." };
  }
}
