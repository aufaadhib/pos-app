import { z } from "zod";

import { normalizeOperationalLabel } from "@/lib/outlets/normalization";

const staffRoleSchema = z.enum(["manager", "cashier", "staff"], { error: "Pilih peran staf." });
const outletIdsSchema = z.array(z.string().trim().min(1)).min(1, "Pilih minimal satu outlet.").max(20)
  .transform((values) => [...new Set(values)]);

const staffFields = z.object({
  name: z.string().transform(normalizeOperationalLabel).pipe(
    z.string().min(2, "Nama staf minimal 2 karakter.").max(80, "Nama staf maksimal 80 karakter."),
  ),
  role: staffRoleSchema,
  jobPositionId: z.string().trim().min(1, "Pilih jabatan staf."),
  outletIds: outletIdsSchema,
});

export const createStaffSchema = staffFields.extend({
  email: z.email("Masukkan email yang valid.").trim().toLowerCase().max(160),
});

export const updateStaffSchema = staffFields.extend({
  id: z.string().trim().min(1, "Staf tidak ditemukan."),
  expectedUpdatedAt: z.iso.datetime({ error: "Versi data staf tidak valid. Muat ulang halaman." }),
});

export const staffMutationTargetSchema = z.object({
  id: z.string().trim().min(1, "Staf tidak ditemukan."),
  expectedUpdatedAt: z.iso.datetime({ error: "Versi data staf tidak valid. Muat ulang halaman." }),
});

export const staffPositionSchema = z.object({
  name: z.string().transform(normalizeOperationalLabel).pipe(z.string().min(2, "Nama jabatan minimal 2 karakter.").max(80, "Nama jabatan maksimal 80 karakter.")),
});

export const updateStaffPositionSchema = staffPositionSchema.extend({
  id: z.string().trim().min(1),
  expectedUpdatedAt: z.iso.datetime(),
});

export const staffPositionTargetSchema = z.object({ id: z.string().trim().min(1), expectedUpdatedAt: z.iso.datetime() });

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(8, "Kata sandi saat ini minimal 8 karakter.").max(128),
  newPassword: z.string().min(12, "Kata sandi baru minimal 12 karakter.").max(128),
  confirmPassword: z.string().min(1, "Ulangi kata sandi baru."),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Konfirmasi kata sandi tidak sama.",
  path: ["confirmPassword"],
});

export const staffSearchSchema = z.object({
  q: z.string().trim().max(100).catch(""),
  role: z.enum(["all", "manager", "cashier", "staff"]).catch("all"),
  status: z.enum(["active", "inactive", "all"]).catch("active"),
  outlet: z.string().trim().max(100).catch(""),
  page: z.coerce.number().int().min(1).catch(1),
});

export type CreateStaffInput = z.infer<typeof createStaffSchema>;
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;
export type StaffMutationTarget = z.infer<typeof staffMutationTargetSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type StaffSearch = z.infer<typeof staffSearchSchema>;
export type StaffPositionInput = z.infer<typeof staffPositionSchema>;
export type UpdateStaffPositionInput = z.infer<typeof updateStaffPositionSchema>;
export type StaffPositionTarget = z.infer<typeof staffPositionTargetSchema>;
