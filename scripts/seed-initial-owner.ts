import "dotenv/config";

import { createAuth } from "../lib/auth/factory";
import { parseOwnerEnvironment } from "../lib/env-schema";
import { prisma } from "../lib/prisma-core";

export async function seedInitialOwner() {
  const environment = parseOwnerEnvironment(process.env);
  const normalizedEmail = environment.INITIAL_OWNER_EMAIL.toLowerCase();
  const users = await prisma.user.findMany({
    select: { id: true, email: true, role: true },
    take: 2,
  });

  if (users.length > 0) {
    const existingOwner = users.find(
      (user) =>
        user.email.toLowerCase() === normalizedEmail && user.role === "owner",
    );

    if (users.length === 1 && existingOwner) {
      console.info("Owner awal sudah tersedia. Seed tidak mengubah data.");
      return existingOwner;
    }

    throw new Error(
      "Seed dibatalkan: database sudah berisi akun yang berbeda. Tetapkan owner melalui proses administrasi yang terautentikasi.",
    );
  }

  const seedAuth = createAuth({ allowSignUp: true, defaultRole: "owner" });
  const result = await seedAuth.api.signUpEmail({
    body: {
      name: environment.INITIAL_OWNER_NAME,
      email: normalizedEmail,
      password: environment.INITIAL_OWNER_PASSWORD,
    },
  });

  console.info(
    "Owner awal berhasil dibuat. Hapus INITIAL_OWNER_PASSWORD dari environment sekarang.",
  );

  return result.user;
}

seedInitialOwner()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
