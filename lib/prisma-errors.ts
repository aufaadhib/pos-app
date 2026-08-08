import { Prisma } from "@/generated/prisma/client";

/** Recognizes serializable write conflicts from Prisma Client and driver adapters. */
export function isTransactionWriteConflict(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) return error.code === "P2034";
  if (!error || typeof error !== "object" || !("cause" in error)) return false;
  const cause = error.cause;
  return Boolean(cause && typeof cause === "object" && "kind" in cause && cause.kind === "TransactionWriteConflict");
}
