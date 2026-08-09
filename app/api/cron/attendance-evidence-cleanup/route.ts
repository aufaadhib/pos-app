import { cleanupExpiredAttendanceEvidence } from "@/lib/attendance/service";

/** Deletes expired private attendance evidence when invoked by authenticated Vercel Cron. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ message: "Akses ditolak." }, { status: 401 });
  return Response.json(await cleanupExpiredAttendanceEvidence());
}
