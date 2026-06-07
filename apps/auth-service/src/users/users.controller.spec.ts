import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { Role } from '@repo/types';

const mockUsersService = {
  setRole: jest.fn(),
  getProfile: jest.fn(),
};

describe('UsersController', () => {
  let controller: UsersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: mockUsersService }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    jest.clearAllMocks();
  });

  // ─── POST /onboarding ─────────────────────────────────────────────────────

  describe('onboarding', () => {
    it('délègue au service avec firstName/lastName et retourne le résultat', async () => {
      const expected = { userId: 'user-1', role: Role.DEVELOPER };
      mockUsersService.setRole.mockResolvedValue(expected);

      const result = await controller.onboarding({
        userId: 'user-1',
        role: Role.DEVELOPER,
        firstName: 'Alice',
        lastName: 'Dev',
      });

      expect(result).toEqual(expected);
      expect(mockUsersService.setRole).toHaveBeenCalledWith('user-1', Role.DEVELOPER, 'Alice', 'Dev');
    });

    it('délègue sans firstName/lastName (valeurs optionnelles)', async () => {
      const expected = { userId: 'user-1', role: Role.DEVELOPER };
      mockUsersService.setRole.mockResolvedValue(expected);

      await controller.onboarding({ userId: 'user-1', role: Role.DEVELOPER });

      expect(mockUsersService.setRole).toHaveBeenCalledWith('user-1', Role.DEVELOPER, undefined, undefined);
    });

    it('propage ConflictException si l\'onboarding est déjà effectué', async () => {
      mockUsersService.setRole.mockRejectedValue(
        new ConflictException('Onboarding déjà effectué pour cet utilisateur'),
      );

      await expect(
        controller.onboarding({ userId: 'user-1', role: Role.DEVELOPER }),
      ).rejects.toThrow(ConflictException);
    });

    it('fonctionne pour le rôle RECRUITER', async () => {
      mockUsersService.setRole.mockResolvedValue({ userId: 'user-2', role: Role.RECRUITER });

      const result = await controller.onboarding({ userId: 'user-2', role: Role.RECRUITER });

      expect(result.role).toBe(Role.RECRUITER);
    });
  });

  // ─── GET /:userId/profile ──────────────────────────────────────────────────

  describe('getProfile', () => {
    it('retourne le profil développeur', async () => {
      const profile = { role: Role.DEVELOPER, profile: { firstName: 'Alice' } };
      mockUsersService.getProfile.mockResolvedValue(profile);

      const result = await controller.getProfile('user-1');

      expect(result).toEqual(profile);
      expect(mockUsersService.getProfile).toHaveBeenCalledWith('user-1');
    });

    it('retourne le profil recruteur', async () => {
      const profile = { role: Role.RECRUITER, profile: { firstName: 'Bob', company: {} } };
      mockUsersService.getProfile.mockResolvedValue(profile);

      const result = await controller.getProfile('user-2');

      expect(result.role).toBe(Role.RECRUITER);
    });

    it('propage NotFoundException si profil introuvable', async () => {
      mockUsersService.getProfile.mockRejectedValue(new NotFoundException('Profil introuvable'));

      await expect(controller.getProfile('user-inconnu')).rejects.toThrow(NotFoundException);
    });
  });
});
