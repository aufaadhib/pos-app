import { materializeUpcomingFixedRosters } from "@/lib/attendance/roster-service";
import { cleanupExpiredAttendanceEvidence } from "@/lib/attendance/service";

/** Runs authenticated, bounded attendance evidence cleanup and fixed-roster maintenance. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ message: "Akses ditolak." }, { status: 401 });
  const evidence = await cleanupExpiredAttendanceEvidence();
  const rosters = await materializeUpcomingFixedRosters();
  return Response.json({ evidence, rosters });
}
