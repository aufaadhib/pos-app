import { z } from "zod";

const trimmedFooterSchema = z.string()
  .transform((value) => value.trim())
  .pipe(z.string().max(160, "Footer maksimal 160 karakter."));

export const printerSettingsSchema = z.object({
  outletId: z.string().trim().min(1),
  receiptPaperSize: z.enum(["MM58", "MM80"]),
  receiptFooter: trimmedFooterSchema,
});

export type PrinterSettingsInput = z.infer<typeof printerSettingsSchema>;
