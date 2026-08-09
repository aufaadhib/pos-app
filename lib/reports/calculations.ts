import { Prisma } from "@/generated/prisma/client";
import type {
  DailyReportRow,
  OverviewReport,
  PaymentReportRow,
  ProductReportRow,
  SourceReportRow,
} from "@/lib/reports/types";

type DecimalInput = Prisma.Decimal | number | string;

export type DailySalesAggregate = {
  date: string;
  grossSales: string;
  subtotal: string;
  serviceCharge: string;
  tax: string;
  transactionCount: number;
  soldQuantity: number;
};

export type DailyCorrectionAggregate = {
  date: string;
  refundAmount: string;
  voidAmount: string;
  subtotal: string;
  serviceCharge: string;
  tax: string;
  voidCount: number;
  refundedQuantity: number;
};

export type ProductAggregate = {
  key: string;
  categoryName: string;
  productName: string;
  sku: string | null;
  quantity: number;
  amount: string;
};

export type PaymentAggregate = {
  method: string;
  count: number;
  amount: string;
};

/** Reconciles sale-date gross values with correction-date refunds and voids using Decimal arithmetic. */
export function buildOverviewReport(
  from: string,
  to: string,
  sales: DailySalesAggregate[],
  corrections: DailyCorrectionAggregate[],
  sources: SourceReportRow[],
): OverviewReport {
  const salesByDate = new Map(sales.map((row) => [row.date, row]));
  const correctionsByDate = new Map(corrections.map((row) => [row.date, row]));
  const daily: DailyReportRow[] = dateRange(from, to).map((date) => {
    const sale = salesByDate.get(date);
    const correction = correctionsByDate.get(date);
    const gross = decimal(sale?.grossSales);
    const correctionAmount = decimal(correction?.refundAmount).add(correction?.voidAmount ?? 0);
    return {
      date,
      grossSales: fixed(gross),
      correctionAmount: fixed(correctionAmount),
      netSales: fixed(gross.sub(correctionAmount)),
      transactionCount: Math.max(0, (sale?.transactionCount ?? 0) - (correction?.voidCount ?? 0)),
    };
  });
  const grossSales = sum(sales, (row) => row.grossSales);
  const refundAmount = sum(corrections, (row) => row.refundAmount);
  const voidAmount = sum(corrections, (row) => row.voidAmount);
  const correctionSubtotal = sum(corrections, (row) => row.subtotal);
  const correctionService = sum(corrections, (row) => row.serviceCharge);
  const correctionTax = sum(corrections, (row) => row.tax);
  const netSales = grossSales.sub(refundAmount).sub(voidAmount);
  const transactionCount = Math.max(0, sales.reduce((total, row) => total + row.transactionCount, 0) - corrections.reduce((total, row) => total + row.voidCount, 0));
  return {
    summary: {
      grossSales: fixed(grossSales),
      refundAmount: fixed(refundAmount),
      voidAmount: fixed(voidAmount),
      netSales: fixed(netSales),
      netSubtotal: fixed(sum(sales, (row) => row.subtotal).sub(correctionSubtotal)),
      netServiceCharge: fixed(sum(sales, (row) => row.serviceCharge).sub(correctionService)),
      netTax: fixed(sum(sales, (row) => row.tax).sub(correctionTax)),
      transactionCount,
      voidCount: corrections.reduce((total, row) => total + row.voidCount, 0),
      soldQuantity: sales.reduce((total, row) => total + row.soldQuantity, 0),
      refundedQuantity: corrections.reduce((total, row) => total + row.refundedQuantity, 0),
      averageTicket: fixed(transactionCount ? netSales.div(transactionCount).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP) : 0),
    },
    daily,
    sources,
  };
}

/** Combines sale-period product rows with correction-period refund rows without mutating historical snapshots. */
export function buildProductRows(sales: ProductAggregate[], refunds: ProductAggregate[]): ProductReportRow[] {
  const rows = new Map<string, ProductReportRow>();
  for (const aggregate of sales) {
    rows.set(aggregate.key, {
      key: aggregate.key,
      categoryName: aggregate.categoryName,
      productName: aggregate.productName,
      sku: aggregate.sku,
      soldQuantity: aggregate.quantity,
      refundedQuantity: 0,
      netQuantity: aggregate.quantity,
      grossRevenue: fixed(aggregate.amount),
      refundRevenue: "0.00",
      netRevenue: fixed(aggregate.amount),
    });
  }
  for (const aggregate of refunds) {
    const current = rows.get(aggregate.key) ?? {
      key: aggregate.key,
      categoryName: aggregate.categoryName,
      productName: aggregate.productName,
      sku: aggregate.sku,
      soldQuantity: 0,
      refundedQuantity: 0,
      netQuantity: 0,
      grossRevenue: "0.00",
      refundRevenue: "0.00",
      netRevenue: "0.00",
    };
    current.refundedQuantity += aggregate.quantity;
    current.netQuantity = current.soldQuantity - current.refundedQuantity;
    current.refundRevenue = fixed(decimal(current.refundRevenue).add(aggregate.amount));
    current.netRevenue = fixed(decimal(current.grossRevenue).sub(current.refundRevenue));
    rows.set(aggregate.key, current);
  }
  return [...rows.values()].sort((a, b) => decimal(b.netRevenue).comparedTo(a.netRevenue) || a.productName.localeCompare(b.productName, "id"));
}

/** Reconciles payments received with refunds executed in the selected period. */
export function buildPaymentRows(sales: PaymentAggregate[], refunds: PaymentAggregate[]): PaymentReportRow[] {
  const methods = new Set([...sales.map((row) => row.method), ...refunds.map((row) => row.method)]);
  return [...methods].map((method) => {
    const sale = sales.find((row) => row.method === method);
    const refund = refunds.find((row) => row.method === method);
    const gross = decimal(sale?.amount);
    const refunded = decimal(refund?.amount);
    return {
      method,
      transactionCount: sale?.count ?? 0,
      refundCount: refund?.count ?? 0,
      grossAmount: fixed(gross),
      refundAmount: fixed(refunded),
      netAmount: fixed(gross.sub(refunded)),
    };
  }).sort((a, b) => decimal(b.netAmount).comparedTo(a.netAmount));
}

/** Produces every inclusive ISO date in a validated report range. */
function dateRange(from: string, to: string) {
  const dates: string[] = [];
  for (let cursor = Date.parse(`${from}T00:00:00.000Z`), end = Date.parse(`${to}T00:00:00.000Z`); cursor <= end; cursor += 86_400_000) {
    dates.push(new Date(cursor).toISOString().slice(0, 10));
  }
  return dates;
}

function decimal(value: DecimalInput | null | undefined) {
  return new Prisma.Decimal(value ?? 0);
}

function fixed(value: DecimalInput) {
  return decimal(value).toFixed(2);
}

function sum<T>(rows: T[], pick: (row: T) => DecimalInput) {
  return rows.reduce((total, row) => total.add(pick(row)), new Prisma.Decimal(0));
}
