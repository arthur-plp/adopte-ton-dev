import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { DeveloperProfilesController } from './developer-profiles.controller';
import { DeveloperProfilesService } from './developer-profiles.service';
import { GitHubSyncService } from './github-sync.service';
import { Availability } from '@repo/types';
import type {
  CreateDeveloperProfileDto,
  UpdateDeveloperProfileDto,
} from '@repo/contracts';

const mockService = {
  create: jest.fn(),
  findByUserId: jest.fn(),
  update: jest.fn(),
};

const mockGitHubSync = {
  syncForUser: jest.fn(),
};

describe('DeveloperProfilesController', () => {
  let controller: DeveloperProfilesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DeveloperProfilesController],
      providers: [
        { provide: DeveloperProfilesService, useValue: mockService },
        { provide: GitHubSyncService, useValue: mockGitHubSync },
      ],
    }).compile();

    controller = module.get<DeveloperProfilesController>(
      DeveloperProfilesController,
    );
    jest.clearAllMocks();
  });

  const baseDto: CreateDeveloperProfileDto = {
    firstName: 'Alice',
    lastName: 'Dev',
    remoteOk: false,
    availability: Availability.IMMEDIATE,
  };

  // ─── POST / ───────────────────────────────────────────────────────────────

  describe('create', () => {
    it('parse le DTO et délègue au service', async () => {
      const created = { id: 'dev-1', userId: 'user-1', ...baseDto };
      mockService.create.mockResolvedValue(created);

      const result = await controller.create({
        userId: 'user-1',
        requesterId: 'user-1',
        data: baseDto,
      });

      expect(result).toEqual(created);
      expect(mockService.create).toHaveBeenCalledWith('user-1', baseDto);
    });

    it('lance une erreur Zod si firstName est vide', () => {
      expect(() =>
        controller.create({
          userId: 'user-1',
          requesterId: 'user-1',
          data: { ...baseDto, firstName: '' },
        }),
      ).toThrow();
      expect(mockService.create).not.toHaveBeenCalled();
    });

    it('lance une erreur Zod si githubUrl est invalide', () => {
      expect(() =>
        controller.create({
          userId: 'user-1',
          requesterId: 'user-1',
          data: { ...baseDto, githubUrl: 'pas-une-url' },
        }),
      ).toThrow();
    });
  });

  // ─── GET /:userId ─────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('retourne le profil correspondant au userId', async () => {
      const profile = {
        id: 'dev-1',
        userId: 'user-1',
        ...baseDto,
        skills: [],
        technologies: [],
        projects: [],
      };
      mockService.findByUserId.mockResolvedValue(profile);

      const result = await controller.findOne('user-1');

      expect(result).toEqual(profile);
      expect(mockService.findByUserId).toHaveBeenCalledWith('user-1');
    });

    it('propage NotFoundException si profil introuvable', async () => {
      mockService.findByUserId.mockRejectedValue(
        new NotFoundException('Profil développeur introuvable'),
      );

      await expect(controller.findOne('user-inconnu')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── PATCH /:userId ───────────────────────────────────────────────────────

  describe('update', () => {
    it('parse le DTO et délègue au service avec ownership', async () => {
      const updateDto: UpdateDeveloperProfileDto = {
        firstName: 'Alice Updated',
      };
      const updated = {
        id: 'dev-1',
        userId: 'user-1',
        ...baseDto,
        ...updateDto,
      };
      mockService.update.mockResolvedValue(updated);

      const result = await controller.update('user-1', {
        requesterId: 'user-1',
        data: updateDto,
      });

      expect(result).toEqual(updated);
      expect(mockService.update).toHaveBeenCalledWith(
        'user-1',
        'user-1',
        updateDto,
      );
    });

    it('accepte un update partiel (objet vide)', async () => {
      mockService.update.mockResolvedValue({
        id: 'dev-1',
        userId: 'user-1',
        ...baseDto,
      });

      const result = await controller.update('user-1', {
        requesterId: 'user-1',
        data: {},
      });

      expect(mockService.update).toHaveBeenCalledWith('user-1', 'user-1', {});
      expect(result).toBeDefined();
    });

    it('propage ForbiddenException si le requesterId ne possède pas le profil', async () => {
      mockService.update.mockRejectedValue(new ForbiddenException());

      await expect(
        controller.update('user-1', {
          requesterId: 'attaquant',
          data: { firstName: 'Hacked' },
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it("lance une erreur Zod si portfolioUrl est invalide dans l'update", () => {
      expect(() =>
        controller.update('user-1', {
          requesterId: 'user-1',
          data: { portfolioUrl: 'pas-une-url' },
        }),
      ).toThrow();
      expect(mockService.update).not.toHaveBeenCalled();
    });
  });

  // ─── POST /:userId/github-sync ────────────────────────────────────────────

  describe('syncGitHub', () => {
    it('délègue à GitHubSyncService et retourne le résultat', async () => {
      const expected = { synced: 5, skipped: 2 };
      mockGitHubSync.syncForUser.mockResolvedValue(expected);

      const result = await controller.syncGitHub('user-1');

      expect(result).toEqual(expected);
      expect(mockGitHubSync.syncForUser).toHaveBeenCalledWith('user-1');
    });
  });
});
