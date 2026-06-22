import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { sendResetPasswordEmail, sendVerificationEmail } from "./mailer";


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

    // Ne bloque pas la connexion (requireEmailVerification reste false) : seul
    // l'usage du compte (ex. postuler) sera restreint tant que l'email n'est
    // pas vérifié. Ne s'applique qu'à l'inscription email/mot de passe — les
    // comptes OAuth (github/google) ont déjà un email vérifié par le provider,
    // et les comptes recruteur créés par l'admin (auth.api.createUser) ne
    // passent pas par signUp.email donc ne déclenchent pas cet envoi.
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        await sendVerificationEmail({
          to: user.email,
          userName: user.name ?? user.email,
          verifyUrl: url,
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

    plugins: [admin({ defaultRole: "DEVELOPER", adminRole: "ADMIN" })],
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
  emailVerified: boolean;
};
