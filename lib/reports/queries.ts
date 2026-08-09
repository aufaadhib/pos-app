import "server-only";

import { OutletStatus, Prisma } from "@/generated/prisma/client";
import type { AppRole } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import {
  buildOverviewReport,
  buildPaymentRows,
  buildProductRows,
  type DailyCorrectionAggregate,
  type DailySalesAggregate,
  type PaymentAggregate,
  type ProductAggregate,
} from "@/lib/reports/calculations";
import type {
  CorrectionReport,
  CorrectionReportRow,
  OverviewReport,
  ReportDataset,
  ReportFilter,
  ReportOutlet,
  ReportView,
  SettlementReport,
  SettlementReportRow,
  ShiftReport,
  ShiftReportRow,
  SourceReportRow,
} from "@/lib/reports/types";

const screenRowLimit = 200;

type DecimalValue = Prisma.Decimal | string | number | null;
type CountValue = bigint | number | null;

/** Lists active outlets visible to one report actor without exposing another manager's assignments. */
export async function getReportOutlets(userId: string, role: AppRole): Promise<ReportOutlet[]> {
  return prisma.outlet.findMany({
    where: { status: OutletStatus.ACTIVE, ...(role === "owner" ? {} : { assignments: { some: { userId } } }) },
    orderBy: { name: "asc" },
    select: { id: true, code: true, name: true, timezone: true },
  });
}

/** Resolves an all-outlet, requested-outlet, or active-outlet selection from an already authorized list. */
export function selectReportOutlets(outlets: ReportOutlet[], requestedOutletId: string, activeOutletId?: string | null) {
  if (requestedOutletId === "all") return outlets;
  const requested = outlets.find((outlet) => outlet.id === requestedOutletId);
  if (requested) return [requested];
  const active = outlets.find((outlet) => outlet.id === activeOutletId);
  return active ? [active] : outlets.slice(0, 1);
}

/** Loads the selected report dataset with a bounded detail row limit and fresh database reads. */
export async function getReportDataset<View extends ReportView>(view: View, filter: ReportFilter, limit = screenRowLimit): Promise<Extract<ReportDataset, { view: View }>> {
  let dataset: ReportDataset;
  switch (view) {
    case "overview": dataset = { view: "overview", data: await getOverviewReport(filter) }; break;
    case "products": dataset = { view: "products", data: await getProductReport(filter) }; break;
    case "payments": dataset = { view: "payments", data: await getPaymentReport(filter) }; break;
    case "shifts": dataset = { view: "shifts", data: await getShiftReport(filter, limit) }; break;
    case "corrections": dataset = { view: "corrections", data: await getCorrectionReport(filter, limit) }; break;
    case "settlements": dataset = { view: "settlements", data: await getSettlementReport(filter, limit) }; break;
    default: throw new Error("Tampilan laporan tidak didukung.");
  }
  return dataset as Extract<ReportDataset, { view: View }>;
}

