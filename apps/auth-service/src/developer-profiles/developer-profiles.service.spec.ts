import {
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DeveloperProfilesService } from './developer-profiles.service';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateDeveloperProfileDto,
  UpdateDeveloperProfileDto,
} from '@repo/contracts';

const mockPrisma = {
  developerProfile: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  developerTechnology: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  developerSkill: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  skill: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  project: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
  },
  outboxEvent: { create: jest.fn() },
  $transaction: jest.fn(),
};

const profile = { id: 'dev-1', userId: 'user-1' };

const baseCreateDto: CreateDeveloperProfileDto = {
  firstName: 'Alice',
  lastName: 'Dev',
  remoteOk: false,
  availability: 'Disponible immédiatement',
};

describe('DeveloperProfilesService', () => {
  let service: DeveloperProfilesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeveloperProfilesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<DeveloperProfilesService>(DeveloperProfilesService);
    jest.clearAllMocks();
  });

  // ─── create ───────────────────────────────────────────────────────────────

  describe('create', () => {
    it('crée et retourne un profil développeur', async () => {
      const created = { id: 'dev-1', userId: 'user-1', ...baseCreateDto };
      mockPrisma.developerProfile.create.mockResolvedValue(created);

      const result = await service.create('user-1', baseCreateDto);

      expect(result).toEqual(created);
      expect(mockPrisma.developerProfile.create).toHaveBeenCalledWith({
        data: { userId: 'user-1', ...baseCreateDto },
      });
    });
  });

  // ─── findByUserId ──────────────────────────────────────────────────────────

  describe('findByUserId', () => {
    it('retourne le profil complet avec ses relations', async () => {
      const fullProfile = {
        ...profile,
        firstName: 'Alice',
        lastName: 'Dev',
        skills: [],
        technologies: [],
        projects: [],
      };
      mockPrisma.developerProfile.findUnique.mockResolvedValue(fullProfile);

      const result = await service.findByUserId('user-1');
      expect(result).toEqual(fullProfile);
    });

    it('lance NotFoundException si profil introuvable', async () => {
      mockPrisma.developerProfile.findUnique.mockResolvedValue(null);
      await expect(service.findByUserId('inconnu')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── update ───────────────────────────────────────────────────────────────

  describe('update', () => {
    it("met à jour le profil et écrit dans l'Outbox en transaction", async () => {
      const updateDto: UpdateDeveloperProfileDto = {
        firstName: 'Alice Updated',
      };
      const updated = { ...profile, ...updateDto };

      mockPrisma.developerProfile.findUnique.mockResolvedValue(profile);
      mockPrisma.$transaction.mockResolvedValue([updated, {}]);

      const result = await service.update('user-1', 'user-1', updateDto);
      expect(result).toEqual(updated);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('lance ForbiddenException si requesterId ≠ propriétaire', async () => {
      mockPrisma.developerProfile.findUnique.mockResolvedValue(profile);
      await expect(service.update('user-1', 'attaquant', {})).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('lance NotFoundException si profil introuvable', async () => {
      mockPrisma.developerProfile.findUnique.mockResolvedValue(null);
      await expect(service.update('inconnu', 'inconnu', {})).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── Technologies ─────────────────────────────────────────────────────────

  describe('addTechnology', () => {
    it('ajoute une technologie et émet un event Outbox', async () => {
      const tech = {
        id: 'tech-1',
        profileId: 'dev-1',
        name: 'TypeScript',
        level: 'ADVANCED',
      };

      mockPrisma.developerProfile.findUnique.mockResolvedValue(profile);
      mockPrisma.developerTechnology.findFirst.mockResolvedValue(null);
      mockPrisma.$transaction.mockResolvedValue([tech, {}]);

      const result = await service.addTechnology('user-1', 'user-1', {
        name: 'TypeScript',
        level: 'ADVANCED',
      });

      expect(result).toEqual({
        id: tech.id,
        name: tech.name,
        level: tech.level,
      });
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('lance ConflictException si la technologie existe déjà', async () => {
      mockPrisma.developerProfile.findUnique.mockResolvedValue(profile);
      mockPrisma.developerTechnology.findFirst.mockResolvedValue({
        id: 'tech-existing',
      });

      await expect(
        service.addTechnology('user-1', 'user-1', {
          name: 'TypeScript',
          level: 'ADVANCED',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('lance ForbiddenException si requesterId ≠ propriétaire', async () => {
      mockPrisma.developerProfile.findUnique.mockResolvedValue(profile);
      await expect(
        service.addTechnology('user-1', 'hacker', {
          name: 'React',
          level: 'BEGINNER',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deleteTechnology', () => {
    it('supprime une technologie existante', async () => {
      const tech = { id: 'tech-1', profileId: 'dev-1', name: 'React' };

      mockPrisma.developerProfile.findUnique.mockResolvedValue(profile);
      mockPrisma.developerTechnology.findUnique.mockResolvedValue(tech);
      mockPrisma.$transaction.mockResolvedValue([{}, {}]);

      const result = await service.deleteTechnology(
        'user-1',
        'user-1',
        'tech-1',
      );
      expect(result).toEqual({ deleted: true });
    });

    it('lance NotFoundException si la technologie appartient à un autre profil', async () => {
      mockPrisma.developerProfile.findUnique.mockResolvedValue(profile);
      mockPrisma.developerTechnology.findUnique.mockResolvedValue({
        id: 'tech-1',
        profileId: 'autre-profil',
      });

      await expect(
        service.deleteTechnology('user-1', 'user-1', 'tech-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── Skills ───────────────────────────────────────────────────────────────

  describe('addSkill', () => {
    it('ajoute une compétence au profil et émet un event', async () => {
      const skill = { id: 'skill-1', name: 'API REST' };
      const entry = {
        id: 'ds-1',
        profileId: 'dev-1',
        skillId: 'skill-1',
        level: 'INTERMEDIATE',
      };

      mockPrisma.developerProfile.findUnique.mockResolvedValue(profile);
      mockPrisma.skill.findUnique.mockResolvedValue(skill);
      mockPrisma.developerSkill.findFirst.mockResolvedValue(null);
      mockPrisma.$transaction.mockResolvedValue([entry, {}]);

      const result = await service.addSkill('user-1', 'user-1', {
        skillId: 'skill-1',
        level: 'INTERMEDIATE',
      });
      expect(result).toEqual(entry);
    });

    it('lance ConflictException si la compétence est déjà ajoutée', async () => {
      mockPrisma.developerProfile.findUnique.mockResolvedValue(profile);
      mockPrisma.skill.findUnique.mockResolvedValue({
        id: 'skill-1',
        name: 'API REST',
      });
      mockPrisma.developerSkill.findFirst.mockResolvedValue({
        id: 'ds-existing',
      });

      await expect(
        service.addSkill('user-1', 'user-1', {
          skillId: 'skill-1',
          level: 'INTERMEDIATE',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it("lance NotFoundException si la compétence du catalogue n'existe pas", async () => {
      mockPrisma.developerProfile.findUnique.mockResolvedValue(profile);
      mockPrisma.skill.findUnique.mockResolvedValue(null);

      await expect(
        service.addSkill('user-1', 'user-1', {
          skillId: 'inconnu',
          level: 'BEGINNER',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── Projets ──────────────────────────────────────────────────────────────

  describe('createProject', () => {
    it('crée un projet manuel et le retourne', async () => {
      const projectData = {
        title: 'Mon app',
        description: 'Super projet',
        technologies: ['React'],
      };
      const created = { id: 'proj-1', profileId: 'dev-1', ...projectData };

      mockPrisma.developerProfile.findUnique.mockResolvedValue(profile);
      mockPrisma.project.create.mockResolvedValue(created);

      const result = await service.createProject(
        'user-1',
        'user-1',
        projectData,
      );
      expect(result).toEqual(created);
    });

    it('lance ForbiddenException si requesterId ≠ propriétaire', async () => {
      mockPrisma.developerProfile.findUnique.mockResolvedValue(profile);
      await expect(
        service.createProject('user-1', 'hacker', {
          title: 'x',
          description: 'y',
          technologies: [],
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deleteProject', () => {
    it('supprime un projet appartenant au profil', async () => {
      const proj = { id: 'proj-1', profileId: 'dev-1' };

      mockPrisma.developerProfile.findUnique.mockResolvedValue(profile);
      mockPrisma.project.findUnique.mockResolvedValue(proj);
      mockPrisma.project.delete.mockResolvedValue(proj);

      const result = await service.deleteProject('user-1', 'user-1', 'proj-1');
      expect(result).toEqual({ deleted: true });
    });

    it('lance NotFoundException si le projet appartient à un autre profil', async () => {
      mockPrisma.developerProfile.findUnique.mockResolvedValue(profile);
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'proj-1',
        profileId: 'autre',
      });

      await expect(
        service.deleteProject('user-1', 'user-1', 'proj-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── search ─────────────────────────────────────────────────────────────

  describe('search', () => {
    const profiles = [
      { id: 'dev-1', userId: 'user-1', technologies: [{ name: 'React' }] },
    ];

    it('filtre par technologies via "some.name.in"', async () => {
      mockPrisma.developerProfile.findMany.mockResolvedValue(profiles);
      mockPrisma.developerProfile.count.mockResolvedValue(1);

      await service.search({
        technologies: ['React', 'Node.js'],
        page: 1,
        pageSize: 20,
      });

      expect(mockPrisma.developerProfile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            technologies: { some: { name: { in: ['React', 'Node.js'] } } },
          },
        }),
      );
    });

    it('filtre par remoteOk et location (insensible à la casse)', async () => {
      mockPrisma.developerProfile.findMany.mockResolvedValue([]);
      mockPrisma.developerProfile.count.mockResolvedValue(0);

      await service.search({
        remoteOk: true,
        location: 'Paris',
        page: 1,
        pageSize: 20,
      });

      expect(mockPrisma.developerProfile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            remoteOk: true,
            location: { contains: 'Paris', mode: 'insensitive' },
          },
        }),
      );
    });

    it('retourne data/total/page/pageSize avec pagination', async () => {
      mockPrisma.developerProfile.findMany.mockResolvedValue(profiles);
      mockPrisma.developerProfile.count.mockResolvedValue(42);

      const result = await service.search({ page: 2, pageSize: 10 });

      expect(result).toEqual({
        data: profiles,
        total: 42,
        page: 2,
        pageSize: 10,
      });
      expect(mockPrisma.developerProfile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
    });

    it('ne filtre sur rien si aucun critère fourni (where vide)', async () => {
      mockPrisma.developerProfile.findMany.mockResolvedValue([]);
      mockPrisma.developerProfile.count.mockResolvedValue(0);

      await service.search({ page: 1, pageSize: 20 });

      expect(mockPrisma.developerProfile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });
  });
});
