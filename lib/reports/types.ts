export const reportViews = ["overview", "products", "payments", "shifts", "corrections", "settlements"] as const;
export type ReportView = (typeof reportViews)[number];

export type ReportOutlet = {
  id: string;
  code: string;
  name: string;
  timezone: string;
};

export type ReportFilter = {
  from: string;
  to: string;
  outletIds: string[];
};

export type ReportSelection = {
  view: ReportView;
  from: string;
  to: string;
  outletId: string;
};

export type ReportSummary = {
  grossSales: string;
  refundAmount: string;
  voidAmount: string;
  netSales: string;
  netSubtotal: string;
  netServiceCharge: string;
  netTax: string;
  transactionCount: number;
  voidCount: number;
  soldQuantity: number;
  refundedQuantity: number;
  averageTicket: string;
};

export type DailyReportRow = {
  date: string;
  grossSales: string;
  correctionAmount: string;
  netSales: string;
  transactionCount: number;
};

export type SourceReportRow = {
  source: string;
  transactionCount: number;
  grossSales: string;
};

export type OverviewReport = {
  summary: ReportSummary;
  daily: DailyReportRow[];
  sources: SourceReportRow[];
};

export type ProductReportRow = {
  key: string;
  categoryName: string;
  productName: string;
  sku: string | null;
  soldQuantity: number;
  refundedQuantity: number;
  netQuantity: number;
  grossRevenue: string;
  refundRevenue: string;
  netRevenue: string;
};

export type PaymentReportRow = {
  method: string;
  transactionCount: number;
  refundCount: number;
  grossAmount: string;
  refundAmount: string;
  netAmount: string;
};

export type ShiftReportRow = {
  id: string;
  businessDate: string;
  outletName: string;
  timezone: string;
  openedByName: string;
  openedAt: string;
  closedAt: string | null;
  status: "OPEN" | "CLOSED";
  openingCash: string;
  cashSales: string;
  cashRefunds: string;
  cashIn: string;
  cashOut: string;
  expectedCash: string;
  actualCash: string | null;
  difference: string | null;
};

export type ShiftReport = {
  rows: ShiftReportRow[];
  totalRows: number;
  truncated: boolean;
};

export type CorrectionReportRow = {
  id: string;
  saleId: string;
  type: "VOID" | "REFUND";
  receiptNumber: string;
  outletName: string;
  amount: string;
  subtotalAmount: string;
  serviceChargeAmount: string;
  taxAmount: string;
  reason: string;
  actorName: string;
  createdAt: string;
  timezone: string;
};

export type CorrectionReport = {
  rows: CorrectionReportRow[];
  totalRows: number;
  truncated: boolean;
};

export type SettlementReportSummary = {
  pendingCount: number;
  pendingGross: string;
  expectedNet: string;
  overdueGross: string;
  confirmedGross: string;
  confirmedFees: string;
  confirmedPromotions: string;
  confirmedAdjustments: string;
  confirmedNet: string;
  directComparison: string;
  reversedCount: number;
};

export type SettlementReportRow = {
  id: string;
  provider: string;
  reference: string;
  grossAmount: string;
  platformFeeAmount: string;
  merchantPromotionAmount: string;
  otherAdjustmentAmount: string;
  netReceivedAmount: string;
  directEquivalentAmount: string;
  receivedAt: string;
  timezone: string;
  outletName: string;
  status: "CONFIRMED" | "REVERSED";
  transactionCount: number;
};

export type SettlementReport = {
  summary: SettlementReportSummary;
  rows: SettlementReportRow[];
  totalRows: number;
  truncated: boolean;
};

export type ReportDataMap = {
  overview: OverviewReport;
  products: ProductReportRow[];
  payments: PaymentReportRow[];
  shifts: ShiftReport;
  corrections: CorrectionReport;
  settlements: SettlementReport;
};

export type ReportDataset = {
  [View in ReportView]: { view: View; data: ReportDataMap[View] };
}[ReportView];