/** Aggregates gross sales by business date and subtracts corrections on their execution date. */
export async function getOverviewReport(filter: ReportFilter): Promise<OverviewReport> {
  const outletIds = Prisma.join(filter.outletIds);
  const [saleRows, correctionRows, sourceRows] = await Promise.all([
    prisma.$queryRaw<Array<{
      date: string; grossSales: DecimalValue; subtotal: DecimalValue; serviceCharge: DecimalValue;
      tax: DecimalValue; transactionCount: CountValue; soldQuantity: CountValue;
    }>>(Prisma.sql`
      WITH item_quantity AS (
        SELECT "saleId", SUM("quantity")::bigint AS quantity
        FROM "sale_item"
        GROUP BY "saleId"
      )
      SELECT TO_CHAR(s."businessDate", 'YYYY-MM-DD') AS date,
        COALESCE(SUM(s."total"), 0) AS "grossSales",
        COALESCE(SUM(s."subtotal"), 0) AS subtotal,
        COALESCE(SUM(s."serviceChargeAmount"), 0) AS "serviceCharge",
        COALESCE(SUM(s."taxAmount"), 0) AS tax,
        COUNT(*)::bigint AS "transactionCount",
        COALESCE(SUM(iq.quantity), 0)::bigint AS "soldQuantity"
      FROM "sale" s
      LEFT JOIN item_quantity iq ON iq."saleId" = s.id
      WHERE s."outletId" IN (${outletIds})
        AND s."businessDate" BETWEEN ${filter.from}::date AND ${filter.to}::date
      GROUP BY s."businessDate"
      ORDER BY s."businessDate" ASC
    `),
    prisma.$queryRaw<Array<{
      date: string; refundAmount: DecimalValue; voidAmount: DecimalValue; subtotal: DecimalValue;
      serviceCharge: DecimalValue; tax: DecimalValue; voidCount: CountValue; refundedQuantity: CountValue;
    }>>(Prisma.sql`
      WITH refunded_quantity AS (
        SELECT "refundId", SUM("quantity")::bigint AS quantity
        FROM "sale_refund_item"
        GROUP BY "refundId"
      )
      SELECT TO_CHAR((r."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE o."timezone")::date, 'YYYY-MM-DD') AS date,
        COALESCE(SUM(r."amount") FILTER (WHERE r."type" = 'REFUND'), 0) AS "refundAmount",
        COALESCE(SUM(r."amount") FILTER (WHERE r."type" = 'VOID'), 0) AS "voidAmount",
        COALESCE(SUM(r."subtotalAmount"), 0) AS subtotal,
        COALESCE(SUM(r."serviceChargeAmount"), 0) AS "serviceCharge",
        COALESCE(SUM(r."taxAmount"), 0) AS tax,
        COUNT(*) FILTER (WHERE r."type" = 'VOID')::bigint AS "voidCount",
        COALESCE(SUM(rq.quantity), 0)::bigint AS "refundedQuantity"
      FROM "sale_refund" r
      JOIN "sale" s ON s.id = r."saleId"
      JOIN "outlet" o ON o.id = s."outletId"
      LEFT JOIN refunded_quantity rq ON rq."refundId" = r.id
      WHERE s."outletId" IN (${outletIds})
        AND (r."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE o."timezone")::date BETWEEN ${filter.from}::date AND ${filter.to}::date
      GROUP BY (r."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE o."timezone")::date
      ORDER BY (r."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE o."timezone")::date ASC
    `),
    prisma.$queryRaw<Array<{ source: string; transactionCount: CountValue; grossSales: DecimalValue }>>(Prisma.sql`
      SELECT CASE WHEN c."provider" IS NOT NULL THEN c."provider"::text ELSE s."orderType"::text END AS source,
        COUNT(*)::bigint AS "transactionCount",
        COALESCE(SUM(s."total"), 0) AS "grossSales"
      FROM "sale" s
      LEFT JOIN "outlet_delivery_channel" c ON c.id = s."channelId"
      WHERE s."outletId" IN (${outletIds})
        AND s."businessDate" BETWEEN ${filter.from}::date AND ${filter.to}::date
      GROUP BY CASE WHEN c."provider" IS NOT NULL THEN c."provider"::text ELSE s."orderType"::text END
      ORDER BY "grossSales" DESC
    `),
  ]);
  const sales: DailySalesAggregate[] = saleRows.map((row) => ({
    date: row.date,
    grossSales: money(row.grossSales),
    subtotal: money(row.subtotal),
    serviceCharge: money(row.serviceCharge),
    tax: money(row.tax),
    transactionCount: count(row.transactionCount),
    soldQuantity: count(row.soldQuantity),
  }));
  const corrections: DailyCorrectionAggregate[] = correctionRows.map((row) => ({
    date: row.date,
    refundAmount: money(row.refundAmount),
    voidAmount: money(row.voidAmount),
    subtotal: money(row.subtotal),
    serviceCharge: money(row.serviceCharge),
    tax: money(row.tax),
    voidCount: count(row.voidCount),
    refundedQuantity: count(row.refundedQuantity),
  }));
  const sources: SourceReportRow[] = sourceRows.map((row) => ({ source: row.source, transactionCount: count(row.transactionCount), grossSales: money(row.grossSales) }));
  return buildOverviewReport(filter.from, filter.to, sales, corrections, sources);
}

