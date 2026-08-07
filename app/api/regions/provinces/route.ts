import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { isAppRole, roleHasPermission } from "@/lib/auth/permissions";
import { getProvinces, RegionServiceError } from "@/lib/regions/service";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ message: "Tidak terautentikasi." }, { status: 401 });
  if (!isAppRole(session.user.role) || !roleHasPermission(session.user.role, { outlet: ["manage"] })) {
    return NextResponse.json({ message: "Akses ditolak." }, { status: 403 });
  }

  try {
    return NextResponse.json({ data: await getProvinces() });
  } catch (error) {
    const message = error instanceof RegionServiceError ? error.message : "Data wilayah belum dapat dimuat.";
    return NextResponse.json({ message }, { status: 502 });
  }
}
