import { authorizeAttendanceRequest } from "@/lib/attendance/http";
import { AttendanceError, createAttendanceChallenge } from "@/lib/attendance/service";
import { attendanceChallengeSchema } from "@/lib/attendance/validation";

/** Issues or rotates a short-lived attendance challenge for one assigned outlet. */
export async function POST(request: Request) {
  const authorization = await authorizeAttendanceRequest({ attendance: ["clock"] });
  if ("error" in authorization) return authorization.error;
  const parsed = attendanceChallengeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ message: parsed.error.issues[0]?.message ?? "Permintaan challenge tidak valid." }, { status: 400 });
  try {
    return Response.json(await createAttendanceChallenge(parsed.data, authorization.actor), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AttendanceError) return Response.json({ message: error.message }, { status: error.code === "FORBIDDEN" ? 403 : 422 });
    console.error("Attendance challenge failed", error);
    return Response.json({ message: "Challenge belum dapat dibuat." }, { status: 500 });
  }
}