/** Aggregates product snapshot revenue and correction-date returned quantities. */
export async function getProductReport(filter: ReportFilter) {
  const outletIds = Prisma.join(filter.outletIds);
  const [sales, refunds] = await Promise.all([
    prisma.$queryRaw<Array<{
      productId: string; categoryId: string | null; categoryName: string; productName: string;
      sku: string | null; quantity: CountValue; amount: DecimalValue;
    }>>(Prisma.sql`
      SELECT si."productId", si."categoryId", COALESCE(si."categoryName", 'Kategori belum tersimpan') AS "categoryName",
        si."productName", si."sku", SUM(si."quantity")::bigint AS quantity, COALESCE(SUM(si."lineTotal"), 0) AS amount
      FROM "sale_item" si
      JOIN "sale" s ON s.id = si."saleId"
      WHERE s."outletId" IN (${outletIds})
        AND s."businessDate" BETWEEN ${filter.from}::date AND ${filter.to}::date
      GROUP BY si."productId", si."categoryId", si."categoryName", si."productName", si."sku"
    `),
    prisma.$queryRaw<Array<{
      productId: string; categoryId: string | null; categoryName: string; productName: string;
      sku: string | null; quantity: CountValue; amount: DecimalValue;
    }>>(Prisma.sql`
      SELECT si."productId", si."categoryId", COALESCE(si."categoryName", 'Kategori belum tersimpan') AS "categoryName",
        si."productName", si."sku", SUM(ri."quantity")::bigint AS quantity, COALESCE(SUM(ri."lineAmount"), 0) AS amount
      FROM "sale_refund_item" ri
      JOIN "sale_refund" r ON r.id = ri."refundId"
      JOIN "sale_item" si ON si.id = ri."saleItemId"
      JOIN "sale" s ON s.id = r."saleId"
      JOIN "outlet" o ON o.id = s."outletId"
      WHERE s."outletId" IN (${outletIds})
        AND (r."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE o."timezone")::date BETWEEN ${filter.from}::date AND ${filter.to}::date
      GROUP BY si."productId", si."categoryId", si."categoryName", si."productName", si."sku"
    `),
  ]);
  const serialize = (rows: typeof sales): ProductAggregate[] => rows.map((row) => ({
    key: `${row.productId}:${row.categoryId ?? "legacy"}`,
    categoryName: row.categoryName,
    productName: row.productName,
    sku: row.sku,
    quantity: count(row.quantity),
    amount: money(row.amount),
  }));
  return buildProductRows(serialize(sales), serialize(refunds));
}

/** Groups receipts and correction-date refunds by their authoritative payment method. */
export async function getPaymentReport(filter: ReportFilter) {
  const outletIds = Prisma.join(filter.outletIds);
  const [sales, refunds] = await Promise.all([
    prisma.$queryRaw<Array<{ method: string; count: CountValue; amount: DecimalValue }>>(Prisma.sql`
      SELECT p."method"::text AS method, COUNT(*)::bigint AS count, COALESCE(SUM(p."amount"), 0) AS amount
      FROM "sale_payment" p
      JOIN "sale" s ON s.id = p."saleId"
      WHERE s."outletId" IN (${outletIds})
        AND s."businessDate" BETWEEN ${filter.from}::date AND ${filter.to}::date
      GROUP BY p."method"
    `),
    prisma.$queryRaw<Array<{ method: string; count: CountValue; amount: DecimalValue }>>(Prisma.sql`
      SELECT r."method"::text AS method, COUNT(*)::bigint AS count, COALESCE(SUM(r."amount"), 0) AS amount
      FROM "sale_refund" r
      JOIN "sale" s ON s.id = r."saleId"
      JOIN "outlet" o ON o.id = s."outletId"
      WHERE s."outletId" IN (${outletIds})
        AND (r."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE o."timezone")::date BETWEEN ${filter.from}::date AND ${filter.to}::date
      GROUP BY r."method"
    `),
  ]);
  const serialize = (rows: typeof sales): PaymentAggregate[] => rows.map((row) => ({ method: row.method, count: count(row.count), amount: money(row.amount) }));
  return buildPaymentRows(serialize(sales), serialize(refunds));
}

