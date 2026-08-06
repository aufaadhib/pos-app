import { z } from "zod";

import {
  normalizeCatalogLabel,
  normalizeSku,
  parseRupiahToMinorUnit,
} from "@/lib/catalog/normalization";

const optionalDescription = (maximum: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? null : value),
    z.string().trim().max(maximum, `Maksimal ${maximum} karakter.`).nullable(),
  );

const displayOrderSchema = z.coerce
  .number({ error: "Urutan tampil harus berupa angka." })
  .int("Urutan tampil harus berupa bilangan bulat.")
  .min(0, "Urutan tampil minimal 0.")
  .max(9999, "Urutan tampil maksimal 9999.");

const catalogIdSchema = z.string().trim().min(1, "Data katalog tidak ditemukan.");
const expectedUpdatedAtSchema = z.iso.datetime({
  error: "Versi data tidak valid. Muat ulang halaman.",
});

export const categoryInputSchema = z.object({
  name: z
    .string()
    .transform(normalizeCatalogLabel)
    .pipe(z.string().min(2, "Nama kategori minimal 2 karakter.").max(60, "Nama kategori maksimal 60 karakter.")),
  description: optionalDescription(240),
  displayOrder: displayOrderSchema,
});

export const createCategorySchema = categoryInputSchema;

export const updateCategorySchema = categoryInputSchema.extend({
  id: catalogIdSchema,
  expectedUpdatedAt: expectedUpdatedAtSchema,
});

export const catalogMutationTargetSchema = z.object({
  id: catalogIdSchema,
  expectedUpdatedAt: expectedUpdatedAtSchema,
});

export const productInputSchema = z.object({
  categoryId: catalogIdSchema,
  name: z
    .string()
    .transform(normalizeCatalogLabel)
    .pipe(z.string().min(2, "Nama produk minimal 2 karakter.").max(120, "Nama produk maksimal 120 karakter.")),
  sku: z
    .string()
    .nullable()
    .optional()
    .transform(normalizeSku)
    .refine(
      (value) => value === null || /^[A-Z0-9][A-Z0-9._-]{0,39}$/.test(value),
      "SKU hanya boleh berisi huruf, angka, titik, garis bawah, atau tanda hubung.",
    ),
  description: optionalDescription(280),
  basePrice: z
    .string()
    .transform(parseRupiahToMinorUnit)
    .refine((value): value is string => value !== null, "Masukkan harga Rupiah antara Rp1 dan Rp999.999.999."),
  displayOrder: displayOrderSchema,
});

export const createProductSchema = productInputSchema;

export const updateProductSchema = productInputSchema.extend({
  id: catalogIdSchema,
  expectedUpdatedAt: expectedUpdatedAtSchema,
});

export const catalogSearchSchema = z.object({
  q: z.string().trim().max(100).catch(""),
  category: z.string().trim().max(100).catch(""),
  status: z.enum(["active", "archived", "all"]).catch("active"),
  page: z.coerce.number().int().min(1).catch(1),
});

export type CategoryInput = z.infer<typeof categoryInputSchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type ProductInput = z.infer<typeof productInputSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type CatalogMutationTarget = z.infer<typeof catalogMutationTargetSchema>;
export type CatalogSearch = z.infer<typeof catalogSearchSchema>;
