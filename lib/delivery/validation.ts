import { z } from "zod";

const idSchema = z.string().trim().min(1).max(80);
const moneySchema = z.string().regex(/^-?\d{1,12}\.\d{2}$/, "Nominal tidak valid.");
const positiveMoneySchema = z.string().regex(/^\d{1,12}\.\d{2}$/, "Nominal tidak valid.");

export const deliveryChannelSchema = z.object({
  outletId: idSchema,
  provider: z.enum(["GOFOOD", "GRABFOOD", "SHOPEEFOOD"]),
  isActive: z.preprocess((value) => value === "true" || value === "on", z.boolean()),
  markupRate: z.coerce.number().gt(0, "Markup harus lebih dari 0%.").lt(1000).transform((value) => value.toFixed(2)),
  estimatedFeeRate: z.coerce.number().min(0).lt(100).transform((value) => value.toFixed(2)),
  settlementDelayHours: z.coerce.number().int().min(1).max(720),
});

export const channelProductPriceSchema = z.object({
  outletId: idSchema,
  channelId: idSchema,
  productId: idSchema,
  priceOverride: z.preprocess(
    (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
    z.coerce.number().int().positive().refine((value) => value % 500 === 0, "Harga harus kelipatan Rp500.").optional(),
  ),
});

export const settlementBatchSchema = z.object({
  outletId: idSchema,
  channelId: idSchema,
  paymentIds: z.array(idSchema).min(1).max(500).refine((values) => new Set(values).size === values.length, "Transaksi tidak boleh duplikat."),
  reference: z.string().trim().min(1, "Referensi transfer wajib diisi.").max(80),
  platformFeeAmount: positiveMoneySchema,
  merchantPromotionAmount: positiveMoneySchema,
  otherAdjustmentAmount: moneySchema,
  otherAdjustmentNote: z.string().trim().max(240),
  netReceivedAmount: positiveMoneySchema,
  receivedAt: z.iso.datetime(),
}).superRefine((value, context) => {
  if (Number(value.otherAdjustmentAmount) !== 0 && !value.otherAdjustmentNote) {
    context.addIssue({ code: "custom", path: ["otherAdjustmentNote"], message: "Catatan penyesuaian wajib diisi." });
  }
});

export const reverseSettlementSchema = z.object({
  outletId: idSchema,
  settlementId: idSchema,
  reason: z.string().trim().min(5, "Alasan minimal 5 karakter.").max(240),
});

export type DeliveryChannelInput = z.infer<typeof deliveryChannelSchema>;
export type ChannelProductPriceInput = z.infer<typeof channelProductPriceSchema>;
export type SettlementBatchInput = z.infer<typeof settlementBatchSchema>;
export type ReverseSettlementInput = z.infer<typeof reverseSettlementSchema>;
