import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ReportDashboard, ReportsNoOutlet } from "@/components/reports/report-dashboard";
import { isAppRole } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { getOverviewReport, getReportDataset, getReportOutlets, selectReportOutlets } from "@/lib/reports/queries";
import { reportViews, type OverviewReport, type ReportDataset, type ReportSelection, type ReportView } from "@/lib/reports/types";
import { parseReportSearch } from "@/lib/reports/validation";
import { getOutletBusinessDate } from "@/lib/time/business-date";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Laporan", description: "Laporan operasional dan keuangan outlet Glutong." };

type RawSearch = Record<string, string | string[] | undefined>;

/** Loads one permission-scoped, URL-filtered report without caching operational financial data. */
export default async function ReportsPage({ searchParams }: { searchParams: Promise<RawSearch> }) {
  const [session, raw] = await Promise.all([requirePermission({ report: ["view"] }), searchParams]);
  if (!isAppRole(session.user.role)) redirect("/workspace?access=denied");
  const outlets = await getReportOutlets(session.user.id, session.user.role);
  if (!outlets.length) return <ReportsNoOutlet />;

  const activeOutlet = outlets.find((outlet) => outlet.id === session.session.activeOutletId) ?? outlets[0];
  const today = getOutletBusinessDate(activeOutlet.timezone).value;
  const requestedOutletId = singleValue(raw.outletId);
  const defaultOutletId = activeOutlet.id;
  const outletId = requestedOutletId === "all" && outlets.length > 1
    ? "all"
    : outlets.some((outlet) => outlet.id === requestedOutletId) ? requestedOutletId! : defaultOutletId;
  const requestedView = singleValue(raw.view);
  const view = (reportViews as readonly string[]).includes(requestedView ?? "") ? requestedView as ReportView : "overview";
  const parsed = parseReportSearch({
    view,
    from: singleValue(raw.from) ?? today,
    to: singleValue(raw.to) ?? today,
    outletId,
  });
  const selection: ReportSelection = parsed.success ? parsed.data : { view, from: today, to: today, outletId };
  const selectedOutlets = selectReportOutlets(outlets, selection.outletId, session.session.activeOutletId);
  const filter = { from: selection.from, to: selection.to, outletIds: selectedOutlets.map((outlet) => outlet.id) };

  let overview: OverviewReport;
  let dataset: ReportDataset;
  if (selection.view === "overview") {
    dataset = await getReportDataset("overview", filter);
    overview = dataset.data;
  } else {
    [overview, dataset] = await Promise.all([getOverviewReport(filter), getReportDataset(selection.view, filter)]);
  }
  return <ReportDashboard dataset={dataset} outlets={outlets} overview={overview} selectedOutlets={selectedOutlets} selection={selection} today={today} />;
}

/** Restricts one possibly repeated URL parameter to its first scalar value. */
function singleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
