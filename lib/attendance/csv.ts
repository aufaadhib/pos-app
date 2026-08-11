import { escapeCsvCell } from "@/lib/reports/csv";

/** Serializes attendance sessions to formula-safe UTF-8 CSV. */
export function createAttendanceCsv(rows: Array<{
  user: { name: string; email: string };
  outlet: { code: string; name: string };
  businessDate: Date;
  positionName: string;
  scheduledStartAt: Date | null;
  scheduledEndAt: Date | null;
  status: string;
  checkInAt: Date | null;
  checkOutAt: Date | null;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  totalMinutes: number;
  correctionReason: string;
}>) {
  const output: unknown[][] = [["Tanggal bisnis", "Outlet", "Nama staf", "Email", "Jabatan", "Jadwal mulai", "Jadwal selesai", "Masuk", "Pulang", "Status", "Menit terlambat", "Menit pulang cepat", "Total jam", "Koreksi"]];
  for (const row of rows) {
    output.push([
      row.businessDate.toISOString().slice(0, 10),
      `${row.outlet.code} - ${row.outlet.name}`,
      row.user.name,
      row.user.email,
      row.positionName,
      row.scheduledStartAt?.toISOString() ?? "",
      row.scheduledEndAt?.toISOString() ?? "",
      row.checkInAt?.toISOString() ?? "",
      row.checkOutAt?.toISOString() ?? "",
      row.status,
      row.lateMinutes,
      row.earlyLeaveMinutes,
      (row.totalMinutes / 60).toFixed(2),
      row.correctionReason,
    ]);
  }
  return output.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
}
