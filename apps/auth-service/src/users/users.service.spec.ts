import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@repo/types';

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  developerProfile: {
    count: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn().mockResolvedValue({}),
  },
  recruiterProfile: {
    count: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    findFirst: jest.fn(),
  },
  company: {
    upsert: jest.fn(),
  },
  account: {
    findMany: jest.fn(),
  },
  $transaction: jest.fn(),
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

      const result = await service.setRole(
        'user-1',
        Role.DEVELOPER,
        'Alice',
        'Dev',
      );

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

      await expect(service.setRole('user-1', Role.DEVELOPER)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.setRole('user-1', Role.DEVELOPER)).rejects.toThrow(
        'Onboarding déjà effectué pour cet utilisateur',
      );
    });

    it('lance ConflictException si un profil recruteur existe déjà', async () => {
      mockPrisma.developerProfile.count.mockResolvedValue(0);
      mockPrisma.recruiterProfile.count.mockResolvedValue(1);

      await expect(service.setRole('user-1', Role.RECRUITER)).rejects.toThrow(
        ConflictException,
      );
    });

    it('vérifie les deux types de profils avant de répondre', async () => {
      mockPrisma.developerProfile.count.mockResolvedValue(0);
      mockPrisma.recruiterProfile.count.mockResolvedValue(0);

      await service.setRole('user-1', Role.DEVELOPER);

      expect(mockPrisma.developerProfile.count).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
      expect(mockPrisma.recruiterProfile.count).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
    });
  });

  // ─── getProfile ───────────────────────────────────────────────────────────

  describe('getProfile', () => {
    it('retourne { role: DEVELOPER, profile } pour un utilisateur DEVELOPER', async () => {
      const devProfile = {
        id: 'dev-1',
        userId: 'user-1',
        firstName: 'Alice',
        lastName: 'Dev',
        skills: [],
        technologies: [],
        projects: [],
      };
      mockPrisma.user.findUnique.mockResolvedValue({ role: Role.DEVELOPER });
      mockPrisma.developerProfile.findUnique.mockResolvedValue(devProfile);

      const result = await service.getProfile('user-1');

      expect(result).toEqual({ role: Role.DEVELOPER, profile: devProfile });
      expect(mockPrisma.recruiterProfile.findUnique).not.toHaveBeenCalled();
    });

    it('retourne { role: DEVELOPER, profile: null } si profil dev absent', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ role: Role.DEVELOPER });
      mockPrisma.developerProfile.findUnique.mockResolvedValue(null);

      const result = await service.getProfile('user-1');

      expect(result).toEqual({ role: Role.DEVELOPER, profile: null });
    });

    it('retourne { role: RECRUITER, profile } pour un utilisateur RECRUITER', async () => {
      const recProfile = {
        id: 'rec-1',
        userId: 'user-2',
        firstName: 'Bob',
        lastName: 'Rec',
        company: { id: 'co-1', name: 'Acme' },
      };
      mockPrisma.user.findUnique.mockResolvedValue({ role: Role.RECRUITER });
      mockPrisma.recruiterProfile.findUnique.mockResolvedValue(recProfile);

      const result = await service.getProfile('user-2');

      expect(result).toEqual({ role: Role.RECRUITER, profile: recProfile });
      expect(mockPrisma.developerProfile.findUnique).not.toHaveBeenCalled();
    });

    it("lance NotFoundException si l'utilisateur n'existe pas", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getProfile('user-unknown')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('cherche le profil dev avec les relations (skills, technologies, projects)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ role: Role.DEVELOPER });
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
        include: {
          skills: { include: { skill: true } },
          technologies: true,
          projects: true,
        },
      });
    });
  });

  // ─── getStats ─────────────────────────────────────────────────────────────

  describe('getStats', () => {
    it('retourne le total et le compte par rôle', async () => {
      mockPrisma.user.count
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(2);
      const result = await service.getStats();
      expect(result).toEqual({
        total: 10,
        developers: 5,
        recruiters: 3,
        admins: 2,
      });
    });
  });

  // ─── listUsers ────────────────────────────────────────────────────────────

  describe('listUsers', () => {
    it("retourne une liste paginée d'utilisateurs", async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(0);
      const result = await service.listUsers(1, 10);
      expect(result).toEqual({ data: [], total: 0, page: 1, pageSize: 10 });
    });
  });

  // ─── adminUpdateUser ──────────────────────────────────────────────────────

  describe('adminUpdateUser', () => {
    it("met à jour le nom d'un utilisateur", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        role: Role.DEVELOPER,
      });
      mockPrisma.user.update.mockResolvedValue({
        id: 'u1',
        name: 'Nouveau',
        role: Role.DEVELOPER,
      });
      const result = await service.adminUpdateUser('u1', { name: 'Nouveau' });
      expect(result.name).toBe('Nouveau');
    });

    it('lance NotFoundException si utilisateur introuvable', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.adminUpdateUser('x', {})).rejects.toThrow(
        NotFoundException,
      );
    });

    it('lance ConflictException si on tente de passer le rôle à RECRUITER (doit passer par promoteToRecruiter)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        role: Role.DEVELOPER,
      });
      await expect(
        service.adminUpdateUser('u1', { role: Role.RECRUITER }),
      ).rejects.toThrow(ConflictException);
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });
  });

  // ─── adminDeleteUser ──────────────────────────────────────────────────────

  describe('adminDeleteUser', () => {
    it('supprime un utilisateur non-admin', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        role: Role.DEVELOPER,
      });
      mockPrisma.user.delete.mockResolvedValue({});
      const result = await service.adminDeleteUser('u1');
      expect(result).toEqual({ ok: true });
    });

    it('lance NotFoundException si introuvable', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.adminDeleteUser('x')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── promoteToRecruiter ───────────────────────────────────────────────────

  describe('promoteToRecruiter', () => {
    beforeEach(() => {
      // Exécute réellement le callback de transaction (au lieu de le no-op)
      // pour pouvoir vérifier les appels faits sur tx.company.upsert / tx.recruiterProfile.create
      mockPrisma.$transaction.mockImplementation(
        (callback: (tx: typeof mockPrisma) => Promise<unknown>) =>
          callback(mockPrisma),
      );
      mockPrisma.company.upsert.mockResolvedValue({ id: 'co-1' });
      mockPrisma.recruiterProfile.create.mockResolvedValue({ id: 'rec-1' });
    });

    it("promeut un DEVELOPER en RECRUITER et crée l'entreprise", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        role: Role.DEVELOPER,
      });
      mockPrisma.recruiterProfile.findUnique.mockResolvedValue(null);

      const result = await service.promoteToRecruiter({
        userId: 'u1',
        companyName: 'Acme',
        firstName: 'Bob',
        lastName: 'Martin',
      });

      expect(result).toEqual({ ok: true, userId: 'u1' });
      expect(mockPrisma.company.upsert).toHaveBeenCalledWith({
        where: { name: 'Acme' },
        update: {},
        create: { name: 'Acme', siret: undefined },
      });
    });

    it('propage companySiret vers la Company créée/mise à jour', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u2',
        role: Role.DEVELOPER,
      });
      mockPrisma.recruiterProfile.findUnique.mockResolvedValue(null);

      await service.promoteToRecruiter({
        userId: 'u2',
        companyName: 'Acme',
        companySiret: '12345678901234',
        firstName: 'Bob',
        lastName: 'Martin',
      });

      expect(mockPrisma.company.upsert).toHaveBeenCalledWith({
        where: { name: 'Acme' },
        update: { siret: '12345678901234' },
        create: { name: 'Acme', siret: '12345678901234' },
      });
    });

    it('lance ConflictException si déjà recruteur', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        role: Role.RECRUITER,
      });
      await expect(
        service.promoteToRecruiter({
          userId: 'u1',
          companyName: 'X',
          firstName: 'A',
          lastName: 'B',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });
});
