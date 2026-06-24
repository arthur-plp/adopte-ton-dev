import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { RecruiterProfilesService } from './recruiter-profiles.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateRecruiterProfileDto } from '@repo/contracts';

const mockPrisma = {
  recruiterProfile: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  company: {
    upsert: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
  },
  $transaction: jest.fn(),
};

const baseCreateDto: CreateRecruiterProfileDto = {
  firstName: 'Bob',
  lastName: 'Rec',
  companyId: 'clxxxxxxxxxxxxxxxxxxxxxxxx',
};

describe('RecruiterProfilesService', () => {
  let service: RecruiterProfilesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecruiterProfilesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<RecruiterProfilesService>(RecruiterProfilesService);
    jest.clearAllMocks();
    mockPrisma.company.findUnique.mockResolvedValue(null);
  });

  // ─── create ───────────────────────────────────────────────────────────────

  describe('create', () => {
    it('crée et retourne un profil recruteur avec la company', async () => {
      const created = {
        id: 'rec-1',
        userId: 'user-1',
        ...baseCreateDto,
        company: { id: 'co-1', name: 'Acme' },
      };
      mockPrisma.recruiterProfile.create.mockResolvedValue(created);

      const result = await service.create('user-1', baseCreateDto);

      expect(result).toEqual(created);
      expect(mockPrisma.recruiterProfile.create).toHaveBeenCalledWith({
        data: { userId: 'user-1', ...baseCreateDto },
        include: { company: true },
      });
    });

    it('passe bien le userId lors de la création', async () => {
      mockPrisma.recruiterProfile.create.mockResolvedValue({
        id: 'rec-2',
        userId: 'user-2',
        ...baseCreateDto,
        company: {},
      });

      await service.create('user-2', baseCreateDto);

      expect(mockPrisma.recruiterProfile.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: 'user-2' }),
        }),
      );
    });
  });

  // ─── findByUserId ──────────────────────────────────────────────────────────

  describe('findByUserId', () => {
    it('retourne le profil recruteur avec sa company', async () => {
      const profile = {
        id: 'rec-1',
        userId: 'user-1',
        firstName: 'Bob',
        lastName: 'Rec',
        company: { id: 'co-1', name: 'Acme Corp' },
      };
      mockPrisma.recruiterProfile.findUnique.mockResolvedValue(profile);

      const result = await service.findByUserId('user-1');

      expect(result).toEqual(profile);
      expect(mockPrisma.recruiterProfile.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        include: { company: true },
      });
    });

    it('lance NotFoundException si profil introuvable', async () => {
      mockPrisma.recruiterProfile.findUnique.mockResolvedValue(null);

      await expect(service.findByUserId('user-inconnu')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findByUserId('user-inconnu')).rejects.toThrow(
        'Profil recruteur introuvable',
      );
    });
  });

  // ─── ensureOwnership ──────────────────────────────────────────────────────

  describe('ensureOwnership', () => {
    it('retourne le profil si le requesterId est le propriétaire', async () => {
      const profile = { id: 'rec-1', userId: 'user-1', ...baseCreateDto };
      mockPrisma.recruiterProfile.findUnique.mockResolvedValue(profile);

      const result = await service.ensureOwnership('user-1', 'user-1');

      expect(result).toEqual(profile);
    });

    it('lance NotFoundException si le profil est introuvable', async () => {
      mockPrisma.recruiterProfile.findUnique.mockResolvedValue(null);

      await expect(
        service.ensureOwnership('user-inconnu', 'user-inconnu'),
      ).rejects.toThrow(NotFoundException);
    });

    it('lance ForbiddenException si le requesterId est différent du userId', async () => {
      const profile = { id: 'rec-1', userId: 'user-1', ...baseCreateDto };
      mockPrisma.recruiterProfile.findUnique.mockResolvedValue(profile);

      await expect(
        service.ensureOwnership('user-1', 'attaquant-42'),
      ).rejects.toThrow(ForbiddenException);
    });

    it("ownership: ne retourne rien si attaquant tente d'accéder", async () => {
      mockPrisma.recruiterProfile.findUnique.mockResolvedValue({
        id: 'rec-1',
        userId: 'legitime',
        ...baseCreateDto,
      });

      await expect(
        service.ensureOwnership('legitime', 'imposteur'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── update ───────────────────────────────────────────────────────────────

  describe('update', () => {
    it('lance ForbiddenException si requesterId diffère du userId', async () => {
      await expect(
        service.update('user-1', 'attaquant-42', {}),
      ).rejects.toThrow(ForbiddenException);
    });

    it('propage companySiret vers Company quand le profil existe déjà', async () => {
      mockPrisma.recruiterProfile.findUnique.mockResolvedValue({
        id: 'rec-1',
        userId: 'user-1',
        companyId: 'co-1',
      });
      mockPrisma.recruiterProfile.update.mockReturnValue(
        Promise.resolve({ id: 'rec-1', userId: 'user-1' }),
      );
      mockPrisma.company.update.mockReturnValue(
        Promise.resolve({ id: 'co-1' }),
      );
      mockPrisma.$transaction.mockImplementation((ops: unknown) =>
        Promise.all(ops as Promise<unknown>[]),
      );

      await service.update('user-1', 'user-1', {
        companySiret: '12345678901234',
      });

      expect(mockPrisma.company.update).toHaveBeenCalledWith({
        where: { id: 'co-1' },
        data: { siret: '12345678901234' },
      });
    });

    it("n'appelle pas company.update si aucun champ entreprise n'est fourni", async () => {
      mockPrisma.recruiterProfile.findUnique.mockResolvedValue({
        id: 'rec-1',
        userId: 'user-1',
        companyId: 'co-1',
      });
      mockPrisma.recruiterProfile.update.mockReturnValue(
        Promise.resolve({ id: 'rec-1', userId: 'user-1' }),
      );
      mockPrisma.$transaction.mockImplementation((ops: unknown) =>
        Promise.all(ops as Promise<unknown>[]),
      );

      await service.update('user-1', 'user-1', { firstName: 'Alice' });

      expect(mockPrisma.company.update).not.toHaveBeenCalled();
    });

    it('crée la Company avec siret quand le profil recruteur est promu sans profil existant', async () => {
      mockPrisma.recruiterProfile.findUnique.mockResolvedValue(null);
      mockPrisma.$transaction.mockImplementation(
        async (callback: (tx: typeof mockPrisma) => Promise<unknown>) =>
          callback(mockPrisma),
      );
      mockPrisma.company.upsert.mockResolvedValue({ id: 'co-new' });
      mockPrisma.recruiterProfile.create.mockResolvedValue({
        id: 'rec-new',
        userId: 'user-2',
      });

      await service.update('user-2', 'user-2', {
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

    it('lance ConflictException si le SIRET appartient déjà à une autre entreprise (profil existant)', async () => {
      mockPrisma.recruiterProfile.findUnique.mockResolvedValue({
        id: 'rec-1',
        userId: 'user-1',
        companyId: 'co-1',
      });
      mockPrisma.company.findUnique.mockResolvedValue({
        id: 'co-autre',
        name: 'Autre Entreprise',
        siret: '12345678901234',
      });

      await expect(
        service.update('user-1', 'user-1', {
          companySiret: '12345678901234',
        }),
      ).rejects.toThrow(ConflictException);
      expect(mockPrisma.company.update).not.toHaveBeenCalled();
    });

    it('lance ConflictException si le SIRET appartient déjà à une autre entreprise (création)', async () => {
      mockPrisma.recruiterProfile.findUnique.mockResolvedValue(null);
      mockPrisma.company.findUnique.mockResolvedValue({
        id: 'co-autre',
        name: 'Autre Entreprise',
        siret: '12345678901234',
      });

      await expect(
        service.update('user-2', 'user-2', {
          companyName: 'Nouvelle Entreprise',
          companySiret: '12345678901234',
          firstName: 'Bob',
          lastName: 'Martin',
        }),
      ).rejects.toThrow(ConflictException);
      expect(mockPrisma.company.upsert).not.toHaveBeenCalled();
    });
  });
});
