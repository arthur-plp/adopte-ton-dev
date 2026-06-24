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
import { ConfigService } from '@nestjs/config';
import { JobOffersController } from './job-offers.controller';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { JobStatus, JobType, Role } from '@repo/types';
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

const mockRecruiter: AuthenticatedUser = {
  id: 'recruiter-1',
  email: 'recruiter@test.com',
  name: 'Bob Recruteur',
  image: null,
  role: Role.RECRUITER,
  onboarded: true,
  emailVerified: true,
  companyId: 'company-1',
};

function mockReq(user: AuthenticatedUser = mockRecruiter): AuthRequest {
  return { user } as AuthRequest;
}

const mockJobsClient = {
  send: jest.fn(),
};

const mockUsersClient = {
  send: jest
    .fn()
    .mockReturnValue({ pipe: jest.fn().mockReturnValue({ profile: null }) }),
};

const baseOffer = {
  id: 'job-1',
  companyId: 'company-1',
  recruiterId: 'recruiter-1',
  title: 'Développeur TS',
  description: 'Description du poste',
  type: JobType.INTERNSHIP,
  status: JobStatus.DRAFT,
  isPublic: true,
  location: null,
  remoteOk: false,
  requiredTechnologies: ['TypeScript'],
  salaryMin: null,
  salaryMax: null,
  createdAt: new Date().toISOString(),
  publishedAt: null,
  updatedAt: new Date().toISOString(),
};

