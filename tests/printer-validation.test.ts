import { describe, expect, it } from "vitest";

import { printerSettingsSchema } from "@/lib/printers/validation";

describe("printer settings validation", () => {
  it("accepts only supported paper sizes", () => {
    expect(printerSettingsSchema.safeParse({ outletId: "outlet-1", receiptPaperSize: "MM58", receiptFooter: "Footer" }).success).toBe(true);
    expect(printerSettingsSchema.safeParse({ outletId: "outlet-1", receiptPaperSize: "A4", receiptFooter: "Footer" }).success).toBe(false);
  });

  it("trims the footer before enforcing its 160-character limit", () => {
    const parsed = printerSettingsSchema.safeParse({ outletId: "outlet-1", receiptPaperSize: "MM80", receiptFooter: "  Terima kasih.  " });
    expect(parsed.success && parsed.data.receiptFooter).toBe("Terima kasih.");
    expect(printerSettingsSchema.safeParse({ outletId: "outlet-1", receiptPaperSize: "MM80", receiptFooter: "x".repeat(161) }).success).toBe(false);
  });
});
