import { describe, expect, it } from "vitest";

import { buildOverviewReport, buildPaymentRows, buildProductRows } from "@/lib/reports/calculations";

describe("report calculations", () => {
  it("attributes refunds and voids to their execution date", () => {
    const report = buildOverviewReport("2026-08-01", "2026-08-03", [
      { date: "2026-08-01", grossSales: "100000.00", subtotal: "80000.00", serviceCharge: "10000.00", tax: "10000.00", transactionCount: 2, soldQuantity: 5 },
      { date: "2026-08-02", grossSales: "50000.00", subtotal: "40000.00", serviceCharge: "5000.00", tax: "5000.00", transactionCount: 1, soldQuantity: 2 },
    ], [
      { date: "2026-08-02", refundAmount: "20000.00", voidAmount: "0.00", subtotal: "15000.00", serviceCharge: "2000.00", tax: "3000.00", voidCount: 0, refundedQuantity: 1 },
      { date: "2026-08-03", refundAmount: "0.00", voidAmount: "50000.00", subtotal: "40000.00", serviceCharge: "5000.00", tax: "5000.00", voidCount: 1, refundedQuantity: 2 },
    ], []);

    expect(report.summary).toMatchObject({
      grossSales: "150000.00",
      refundAmount: "20000.00",
      voidAmount: "50000.00",
      netSales: "80000.00",
      transactionCount: 2,
      averageTicket: "40000.00",
    });
    expect(report.daily.map((row) => row.netSales)).toEqual(["100000.00", "30000.00", "-50000.00"]);
  });

  it("keeps product snapshots and supports refund-only rows", () => {
    const rows = buildProductRows([
      { key: "p1:c1", categoryName: "Sate", productName: "Sate ayam", sku: "SAT-1", quantity: 5, amount: "100000.00" },
    ], [
      { key: "p1:c1", categoryName: "Sate", productName: "Sate ayam", sku: "SAT-1", quantity: 2, amount: "40000.00" },
      { key: "legacy:legacy", categoryName: "Kategori belum tersimpan", productName: "Produk lama", sku: null, quantity: 1, amount: "10000.00" },
    ]);

    expect(rows[0]).toMatchObject({ productName: "Sate ayam", netQuantity: 3, netRevenue: "60000.00" });
    expect(rows[1]).toMatchObject({ productName: "Produk lama", netQuantity: -1, netRevenue: "-10000.00" });
  });

  it("reconciles payment methods without floating point", () => {
    expect(buildPaymentRows(
      [{ method: "CASH", count: 2, amount: "100000.00" }],
      [{ method: "CASH", count: 1, amount: "25000.00" }, { method: "QRIS", count: 1, amount: "10000.00" }],
    )).toEqual([
      { method: "CASH", transactionCount: 2, refundCount: 1, grossAmount: "100000.00", refundAmount: "25000.00", netAmount: "75000.00" },
      { method: "QRIS", transactionCount: 0, refundCount: 1, grossAmount: "0.00", refundAmount: "10000.00", netAmount: "-10000.00" },
    ]);
  });
});
