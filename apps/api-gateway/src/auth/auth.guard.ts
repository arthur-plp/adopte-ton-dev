import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { PrismaClient } from '../../generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import type { Request } from 'express';

export type AuthenticatedUser = {
  id: string;
  email: string;
  name: string;
  image: string | null | undefined;
  role: string;
  onboarded: boolean;
};

type RawSessionUser = {
  id: string;
  email: string;
  name: string;
  image?: string | null;
  role?: string;
  onboarded?: boolean;
};

// makeAuth retourne un type inféré précis — ReturnType<typeof makeAuth> évite
// les problèmes de variance avec Auth<BetterAuthOptions>
function makeAuth() {
  const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });
  const pgAdapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter: pgAdapter });

  return betterAuth({
    database: prismaAdapter(prisma, { provider: 'postgresql' }),
    baseURL: process.env['BETTER_AUTH_URL'] ?? 'http://localhost:3000',
    secret: process.env['BETTER_AUTH_SECRET'],
  });
}

type AuthInstance = ReturnType<typeof makeAuth>;

// Initialisation lazy : process.env est chargé par ConfigModule avant la première requête
let _auth: AuthInstance | undefined;

function getAuth(): AuthInstance {
  if (!_auth) _auth = makeAuth();
  return _auth;
}

@Injectable()
export class AuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    const session = await getAuth().api.getSession({
      headers: new Headers(request.headers as Record<string, string>),
    });

    if (!session?.user) {
      throw new UnauthorizedException('Session invalide ou expirée');
    }

    const raw = session.user as RawSessionUser;
    const user: AuthenticatedUser = {
      id: raw.id,
      email: raw.email,
      name: raw.name,
      image: raw.image,
      role: raw.role ?? 'DEVELOPER',
      onboarded: raw.onboarded ?? false,
    };

    (request as Request & { user: AuthenticatedUser }).user = user;
    return true;
  }
}
