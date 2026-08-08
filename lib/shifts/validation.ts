import { z } from "zod";

const idSchema = z.string().trim().min(1).max(80);
const tokenSchema = z.uuid();
const moneySchema = z.string().trim().regex(/^\d{1,12}(?:\.\d{1,2})?$/, "Nominal tidak valid.");
const reasonSchema = z.string().trim().min(5, "Alasan minimal 5 karakter.").max(240);

export const openCashShiftSchema = z.object({
  outletId: idSchema,
  openingCash: moneySchema,
  openToken: tokenSchema,
});

export const cashMovementSchema = z.object({
  shiftId: idSchema,
  outletId: idSchema,
  operationToken: tokenSchema,
  direction: z.enum(["IN", "OUT"]),
  category: z.enum(["ADDITIONAL_FLOAT", "CASH_DROP", "OPERATING_EXPENSE", "OTHER"]),
  amount: moneySchema.refine((value) => Number(value) > 0, "Nominal harus lebih dari nol."),
  reason: reasonSchema,
}).superRefine((value, context) => {
  if (value.category === "ADDITIONAL_FLOAT" && value.direction !== "IN") {
    context.addIssue({ code: "custom", path: ["direction"], message: "Tambahan modal harus berupa kas masuk." });
  }
  if (["CASH_DROP", "OPERATING_EXPENSE"].includes(value.category) && value.direction !== "OUT") {
    context.addIssue({ code: "custom", path: ["direction"], message: "Kategori ini harus berupa kas keluar." });
  }
});

export const closeCashShiftSchema = z.object({
  shiftId: idSchema,
  outletId: idSchema,
  actualCash: moneySchema,
  closeToken: tokenSchema,
});

export const forceCloseCashShiftSchema = closeCashShiftSchema.extend({ reason: reasonSchema });

export const cashShiftSearchSchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  status: z.enum(["all", "OPEN", "CLOSED"]).catch("all"),
});

export const cashShiftDetailSearchSchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
});

export type OpenCashShiftInput = z.infer<typeof openCashShiftSchema>;
export type CashMovementInput = z.infer<typeof cashMovementSchema>;
export type CloseCashShiftInput = z.infer<typeof closeCashShiftSchema>;
export type ForceCloseCashShiftInput = z.infer<typeof forceCloseCashShiftSchema>;
