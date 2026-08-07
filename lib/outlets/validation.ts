import { z } from "zod";

import {
  normalizeOperationalLabel,
  normalizeOutletCode,
  parseOutletPercentage,
} from "@/lib/outlets/normalization";

export const supportedOutletTimezones = [
  "Asia/Jakarta",
  "Asia/Makassar",
  "Asia/Jayapura",
] as const;

const optionalAddress = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z.string().transform(normalizeOperationalLabel).pipe(
    z.string().max(240, "Alamat maksimal 240 karakter."),
  ).nullable(),
);

const outletFields = z.object({
  name: z.string().transform(normalizeOperationalLabel).pipe(
    z.string().min(2, "Nama outlet minimal 2 karakter.").max(80, "Nama outlet maksimal 80 karakter."),
  ),
  code: z.string().transform(normalizeOutletCode).pipe(
    z.string()
      .min(2, "Kode outlet minimal 2 karakter.")
      .max(12, "Kode outlet maksimal 12 karakter.")
      .regex(/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/, "Gunakan huruf, angka, dan tanda hubung."),
  ),
  timezone: z.enum(supportedOutletTimezones, { error: "Zona waktu outlet tidak didukung." }),
  addressLine: optionalAddress,
  provinceCode: z.string().trim().regex(/^\d{2}$/, "Pilih provinsi yang valid."),
  provinceName: z.string().transform(normalizeOperationalLabel).pipe(z.string().min(2).max(80)),
  cityCode: z.string().trim().regex(/^\d{4}$/, "Pilih kabupaten/kota yang valid."),
  cityName: z.string().transform(normalizeOperationalLabel).pipe(z.string().min(2).max(100)),
  taxRate: z.string().transform(parseOutletPercentage).refine(
    (value): value is string => value !== null,
    "Persentase pajak harus antara 0 dan 100.",
  ),
  serviceChargeRate: z.string().transform(parseOutletPercentage).refine(
    (value): value is string => value !== null,
    "Persentase layanan harus antara 0 dan 100.",
  ),
  pricesIncludeTax: z.preprocess(
    (value) => value === "on" || value === "true",
    z.boolean(),
  ),
});

export const createOutletSchema = outletFields;

export const updateOutletSchema = outletFields.extend({
  id: z.string().trim().min(1, "Outlet tidak ditemukan."),
  expectedUpdatedAt: z.iso.datetime({ error: "Versi outlet tidak valid. Muat ulang halaman." }),
});

export const outletMutationTargetSchema = z.object({
  id: z.string().trim().min(1, "Outlet tidak ditemukan."),
  expectedUpdatedAt: z.iso.datetime({ error: "Versi outlet tidak valid. Muat ulang halaman." }),
});

export const outletSearchSchema = z.object({
  q: z.string().trim().max(100).catch(""),
  status: z.enum(["active", "archived", "all"]).catch("active"),
  page: z.coerce.number().int().min(1).catch(1),
});

export const selectOutletSchema = z.object({
  outletId: z.string().trim().min(1, "Pilih outlet terlebih dahulu."),
});

export type OutletInput = z.infer<typeof createOutletSchema>;
export type UpdateOutletInput = z.infer<typeof updateOutletSchema>;
export type OutletMutationTarget = z.infer<typeof outletMutationTargetSchema>;
export type OutletSearch = z.infer<typeof outletSearchSchema>;
