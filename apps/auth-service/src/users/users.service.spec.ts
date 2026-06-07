import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@repo/types';

const mockPrisma = {
  developerProfile: {
    count: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn().mockResolvedValue({}),
  },
  recruiterProfile: {
    count: jest.fn(),
    findUnique: jest.fn(),
  },
};

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  // ─── setRole ──────────────────────────────────────────────────────────────

  describe('setRole', () => {
    it('crée un DeveloperProfile et retourne { userId, role } pour DEVELOPER', async () => {
      mockPrisma.developerProfile.count.mockResolvedValue(0);
      mockPrisma.recruiterProfile.count.mockResolvedValue(0);

      const result = await service.setRole('user-1', Role.DEVELOPER, 'Alice', 'Dev');

      expect(result).toEqual({ userId: 'user-1', role: Role.DEVELOPER });
      expect(mockPrisma.developerProfile.create).toHaveBeenCalledWith({
        data: { userId: 'user-1', firstName: 'Alice', lastName: 'Dev' },
      });
    });

    it('utilise des chaînes vides si firstName/lastName absents', async () => {
      mockPrisma.developerProfile.count.mockResolvedValue(0);
      mockPrisma.recruiterProfile.count.mockResolvedValue(0);

      await service.setRole('user-1', Role.DEVELOPER);

      expect(mockPrisma.developerProfile.create).toHaveBeenCalledWith({
        data: { userId: 'user-1', firstName: '', lastName: '' },
      });
    });

    it('retourne { userId, role } pour RECRUITER sans créer de profil dev', async () => {
      mockPrisma.developerProfile.count.mockResolvedValue(0);
      mockPrisma.recruiterProfile.count.mockResolvedValue(0);

      const result = await service.setRole('user-2', Role.RECRUITER);

      expect(result).toEqual({ userId: 'user-2', role: Role.RECRUITER });
      expect(mockPrisma.developerProfile.create).not.toHaveBeenCalled();
    });

    it('lance ConflictException si un profil développeur existe déjà', async () => {
      mockPrisma.developerProfile.count.mockResolvedValue(1);
      mockPrisma.recruiterProfile.count.mockResolvedValue(0);

      await expect(service.setRole('user-1', Role.DEVELOPER)).rejects.toThrow(ConflictException);
      await expect(service.setRole('user-1', Role.DEVELOPER)).rejects.toThrow(
        'Onboarding déjà effectué pour cet utilisateur',
      );
    });

    it('lance ConflictException si un profil recruteur existe déjà', async () => {
      mockPrisma.developerProfile.count.mockResolvedValue(0);
      mockPrisma.recruiterProfile.count.mockResolvedValue(1);

      await expect(service.setRole('user-1', Role.RECRUITER)).rejects.toThrow(ConflictException);
    });

    it('vérifie les deux types de profils avant de répondre', async () => {
      mockPrisma.developerProfile.count.mockResolvedValue(0);
      mockPrisma.recruiterProfile.count.mockResolvedValue(0);

      await service.setRole('user-1', Role.DEVELOPER);

      expect(mockPrisma.developerProfile.count).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
      expect(mockPrisma.recruiterProfile.count).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
    });
  });

  // ─── getProfile ───────────────────────────────────────────────────────────

  describe('getProfile', () => {
    it('retourne le profil DEVELOPER si un profil dev est trouvé', async () => {
      const devProfile = {
        id: 'dev-1',
        userId: 'user-1',
        firstName: 'Alice',
        lastName: 'Dev',
        skills: [],
        technologies: [],
        projects: [],
      };
      mockPrisma.developerProfile.findUnique.mockResolvedValue(devProfile);

      const result = await service.getProfile('user-1');

      expect(result).toEqual({ role: Role.DEVELOPER, profile: devProfile });
      expect(mockPrisma.recruiterProfile.findUnique).not.toHaveBeenCalled();
    });

    it('retourne le profil RECRUITER si pas de profil dev mais profil recruteur', async () => {
      const recProfile = {
        id: 'rec-1',
        userId: 'user-2',
        firstName: 'Bob',
        lastName: 'Rec',
        company: { id: 'co-1', name: 'Acme' },
      };
      mockPrisma.developerProfile.findUnique.mockResolvedValue(null);
      mockPrisma.recruiterProfile.findUnique.mockResolvedValue(recProfile);

      const result = await service.getProfile('user-2');

      expect(result).toEqual({ role: Role.RECRUITER, profile: recProfile });
    });

    it('lance NotFoundException si aucun profil trouvé', async () => {
      mockPrisma.developerProfile.findUnique.mockResolvedValue(null);
      mockPrisma.recruiterProfile.findUnique.mockResolvedValue(null);

      await expect(service.getProfile('user-unknown')).rejects.toThrow(NotFoundException);
      await expect(service.getProfile('user-unknown')).rejects.toThrow('Profil introuvable');
    });

    it('cherche le profil dev avec les relations (skills, technologies, projects)', async () => {
      mockPrisma.developerProfile.findUnique.mockResolvedValue({
        id: 'dev-1',
        userId: 'user-1',
        skills: [],
        technologies: [],
        projects: [],
      });

      await service.getProfile('user-1');

      expect(mockPrisma.developerProfile.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        include: { skills: { include: { skill: true } }, technologies: true, projects: true },
      });
    });
  });
});