/** Returns bounded shift reconciliation rows for the selected business-date range. */
export async function getShiftReport(filter: ReportFilter, limit = screenRowLimit): Promise<ShiftReport> {
  const outletIds = Prisma.join(filter.outletIds);
  const rows = await prisma.$queryRaw<Array<{
    id: string; businessDate: string; outletName: string; timezone: string; openedByName: string; openedAt: Date;
    closedAt: Date | null; status: "OPEN" | "CLOSED"; openingCash: DecimalValue; cashSales: DecimalValue;
    cashRefunds: DecimalValue; cashIn: DecimalValue; cashOut: DecimalValue; expectedCash: DecimalValue;
    actualCash: DecimalValue; difference: DecimalValue; totalRows: CountValue;
  }>>(Prisma.sql`
    SELECT cs.id, TO_CHAR(cs."businessDate", 'YYYY-MM-DD') AS "businessDate", o.name AS "outletName", o.timezone,
      cs."openedByName", cs."openedAt", cs."closedAt", cs.status::text AS status, cs."openingCash",
      COALESCE(payments.amount, 0) AS "cashSales", COALESCE(refunds.amount, 0) AS "cashRefunds",
      COALESCE(movements."cashIn", 0) AS "cashIn", COALESCE(movements."cashOut", 0) AS "cashOut",
      COALESCE(cs."expectedCash", cs."openingCash" + COALESCE(payments.amount, 0) + COALESCE(movements."cashIn", 0) - COALESCE(movements."cashOut", 0) - COALESCE(refunds.amount, 0)) AS "expectedCash",
      cs."actualCash", cs."cashDifference" AS difference, COUNT(*) OVER()::bigint AS "totalRows"
    FROM "cash_shift" cs
    JOIN "outlet" o ON o.id = cs."outletId"
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(p.amount), 0) AS amount FROM "sale_payment" p
      JOIN "sale" s ON s.id = p."saleId" WHERE s."shiftId" = cs.id AND p.method = 'CASH'
    ) payments ON TRUE
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(r.amount), 0) AS amount FROM "sale_refund" r
      WHERE r."cashShiftId" = cs.id AND r.method = 'CASH'
    ) refunds ON TRUE
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(cm.amount) FILTER (WHERE cm.direction = 'IN'), 0) AS "cashIn",
        COALESCE(SUM(cm.amount) FILTER (WHERE cm.direction = 'OUT'), 0) AS "cashOut"
      FROM "cash_movement" cm WHERE cm."shiftId" = cs.id
    ) movements ON TRUE
    WHERE cs."outletId" IN (${outletIds})
      AND cs."businessDate" BETWEEN ${filter.from}::date AND ${filter.to}::date
    ORDER BY cs."businessDate" DESC, cs."openedAt" DESC
    LIMIT ${limit}
  `);
  const totalRows = count(rows[0]?.totalRows);
  return {
    totalRows,
    truncated: totalRows > rows.length,
    rows: rows.map((row): ShiftReportRow => ({
      id: row.id,
      businessDate: row.businessDate,
      outletName: row.outletName,
      timezone: row.timezone,
      openedByName: row.openedByName,
      openedAt: row.openedAt.toISOString(),
      closedAt: row.closedAt?.toISOString() ?? null,
      status: row.status,
      openingCash: money(row.openingCash),
      cashSales: money(row.cashSales),
      cashRefunds: money(row.cashRefunds),
      cashIn: money(row.cashIn),
      cashOut: money(row.cashOut),
      expectedCash: money(row.expectedCash),
      actualCash: nullableMoney(row.actualCash),
      difference: nullableMoney(row.difference),
    })),
  };
}

/** Returns correction activity on the local date it affected cash and payment reconciliation. */
export async function getCorrectionReport(filter: ReportFilter, limit = screenRowLimit): Promise<CorrectionReport> {
  const outletIds = Prisma.join(filter.outletIds);
  const rows = await prisma.$queryRaw<Array<{
    id: string; saleId: string; type: "VOID" | "REFUND"; receiptNumber: string; outletName: string; amount: DecimalValue;
    subtotalAmount: DecimalValue; serviceChargeAmount: DecimalValue; taxAmount: DecimalValue; reason: string;
    actorName: string; createdAt: Date; timezone: string; totalRows: CountValue;
  }>>(Prisma.sql`
    SELECT r.id, r."saleId", r.type::text AS type, s."receiptNumber", o.name AS "outletName", r.amount,
      r."subtotalAmount", r."serviceChargeAmount", r."taxAmount", r.reason, r."actorName", r."createdAt",
      o.timezone, COUNT(*) OVER()::bigint AS "totalRows"
    FROM "sale_refund" r
    JOIN "sale" s ON s.id = r."saleId"
    JOIN "outlet" o ON o.id = s."outletId"
    WHERE s."outletId" IN (${outletIds})
      AND (r."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE o.timezone)::date BETWEEN ${filter.from}::date AND ${filter.to}::date
    ORDER BY r."createdAt" DESC
    LIMIT ${limit}
  `);
  const totalRows = count(rows[0]?.totalRows);
  return {
    totalRows,
    truncated: totalRows > rows.length,
    rows: rows.map((row): CorrectionReportRow => ({
      id: row.id,
      saleId: row.saleId,
      type: row.type,
      receiptNumber: row.receiptNumber,
      outletName: row.outletName,
      amount: money(row.amount),
      subtotalAmount: money(row.subtotalAmount),
      serviceChargeAmount: money(row.serviceChargeAmount),
      taxAmount: money(row.taxAmount),
      reason: row.reason,
      actorName: row.actorName,
      createdAt: row.createdAt.toISOString(),
      timezone: row.timezone,
    })),
  };
}

