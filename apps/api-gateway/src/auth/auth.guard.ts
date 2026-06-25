import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OPTIONAL_AUTH_KEY } from './optional-auth.decorator';
import { resolveSessionUser, type AuthenticatedUser } from './auth-session';
import type { Request } from 'express';

export type { AuthenticatedUser };

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isOptional = this.reflector.get<boolean>(
      OPTIONAL_AUTH_KEY,
      context.getHandler(),
    );
    const request = context.switchToHttp().getRequest<Request>();

    const user = await resolveSessionUser(
      new Headers(request.headers as Record<string, string>),
    );

    if (!user) {
      if (isOptional) return true;
      throw new UnauthorizedException('Session invalide ou expirée');
    }

    (request as Request & { user: AuthenticatedUser }).user = user;
    return true;
  }
}
