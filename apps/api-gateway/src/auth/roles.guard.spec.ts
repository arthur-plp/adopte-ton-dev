import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { Role } from '@repo/types';

function makeContext(userRole: Role | undefined, requiredRoles: Role[] | null): ExecutionContext {
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => ({
        user: userRole !== undefined ? { role: userRole } : undefined,
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() } as unknown as jest.Mocked<Reflector>;
    guard = new RolesGuard(reflector);
  });

  describe('quand aucun rôle requis', () => {
    it('autorise toujours (pas de restriction)', () => {
      reflector.getAllAndOverride.mockReturnValue(null);
      const ctx = makeContext(Role.DEVELOPER, null);
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('autorise même si rôles vide []', () => {
      reflector.getAllAndOverride.mockReturnValue([]);
      const ctx = makeContext(Role.DEVELOPER, []);
      expect(guard.canActivate(ctx)).toBe(true);
    });
  });

  describe('quand un rôle est requis', () => {
    it('autorise DEVELOPER sur route DEVELOPER', () => {
      reflector.getAllAndOverride.mockReturnValue([Role.DEVELOPER]);
      const ctx = makeContext(Role.DEVELOPER, [Role.DEVELOPER]);
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('autorise RECRUITER sur route RECRUITER', () => {
      reflector.getAllAndOverride.mockReturnValue([Role.RECRUITER]);
      const ctx = makeContext(Role.RECRUITER, [Role.RECRUITER]);
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('autorise ADMIN sur route ADMIN', () => {
      reflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);
      const ctx = makeContext(Role.ADMIN, [Role.ADMIN]);
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('rejette DEVELOPER sur une route RECRUITER (ForbiddenException)', () => {
      reflector.getAllAndOverride.mockReturnValue([Role.RECRUITER]);
      const ctx = makeContext(Role.DEVELOPER, [Role.RECRUITER]);
      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it('rejette RECRUITER sur une route DEVELOPER', () => {
      reflector.getAllAndOverride.mockReturnValue([Role.DEVELOPER]);
      const ctx = makeContext(Role.RECRUITER, [Role.DEVELOPER]);
      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it('rejette DEVELOPER sur une route ADMIN', () => {
      reflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);
      const ctx = makeContext(Role.DEVELOPER, [Role.ADMIN]);
      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });
  });

  describe('quand plusieurs rôles sont acceptés', () => {
    it('autorise DEVELOPER si [DEVELOPER, RECRUITER]', () => {
      reflector.getAllAndOverride.mockReturnValue([Role.DEVELOPER, Role.RECRUITER]);
      const ctx = makeContext(Role.DEVELOPER, [Role.DEVELOPER, Role.RECRUITER]);
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('autorise RECRUITER si [DEVELOPER, RECRUITER]', () => {
      reflector.getAllAndOverride.mockReturnValue([Role.DEVELOPER, Role.RECRUITER]);
      const ctx = makeContext(Role.RECRUITER, [Role.DEVELOPER, Role.RECRUITER]);
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('rejette ADMIN si [DEVELOPER, RECRUITER]', () => {
      reflector.getAllAndOverride.mockReturnValue([Role.DEVELOPER, Role.RECRUITER]);
      const ctx = makeContext(Role.ADMIN, [Role.DEVELOPER, Role.RECRUITER]);
      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });
  });

  describe('message d\'erreur', () => {
    it('le message de ForbiddenException est explicite', () => {
      reflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);
      const ctx = makeContext(Role.DEVELOPER, [Role.ADMIN]);
      expect(() => guard.canActivate(ctx)).toThrow('Accès refusé : rôle insuffisant');
    });
  });
});
