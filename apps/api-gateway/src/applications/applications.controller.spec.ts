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
import { ForbiddenException, HttpException } from '@nestjs/common';
import { ApplicationsController } from './applications.controller';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { ApplicationStatus, Role } from '@repo/types';
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

const mockDeveloper: AuthenticatedUser = {
  id: 'dev-1',
  email: 'alice@test.com',
  name: 'Alice Dev',
  image: null,
  role: Role.DEVELOPER,
  onboarded: true,
  emailVerified: true,
};

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

function mockReq(user: AuthenticatedUser): AuthRequest {
  return { user } as AuthRequest;
}

const mockApplicationsClient = {
  send: jest.fn(),
};

const VALID_JOB_OFFER_ID = 'cjobid0000000000000001';

const baseApplication = {
  id: 'app-1',
  jobOfferId: 'job-1',
  developerId: 'dev-1',
  status: ApplicationStatus.SENT,
  coverLetter: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('ApplicationsController (api-gateway)', () => {
  let controller: ApplicationsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApplicationsController],
      providers: [
        { provide: 'APPLICATIONS_SVC', useValue: mockApplicationsClient },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ApplicationsController>(ApplicationsController);
    jest.clearAllMocks();
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('transmet la candidature au applications-svc', async () => {
      mockApplicationsClient.send.mockReturnValueOnce(of(baseApplication));

      const result = await controller.create(mockReq(mockDeveloper), {
        jobOfferId: VALID_JOB_OFFER_ID,
        coverLetter: 'Motivé !',
      });

      expect(mockApplicationsClient.send).toHaveBeenCalledWith(
        { cmd: 'application.create' },
        {
          developerId: 'dev-1',
          dto: { jobOfferId: VALID_JOB_OFFER_ID, coverLetter: 'Motivé !' },
        },
      );
      expect(result).toEqual(baseApplication);
    });

    it("lance ForbiddenException si l'email n'est pas vérifié", async () => {
      await expect(
        controller.create(mockReq({ ...mockDeveloper, emailVerified: false }), {
          jobOfferId: VALID_JOB_OFFER_ID,
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(mockApplicationsClient.send).not.toHaveBeenCalled();
    });

    it('lance HttpException 400 si payload invalide', async () => {
      await expect(
        controller.create(mockReq(mockDeveloper), { jobOfferId: '' } as never),
      ).rejects.toThrow(HttpException);
    });

    it('propage une HttpException 409 si candidature déjà existante', async () => {
      mockApplicationsClient.send.mockReturnValueOnce(
        throwError(() => ({
          statusCode: 409,
          message: 'Une candidature existe déjà pour cette offre.',
        })),
      );
      await expect(
        controller.create(mockReq(mockDeveloper), {
          jobOfferId: VALID_JOB_OFFER_ID,
        }),
      ).rejects.toThrow(HttpException);
    });
  });

  // ── findMine ──────────────────────────────────────────────────────────────

  describe('findMine', () => {
    it('retourne les candidatures du développeur connecté', async () => {
      mockApplicationsClient.send.mockReturnValueOnce(of([baseApplication]));
      const result = await controller.findMine(mockReq(mockDeveloper));
      expect(mockApplicationsClient.send).toHaveBeenCalledWith(
        { cmd: 'application.findMine' },
        { developerId: 'dev-1' },
      );
      expect(result).toHaveLength(1);
    });
  });

  // ── withdraw ──────────────────────────────────────────────────────────────

  describe('withdraw', () => {
    it('retire la candidature', async () => {
      const withdrawn = {
        ...baseApplication,
        status: ApplicationStatus.WITHDRAWN,
      };
      mockApplicationsClient.send.mockReturnValueOnce(of(withdrawn));
      const result = await controller.withdraw(mockReq(mockDeveloper), 'app-1');
      expect(mockApplicationsClient.send).toHaveBeenCalledWith(
        { cmd: 'application.withdraw' },
        { id: 'app-1', developerId: 'dev-1' },
      );
      expect(result.status).toBe(ApplicationStatus.WITHDRAWN);
    });

    it('propage une HttpException 403 si pas propriétaire', async () => {
      mockApplicationsClient.send.mockReturnValueOnce(
        throwError(() => ({ statusCode: 403, message: 'Accès refusé' })),
      );
      await expect(
        controller.withdraw(mockReq(mockDeveloper), 'app-1'),
      ).rejects.toThrow(HttpException);
    });
  });

  // ── reactivate ───────────────────────────────────────────────────────────

  describe('reactivate', () => {
    it('réactive (repasse en SENT) la candidature', async () => {
      const reactivated = {
        ...baseApplication,
        status: ApplicationStatus.SENT,
      };
      mockApplicationsClient.send.mockReturnValueOnce(of(reactivated));
      const result = await controller.reactivate(
        mockReq(mockDeveloper),
        'app-1',
      );
      expect(mockApplicationsClient.send).toHaveBeenCalledWith(
        { cmd: 'application.reactivate' },
        { id: 'app-1', developerId: 'dev-1' },
      );
      expect(result.status).toBe(ApplicationStatus.SENT);
    });

    it("propage une HttpException 400 si l'offre n'est plus publiée", async () => {
      mockApplicationsClient.send.mockReturnValueOnce(
        throwError(() => ({
          statusCode: 400,
          message: "Cette offre n'est plus disponible.",
        })),
      );
      await expect(
        controller.reactivate(mockReq(mockDeveloper), 'app-1'),
      ).rejects.toThrow(HttpException);
    });
  });

  // ── findByJobOffer ────────────────────────────────────────────────────────

  describe('findByJobOffer', () => {
    it("retourne les candidatures de l'offre pour le recruteur propriétaire", async () => {
      mockApplicationsClient.send.mockReturnValueOnce(of([baseApplication]));
      const result = await controller.findByJobOffer(
        mockReq(mockRecruiter),
        'job-1',
      );
      expect(mockApplicationsClient.send).toHaveBeenCalledWith(
        { cmd: 'application.findByJobOffer' },
        { jobOfferId: 'job-1', recruiterId: 'recruiter-1' },
      );
      expect(result).toHaveLength(1);
    });

    it('propage une HttpException 403 si pas propriétaire de l’offre', async () => {
      mockApplicationsClient.send.mockReturnValueOnce(
        throwError(() => ({ statusCode: 403, message: 'Accès refusé' })),
      );
      await expect(
        controller.findByJobOffer(mockReq(mockRecruiter), 'job-1'),
      ).rejects.toThrow(HttpException);
    });
  });

  // ── updateStatus ──────────────────────────────────────────────────────────

  describe('updateStatus', () => {
    it('transmet le changement de statut au applications-svc', async () => {
      const updated = {
        ...baseApplication,
        status: ApplicationStatus.INTERVIEW,
      };
      mockApplicationsClient.send.mockReturnValueOnce(of(updated));

      const result = await controller.updateStatus(
        mockReq(mockRecruiter),
        'app-1',
        { status: ApplicationStatus.INTERVIEW },
      );

      expect(mockApplicationsClient.send).toHaveBeenCalledWith(
        { cmd: 'application.updateStatus' },
        {
          id: 'app-1',
          recruiterId: 'recruiter-1',
          dto: { status: ApplicationStatus.INTERVIEW },
        },
      );
      expect(result.status).toBe(ApplicationStatus.INTERVIEW);
    });

    it('lance HttpException 400 si payload invalide', async () => {
      await expect(
        controller.updateStatus(mockReq(mockRecruiter), 'app-1', {
          status: 'NOT_A_STATUS',
        } as never),
      ).rejects.toThrow(HttpException);
    });

    it('propage une HttpException 400 si statut déjà définitif', async () => {
      mockApplicationsClient.send.mockReturnValueOnce(
        throwError(() => ({
          statusCode: 400,
          message: 'Cette candidature est déjà dans un état définitif.',
        })),
      );
      await expect(
        controller.updateStatus(mockReq(mockRecruiter), 'app-1', {
          status: ApplicationStatus.REJECTED,
        }),
      ).rejects.toThrow(HttpException);
    });
  });

  // ── getHistory ────────────────────────────────────────────────────────────

  describe('getHistory', () => {
    it('transmet requesterId et requesterRole=DEVELOPER au applications-svc', async () => {
      mockApplicationsClient.send.mockReturnValueOnce(of([]));
      await controller.getHistory(mockReq(mockDeveloper), 'app-1');
      expect(mockApplicationsClient.send).toHaveBeenCalledWith(
        { cmd: 'application.getHistory' },
        {
          id: 'app-1',
          requesterId: 'dev-1',
          requesterRole: Role.DEVELOPER,
          isAdmin: false,
        },
      );
    });

    it('transmet requesterRole=RECRUITER au applications-svc', async () => {
      mockApplicationsClient.send.mockReturnValueOnce(of([]));
      await controller.getHistory(mockReq(mockRecruiter), 'app-1');
      expect(mockApplicationsClient.send).toHaveBeenCalledWith(
        { cmd: 'application.getHistory' },
        {
          id: 'app-1',
          requesterId: 'recruiter-1',
          requesterRole: Role.RECRUITER,
          isAdmin: false,
        },
      );
    });

    it('propage une HttpException 403 si ni développeur ni recruteur propriétaire', async () => {
      mockApplicationsClient.send.mockReturnValueOnce(
        throwError(() => ({ statusCode: 403, message: 'Accès refusé' })),
      );
      await expect(
        controller.getHistory(mockReq(mockDeveloper), 'app-1'),
      ).rejects.toThrow(HttpException);
    });
  });

  // ── createDocumentRequest ────────────────────────────────────────────────

  describe('createDocumentRequest', () => {
    it('transmet applicationId, requesterId, requesterRole=RECRUITER et dto au applications-svc', async () => {
      mockApplicationsClient.send.mockReturnValueOnce(
        of({ id: 'req-1', label: 'CV' }),
      );
      const result = await controller.createDocumentRequest(
        mockReq(mockRecruiter),
        'app-1',
        { label: 'CV' },
      );
      expect(mockApplicationsClient.send).toHaveBeenCalledWith(
        { cmd: 'application.documentRequest.create' },
        {
          applicationId: 'app-1',
          requesterId: 'recruiter-1',
          requesterRole: Role.RECRUITER,
          dto: { label: 'CV' },
        },
      );
      expect(result).toEqual({ id: 'req-1', label: 'CV' });
    });

    it('transmet requesterRole=DEVELOPER quand le développeur joint son propre document', async () => {
      mockApplicationsClient.send.mockReturnValueOnce(
        of({ id: 'req-2', label: 'Portfolio', source: 'DEVELOPER' }),
      );
      await controller.createDocumentRequest(mockReq(mockDeveloper), 'app-1', {
        label: 'Portfolio',
      });
      expect(mockApplicationsClient.send).toHaveBeenCalledWith(
        { cmd: 'application.documentRequest.create' },
        {
          applicationId: 'app-1',
          requesterId: 'dev-1',
          requesterRole: Role.DEVELOPER,
          dto: { label: 'Portfolio' },
        },
      );
    });

    it('lance HttpException 400 si le label est vide', async () => {
      await expect(
        controller.createDocumentRequest(mockReq(mockRecruiter), 'app-1', {
          label: '',
        }),
      ).rejects.toThrow(HttpException);
    });

    it('propage une HttpException 403 si pas propriétaire de l’offre', async () => {
      mockApplicationsClient.send.mockReturnValueOnce(
        throwError(() => ({ statusCode: 403, message: 'Accès refusé' })),
      );
      await expect(
        controller.createDocumentRequest(mockReq(mockRecruiter), 'app-1', {
          label: 'CV',
        }),
      ).rejects.toThrow(HttpException);
    });
  });

  // ── listDocumentRequests ─────────────────────────────────────────────────

  describe('listDocumentRequests', () => {
    it('transmet requesterId et requesterRole=DEVELOPER au applications-svc', async () => {
      mockApplicationsClient.send.mockReturnValueOnce(of([]));
      await controller.listDocumentRequests(mockReq(mockDeveloper), 'app-1');
      expect(mockApplicationsClient.send).toHaveBeenCalledWith(
        { cmd: 'application.documentRequest.list' },
        {
          applicationId: 'app-1',
          requesterId: 'dev-1',
          requesterRole: Role.DEVELOPER,
        },
      );
    });
  });

  // ── createUploadUrl ──────────────────────────────────────────────────────

  describe('createUploadUrl', () => {
    it('transmet requestId, developerId et dto au applications-svc', async () => {
      mockApplicationsClient.send.mockReturnValueOnce(
        of({ uploadUrl: 'https://s3.example.com', fields: {}, fileKey: 'key' }),
      );
      const result = await controller.createUploadUrl(
        mockReq(mockDeveloper),
        'req-1',
        { fileName: 'cv.pdf', contentType: 'application/pdf', fileSize: 1024 },
      );
      expect(mockApplicationsClient.send).toHaveBeenCalledWith(
        { cmd: 'application.documentRequest.createUploadUrl' },
        {
          requestId: 'req-1',
          developerId: 'dev-1',
          dto: {
            fileName: 'cv.pdf',
            contentType: 'application/pdf',
            fileSize: 1024,
          },
        },
      );
      expect(result).toEqual({
        uploadUrl: 'https://s3.example.com',
        fields: {},
        fileKey: 'key',
      });
    });

    it('lance HttpException 400 si fileName est vide', async () => {
      await expect(
        controller.createUploadUrl(mockReq(mockDeveloper), 'req-1', {
          fileName: '',
          contentType: 'application/pdf',
          fileSize: 1024,
        }),
      ).rejects.toThrow(HttpException);
    });

    it('lance HttpException 400 si contentType non autorisé (ex. text/html)', async () => {
      await expect(
        controller.createUploadUrl(mockReq(mockDeveloper), 'req-1', {
          fileName: 'fichier.html',
          contentType: 'text/html',
          fileSize: 1024,
        }),
      ).rejects.toThrow(HttpException);
    });

    it('lance HttpException 400 si fileSize dépasse la limite', async () => {
      await expect(
        controller.createUploadUrl(mockReq(mockDeveloper), 'req-1', {
          fileName: 'cv.pdf',
          contentType: 'application/pdf',
          fileSize: 10 * 1024 * 1024 + 1,
        }),
      ).rejects.toThrow(HttpException);
    });

    it('lance HttpException 400 si fileSize est absent', async () => {
      await expect(
        controller.createUploadUrl(mockReq(mockDeveloper), 'req-1', {
          fileName: 'cv.pdf',
          contentType: 'application/pdf',
        } as never),
      ).rejects.toThrow(HttpException);
    });
  });

  // ── confirmUpload ────────────────────────────────────────────────────────

  describe('confirmUpload', () => {
    it('transmet requestId, developerId et dto au applications-svc', async () => {
      mockApplicationsClient.send.mockReturnValueOnce(
        of({ status: 'FULFILLED' }),
      );
      const result = await controller.confirmUpload(
        mockReq(mockDeveloper),
        'req-1',
        { fileKey: 'key', fileName: 'cv.pdf' },
      );
      expect(mockApplicationsClient.send).toHaveBeenCalledWith(
        { cmd: 'application.documentRequest.confirmUpload' },
        {
          requestId: 'req-1',
          developerId: 'dev-1',
          dto: { fileKey: 'key', fileName: 'cv.pdf' },
        },
      );
      expect(result).toEqual({ status: 'FULFILLED' });
    });

    it('lance HttpException 400 si fileKey est absent', async () => {
      await expect(
        controller.confirmUpload(mockReq(mockDeveloper), 'req-1', {
          fileName: 'cv.pdf',
        } as never),
      ).rejects.toThrow(HttpException);
    });
  });

  // ── getDownloadUrl ───────────────────────────────────────────────────────

  describe('getDownloadUrl', () => {
    it('transmet requestId, requesterId, requesterRole et disposition=attachment par défaut', async () => {
      mockApplicationsClient.send.mockReturnValueOnce(
        of({ downloadUrl: 'https://s3.example.com', fileName: 'cv.pdf' }),
      );
      const result = await controller.getDownloadUrl(
        mockReq(mockRecruiter),
        'req-1',
      );
      expect(mockApplicationsClient.send).toHaveBeenCalledWith(
        { cmd: 'application.documentRequest.downloadUrl' },
        {
          requestId: 'req-1',
          requesterId: 'recruiter-1',
          requesterRole: Role.RECRUITER,
          disposition: 'attachment',
        },
      );
      expect(result).toEqual({
        downloadUrl: 'https://s3.example.com',
        fileName: 'cv.pdf',
      });
    });

    it('transmet disposition=inline pour un aperçu', async () => {
      mockApplicationsClient.send.mockReturnValueOnce(
        of({ downloadUrl: 'https://s3.example.com', fileName: 'cv.pdf' }),
      );
      await controller.getDownloadUrl(
        mockReq(mockRecruiter),
        'req-1',
        'inline',
      );
      expect(mockApplicationsClient.send).toHaveBeenCalledWith(
        { cmd: 'application.documentRequest.downloadUrl' },
        expect.objectContaining({ disposition: 'inline' }),
      );
    });

    it('propage une HttpException 400 si aucun fichier déposé', async () => {
      mockApplicationsClient.send.mockReturnValueOnce(
        throwError(() => ({ statusCode: 400, message: 'Aucun fichier' })),
      );
      await expect(
        controller.getDownloadUrl(mockReq(mockDeveloper), 'req-1'),
      ).rejects.toThrow(HttpException);
    });
  });

  // ── deleteDocument ───────────────────────────────────────────────────────

  describe('deleteDocument', () => {
    it('transmet requestId et developerId au applications-svc', async () => {
      mockApplicationsClient.send.mockReturnValueOnce(
        of({ removed: true, requestId: 'req-1' }),
      );
      const result = await controller.deleteDocument(
        mockReq(mockDeveloper),
        'req-1',
      );
      expect(mockApplicationsClient.send).toHaveBeenCalledWith(
        { cmd: 'application.documentRequest.delete' },
        { requestId: 'req-1', developerId: 'dev-1' },
      );
      expect(result).toEqual({ removed: true, requestId: 'req-1' });
    });

    it('propage une HttpException 403 si le développeur n’est pas propriétaire', async () => {
      mockApplicationsClient.send.mockReturnValueOnce(
        throwError(() => ({ statusCode: 403, message: 'Accès refusé' })),
      );
      await expect(
        controller.deleteDocument(mockReq(mockDeveloper), 'req-1'),
      ).rejects.toThrow(HttpException);
    });
  });
});
