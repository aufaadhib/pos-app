import { PrismaNeon } from "@prisma/adapter-neon";

import { PrismaClient } from "../generated/prisma/client";
import { parseServerEnvironment } from "./env-schema";

const prismaGlobal = globalThis as unknown as {
  prismaReceiptSettingsV5: PrismaClient | undefined;
};

function createPrismaClient() {
  const environment = parseServerEnvironment(process.env);
  const adapter = new PrismaNeon({ connectionString: environment.DATABASE_URL });

  return new PrismaClient({ adapter });
}

export const prisma = prismaGlobal.prismaReceiptSettingsV5 ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  prismaGlobal.prismaReceiptSettingsV5 = prisma;
}
