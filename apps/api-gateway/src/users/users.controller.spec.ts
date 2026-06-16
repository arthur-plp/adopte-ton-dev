// Mock auth.guard before imports to avoid loading better-auth (ESM-only) in Jest
jest.mock('../auth/auth.guard', () => ({
  AuthGuard: class MockAuthGuard {
    canActivate() {
      return true;
    }
  },
}));

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UsersController } from './users.controller';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Role } from '@repo/types';
import type { Request } from 'express';

type AuthenticatedUser = {
  id: string;
  email: string;
  name: string;
  image: string | null | undefined;
  role: string;
  onboarded: boolean;
};

type AuthRequest = Request & { user: AuthenticatedUser };

const mockUser: AuthenticatedUser = {
  id: 'user-1',
  email: 'alice@test.com',
  name: 'Alice',
  image: null,
  role: Role.DEVELOPER,
  onboarded: true,
};

function mockReq(user = mockUser): AuthRequest {
  return { user } as AuthRequest;
}

global.fetch = jest.fn();
const mockFetch = global.fetch as jest.Mock;

describe('UsersController (api-gateway)', () => {
  let controller: UsersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: ConfigService,
          useValue: {
            get: jest
              .fn()
              .mockImplementation(
                (_key: string, defaultVal: string) => defaultVal,
              ),
          },
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UsersController>(UsersController);
    jest.clearAllMocks();
  });

  // ─── POST /onboarding ─────────────────────────────────────────────────────

  describe('onboarding', () => {
    it('appelle users-svc et retourne la réponse', async () => {
      const expected = { userId: 'user-1', role: Role.DEVELOPER };
      mockFetch.mockResolvedValue({ json: () => Promise.resolve(expected) });

      const result = await controller.onboarding(mockReq(), {
        role: Role.DEVELOPER,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/v1/users/onboarding',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: 'user-1',
            role: Role.DEVELOPER,
            firstName: 'Alice',
            lastName: 'Alice',
          }),
        }),
      );
      expect(result).toEqual(expected);
    });

    it('propage le rôle RECRUITER correctement', async () => {
      const recUser = { ...mockUser, role: Role.RECRUITER };
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({ userId: 'user-1', role: Role.RECRUITER }),
      });

      await controller.onboarding(mockReq(recUser), { role: Role.RECRUITER });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            userId: 'user-1',
            role: Role.RECRUITER,
            firstName: 'Alice',
            lastName: 'Alice',
          }),
        }),
      );
    });
  });

  // ─── GET /me/profile ──────────────────────────────────────────────────────

  describe('getMyProfile', () => {
    it("appelle users-svc avec l'userId extrait du token", async () => {
      const profile = { role: Role.DEVELOPER, profile: { firstName: 'Alice' } };
      mockFetch.mockResolvedValue({ json: () => Promise.resolve(profile) });

      const result = await controller.getMyProfile(mockReq());

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/v1/users/user-1/profile',
        expect.objectContaining({ method: 'GET' }),
      );
      expect(result).toEqual(profile);
    });
  });

  // ─── GET /developer/:userId ───────────────────────────────────────────────

  describe('getDeveloperProfile', () => {
    it('appelle users-svc avec le userId en paramètre', async () => {
      const profile = { id: 'dev-1', firstName: 'Alice' };
      mockFetch.mockResolvedValue({ json: () => Promise.resolve(profile) });

      const result = await controller.getDeveloperProfile('user-1');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/v1/developer-profiles/user-1',
        expect.objectContaining({ method: 'GET' }),
      );
      expect(result).toEqual(profile);
    });
  });

  // ─── PATCH /developer/me ──────────────────────────────────────────────────

  describe('updateDeveloperProfile', () => {
    it('appelle users-svc avec requesterId et données', async () => {
      const updated = { id: 'dev-1', firstName: 'Alice Updated' };
      mockFetch.mockResolvedValue({ json: () => Promise.resolve(updated) });

      const result = await controller.updateDeveloperProfile(mockReq(), {
        firstName: 'Alice Updated',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/v1/developer-profiles/user-1',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({
            requesterId: 'user-1',
            data: { firstName: 'Alice Updated' },
          }),
        }),
      );
      expect(result).toEqual(updated);
    });
  });
});
