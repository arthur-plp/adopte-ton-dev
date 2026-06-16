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

    it("extrait prénom + nom d'un nom complet", async () => {
      const userFullName = { ...mockUser, name: 'Alice Dupont' };
      mockFetch.mockResolvedValue({ json: () => Promise.resolve({}) });
      await controller.onboarding(mockReq(userFullName), {
        role: Role.DEVELOPER,
      });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            userId: 'user-1',
            role: Role.DEVELOPER,
            firstName: 'Alice',
            lastName: 'Dupont',
          }),
        }),
      );
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

  // ─── POST /developer/me/github-sync ──────────────────────────────────────

  describe('syncGitHub', () => {
    it('appelle le endpoint github-sync', async () => {
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({ synced: 5 }),
      });
      await controller.syncGitHub(mockReq());
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('github-sync'),
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  // ─── Technologies ─────────────────────────────────────────────────────────

  describe('getMyTechnologies', () => {
    it('liste les technologies via GET', async () => {
      mockFetch.mockResolvedValue({ json: () => Promise.resolve([]) });
      await controller.getMyTechnologies(mockReq());
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/technologies'),
        expect.objectContaining({ method: 'GET' }),
      );
    });
  });

  describe('deleteTechnology', () => {
    it('supprime une technologie via DELETE', async () => {
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({ deleted: true }),
      });
      await controller.deleteTechnology(mockReq(), 'tech-1');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('tech-1'),
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  // ─── Skills ───────────────────────────────────────────────────────────────

  describe('listSkillsCatalog', () => {
    it('retourne le catalogue de compétences', async () => {
      mockFetch.mockResolvedValue({ json: () => Promise.resolve([]) });
      await controller.listSkillsCatalog();
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('skills/catalog'),
        expect.objectContaining({ method: 'GET' }),
      );
    });
  });

  describe('getMySkills', () => {
    it('liste les compétences via GET', async () => {
      mockFetch.mockResolvedValue({ json: () => Promise.resolve([]) });
      await controller.getMySkills(mockReq());
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/skills'),
        expect.objectContaining({ method: 'GET' }),
      );
    });
  });

  describe('updateSkill', () => {
    it("met à jour le niveau d'une compétence", async () => {
      mockFetch.mockResolvedValue({ json: () => Promise.resolve({}) });
      await controller.updateSkill(mockReq(), 'skill-1', { level: 'ADVANCED' });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('skill-1'),
        expect.objectContaining({ method: 'PATCH' }),
      );
    });
  });

  describe('removeSkill', () => {
    it('retire une compétence via DELETE', async () => {
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({ deleted: true }),
      });
      await controller.removeSkill(mockReq(), 'skill-1');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('skill-1'),
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  // ─── Projets ──────────────────────────────────────────────────────────────

  describe('getMyProjects', () => {
    it('liste les projets via GET', async () => {
      mockFetch.mockResolvedValue({ json: () => Promise.resolve([]) });
      await controller.getMyProjects(mockReq());
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/projects'),
        expect.objectContaining({ method: 'GET' }),
      );
    });
  });

  describe('reorderMyProjects', () => {
    it('réordonne les projets via POST', async () => {
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({ updated: 2 }),
      });
      await controller.reorderMyProjects(mockReq(), {
        order: [
          { id: 'p1', displayOrder: 0 },
          { id: 'p2', displayOrder: 1 },
        ],
      });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('reorder'),
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  describe('updateMyProject', () => {
    it('met à jour un projet via PATCH', async () => {
      mockFetch.mockResolvedValue({ json: () => Promise.resolve({}) });
      await controller.updateMyProject(mockReq(), 'proj-1', { visible: false });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('proj-1'),
        expect.objectContaining({ method: 'PATCH' }),
      );
    });
  });

  describe('deleteMyProject', () => {
    it('supprime un projet via DELETE', async () => {
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({ deleted: true }),
      });
      await controller.deleteMyProject(mockReq(), 'proj-1');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('proj-1'),
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  // ─── Avatar & misc ────────────────────────────────────────────────────────

  describe('getAvatarOptions', () => {
    it("retourne les options d'avatar", async () => {
      mockFetch.mockResolvedValue({ json: () => Promise.resolve([]) });
      await controller.getAvatarOptions(mockReq());
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('avatar-options'),
        expect.objectContaining({ method: 'GET' }),
      );
    });
  });
});
