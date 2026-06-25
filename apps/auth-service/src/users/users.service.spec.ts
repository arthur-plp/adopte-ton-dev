import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
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
    findUnique: jest.fn(),
  },
  account: {
    findMany: jest.fn(),
  },
  outboxEvent: {
    create: jest.fn(),
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
    beforeEach(() => {
      // Exécute réellement le callback de transaction (au lieu de le no-op)
      // pour pouvoir vérifier les appels faits sur tx.developerProfile.create / tx.user.update
      mockPrisma.$transaction.mockImplementation(
        (callback: (tx: typeof mockPrisma) => Promise<unknown>) =>
          callback(mockPrisma),
      );
    });

    it('crée un DeveloperProfile, marque onboarded et retourne { userId, role } pour DEVELOPER', async () => {
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
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { role: Role.DEVELOPER, onboarded: true },
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

    it('retourne { userId, role } pour RECRUITER sans créer de profil dev, mais marque onboarded', async () => {
      mockPrisma.developerProfile.count.mockResolvedValue(0);
      mockPrisma.recruiterProfile.count.mockResolvedValue(0);

      const result = await service.setRole('user-2', Role.RECRUITER);

      expect(result).toEqual({ userId: 'user-2', role: Role.RECRUITER });
      expect(mockPrisma.developerProfile.create).not.toHaveBeenCalled();
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-2' },
        data: { role: Role.RECRUITER, onboarded: true },
      });
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

  // ─── getParticipantInfo ───────────────────────────────────────────────────
  // Identité normalisée pour un participant de conversation (messaging-svc),
  // quel que soit son rôle — y compris ADMIN qui n'a ni DeveloperProfile ni
  // RecruiterProfile et retombe donc sur le nom BetterAuth.

  describe('getParticipantInfo', () => {
    it('retourne le profil développeur (firstName/lastName/avatarUrl/email)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        name: 'Alice Dev',
        role: Role.DEVELOPER,
        email: 'alice@test.com',
      });
      mockPrisma.developerProfile.findUnique.mockResolvedValue({
        firstName: 'Alice',
        lastName: 'Dev',
        avatarUrl: 'https://avatars.example/alice.png',
      });

      const result = await service.getParticipantInfo('user-1');

      expect(result).toEqual({
        firstName: 'Alice',
        lastName: 'Dev',
        avatarUrl: 'https://avatars.example/alice.png',
        companyName: null,
        role: Role.DEVELOPER,
        email: 'alice@test.com',
      });
    });

    it("retourne le profil recruteur avec le nom de l'entreprise", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        name: 'Bob Rec',
        role: Role.RECRUITER,
        email: 'bob@test.com',
      });
      mockPrisma.recruiterProfile.findUnique.mockResolvedValue({
        firstName: 'Bob',
        lastName: 'Rec',
        avatarUrl: null,
        company: { name: 'Acme Corp' },
      });

      const result = await service.getParticipantInfo('user-2');

      expect(result).toEqual({
        firstName: 'Bob',
        lastName: 'Rec',
        avatarUrl: null,
        companyName: 'Acme Corp',
        role: Role.RECRUITER,
        email: 'bob@test.com',
      });
    });

    it('retombe sur le nom BetterAuth pour un ADMIN (pas de profil dédié)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        name: 'Carole Admin',
        role: Role.ADMIN,
        email: 'carole@test.com',
      });

      const result = await service.getParticipantInfo('admin-1');

      expect(result).toEqual({
        firstName: 'Carole',
        lastName: 'Admin',
        avatarUrl: null,
        companyName: null,
        role: Role.ADMIN,
        email: 'carole@test.com',
      });
      expect(mockPrisma.developerProfile.findUnique).not.toHaveBeenCalled();
      expect(mockPrisma.recruiterProfile.findUnique).not.toHaveBeenCalled();
    });

    it('retombe sur le nom BetterAuth si le profil développeur est absent (rôle changé)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        name: 'Dan Sansprofil',
        role: Role.DEVELOPER,
        email: 'dan@test.com',
      });
      mockPrisma.developerProfile.findUnique.mockResolvedValue(null);

      const result = await service.getParticipantInfo('user-3');

      expect(result).toEqual({
        firstName: 'Dan',
        lastName: 'Sansprofil',
        avatarUrl: null,
        companyName: null,
        role: Role.DEVELOPER,
        email: 'dan@test.com',
      });
    });

    it("lance NotFoundException si l'utilisateur n'existe pas", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getParticipantInfo('user-unknown')).rejects.toThrow(
        NotFoundException,
      );
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
    beforeEach(() => {
      // deleteUserAndEmitEvent utilise $transaction([...]) (forme tableau),
      // pas la forme callback utilisée par setRole — on adapte le mock ici.
      mockPrisma.$transaction.mockImplementation((arr: unknown[]) =>
        Promise.all(arr),
      );
    });

    it('supprime un utilisateur non-admin et émet user.deleted', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        role: Role.DEVELOPER,
      });
      mockPrisma.user.delete.mockResolvedValue({});
      mockPrisma.outboxEvent.create.mockResolvedValue({});

      const result = await service.adminDeleteUser('u1');

      expect(result).toEqual({ ok: true });
      expect(mockPrisma.user.delete).toHaveBeenCalledWith({
        where: { id: 'u1' },
      });
      expect(mockPrisma.outboxEvent.create).toHaveBeenCalledWith({
        data: {
          type: 'user.deleted',
          payload: { userId: 'u1', role: Role.DEVELOPER },
        },
      });
    });

    it('lance NotFoundException si introuvable', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.adminDeleteUser('x')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── deleteOwnAccount ─────────────────────────────────────────────────────

  describe('deleteOwnAccount', () => {
    beforeEach(() => {
      mockPrisma.$transaction.mockImplementation((arr: unknown[]) =>
        Promise.all(arr),
      );
    });

    it('supprime son propre compte développeur et émet user.deleted', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'dev-1',
        role: Role.DEVELOPER,
      });
      mockPrisma.user.delete.mockResolvedValue({});
      mockPrisma.outboxEvent.create.mockResolvedValue({});

      const result = await service.deleteOwnAccount('dev-1');

      expect(result).toEqual({ ok: true });
      expect(mockPrisma.outboxEvent.create).toHaveBeenCalledWith({
        data: {
          type: 'user.deleted',
          payload: { userId: 'dev-1', role: Role.DEVELOPER },
        },
      });
    });

    it('lance NotFoundException si introuvable', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.deleteOwnAccount('x')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('refuse la suppression auto-service pour un compte admin', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'admin-1',
        role: Role.ADMIN,
      });
      await expect(service.deleteOwnAccount('admin-1')).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockPrisma.user.delete).not.toHaveBeenCalled();
    });
  });

  // ─── exportData ───────────────────────────────────────────────────────────

  describe('exportData', () => {
    it("exporte l'identité et le profil développeur", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'dev-1',
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        role: Role.DEVELOPER,
        createdAt: new Date('2026-01-01'),
      });
      mockPrisma.developerProfile.findUnique.mockResolvedValue({
        id: 'profile-1',
        firstName: 'Ada',
        lastName: 'Lovelace',
      });

      const result = await service.exportData('dev-1');

      expect(result.user).toEqual({
        id: 'dev-1',
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        role: Role.DEVELOPER,
        createdAt: new Date('2026-01-01'),
      });
      expect(result.profile).toEqual({
        id: 'profile-1',
        firstName: 'Ada',
        lastName: 'Lovelace',
      });
      expect(typeof result.exportedAt).toBe('string');
    });

    it('lance NotFoundException si introuvable', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.exportData('x')).rejects.toThrow(NotFoundException);
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
      mockPrisma.company.findUnique.mockResolvedValue(null);
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

    it('lance ConflictException si le SIRET est déjà utilisé par une autre entreprise', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u3',
        role: Role.DEVELOPER,
      });
      mockPrisma.recruiterProfile.findUnique.mockResolvedValue(null);
      mockPrisma.company.findUnique.mockResolvedValue({
        id: 'co-existing',
        name: 'Autre Entreprise',
        siret: '12345678901234',
      });

      await expect(
        service.promoteToRecruiter({
          userId: 'u3',
          companyName: 'Nouvelle Entreprise',
          companySiret: '12345678901234',
          firstName: 'Bob',
          lastName: 'Martin',
        }),
      ).rejects.toThrow(ConflictException);
      expect(mockPrisma.company.upsert).not.toHaveBeenCalled();
    });

    it("n'échoue pas si le SIRET appartient déjà à la même entreprise (mise à jour)", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u4',
        role: Role.DEVELOPER,
      });
      mockPrisma.recruiterProfile.findUnique.mockResolvedValue(null);
      mockPrisma.company.findUnique.mockResolvedValue({
        id: 'co-1',
        name: 'Acme',
        siret: '12345678901234',
      });

      await expect(
        service.promoteToRecruiter({
          userId: 'u4',
          companyName: 'Acme',
          companySiret: '12345678901234',
          firstName: 'Bob',
          lastName: 'Martin',
        }),
      ).resolves.toEqual({ ok: true, userId: 'u4' });
    });
  });
});
