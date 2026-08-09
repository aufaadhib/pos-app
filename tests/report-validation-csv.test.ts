import { describe, expect, it } from "vitest";

import { createReportCsv, escapeCsvCell, getReportCsvRowCount } from "@/lib/reports/csv";
import type { ReportDataset } from "@/lib/reports/types";
import { parseReportSearch } from "@/lib/reports/validation";

describe("report validation and CSV", () => {
  it("accepts one year and rejects reversed or oversized ranges", () => {
    expect(parseReportSearch({ view: "overview", from: "2026-01-01", to: "2026-12-31", outletId: "all" }).success).toBe(true);
    expect(parseReportSearch({ view: "overview", from: "2026-08-10", to: "2026-08-09", outletId: "all" }).success).toBe(false);
    expect(parseReportSearch({ view: "overview", from: "2025-01-01", to: "2026-01-02", outletId: "all" }).success).toBe(false);
  });

  it("escapes CSV delimiters and spreadsheet formulas", () => {
    expect(escapeCsvCell("Sate, ayam")).toBe('"Sate, ayam"');
    expect(escapeCsvCell('A "spesial"')).toBe('"A ""spesial"""');
    expect(escapeCsvCell("=2+2")).toBe("'=2+2");
    expect(escapeCsvCell("-10")).toBe("'-10");
  });

  it("exports the selected report rows with metadata", () => {
    const dataset: ReportDataset = { view: "products", data: [{ key: "p1:c1", categoryName: "Sate", productName: "=Sate ayam", sku: null, soldQuantity: 2, refundedQuantity: 0, netQuantity: 2, grossRevenue: "40000.00", refundRevenue: "0.00", netRevenue: "40000.00" }] };
    const csv = createReportCsv(dataset, { view: "products", from: "2026-08-09", to: "2026-08-09", outletId: "outlet-1" });
    expect(csv).toContain("Laporan,products");
    expect(csv).toContain("'=Sate ayam");
    expect(getReportCsvRowCount(dataset)).toBe(1);
  });
});
