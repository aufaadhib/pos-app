import "server-only";

import { prisma } from "@/lib/prisma";

/** Returns the bounded global position list for owner configuration. */
export async function getStaffPositions() {
  const positions = await prisma.staffPosition.findMany({ orderBy: [{ status: "asc" }, { name: "asc" }], take: 200, select: { id: true, name: true, status: true, updatedAt: true, _count: { select: { users: true } } } });
  return positions.map((position) => ({ id: position.id, name: position.name, status: position.status, staffCount: position._count.users, updatedAt: position.updatedAt.toISOString() }));
}
