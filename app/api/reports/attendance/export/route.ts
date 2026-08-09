import { NextResponse, type NextRequest } from "next/server";

import { createAttendanceCsv } from "@/lib/attendance/csv";
import { authorizeAttendanceRequest } from "@/lib/attendance/http";
import { getAttendanceExportRows } from "@/lib/attendance/queries";
import { attendanceReportSearchSchema } from "@/lib/attendance/validation";

const exportLimit = 10_000;

/** Exports a fresh, scoped attendance report with a hard 10,000-row limit. */
export async function GET(request: NextRequest) {
  const authorization = await authorizeAttendanceRequest({ attendance: ["export"] });
  if ("error" in authorization) return authorization.error;
  const parsed = attendanceReportSearchSchema.safeParse({ outletId: request.nextUrl.searchParams.get("outletId") ?? undefined, from: request.nextUrl.searchParams.get("from") ?? undefined, to: request.nextUrl.searchParams.get("to") ?? undefined });
  if (!parsed.success || !parsed.data.outletId || !parsed.data.from || !parsed.data.to) return NextResponse.json({ message: parsed.error?.issues[0]?.message ?? "Filter laporan belum lengkap." }, { status: 400 });
  const from = new Date(`${parsed.data.from}T00:00:00.000Z`);
  const to = new Date(`${parsed.data.to}T23:59:59.999Z`);
  if (to < from) return NextResponse.json({ message: "Tanggal akhir tidak boleh sebelum tanggal awal." }, { status: 400 });
  try {
    const rows = await getAttendanceExportRows(parsed.data.outletId, from, to, authorization.actor, exportLimit + 1);
    if (rows.length > exportLimit) return NextResponse.json({ message: "Hasil melebihi 10.000 baris. Persempit rentang tanggal." }, { status: 422 });
    return new Response(`\uFEFF${createAttendanceCsv(rows)}`, { headers: { "Cache-Control": "no-store", "Content-Disposition": `attachment; filename="glutong-absensi-${parsed.data.from}-${parsed.data.to}.csv"`, "Content-Type": "text/csv; charset=utf-8" } });
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") return NextResponse.json({ message: "Outlet tidak tersedia untuk akun Anda." }, { status: 403 });
    throw error;
  }
}
