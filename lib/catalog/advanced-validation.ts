import { z } from "zod";

import {
  normalizeCatalogLabel,
  parseNonNegativeRupiah,
} from "@/lib/catalog/normalization";

const idSchema = z.string().trim().min(1, "Data katalog tidak ditemukan.");
const displayOrderSchema = z.coerce.number().int().min(0).max(9999);
const statusSchema = z.enum(["ACTIVE", "ARCHIVED"]);
const priceAdjustmentSchema = z.string().transform(parseNonNegativeRupiah).refine(
  (value): value is string => value !== null,
  "Harga tambahan harus antara Rp0 dan Rp999.999.999.",
);
const optionalOverridePriceSchema = z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? null : value,
  z.string().nullable(),
).transform((value, context) => {
  if (value === null) return null;
  const parsed = parseNonNegativeRupiah(value);
  if (parsed === null) {
    context.addIssue({ code: "custom", message: "Harga override harus antara Rp0 dan Rp999.999.999." });
    return z.NEVER;
  }
  return parsed;
});

const editableTargetShape = {
  id: idSchema.optional(),
  expectedUpdatedAt: z.iso.datetime().optional(),
};

/** Ensures edit identifiers and optimistic versions are always supplied as a pair. */
function validateEditableTarget(value: { id?: string; expectedUpdatedAt?: string }, context: z.RefinementCtx) {
  if (Boolean(value.id) !== Boolean(value.expectedUpdatedAt)) {
    context.addIssue({ code: "custom", message: "Versi data tidak valid. Muat ulang halaman." });
  }
}

export const variantGroupSchema = z.object({
  ...editableTargetShape,
  productId: idSchema,
  name: z.string().transform(normalizeCatalogLabel).pipe(z.string().min(2).max(60)),
  displayOrder: displayOrderSchema,
}).superRefine(validateEditableTarget);

export const variantOptionSchema = z.object({
  ...editableTargetShape,
  variantGroupId: idSchema,
  name: z.string().transform(normalizeCatalogLabel).pipe(z.string().min(1).max(60)),
  priceAdjustment: priceAdjustmentSchema,
  displayOrder: displayOrderSchema,
}).superRefine(validateEditableTarget);

export const modifierGroupSchema = z.object({
  ...editableTargetShape,
  name: z.string().transform(normalizeCatalogLabel).pipe(z.string().min(2).max(60)),
  description: z.preprocess(
    (value) => typeof value === "string" && value.trim() === "" ? null : value,
    z.string().transform(normalizeCatalogLabel).pipe(z.string().max(240)).nullable(),
  ),
}).superRefine(validateEditableTarget);

export const modifierOptionSchema = z.object({
  ...editableTargetShape,
  modifierGroupId: idSchema,
  name: z.string().transform(normalizeCatalogLabel).pipe(z.string().min(1).max(60)),
  priceAdjustment: priceAdjustmentSchema,
  displayOrder: displayOrderSchema,
}).superRefine(validateEditableTarget);

export const productModifierSchema = z.object({
  ...editableTargetShape,
  productId: idSchema,
  modifierGroupId: idSchema,
  minSelections: z.coerce.number().int().min(0).max(99),
  maxSelections: z.coerce.number().int().min(1).max(99),
  displayOrder: displayOrderSchema,
}).superRefine((value, context) => {
  validateEditableTarget(value, context);
  if (value.minSelections > value.maxSelections) {
    context.addIssue({ code: "custom", message: "Minimum pilihan tidak boleh melebihi maksimum.", path: ["minSelections"] });
  }
});

export const catalogEntityStatusSchema = z.object({
  entityType: z.enum(["VARIANT_GROUP", "VARIANT_OPTION", "MODIFIER_GROUP", "MODIFIER_OPTION", "PRODUCT_MODIFIER"]),
  id: idSchema,
  parentId: idSchema.optional(),
  status: statusSchema,
  expectedUpdatedAt: z.iso.datetime(),
});

export const outletProductOverrideSchema = z.object({
  outletId: idSchema,
  productId: idSchema,
  expectedUpdatedAt: z.iso.datetime().optional(),
  isAvailable: z.preprocess((value) => value === "true" || value === "on", z.boolean()),
  priceOverride: optionalOverridePriceSchema,
});

export const outletVariantOverrideSchema = z.object({
  outletId: idSchema,
  variantOptionId: idSchema,
  expectedUpdatedAt: z.iso.datetime().optional(),
  isAvailable: z.preprocess((value) => value === "true" || value === "on", z.boolean()),
  priceAdjustmentOverride: optionalOverridePriceSchema,
});

export type VariantGroupInput = z.infer<typeof variantGroupSchema>;
export type VariantOptionInput = z.infer<typeof variantOptionSchema>;
export type ModifierGroupInput = z.infer<typeof modifierGroupSchema>;
export type ModifierOptionInput = z.infer<typeof modifierOptionSchema>;
export type ProductModifierInput = z.infer<typeof productModifierSchema>;
export type CatalogEntityStatusInput = z.infer<typeof catalogEntityStatusSchema>;
export type OutletProductOverrideInput = z.infer<typeof outletProductOverrideSchema>;
export type OutletVariantOverrideInput = z.infer<typeof outletVariantOverrideSchema>;
