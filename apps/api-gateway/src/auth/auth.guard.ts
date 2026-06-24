import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OPTIONAL_AUTH_KEY } from './optional-auth.decorator';
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

function getAuth(): AuthInstance {
  if (!_auth) _auth = makeAuth();
  return _auth;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isOptional = this.reflector.get<boolean>(
      OPTIONAL_AUTH_KEY,
      context.getHandler(),
    );
    const request = context.switchToHttp().getRequest<Request>();

    const session = await getAuth().api.getSession({
      headers: new Headers(request.headers as Record<string, string>),
    });

    if (!session?.user) {
      if (isOptional) return true;
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
      emailVerified: raw.emailVerified ?? false,
      companyId: raw.companyId,
    };

    (request as Request & { user: AuthenticatedUser }).user = user;
    return true;
  }
}
