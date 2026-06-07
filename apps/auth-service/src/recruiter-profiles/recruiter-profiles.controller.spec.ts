import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { RecruiterProfilesController } from './recruiter-profiles.controller';
import { RecruiterProfilesService } from './recruiter-profiles.service';
import type { CreateRecruiterProfileDto } from '@repo/contracts';

const validCuid = 'clxxxxxxxxxxxxxxxxxxxxxxxx';

const mockService = {
  create: jest.fn(),
  findByUserId: jest.fn(),
};

describe('RecruiterProfilesController', () => {
  let controller: RecruiterProfilesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RecruiterProfilesController],
      providers: [{ provide: RecruiterProfilesService, useValue: mockService }],
    }).compile();

    controller = module.get<RecruiterProfilesController>(RecruiterProfilesController);
    jest.clearAllMocks();
  });

  const baseDto: CreateRecruiterProfileDto = {
    firstName: 'Bob',
    lastName: 'Rec',
    companyId: validCuid,
  };

  // ─── POST / ───────────────────────────────────────────────────────────────

  describe('create', () => {
    it('parse le DTO et délègue au service', async () => {
      const created = {
        id: 'rec-1',
        userId: 'user-1',
        ...baseDto,
        company: { id: 'co-1', name: 'Acme' },
      };
      mockService.create.mockResolvedValue(created);

      const result = await controller.create({ userId: 'user-1', data: baseDto });

      expect(result).toEqual(created);
      expect(mockService.create).toHaveBeenCalledWith('user-1', baseDto);
    });

    it('lance une erreur Zod si firstName est vide', () => {
      expect(() =>
        controller.create({
          userId: 'user-1',
          data: { ...baseDto, firstName: '' },
        }),
      ).toThrow();
      expect(mockService.create).not.toHaveBeenCalled();
    });

    it('lance une erreur Zod si companyId est invalide (non-cuid)', () => {
      expect(() =>
        controller.create({
          userId: 'user-1',
          data: { ...baseDto, companyId: 'pas-un-cuid' },
        }),
      ).toThrow();
    });
  });

  // ─── GET /:userId ─────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('retourne le profil recruteur avec company', async () => {
      const profile = {
        id: 'rec-1',
        userId: 'user-1',
        ...baseDto,
        company: { id: 'co-1', name: 'Acme Corp' },
      };
      mockService.findByUserId.mockResolvedValue(profile);

      const result = await controller.findOne('user-1');

      expect(result).toEqual(profile);
      expect(mockService.findByUserId).toHaveBeenCalledWith('user-1');
    });

    it('propage NotFoundException si profil introuvable', async () => {
      mockService.findByUserId.mockRejectedValue(
        new NotFoundException('Profil recruteur introuvable'),
      );

      await expect(controller.findOne('user-inconnu')).rejects.toThrow(NotFoundException);
    });
  });
});
