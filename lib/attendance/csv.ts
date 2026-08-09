import { escapeCsvCell } from "@/lib/reports/csv";

/** Serializes attendance sessions to formula-safe UTF-8 CSV. */
export function createAttendanceCsv(rows: Array<{
  user: { name: string; email: string };
  outlet: { code: string; name: string };
  businessDate: Date;
  status: string;
  checkInAt: Date;
  checkOutAt: Date | null;
  corrections: Array<{ correctedCheckInAt: Date | null; correctedCheckOutAt: Date | null; reason: string }>;
}>) {
  const output: unknown[][] = [["Tanggal bisnis", "Outlet", "Nama staf", "Email", "Masuk", "Pulang", "Status", "Koreksi"]];
  for (const row of rows) {
    const correction = row.corrections[0];
    output.push([
      row.businessDate.toISOString().slice(0, 10),
      `${row.outlet.code} - ${row.outlet.name}`,
      row.user.name,
      row.user.email,
      (correction?.correctedCheckInAt ?? row.checkInAt).toISOString(),
      (correction?.correctedCheckOutAt ?? row.checkOutAt)?.toISOString() ?? "",
      row.status,
      correction?.reason ?? "",
    ]);
  }
  return output.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
}
