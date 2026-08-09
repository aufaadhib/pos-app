import { z } from "zod";

const idSchema = z.string().trim().min(1).max(80);
const moneySchema = z.string().regex(/^\d{1,12}\.\d{2}$/, "Nominal tidak valid.");
const uniqueIdsSchema = z.array(idSchema).max(30).refine(
  (values) => new Set(values).size === values.length,
  "Pilihan tidak boleh duplikat.",
);

export const cartItemSchema = z.object({
  orderItemId: idSchema.optional(),
  productId: idSchema,
  quantity: z.number().int().min(1).max(99),
  note: z.string().trim().max(240).optional(),
  variantOptionIds: uniqueIdsSchema,
  modifierOptionIds: uniqueIdsSchema,
  expectedUnitPrice: moneySchema,
});

export const checkoutSchema = z.object({
  checkoutToken: z.uuid(),
  outletId: idSchema,
  orderId: idSchema.optional(),
  expectedVersion: z.number().int().positive().optional(),
  source: z.discriminatedUnion("type", [
    z.object({ type: z.literal("DIRECT") }),
    z.object({ type: z.literal("DELIVERY_PLATFORM"), channelId: idSchema, externalOrderId: z.string().trim().min(1, "Nomor order platform wajib diisi.").max(80) }),
  ]).default({ type: "DIRECT" }),
  orderType: z.enum(["DINE_IN", "TAKEAWAY", "DELIVERY"]),
  tableLabel: z.string().trim().max(40).optional(),
  items: z.array(cartItemSchema).min(1).max(100),
  payment: z.object({
    method: z.enum(["CASH", "QRIS", "DEBIT_CARD", "CREDIT_CARD", "BANK_TRANSFER"]),
    tenderedAmount: moneySchema.optional(),
    reference: z.string().trim().max(80).optional(),
  }).optional(),
}).superRefine((value, context) => {
  if (value.source.type === "DIRECT" && value.orderType === "DELIVERY") {
    context.addIssue({ code: "custom", path: ["orderType"], message: "Delivery hanya tersedia untuk order platform." });
  }
  if (value.source.type === "DELIVERY_PLATFORM" && value.orderType !== "DELIVERY") {
    context.addIssue({ code: "custom", path: ["orderType"], message: "Order platform harus menggunakan jenis delivery." });
  }
  if (value.source.type === "DIRECT" && value.orderType === "DINE_IN" && !value.tableLabel) {
    context.addIssue({ code: "custom", path: ["tableLabel"], message: "Nomor atau nama meja wajib diisi." });
  }
  if (value.source.type === "DIRECT" && !value.payment) {
    context.addIssue({ code: "custom", path: ["payment"], message: "Metode pembayaran wajib dipilih." });
  }
  if (value.source.type === "DELIVERY_PLATFORM" && value.payment) {
    context.addIssue({ code: "custom", path: ["payment"], message: "Pembayaran platform ditentukan oleh server." });
  }
  if (value.source.type === "DIRECT" && value.payment?.method === "CASH" && !value.payment.tenderedAmount) {
    context.addIssue({ code: "custom", path: ["payment", "tenderedAmount"], message: "Uang diterima wajib diisi." });
  }
  if (Boolean(value.orderId) !== Boolean(value.expectedVersion)) {
    context.addIssue({ code: "custom", path: ["orderId"], message: "Versi open order tidak lengkap." });
  }
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

const correctionBaseSchema = z.object({
  saleId: idSchema,
  outletId: idSchema,
  operationToken: z.uuid(),
  reason: z.string().trim().min(5, "Alasan minimal 5 karakter.").max(240),
  providerReference: z.preprocess(
    (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().trim().min(1).max(80).optional(),
  ),
});

export const voidSaleSchema = correctionBaseSchema;

export const refundSaleSchema = correctionBaseSchema.extend({
  items: z.array(z.object({
    saleItemId: idSchema,
    quantity: z.number().int().min(1).max(99),
  })).min(1, "Pilih minimal satu item.").max(100).refine(
    (items) => new Set(items.map((item) => item.saleItemId)).size === items.length,
    "Item refund tidak boleh duplikat.",
  ),
});

export type VoidSaleInput = z.infer<typeof voidSaleSchema>;
export type RefundSaleInput = z.infer<typeof refundSaleSchema>;

/** Parses the JSON item payload from a refund form before applying the shared Zod boundary. */
export function parseRefundSaleForm(formData: FormData) {
  let items: unknown;
  try {
    items = JSON.parse(String(formData.get("items") ?? "null"));
  } catch {
    items = null;
  }
  return refundSaleSchema.safeParse({ ...Object.fromEntries(formData), items });
}
