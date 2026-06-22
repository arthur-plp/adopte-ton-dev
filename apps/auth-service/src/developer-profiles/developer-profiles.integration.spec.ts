/**
 * Tests d'intégration — DeveloperProfilesController (auth-service)
 * Pattern TCP : les méthodes sont appelées directement avec leur payload.
 * Vérifie : délégation aux services, propagation des exceptions, logique Zod.
 */
import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { DeveloperProfilesController } from './developer-profiles.controller';
import { DeveloperProfilesService } from './developer-profiles.service';
import { GitHubSyncService } from './github-sync.service';

const mockService = {
  create: jest.fn(),
  findByUserId: jest.fn(),
  update: jest.fn(),
  getTechnologies: jest.fn(),
  addTechnology: jest.fn(),
  updateTechnology: jest.fn(),
  deleteTechnology: jest.fn(),
  getSkills: jest.fn(),
  listAvailableSkills: jest.fn(),
  addSkill: jest.fn(),
  updateSkill: jest.fn(),
  removeSkill: jest.fn(),
  getProjects: jest.fn(),
  createProject: jest.fn(),
  updateProject: jest.fn(),
  reorderProjects: jest.fn(),
  deleteProject: jest.fn(),
};

const mockGitHubSync = { syncForUser: jest.fn() };

describe('DeveloperProfilesController (intégration TCP)', () => {
  let controller: DeveloperProfilesController;

  beforeAll(async () => {
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
  });

  beforeEach(() => jest.clearAllMocks());

  // ─── Catalogue de compétences ──────────────────────────────────────────────

  describe('developer.getSkillsCatalog', () => {
    it('retourne le catalogue sans paramètre', async () => {
      mockService.listAvailableSkills.mockResolvedValue([
        { id: 's1', name: 'API REST', category: 'technique' },
      ]);

      const result = await controller.listSkills();

      expect(Array.isArray(result)).toBe(true);
      expect(mockService.listAvailableSkills).toHaveBeenCalled();
    });
  });

  // ─── Technologies ─────────────────────────────────────────────────────────

  describe('developer.addTechnology', () => {
    it("délègue l'ajout au service", async () => {
      const tech = {
        id: 'tech-1',
        profileId: 'dev-1',
        name: 'TypeScript',
        level: 'ADVANCED',
      };
      mockService.addTechnology.mockResolvedValue(tech);

      const result = await controller.addTechnology({
        userId: 'user-1',
        requesterId: 'user-1',
        name: 'TypeScript',
        level: 'ADVANCED' as const,
      });

      expect(result).toEqual(tech);
      expect(mockService.addTechnology).toHaveBeenCalledWith(
        'user-1',
        'user-1',
        { name: 'TypeScript', level: 'ADVANCED' },
      );
    });

    it('propage ConflictException si la technologie est déjà ajoutée', async () => {
      mockService.addTechnology.mockRejectedValue(
        new ConflictException('Technologie "TypeScript" déjà ajoutée'),
      );

      await expect(
        controller.addTechnology({
          userId: 'user-1',
          requesterId: 'user-1',
          name: 'TypeScript',
          level: 'INTERMEDIATE' as const,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('propage ForbiddenException si pas propriétaire', async () => {
      mockService.addTechnology.mockRejectedValue(new ForbiddenException());

      await expect(
        controller.addTechnology({
          userId: 'user-1',
          requesterId: 'hacker',
          name: 'React',
          level: 'BEGINNER' as const,
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('developer.deleteTechnology', () => {
    it('supprime une technologie', async () => {
      mockService.deleteTechnology.mockResolvedValue({ deleted: true });

      const result = await controller.deleteTechnology({
        userId: 'user-1',
        requesterId: 'user-1',
        techId: 'tech-1',
      });

      expect(result).toEqual({ deleted: true });
      expect(mockService.deleteTechnology).toHaveBeenCalledWith(
        'user-1',
        'user-1',
        'tech-1',
      );
    });

    it('propage NotFoundException si technologie introuvable', async () => {
      mockService.deleteTechnology.mockRejectedValue(
        new NotFoundException('Technologie introuvable'),
      );

      await expect(
        controller.deleteTechnology({
          userId: 'user-1',
          requesterId: 'user-1',
          techId: 'tech-autre',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── Skills ───────────────────────────────────────────────────────────────

  describe('developer.addSkill', () => {
    it('ajoute une compétence', async () => {
      const entry = {
        id: 'ds-1',
        profileId: 'dev-1',
        skillId: 'skill-1',
        level: 'INTERMEDIATE',
      };
      mockService.addSkill.mockResolvedValue(entry);

      const result = await controller.addSkill({
        userId: 'user-1',
        requesterId: 'user-1',
        skillId: 'skill-1',
        level: 'INTERMEDIATE' as const,
      });

      expect(result).toEqual(entry);
    });

    it('propage NotFoundException si compétence du catalogue introuvable', async () => {
      mockService.addSkill.mockRejectedValue(
        new NotFoundException('Compétence introuvable'),
      );

      await expect(
        controller.addSkill({
          userId: 'user-1',
          requesterId: 'user-1',
          skillId: 'skill-inconnu',
          level: 'BEGINNER' as const,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('propage ConflictException si déjà ajoutée', async () => {
      mockService.addSkill.mockRejectedValue(
        new ConflictException('Compétence déjà ajoutée'),
      );

      await expect(
        controller.addSkill({
          userId: 'user-1',
          requesterId: 'user-1',
          skillId: 'skill-1',
          level: 'ADVANCED' as const,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ─── Projets ──────────────────────────────────────────────────────────────

  describe('developer.createProject', () => {
    it('crée un projet', async () => {
      const project = {
        id: 'proj-1',
        profileId: 'dev-1',
        title: 'Mon app',
        description: 'Cool',
      };
      mockService.createProject.mockResolvedValue(project);

      const result = await controller.createProject({
        userId: 'user-1',
        requesterId: 'user-1',
        title: 'Mon app',
        description: 'Cool',
        technologies: [],
      });

      expect(result).toEqual(project);
      expect(mockService.createProject).toHaveBeenCalledWith(
        'user-1',
        'user-1',
        expect.objectContaining({ title: 'Mon app', description: 'Cool' }),
      );
    });

    it('propage ForbiddenException si pas propriétaire', async () => {
      mockService.createProject.mockRejectedValue(new ForbiddenException());

      await expect(
        controller.createProject({
          userId: 'user-1',
          requesterId: 'hacker',
          title: 'x',
          description: 'y',
          technologies: [],
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('developer.deleteProject', () => {
    it('supprime un projet', async () => {
      mockService.deleteProject.mockResolvedValue({ deleted: true });

      await controller.deleteProject({
        userId: 'user-1',
        requesterId: 'user-1',
        projectId: 'proj-1',
      });

      expect(mockService.deleteProject).toHaveBeenCalledWith(
        'user-1',
        'user-1',
        'proj-1',
      );
    });

    it('propage NotFoundException si projet introuvable', async () => {
      mockService.deleteProject.mockRejectedValue(
        new NotFoundException('Projet introuvable'),
      );

      await expect(
        controller.deleteProject({
          userId: 'user-1',
          requesterId: 'user-1',
          projectId: 'proj-autre',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
