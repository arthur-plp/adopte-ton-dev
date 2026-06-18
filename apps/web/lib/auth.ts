import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { sendResetPasswordEmail } from "./mailer";


function makeAuth() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  return betterAuth({
    database: prismaAdapter(prisma, { provider: "postgresql" }),

    baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
    secret: process.env.BETTER_AUTH_SECRET,

    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      sendResetPassword: async ({ user, url }) => {
        await sendResetPasswordEmail({
          to: user.email,
          userName: user.name ?? user.email,
          resetUrl: url,
        });
      },
    },

    socialProviders: {
      github: {
        clientId: process.env.GITHUB_CLIENT_ID ?? "",
        clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
      },
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID ?? "",
        clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
        prompt: "select_account",
      },
    },

    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ["github", "google"],
      },
    },

    user: {
      additionalFields: {
        role: {
          type: "string",
          required: false,
          defaultValue: "DEVELOPER",
          input: false,
        },
        onboarded: {
          type: "boolean",
          required: false,
          defaultValue: false,
          input: false,
        },
      },
    },

    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: true, maxAge: 60 * 5 },
    },
  });
}

export type AuthInstance = ReturnType<typeof makeAuth>;

let _auth: AuthInstance | undefined;

export function getAuth(): AuthInstance {
  if (_auth) return _auth;
  _auth = makeAuth();
  return _auth;
}

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  image?: string | null;
  role: string;
  onboarded: boolean;
};
