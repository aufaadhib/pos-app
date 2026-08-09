import { z } from "zod";

import { reportViews } from "@/lib/reports/types";

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal harus menggunakan format YYYY-MM-DD.").refine(
  (value) => !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)),
  "Tanggal tidak valid.",
);

export const reportSearchSchema = z.object({
  view: z.enum(reportViews),
  from: isoDateSchema,
  to: isoDateSchema,
  outletId: z.string().trim().min(1).max(80),
}).superRefine((value, context) => {
  const from = Date.parse(`${value.from}T00:00:00.000Z`);
  const to = Date.parse(`${value.to}T00:00:00.000Z`);
  if (from > to) context.addIssue({ code: "custom", path: ["to"], message: "Tanggal akhir tidak boleh sebelum tanggal awal." });
  if ((to - from) / 86_400_000 >= 366) context.addIssue({ code: "custom", path: ["to"], message: "Rentang laporan maksimal 366 hari." });
});

export type ReportSearch = z.infer<typeof reportSearchSchema>;

/** Parses one report URL boundary after dynamic defaults have been supplied by the caller. */
export function parseReportSearch(input: unknown) {
  return reportSearchSchema.safeParse(input);
}
