// Mock auth.guard before imports to avoid loading better-auth (ESM-only) in Jest
jest.mock('../auth/auth.guard', () => ({
  AuthGuard: class MockAuthGuard {
    canActivate() {
      return true;
    }
  },
}));

import { Test, TestingModule } from '@nestjs/testing';
import { of, throwError } from 'rxjs';
import { HttpException } from '@nestjs/common';
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
  emailVerified: boolean;
  companyId?: string;
};

type AuthRequest = Request & { user: AuthenticatedUser };

const mockDev: AuthenticatedUser = {
  id: 'user-1',
  email: 'alice@test.com',
  name: 'Alice Dev',
  image: null,
  role: Role.DEVELOPER,
  onboarded: true,
  emailVerified: true,
};

function mockReq(user: AuthenticatedUser = mockDev): AuthRequest {
  return { user } as AuthRequest;
}

const mockUsersSvc = { send: jest.fn() };

describe('UsersController (api-gateway, TCP)', () => {
  let controller: UsersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: 'USERS_SVC', useValue: mockUsersSvc }],
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
      mockUsersSvc.send.mockReturnValueOnce(of(expected));

      const result = await controller.onboarding(mockReq(), {
        role: Role.DEVELOPER,
      });

      expect(mockUsersSvc.send).toHaveBeenCalledWith(
        { cmd: 'users.onboarding' },
        expect.objectContaining({ userId: 'user-1', role: Role.DEVELOPER }),
      );
      expect(result).toEqual(expected);
    });

    it("extrait prénom + nom d'un nom complet", async () => {
      const userFullName = { ...mockDev, name: 'Alice Dupont' };
      mockUsersSvc.send.mockReturnValueOnce(of({}));
      await controller.onboarding(mockReq(userFullName), {
        role: Role.DEVELOPER,
      });
      expect(mockUsersSvc.send).toHaveBeenCalledWith(
        { cmd: 'users.onboarding' },
        expect.objectContaining({ firstName: 'Alice', lastName: 'Dupont' }),
      );
    });

    it('propage le rôle RECRUITER correctement', async () => {
      mockUsersSvc.send.mockReturnValueOnce(
        of({ userId: 'user-1', role: Role.RECRUITER }),
      );
      await controller.onboarding(
        mockReq({ ...mockDev, role: Role.RECRUITER }),
        { role: Role.RECRUITER },
      );
      expect(mockUsersSvc.send).toHaveBeenCalledWith(
        { cmd: 'users.onboarding' },
        expect.objectContaining({ role: Role.RECRUITER }),
      );
    });
  });

  // ─── GET /me/profile ──────────────────────────────────────────────────────

  describe('getMyProfile', () => {
    it("appelle users-svc avec l'userId extrait du token", async () => {
      const profile = { role: Role.DEVELOPER, profile: { firstName: 'Alice' } };
      mockUsersSvc.send.mockReturnValueOnce(of(profile));

      const result = await controller.getMyProfile(mockReq());

      expect(mockUsersSvc.send).toHaveBeenCalledWith(
        { cmd: 'users.getProfile' },
        { userId: 'user-1' },
      );
      expect(result).toEqual(profile);
    });
  });

  // ─── GET /developer/:userId ───────────────────────────────────────────────

  describe('getDeveloperProfile', () => {
    it('appelle users-svc avec le userId en paramètre', async () => {
      const profile = { id: 'dev-1', firstName: 'Alice' };
      mockUsersSvc.send.mockReturnValueOnce(of(profile));

      const result = await controller.getDeveloperProfile('user-1');

      expect(mockUsersSvc.send).toHaveBeenCalledWith(
        { cmd: 'developer.getProfile' },
        { userId: 'user-1' },
      );
      expect(result).toEqual(profile);
    });
  });

  // ─── PATCH /developer/me ──────────────────────────────────────────────────

  describe('updateDeveloperProfile', () => {
    it('appelle users-svc avec userId et données', async () => {
      const updated = { id: 'dev-1', firstName: 'Alice Updated' };
      mockUsersSvc.send.mockReturnValueOnce(of(updated));

      const result = await controller.updateDeveloperProfile(mockReq(), {
        firstName: 'Alice Updated',
      });

      expect(mockUsersSvc.send).toHaveBeenCalledWith(
        { cmd: 'developer.updateProfile' },
        expect.objectContaining({ userId: 'user-1', requesterId: 'user-1' }),
      );
      expect(result).toEqual(updated);
    });
  });

  // ─── POST /developer/me/github-sync ──────────────────────────────────────

  describe('syncGitHub', () => {
    it('appelle le cmd developer.githubSync', async () => {
      mockUsersSvc.send.mockReturnValueOnce(of({ synced: 5 }));
      await controller.syncGitHub(mockReq());
      expect(mockUsersSvc.send).toHaveBeenCalledWith(
        { cmd: 'developer.githubSync' },
        { userId: 'user-1' },
      );
    });
  });

  // ─── Technologies ─────────────────────────────────────────────────────────

  describe('getMyTechnologies', () => {
    it('liste les technologies via cmd developer.getTechnologies', async () => {
      mockUsersSvc.send.mockReturnValueOnce(of([]));
      await controller.getMyTechnologies(mockReq());
      expect(mockUsersSvc.send).toHaveBeenCalledWith(
        { cmd: 'developer.getTechnologies' },
        { userId: 'user-1' },
      );
    });
  });

  describe('deleteTechnology', () => {
    it('supprime une technologie via cmd developer.deleteTechnology', async () => {
      mockUsersSvc.send.mockReturnValueOnce(of({ deleted: true }));
      await controller.deleteTechnology(mockReq(), 'tech-1');
      expect(mockUsersSvc.send).toHaveBeenCalledWith(
        { cmd: 'developer.deleteTechnology' },
        expect.objectContaining({ techId: 'tech-1' }),
      );
    });
  });

  // ─── Skills ───────────────────────────────────────────────────────────────

  describe('listSkillsCatalog', () => {
    it('retourne le catalogue de compétences', async () => {
      mockUsersSvc.send.mockReturnValueOnce(of([]));
      await controller.listSkillsCatalog();
      expect(mockUsersSvc.send).toHaveBeenCalledWith(
        { cmd: 'developer.getSkillsCatalog' },
        {},
      );
    });
  });

  describe('getMySkills', () => {
    it('liste les compétences via cmd developer.getSkills', async () => {
      mockUsersSvc.send.mockReturnValueOnce(of([]));
      await controller.getMySkills(mockReq());
      expect(mockUsersSvc.send).toHaveBeenCalledWith(
        { cmd: 'developer.getSkills' },
        { userId: 'user-1' },
      );
    });
  });

  describe('updateSkill', () => {
    it("met à jour le niveau d'une compétence", async () => {
      mockUsersSvc.send.mockReturnValueOnce(of({}));
      await controller.updateSkill(mockReq(), 'skill-1', { level: 'ADVANCED' });
      expect(mockUsersSvc.send).toHaveBeenCalledWith(
        { cmd: 'developer.updateSkill' },
        expect.objectContaining({ skillId: 'skill-1', level: 'ADVANCED' }),
      );
    });
  });

  describe('removeSkill', () => {
    it('retire une compétence via cmd developer.removeSkill', async () => {
      mockUsersSvc.send.mockReturnValueOnce(of({ deleted: true }));
      await controller.removeSkill(mockReq(), 'skill-1');
      expect(mockUsersSvc.send).toHaveBeenCalledWith(
        { cmd: 'developer.removeSkill' },
        expect.objectContaining({ skillId: 'skill-1' }),
      );
    });
  });

  // ─── Projets ──────────────────────────────────────────────────────────────

  describe('getMyProjects', () => {
    it('liste les projets via cmd developer.getProjects', async () => {
      mockUsersSvc.send.mockReturnValueOnce(of([]));
      await controller.getMyProjects(mockReq());
      expect(mockUsersSvc.send).toHaveBeenCalledWith(
        { cmd: 'developer.getProjects' },
        { userId: 'user-1' },
      );
    });
  });

  describe('reorderMyProjects', () => {
    it('réordonne les projets via cmd developer.reorderProjects', async () => {
      mockUsersSvc.send.mockReturnValueOnce(of({ updated: 2 }));
      await controller.reorderMyProjects(mockReq(), {
        order: [
          { id: 'p1', displayOrder: 0 },
          { id: 'p2', displayOrder: 1 },
        ],
      });
      expect(mockUsersSvc.send).toHaveBeenCalledWith(
        { cmd: 'developer.reorderProjects' },
        expect.objectContaining({ order: expect.any(Array) }),
      );
    });
  });

  describe('updateMyProject', () => {
    it('met à jour un projet via cmd developer.updateProject', async () => {
      mockUsersSvc.send.mockReturnValueOnce(of({}));
      await controller.updateMyProject(mockReq(), 'proj-1', { visible: false });
      expect(mockUsersSvc.send).toHaveBeenCalledWith(
        { cmd: 'developer.updateProject' },
        expect.objectContaining({ projectId: 'proj-1' }),
      );
    });
  });

  describe('deleteMyProject', () => {
    it('supprime un projet via cmd developer.deleteProject', async () => {
      mockUsersSvc.send.mockReturnValueOnce(of({ deleted: true }));
      await controller.deleteMyProject(mockReq(), 'proj-1');
      expect(mockUsersSvc.send).toHaveBeenCalledWith(
        { cmd: 'developer.deleteProject' },
        expect.objectContaining({ projectId: 'proj-1' }),
      );
    });
  });

  // ─── Avatar & misc ────────────────────────────────────────────────────────

  describe('getAvatarOptions', () => {
    it("retourne les options d'avatar", async () => {
      mockUsersSvc.send.mockReturnValueOnce(of([]));
      await controller.getAvatarOptions(mockReq());
      expect(mockUsersSvc.send).toHaveBeenCalledWith(
        { cmd: 'users.getAvatarOptions' },
        { userId: 'user-1' },
      );
    });
  });

  // ─── Gestion d'erreurs RPC ────────────────────────────────────────────────

  describe('propagation des erreurs RPC', () => {
    it('convertit une RpcError en HttpException', async () => {
      mockUsersSvc.send.mockReturnValueOnce(
        throwError(() => ({ statusCode: 404, message: 'Profil introuvable' })),
      );
      await expect(controller.getMyProfile(mockReq())).rejects.toThrow(
        HttpException,
      );
    });
  });
});
