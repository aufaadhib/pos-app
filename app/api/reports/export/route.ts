import { NextResponse, type NextRequest } from "next/server";

import { isAppRole, roleHasPermission } from "@/lib/auth/permissions";
import { getCurrentSession } from "@/lib/auth/session";
import { createReportCsv, getReportCsvRowCount } from "@/lib/reports/csv";
import { getReportDataset, getReportOutlets, selectReportOutlets } from "@/lib/reports/queries";
import { parseReportSearch } from "@/lib/reports/validation";

const exportRowLimit = 10_000;

/** Exports one fresh, outlet-scoped report after repeating authentication, permission, and filter validation. */
export async function GET(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ message: "Tidak terautentikasi." }, { status: 401 });
  if (!isAppRole(session.user.role) || !roleHasPermission(session.user.role, { report: ["export"] })) {
    return NextResponse.json({ message: "Akses ditolak." }, { status: 403 });
  }

  const parsed = parseReportSearch({
    view: request.nextUrl.searchParams.get("view"),
    from: request.nextUrl.searchParams.get("from"),
    to: request.nextUrl.searchParams.get("to"),
    outletId: request.nextUrl.searchParams.get("outletId"),
  });
  if (!parsed.success) return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Filter laporan tidak valid." }, { status: 400 });

  const outlets = await getReportOutlets(session.user.id, session.user.role);
  const requestedAllowed = parsed.data.outletId === "all" || outlets.some((outlet) => outlet.id === parsed.data.outletId);
  if (!requestedAllowed) return NextResponse.json({ message: "Outlet tidak tersedia untuk akun Anda." }, { status: 403 });
  const selectedOutlets = selectReportOutlets(outlets, parsed.data.outletId, session.session.activeOutletId);
  if (!selectedOutlets.length) return NextResponse.json({ message: "Belum ada outlet aktif untuk dilaporkan." }, { status: 422 });

  const dataset = await getReportDataset(parsed.data.view, { from: parsed.data.from, to: parsed.data.to, outletIds: selectedOutlets.map((outlet) => outlet.id) }, exportRowLimit + 1);
  if (getReportCsvRowCount(dataset) > exportRowLimit || ("truncated" in dataset.data && dataset.data.truncated)) {
    return NextResponse.json({ message: "Hasil melebihi 10.000 baris. Persempit rentang tanggal atau outlet." }, { status: 422 });
  }
  const csv = createReportCsv(dataset, parsed.data);
  const filename = `glutong-${parsed.data.view}-${parsed.data.from}-${parsed.data.to}.csv`;
  return new Response(`\uFEFF${csv}`, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}