describe('JobOffersController (api-gateway)', () => {
  let controller: JobOffersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [JobOffersController],
      providers: [
        { provide: 'JOBS_SVC', useValue: mockJobsClient },
        { provide: 'USERS_SVC', useValue: mockUsersClient },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((_key: string, d: string) => d),
          },
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<JobOffersController>(JobOffersController);
    jest.clearAllMocks();
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    it("transmet la création au jobs-svc et retourne l'offre", async () => {
      mockJobsClient.send.mockReturnValueOnce(of(baseOffer));

      const result = await controller.create(mockReq(), {
        title: 'Développeur TS',
        description: 'Description du poste',
        type: JobType.INTERNSHIP,
        remoteOk: false,
        requiredTechnologies: [],
        isPublic: true,
      });

      expect(mockJobsClient.send).toHaveBeenCalledWith(
        { cmd: 'job.create' },
        expect.objectContaining({
          recruiterId: 'recruiter-1',
          companyId: 'company-1',
        }),
      );
      expect(result).toEqual(baseOffer);
    });

    it('lance HttpException 400 si payload invalide', async () => {
      await expect(
        controller.create(mockReq(), { title: '' } as never),
      ).rejects.toThrow(HttpException);
    });
  });

  // ── findMine ──────────────────────────────────────────────────────────────

  describe('findMine', () => {
    it('retourne les offres du recruteur connecté', async () => {
      mockJobsClient.send.mockReturnValueOnce(of([baseOffer]));
      const result = await controller.findMine(mockReq());
      expect(mockJobsClient.send).toHaveBeenCalledWith(
        { cmd: 'job.findMine' },
        { recruiterId: 'recruiter-1' },
      );
      expect(result).toHaveLength(1);
    });
  });

  // ── findPublished ─────────────────────────────────────────────────────────

  describe('findPublished', () => {
    it('retourne une liste paginée', async () => {
      const paginated = { data: [baseOffer], total: 1, page: 1, pageSize: 20 };
      mockJobsClient.send.mockReturnValueOnce(of(paginated));

      const result = await controller.findPublished({}, '1', '20');

      expect(mockJobsClient.send).toHaveBeenCalledWith(
        { cmd: 'job.findPublished' },
        expect.objectContaining({ page: 1, pageSize: 20 }),
      );
      expect(result.total).toBe(1);
    });
  });

  // ── findOne ───────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('retourne une offre par id (publicOnly=false si authentifié)', async () => {
      mockJobsClient.send.mockReturnValueOnce(of(baseOffer));
      const req = mockReq() as unknown as import('express').Request;
      const result = await controller.findOne(req, 'job-1');
      expect(mockJobsClient.send).toHaveBeenCalledWith(
        { cmd: 'job.findOne' },
        { id: 'job-1', publicOnly: false },
      );
      expect(result).toEqual(baseOffer);
    });

    it('propage une HttpException 404 depuis jobs-svc', async () => {
      mockJobsClient.send.mockReturnValueOnce(
        throwError(() => ({ statusCode: 404, message: 'Offre introuvable' })),
      );
      const req = mockReq() as unknown as import('express').Request;
      await expect(controller.findOne(req, 'unknown')).rejects.toThrow(
        HttpException,
      );
    });
  });

  // ── update ────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('transmet la mise à jour au jobs-svc', async () => {
      const updated = { ...baseOffer, title: 'Nouveau titre' };
      mockJobsClient.send.mockReturnValueOnce(of(updated));

      const result = await controller.update(mockReq(), 'job-1', {
        title: 'Nouveau titre',
      });

      expect(mockJobsClient.send).toHaveBeenCalledWith(
        { cmd: 'job.update' },
        expect.objectContaining({ id: 'job-1', recruiterId: 'recruiter-1' }),
      );
      expect(result.title).toBe('Nouveau titre');
    });

    it('propage une HttpException 400 si offre PUBLISHED', async () => {
      mockJobsClient.send.mockReturnValueOnce(
        throwError(() => ({ statusCode: 400, message: 'Offre publiée' })),
      );
      await expect(
        controller.update(mockReq(), 'job-1', { title: 'x' }),
      ).rejects.toThrow(HttpException);
    });
  });

  // ── publish ───────────────────────────────────────────────────────────────

  describe('publish', () => {
    it("publie l'offre", async () => {
      const published = { ...baseOffer, status: JobStatus.PUBLISHED };
      mockJobsClient.send.mockReturnValueOnce(of(published));

      const result = await controller.publish(mockReq(), 'job-1');

      expect(mockJobsClient.send).toHaveBeenCalledWith(
        { cmd: 'job.publish' },
        { id: 'job-1', recruiterId: 'recruiter-1' },
      );
      expect(result.status).toBe(JobStatus.PUBLISHED);
    });

    it('propage une HttpException 402 si quota atteint', async () => {
      mockJobsClient.send.mockReturnValueOnce(
        throwError(() => ({ statusCode: 402, message: 'Quota atteint' })),
      );
      await expect(controller.publish(mockReq(), 'job-1')).rejects.toThrow(
        HttpException,
      );
    });
  });

  // ── goLive ────────────────────────────────────────────────────────────────

  describe('goLive', () => {
    it("publie l'offre approuvée", async () => {
      const published = { ...baseOffer, status: JobStatus.PUBLISHED };
      mockJobsClient.send.mockReturnValueOnce(of(published));

      const result = await controller.goLive(mockReq(), 'job-1');

      expect(mockJobsClient.send).toHaveBeenCalledWith(
        { cmd: 'job.goLive' },
        { id: 'job-1', recruiterId: 'recruiter-1' },
      );
      expect(result.status).toBe(JobStatus.PUBLISHED);
    });

    it('propage une HttpException 402 si quota atteint', async () => {
      mockJobsClient.send.mockReturnValueOnce(
        throwError(() => ({ statusCode: 402, message: 'Quota atteint' })),
      );
      await expect(controller.goLive(mockReq(), 'job-1')).rejects.toThrow(
        HttpException,
      );
    });
  });

  // ── archive ───────────────────────────────────────────────────────────────

  describe('archive', () => {
    it("archive l'offre", async () => {
      const archived = { ...baseOffer, status: JobStatus.ARCHIVED };
      mockJobsClient.send.mockReturnValueOnce(of(archived));

      const result = await controller.archive(mockReq(), 'job-1');

      expect(mockJobsClient.send).toHaveBeenCalledWith(
        { cmd: 'job.archive' },
        { id: 'job-1', recruiterId: 'recruiter-1' },
      );
      expect(result.status).toBe(JobStatus.ARCHIVED);
    });

    it('propage une HttpException 403 si pas propriétaire', async () => {
      mockJobsClient.send.mockReturnValueOnce(
        throwError(() => ({ statusCode: 403, message: 'Accès refusé' })),
      );
      await expect(
        controller.archive(mockReq({ ...mockRecruiter, id: 'autre' }), 'job-1'),
      ).rejects.toThrow(HttpException);
    });
  });

  // ── unarchive ─────────────────────────────────────────────────────────────

  describe('unarchive', () => {
    it("désarchive l'offre (repassée en brouillon)", async () => {
      const draft = { ...baseOffer, status: JobStatus.DRAFT };
      mockJobsClient.send.mockReturnValueOnce(of(draft));

      const result = await controller.unarchive(mockReq(), 'job-1');

      expect(mockJobsClient.send).toHaveBeenCalledWith(
        { cmd: 'job.unarchive' },
        { id: 'job-1', recruiterId: 'recruiter-1' },
      );
      expect(result.status).toBe(JobStatus.DRAFT);
    });

    it('propage une HttpException 400 si offre pas archivée', async () => {
      mockJobsClient.send.mockReturnValueOnce(
        throwError(() => ({ statusCode: 400, message: 'Offre pas archivée' })),
      );
      await expect(controller.unarchive(mockReq(), 'job-1')).rejects.toThrow(
        HttpException,
      );
    });
  });

  // ── dev access (findOne public) ───────────────────────────────────────────

  describe('accès développeur', () => {
    it('un dev peut consulter une offre publiée (publicOnly=false si authentifié)', async () => {
      const published = { ...baseOffer, status: JobStatus.PUBLISHED };
      mockJobsClient.send.mockReturnValueOnce(of(published));
      const req = mockReq() as unknown as import('express').Request;
      const result = await controller.findOne(req, 'job-1');
      expect(result.status).toBe(JobStatus.PUBLISHED);
    });
  });

  // ── getHistory ────────────────────────────────────────────────────────────

  describe('getHistory', () => {
    it('transmet requesterId et isAdmin=false au jobs-svc', async () => {
      mockJobsClient.send.mockReturnValueOnce(of([]));

      await controller.getHistory(mockReq(), 'job-1');

      expect(mockJobsClient.send).toHaveBeenCalledWith(
        { cmd: 'job.getHistory' },
        { id: 'job-1', requesterId: 'recruiter-1', isAdmin: false },
      );
    });

    it('propage une HttpException 403 si pas propriétaire', async () => {
      mockJobsClient.send.mockReturnValueOnce(
        throwError(() => ({ statusCode: 403, message: 'Accès refusé' })),
      );
      await expect(
        controller.getHistory(
          mockReq({ ...mockRecruiter, id: 'autre' }),
          'job-1',
        ),
      ).rejects.toThrow(HttpException);
    });
  });
});
