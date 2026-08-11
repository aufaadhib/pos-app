import type { ReportDataset, ReportSelection } from "@/lib/reports/types";

/** Serializes one selected report view as formula-safe UTF-8 CSV content. */
export function createReportCsv(dataset: ReportDataset, selection: ReportSelection) {
  const metadata = [
    ["Laporan", dataset.view],
    ["Periode", `${selection.from} s.d. ${selection.to}`],
    ["Outlet", selection.outletId],
    [],
  ];
  return [...metadata, ...datasetRows(dataset)].map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
}

/** Escapes delimiters and neutralizes spreadsheet formulas in untrusted snapshot labels. */
export function escapeCsvCell(value: unknown) {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** Counts exportable detail rows so the route can reject oversized downloads explicitly. */
export function getReportCsvRowCount(dataset: ReportDataset) {
  switch (dataset.view) {
    case "overview": return dataset.data.daily.length;
    case "products": return dataset.data.length;
    case "payments": return dataset.data.length;
    case "shifts": return dataset.data.rows.length;
    case "corrections": return dataset.data.rows.length;
    case "settlements": return dataset.data.rows.length;
  }
}

function datasetRows(dataset: ReportDataset): unknown[][] {
  switch (dataset.view) {
    case "overview": return [
      ["Tanggal", "Penjualan bruto", "Koreksi", "Net sales", "Jumlah transaksi"],
      ...dataset.data.daily.map((row) => [row.date, row.grossSales, row.correctionAmount, row.netSales, row.transactionCount]),
    ];
    case "products": return [
      ["Kategori", "Produk", "SKU", "Terjual", "Direfund", "Net kuantitas", "Bruto", "Refund", "Net pendapatan"],
      ...dataset.data.map((row) => [row.categoryName, row.productName, row.sku, row.soldQuantity, row.refundedQuantity, row.netQuantity, row.grossRevenue, row.refundRevenue, row.netRevenue]),
    ];
    case "payments": return [
      ["Metode", "Transaksi", "Jumlah refund", "Bruto", "Refund", "Net"],
      ...dataset.data.map((row) => [row.method, row.transactionCount, row.refundCount, row.grossAmount, row.refundAmount, row.netAmount]),
    ];
    case "shifts": return [
      ["Tanggal bisnis", "Outlet", "Petugas", "Dibuka", "Ditutup", "Status", "Saldo awal", "Penjualan tunai", "Refund tunai", "Kas masuk", "Kas keluar", "Expected", "Aktual asli", "Selisih asli", "Aktual efektif", "Selisih efektif", "Alasan koreksi", "Dikoreksi oleh", "Waktu koreksi"],
      ...dataset.data.rows.map((row) => [row.businessDate, row.outletName, row.openedByName, row.openedAt, row.closedAt, row.status, row.openingCash, row.cashSales, row.cashRefunds, row.cashIn, row.cashOut, row.expectedCash, row.originalActualCash, row.originalDifference, row.actualCash, row.difference, row.correctionReason, row.correctedByName, row.correctedAt]),
    ];
    case "corrections": return [
      ["Waktu", "Outlet", "Struk", "Jenis", "Subtotal", "Layanan", "Pajak", "Total", "Alasan", "Petugas"],
      ...dataset.data.rows.map((row) => [row.createdAt, row.outletName, row.receiptNumber, row.type, row.subtotalAmount, row.serviceChargeAmount, row.taxAmount, row.amount, row.reason, row.actorName]),
    ];
    case "settlements": return [
      ["Diterima", "Outlet", "Provider", "Referensi", "Status", "Transaksi", "Gross", "Fee", "Promo", "Penyesuaian", "Net diterima", "Pembanding direct"],
      ...dataset.data.rows.map((row) => [row.receivedAt, row.outletName, row.provider, row.reference, row.status, row.transactionCount, row.grossAmount, row.platformFeeAmount, row.merchantPromotionAmount, row.otherAdjustmentAmount, row.netReceivedAmount, row.directEquivalentAmount]),
    ];
  }
}
