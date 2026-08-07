import { prismaAdapter } from "better-auth/adapters/prisma";
import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";

import { accessControl, roles, type AppRole } from "./permissions";
import { parseServerEnvironment } from "../env-schema";
import { prisma } from "../prisma-core";

type CreateAuthOptions = {
  allowSignUp?: boolean;
  defaultRole?: AppRole;
};

export function createAuth({
  allowSignUp = false,
  defaultRole = "cashier",
}: CreateAuthOptions = {}) {
  const environment = parseServerEnvironment(process.env);

  return betterAuth({
    appName: "Glutong POS",
    baseURL: environment.BETTER_AUTH_URL,
    secret: environment.BETTER_AUTH_SECRET,
    database: prismaAdapter(prisma, {
      provider: "postgresql",
      transaction: true,
    }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: !allowSignUp,
      minPasswordLength: 8,
      maxPasswordLength: 128,
    },
    user: {
      additionalFields: {
        mustChangePassword: {
          type: "boolean",
          defaultValue: false,
          input: false,
        },
      },
    },
    session: {
      additionalFields: {
        activeOutletId: {
          type: "string",
          required: false,
          input: false,
        },
      },
      cookieCache: {
        enabled: false,
      },
    },
    advanced: {
      useSecureCookies: process.env.NODE_ENV === "production",
    },
    plugins: [
      admin({
        ac: accessControl,
        roles,
        defaultRole,
        adminRoles: ["owner"],
      }),
    ],
  });
}
