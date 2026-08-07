import { NextResponse, type NextRequest } from "next/server";

import { isAppRole, roleHasPermission } from "@/lib/auth/permissions";
import { getCurrentSession } from "@/lib/auth/session";
import { getRegencies, RegionServiceError } from "@/lib/regions/service";

export async function GET(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ message: "Tidak terautentikasi." }, { status: 401 });
  if (!isAppRole(session.user.role) || !roleHasPermission(session.user.role, { outlet: ["manage"] })) {
    return NextResponse.json({ message: "Akses ditolak." }, { status: 403 });
  }

  const provinceCode = request.nextUrl.searchParams.get("province") ?? "";
  try {
    return NextResponse.json({ data: await getRegencies(provinceCode) });
  } catch (error) {
    const status = /^\d{2}$/.test(provinceCode) ? 502 : 400;
    const message = error instanceof RegionServiceError ? error.message : "Data wilayah belum dapat dimuat.";
    return NextResponse.json({ message }, { status });
  }
}
