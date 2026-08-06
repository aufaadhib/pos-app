import { PrismaNeon } from "@prisma/adapter-neon";

import { PrismaClient } from "../generated/prisma/client";
import { parseServerEnvironment } from "./env-schema";

const prismaGlobal = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const environment = parseServerEnvironment(process.env);
  const adapter = new PrismaNeon({ connectionString: environment.DATABASE_URL });

  return new PrismaClient({ adapter });
}

export const prisma = prismaGlobal.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  prismaGlobal.prisma = prisma;
}
