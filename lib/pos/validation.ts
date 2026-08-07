import { z } from "zod";

const idSchema = z.string().trim().min(1).max(80);
const moneySchema = z.string().regex(/^\d{1,12}\.\d{2}$/, "Nominal tidak valid.");
const uniqueIdsSchema = z.array(idSchema).max(30).refine(
  (values) => new Set(values).size === values.length,
  "Pilihan tidak boleh duplikat.",
);

export const checkoutSchema = z.object({
  checkoutToken: z.uuid(),
  outletId: idSchema,
  orderType: z.enum(["DINE_IN", "TAKEAWAY"]),
  tableLabel: z.string().trim().max(40).optional(),
  items: z.array(z.object({
    productId: idSchema,
    quantity: z.number().int().min(1).max(99),
    note: z.string().trim().max(240).optional(),
    variantOptionIds: uniqueIdsSchema,
    modifierOptionIds: uniqueIdsSchema,
    expectedUnitPrice: moneySchema,
  })).min(1).max(100),
  payment: z.object({
    method: z.enum(["CASH", "QRIS", "DEBIT_CARD", "CREDIT_CARD", "BANK_TRANSFER"]),
    tenderedAmount: moneySchema.optional(),
    reference: z.string().trim().max(80).optional(),
  }),
}).superRefine((value, context) => {
  if (value.orderType === "DINE_IN" && !value.tableLabel) {
    context.addIssue({ code: "custom", path: ["tableLabel"], message: "Nomor atau nama meja wajib diisi." });
  }
  if (value.payment.method === "CASH" && !value.payment.tenderedAmount) {
    context.addIssue({ code: "custom", path: ["payment", "tenderedAmount"], message: "Uang diterima wajib diisi." });
  }
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
