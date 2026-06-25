import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { PrismaClient } from '../../generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

export type AuthenticatedUser = {
  id: string;
  email: string;
  name: string;
  image: string | null | undefined;
  role: string;
  onboarded: boolean;
  emailVerified: boolean;
  companyId?: string;
};

type RawSessionUser = {
  id: string;
  email: string;
  name: string;
  image?: string | null;
  role?: string;
  onboarded?: boolean;
  emailVerified?: boolean;
  companyId?: string;
};

function makeAuth() {
  const pool = new Pool({
    connectionString: process.env['DATABASE_URL'],
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
    max: 5,
  });
  const pgAdapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter: pgAdapter });

  return betterAuth({
    database: prismaAdapter(prisma, { provider: 'postgresql' }),
    baseURL: process.env['BETTER_AUTH_URL'] ?? 'http://localhost:3000',
    secret: process.env['BETTER_AUTH_SECRET'],
    user: {
      additionalFields: {
        role: {
          type: 'string',
          required: false,
          defaultValue: 'DEVELOPER',
          input: false,
        },
        onboarded: {
          type: 'boolean',
          required: false,
          defaultValue: false,
          input: false,
        },
      },
    },
  });
}

type AuthInstance = ReturnType<typeof makeAuth>;

let _auth: AuthInstance | undefined;

export function getAuth(): AuthInstance {
  if (!_auth) _auth = makeAuth();
  return _auth;
}

/**
 * Résout l'utilisateur authentifié à partir d'en-têtes HTTP (cookie de
 * session BetterAuth). Partagé entre l'AuthGuard HTTP et le RealtimeGateway
 * WebSocket (handshake) pour ne valider la session qu'à un seul endroit.
 */
export async function resolveSessionUser(
  headers: Headers,
): Promise<AuthenticatedUser | null> {
  const session = await getAuth().api.getSession({ headers });
  if (!session?.user) return null;

  const raw = session.user as RawSessionUser;
  return {
    id: raw.id,
    email: raw.email,
    name: raw.name,
    image: raw.image,
    role: raw.role ?? 'DEVELOPER',
    onboarded: raw.onboarded ?? false,
    emailVerified: raw.emailVerified ?? false,
    companyId: raw.companyId,
  };
}
