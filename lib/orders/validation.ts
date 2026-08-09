import { z } from "zod";

import { cartItemSchema } from "@/lib/pos/validation";

const idSchema = z.string().trim().min(1);
const reasonSchema = z.string().trim().min(5, "Alasan minimal 5 karakter.").max(240);

const orderContentSchema = z.object({
  outletId: idSchema,
  orderType: z.enum(["DINE_IN", "TAKEAWAY"]),
  tableLabel: z.string().trim().max(40).optional(),
  items: z.array(cartItemSchema).min(1).max(100),
}).superRefine((value, context) => {
  if (value.orderType === "DINE_IN" && !value.tableLabel) {
    context.addIssue({ code: "custom", path: ["tableLabel"], message: "Nomor atau nama meja wajib diisi." });
  }
});

export const saveOrderSchema = orderContentSchema.extend({ operationToken: z.uuid() });
export const updateOrderSchema = orderContentSchema.extend({
  orderId: idSchema,
  expectedVersion: z.number().int().positive(),
  operationToken: z.uuid(),
  reductionReason: reasonSchema.optional(),
});
export const orderMutationSchema = z.object({
  orderId: idSchema,
  outletId: idSchema,
  expectedVersion: z.number().int().positive(),
  operationToken: z.uuid(),
});
export const cancelOrderSchema = orderMutationSchema.extend({ reason: reasonSchema });
export const ticketStatusSchema = z.object({
  ticketId: idSchema,
  outletId: idSchema,
  status: z.enum(["PROCESSING", "COMPLETED"]),
});
export const outletOperationsSchema = z.object({ outletId: idSchema, openOrdersEnabled: z.boolean() });

export type SaveOrderInput = z.infer<typeof saveOrderSchema>;
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;
export type OrderMutationInput = z.infer<typeof orderMutationSchema>;
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;
export type TicketStatusInput = z.infer<typeof ticketStatusSchema>;