/** Summarizes current receivables and bounded settlement batches for the selected sales/activity period. */
export async function getSettlementReport(filter: ReportFilter, limit = screenRowLimit): Promise<SettlementReport> {
  const outletIds = Prisma.join(filter.outletIds);
  const [pendingRows, summaryRows, rows] = await Promise.all([
    prisma.$queryRaw<Array<{
      pendingCount: CountValue; pendingGross: DecimalValue; expectedNet: DecimalValue; overdueGross: DecimalValue;
    }>>(Prisma.sql`
      WITH refunds AS (
        SELECT "saleId", COALESCE(SUM(amount), 0) AS amount, COALESCE(SUM("expectedNetAmount"), 0) AS "expectedNetAmount"
        FROM "sale_refund" GROUP BY "saleId"
      )
      SELECT COUNT(*) FILTER (WHERE GREATEST(p.amount - COALESCE(r.amount, 0), 0) > 0)::bigint AS "pendingCount",
        COALESCE(SUM(GREATEST(p.amount - COALESCE(r.amount, 0), 0)), 0) AS "pendingGross",
        COALESCE(SUM(GREATEST(COALESCE(p."expectedNetAmount", 0) - COALESCE(r."expectedNetAmount", 0), 0)), 0) AS "expectedNet",
        COALESCE(SUM(GREATEST(p.amount - COALESCE(r.amount, 0), 0)) FILTER (WHERE p."expectedSettlementAt" < NOW()), 0) AS "overdueGross"
      FROM "sale_payment" p
      JOIN "sale" s ON s.id = p."saleId"
      LEFT JOIN refunds r ON r."saleId" = s.id
      WHERE p."settlementStatus" = 'PENDING'
        AND s."outletId" IN (${outletIds})
        AND s."businessDate" BETWEEN ${filter.from}::date AND ${filter.to}::date
    `),
    prisma.$queryRaw<Array<{
      confirmedGross: DecimalValue; confirmedFees: DecimalValue; confirmedPromotions: DecimalValue;
      confirmedAdjustments: DecimalValue; confirmedNet: DecimalValue; directEquivalent: DecimalValue; reversedCount: CountValue;
    }>>(Prisma.sql`
      WITH item_totals AS (
        SELECT "settlementId", COALESCE(SUM("directEquivalentAmount"), 0) AS "directEquivalent"
        FROM "platform_settlement_item" GROUP BY "settlementId"
      )
      SELECT COALESCE(SUM(ps."grossAmount") FILTER (WHERE ps.status = 'CONFIRMED'), 0) AS "confirmedGross",
        COALESCE(SUM(ps."platformFeeAmount") FILTER (WHERE ps.status = 'CONFIRMED'), 0) AS "confirmedFees",
        COALESCE(SUM(ps."merchantPromotionAmount") FILTER (WHERE ps.status = 'CONFIRMED'), 0) AS "confirmedPromotions",
        COALESCE(SUM(ps."otherAdjustmentAmount") FILTER (WHERE ps.status = 'CONFIRMED'), 0) AS "confirmedAdjustments",
        COALESCE(SUM(ps."netReceivedAmount") FILTER (WHERE ps.status = 'CONFIRMED'), 0) AS "confirmedNet",
        COALESCE(SUM(it."directEquivalent") FILTER (WHERE ps.status = 'CONFIRMED'), 0) AS "directEquivalent",
        COUNT(*) FILTER (WHERE ps.status = 'REVERSED')::bigint AS "reversedCount"
      FROM "platform_settlement" ps
      JOIN "outlet_delivery_channel" c ON c.id = ps."channelId"
      JOIN "outlet" o ON o.id = c."outletId"
      LEFT JOIN item_totals it ON it."settlementId" = ps.id
      WHERE c."outletId" IN (${outletIds})
        AND (ps."receivedAt" AT TIME ZONE 'UTC' AT TIME ZONE o.timezone)::date BETWEEN ${filter.from}::date AND ${filter.to}::date
    `),
    prisma.$queryRaw<Array<{
      id: string; provider: string; reference: string; grossAmount: DecimalValue; platformFeeAmount: DecimalValue;
      merchantPromotionAmount: DecimalValue; otherAdjustmentAmount: DecimalValue; netReceivedAmount: DecimalValue;
      directEquivalentAmount: DecimalValue; receivedAt: Date; timezone: string; outletName: string;
      status: "CONFIRMED" | "REVERSED"; transactionCount: CountValue; totalRows: CountValue;
    }>>(Prisma.sql`
      WITH item_totals AS (
        SELECT "settlementId", COUNT(*)::bigint AS count, COALESCE(SUM("directEquivalentAmount"), 0) AS "directEquivalent"
        FROM "platform_settlement_item" GROUP BY "settlementId"
      )
      SELECT ps.id, c.provider::text AS provider, ps.reference, ps."grossAmount", ps."platformFeeAmount",
        ps."merchantPromotionAmount", ps."otherAdjustmentAmount", ps."netReceivedAmount",
        COALESCE(it."directEquivalent", 0) AS "directEquivalentAmount", ps."receivedAt", o.timezone,
        o.name AS "outletName", ps.status::text AS status, COALESCE(it.count, 0)::bigint AS "transactionCount",
        COUNT(*) OVER()::bigint AS "totalRows"
      FROM "platform_settlement" ps
      JOIN "outlet_delivery_channel" c ON c.id = ps."channelId"
      JOIN "outlet" o ON o.id = c."outletId"
      LEFT JOIN item_totals it ON it."settlementId" = ps.id
      WHERE c."outletId" IN (${outletIds})
        AND (ps."receivedAt" AT TIME ZONE 'UTC' AT TIME ZONE o.timezone)::date BETWEEN ${filter.from}::date AND ${filter.to}::date
      ORDER BY ps."receivedAt" DESC
      LIMIT ${limit}
    `),
  ]);
  const pending = pendingRows[0];
  const summary = summaryRows[0];
  const totalRows = count(rows[0]?.totalRows);
  return {
    summary: {
      pendingCount: count(pending?.pendingCount),
      pendingGross: money(pending?.pendingGross),
      expectedNet: money(pending?.expectedNet),
      overdueGross: money(pending?.overdueGross),
      confirmedGross: money(summary?.confirmedGross),
      confirmedFees: money(summary?.confirmedFees),
      confirmedPromotions: money(summary?.confirmedPromotions),
      confirmedAdjustments: money(summary?.confirmedAdjustments),
      confirmedNet: money(summary?.confirmedNet),
      directComparison: new Prisma.Decimal(summary?.confirmedNet ?? 0).sub(summary?.directEquivalent ?? 0).toFixed(2),
      reversedCount: count(summary?.reversedCount),
    },
    totalRows,
    truncated: totalRows > rows.length,
    rows: rows.map((row): SettlementReportRow => ({
      id: row.id,
      provider: row.provider,
      reference: row.reference,
      grossAmount: money(row.grossAmount),
      platformFeeAmount: money(row.platformFeeAmount),
      merchantPromotionAmount: money(row.merchantPromotionAmount),
      otherAdjustmentAmount: money(row.otherAdjustmentAmount),
      netReceivedAmount: money(row.netReceivedAmount),
      directEquivalentAmount: money(row.directEquivalentAmount),
      receivedAt: row.receivedAt.toISOString(),
      timezone: row.timezone,
      outletName: row.outletName,
      status: row.status,
      transactionCount: count(row.transactionCount),
    })),
  };
}

function money(value: DecimalValue | undefined) {
  return new Prisma.Decimal(value ?? 0).toFixed(2);
}

function nullableMoney(value: DecimalValue | undefined) {
  return value === null || value === undefined ? null : money(value);
}

function count(value: CountValue | undefined) {
  return Number(value ?? 0);
}
