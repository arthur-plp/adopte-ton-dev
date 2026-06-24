import { Test, TestingModule } from "@nestjs/testing";
import { RpcException } from "@nestjs/microservices";
import { of, throwError } from "rxjs";
import { ApplicationsService } from "./applications.service";
import { PrismaService } from "../prisma/prisma.service";
import { S3Service } from "../documents/s3.service";
import { ApplicationStatus, InterviewMode, JobStatus } from "@repo/types";

const mockPrisma = {
  application: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    count: jest.fn(),
  },
  applicationEvent: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  documentRequest: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  outboxEvent: { create: jest.fn() },
  $transaction: jest.fn(),
};

const mockJobsClient = {
  send: jest.fn(),
};

const mockS3Service = {
  createUploadPost: jest.fn(),
  createDownloadUrl: jest.fn(),
  deleteObject: jest.fn(),
};

const baseOffer = {
  id: "job-1",
  recruiterId: "recruiter-1",
  status: JobStatus.PUBLISHED,
};

const baseApplication = {
  id: "app-1",
  jobOfferId: "job-1",
  developerId: "dev-1",
  status: ApplicationStatus.SENT,
  coverLetter: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("ApplicationsService", () => {
  let service: ApplicationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApplicationsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: "JOBS_SVC", useValue: mockJobsClient },
        { provide: S3Service, useValue: mockS3Service },
      ],
    }).compile();
    service = module.get<ApplicationsService>(ApplicationsService);
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(
      (callback: (tx: typeof mockPrisma) => Promise<unknown>) =>
        callback(mockPrisma),
    );
  });

  // ── create ───────────────────────────────────────────────────────────────

  describe("create", () => {
    it("crée une candidature SENT si l'offre est publiée et sans doublon", async () => {
      mockJobsClient.send.mockReturnValueOnce(of(baseOffer));
      mockPrisma.application.findUnique.mockResolvedValueOnce(null);
      mockPrisma.application.create.mockResolvedValueOnce(baseApplication);

      const result = await service.create("dev-1", {
        jobOfferId: "job-1",
        coverLetter: "Motivé !",
      });

      expect(result.status).toBe(ApplicationStatus.SENT);
      expect(mockPrisma.application.create).toHaveBeenCalledWith({
        data: {
          jobOfferId: "job-1",
          developerId: "dev-1",
          coverLetter: "Motivé !",
        },
      });
    });

    it("écrit un ApplicationEvent SENT avec actorRole DEVELOPER", async () => {
      mockJobsClient.send.mockReturnValueOnce(of(baseOffer));
      mockPrisma.application.findUnique.mockResolvedValueOnce(null);
      mockPrisma.application.create.mockResolvedValueOnce(baseApplication);

      await service.create("dev-1", { jobOfferId: "job-1" });

      expect(mockPrisma.applicationEvent.create).toHaveBeenCalledWith({
        data: {
          applicationId: "app-1",
          status: ApplicationStatus.SENT,
          actorRole: "DEVELOPER",
          actorId: "dev-1",
          note: null,
        },
      });
    });

    it("émet un OutboxEvent application.created", async () => {
      mockJobsClient.send.mockReturnValueOnce(of(baseOffer));
      mockPrisma.application.findUnique.mockResolvedValueOnce(null);
      mockPrisma.application.create.mockResolvedValueOnce(baseApplication);

      await service.create("dev-1", { jobOfferId: "job-1" });

      expect(mockPrisma.outboxEvent.create).toHaveBeenCalledWith({
        data: {
          type: "application.created",
          payload: {
            applicationId: "app-1",
            jobOfferId: "job-1",
            developerId: "dev-1",
            recruiterId: "recruiter-1",
          },
        },
      });
    });

    it("lance RpcException 404 si l'offre est introuvable", async () => {
      mockJobsClient.send.mockReturnValueOnce(
        throwError(() => ({ statusCode: 404, message: "Offre introuvable" })),
      );
      await expect(
        service.create("dev-1", { jobOfferId: "unknown" }),
      ).rejects.toThrow(RpcException);
    });

    it("lance RpcException 400 si l'offre n'est pas PUBLISHED", async () => {
      mockJobsClient.send.mockReturnValueOnce(
        of({ ...baseOffer, status: JobStatus.DRAFT }),
      );
      await expect(
        service.create("dev-1", { jobOfferId: "job-1" }),
      ).rejects.toThrow(RpcException);
    });

    it("lance RpcException 409 si une candidature existe déjà pour cette offre", async () => {
      mockJobsClient.send.mockReturnValueOnce(of(baseOffer));
      mockPrisma.application.findUnique.mockResolvedValueOnce(baseApplication);
      await expect(
        service.create("dev-1", { jobOfferId: "job-1" }),
      ).rejects.toThrow(RpcException);
    });

    it("lance RpcException 409 même si la candidature précédente a été retirée", async () => {
      mockJobsClient.send.mockReturnValueOnce(of(baseOffer));
      mockPrisma.application.findUnique.mockResolvedValueOnce({
        ...baseApplication,
        status: ApplicationStatus.WITHDRAWN,
      });
      await expect(
        service.create("dev-1", { jobOfferId: "job-1" }),
      ).rejects.toThrow(RpcException);
    });
  });

  // ── findMine ─────────────────────────────────────────────────────────────

  describe("findMine", () => {
    it("retourne les candidatures du développeur triées par date", async () => {
      mockPrisma.application.findMany.mockResolvedValueOnce([baseApplication]);
      const result = await service.findMine("dev-1");
      expect(result).toHaveLength(1);
      expect(mockPrisma.application.findMany).toHaveBeenCalledWith({
        where: { developerId: "dev-1" },
        orderBy: { createdAt: "desc" },
      });
    });
  });

  // ── findByJobOffer ───────────────────────────────────────────────────────

  describe("findByJobOffer", () => {
    it("retourne les candidatures si le recruteur est propriétaire de l'offre", async () => {
      mockJobsClient.send.mockReturnValueOnce(of(baseOffer));
      mockPrisma.application.findMany.mockResolvedValueOnce([baseApplication]);
      mockPrisma.application.updateMany.mockResolvedValueOnce({ count: 1 });

      const result = await service.findByJobOffer("job-1", "recruiter-1");

      expect(result).toHaveLength(1);
    });

    it("marque automatiquement les candidatures SENT comme VIEWED", async () => {
      mockJobsClient.send.mockReturnValueOnce(of(baseOffer));
      mockPrisma.application.findMany.mockResolvedValueOnce([baseApplication]);
      mockPrisma.application.updateMany.mockResolvedValueOnce({ count: 1 });

      await service.findByJobOffer("job-1", "recruiter-1");

      expect(mockPrisma.application.updateMany).toHaveBeenCalledWith({
        where: { jobOfferId: "job-1", status: ApplicationStatus.SENT },
        data: { status: ApplicationStatus.VIEWED },
      });
      expect(mockPrisma.applicationEvent.create).toHaveBeenCalledWith({
        data: {
          applicationId: "app-1",
          status: ApplicationStatus.VIEWED,
          actorRole: "RECRUITER",
          actorId: "recruiter-1",
          note: null,
        },
      });
    });

    it("lance RpcException 403 si le recruteur n'est pas propriétaire de l'offre", async () => {
      mockJobsClient.send.mockReturnValueOnce(of(baseOffer));
      await expect(
        service.findByJobOffer("job-1", "autre-recruteur"),
      ).rejects.toThrow(RpcException);
    });

    it("lance RpcException 404 si l'offre est introuvable", async () => {
      mockJobsClient.send.mockReturnValueOnce(
        throwError(() => ({ statusCode: 404, message: "Offre introuvable" })),
      );
      await expect(
        service.findByJobOffer("unknown", "recruiter-1"),
      ).rejects.toThrow(RpcException);
    });
  });

  // ── updateStatus ─────────────────────────────────────────────────────────

  describe("updateStatus", () => {
    it("met à jour le statut si le recruteur est propriétaire de l'offre", async () => {
      mockPrisma.application.findUnique.mockResolvedValueOnce(baseApplication);
      mockJobsClient.send.mockReturnValueOnce(of(baseOffer));
      const updated = {
        ...baseApplication,
        status: ApplicationStatus.INTERVIEW,
      };
      mockPrisma.$transaction.mockResolvedValueOnce([updated]);

      const result = await service.updateStatus("app-1", "recruiter-1", {
        status: ApplicationStatus.INTERVIEW,
      });

      expect(result.status).toBe(ApplicationStatus.INTERVIEW);
    });

    it("écrit un ApplicationEvent avec la note et actorRole RECRUITER", async () => {
      mockPrisma.application.findUnique.mockResolvedValueOnce(baseApplication);
      mockJobsClient.send.mockReturnValueOnce(of(baseOffer));
      mockPrisma.$transaction.mockImplementationOnce((ops: unknown) =>
        Promise.all(ops as Promise<unknown>[]),
      );

      await service.updateStatus("app-1", "recruiter-1", {
        status: ApplicationStatus.REJECTED,
        note: "Profil non retenu",
      });

      expect(mockPrisma.applicationEvent.create).toHaveBeenCalledWith({
        data: {
          applicationId: "app-1",
          status: ApplicationStatus.REJECTED,
          actorRole: "RECRUITER",
          actorId: "recruiter-1",
          note: "Profil non retenu",
        },
      });
    });

    it("émet un OutboxEvent application.status.changed", async () => {
      mockPrisma.application.findUnique.mockResolvedValueOnce(baseApplication);
      mockJobsClient.send.mockReturnValueOnce(of(baseOffer));
      mockPrisma.$transaction.mockImplementationOnce((ops: unknown) =>
        Promise.all(ops as Promise<unknown>[]),
      );

      await service.updateStatus("app-1", "recruiter-1", {
        status: ApplicationStatus.INTERVIEW,
      });

      expect(mockPrisma.outboxEvent.create).toHaveBeenCalledWith({
        data: {
          type: "application.status.changed",
          payload: {
            applicationId: "app-1",
            developerId: "dev-1",
            status: ApplicationStatus.INTERVIEW,
          },
        },
      });
    });

    it("lance RpcException 403 si le recruteur n'est pas propriétaire de l'offre", async () => {
      mockPrisma.application.findUnique.mockResolvedValueOnce(baseApplication);
      mockJobsClient.send.mockReturnValueOnce(of(baseOffer));
      await expect(
        service.updateStatus("app-1", "autre-recruteur", {
          status: ApplicationStatus.INTERVIEW,
        }),
      ).rejects.toThrow(RpcException);
    });

    it("lance RpcException 400 si la candidature est déjà dans un état terminal", async () => {
      mockPrisma.application.findUnique.mockResolvedValueOnce({
        ...baseApplication,
        status: ApplicationStatus.ACCEPTED,
      });
      mockJobsClient.send.mockReturnValueOnce(of(baseOffer));
      await expect(
        service.updateStatus("app-1", "recruiter-1", {
          status: ApplicationStatus.REJECTED,
        }),
      ).rejects.toThrow(RpcException);
    });

    it("lance RpcException 400 si le statut cible est WITHDRAWN", async () => {
      mockPrisma.application.findUnique.mockResolvedValueOnce(baseApplication);
      mockJobsClient.send.mockReturnValueOnce(of(baseOffer));
      await expect(
        service.updateStatus("app-1", "recruiter-1", {
          status: ApplicationStatus.WITHDRAWN,
        }),
      ).rejects.toThrow(RpcException);
    });

    it("lance RpcException 404 si la candidature est introuvable", async () => {
      mockPrisma.application.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.updateStatus("unknown", "recruiter-1", {
          status: ApplicationStatus.INTERVIEW,
        }),
      ).rejects.toThrow(RpcException);
    });

    it("lance RpcException 400 si ACCEPTED est demandé sans entretien préalable", async () => {
      mockPrisma.application.findUnique.mockResolvedValueOnce({
        ...baseApplication,
        status: ApplicationStatus.VIEWED,
      });
      mockJobsClient.send.mockReturnValueOnce(of(baseOffer));
      await expect(
        service.updateStatus("app-1", "recruiter-1", {
          status: ApplicationStatus.ACCEPTED,
        }),
      ).rejects.toThrow(RpcException);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it("autorise ACCEPTED si le statut actuel est INTERVIEW", async () => {
      mockPrisma.application.findUnique.mockResolvedValueOnce({
        ...baseApplication,
        status: ApplicationStatus.INTERVIEW,
      });
      mockJobsClient.send.mockReturnValueOnce(of(baseOffer));
      const accepted = {
        ...baseApplication,
        status: ApplicationStatus.ACCEPTED,
      };
      mockPrisma.$transaction.mockResolvedValueOnce([accepted]);

      const result = await service.updateStatus("app-1", "recruiter-1", {
        status: ApplicationStatus.ACCEPTED,
      });

      expect(result.status).toBe(ApplicationStatus.ACCEPTED);
    });

    it("persiste interviewMode et interviewLocation au passage en INTERVIEW", async () => {
      mockPrisma.application.findUnique.mockResolvedValueOnce(baseApplication);
      mockJobsClient.send.mockReturnValueOnce(of(baseOffer));
      mockPrisma.$transaction.mockImplementationOnce((ops: unknown) =>
        Promise.all(ops as Promise<unknown>[]),
      );

      await service.updateStatus("app-1", "recruiter-1", {
        status: ApplicationStatus.INTERVIEW,
        interviewMode: InterviewMode.REMOTE,
        interviewLocation: "https://meet.jit.si/abc-def-ghi",
      });

      expect(mockPrisma.application.update).toHaveBeenCalledWith({
        where: { id: "app-1" },
        data: {
          status: ApplicationStatus.INTERVIEW,
          interviewMode: InterviewMode.REMOTE,
          interviewLocation: "https://meet.jit.si/abc-def-ghi",
        },
      });
    });

    it("construit une note d'entretien composée dans l'historique (distanciel)", async () => {
      mockPrisma.application.findUnique.mockResolvedValueOnce(baseApplication);
      mockJobsClient.send.mockReturnValueOnce(of(baseOffer));
      mockPrisma.$transaction.mockImplementationOnce((ops: unknown) =>
        Promise.all(ops as Promise<unknown>[]),
      );

      await service.updateStatus("app-1", "recruiter-1", {
        status: ApplicationStatus.INTERVIEW,
        interviewMode: InterviewMode.REMOTE,
        interviewLocation: "https://meet.jit.si/abc-def-ghi",
      });

      expect(mockPrisma.applicationEvent.create).toHaveBeenCalledWith({
        data: {
          applicationId: "app-1",
          status: ApplicationStatus.INTERVIEW,
          actorRole: "RECRUITER",
          actorId: "recruiter-1",
          note: "Entretien en distanciel — lien : https://meet.jit.si/abc-def-ghi",
        },
      });
    });

    it("ne modifie pas interviewMode/interviewLocation pour un statut autre que INTERVIEW", async () => {
      mockPrisma.application.findUnique.mockResolvedValueOnce(baseApplication);
      mockJobsClient.send.mockReturnValueOnce(of(baseOffer));
      mockPrisma.$transaction.mockImplementationOnce((ops: unknown) =>
        Promise.all(ops as Promise<unknown>[]),
      );

      await service.updateStatus("app-1", "recruiter-1", {
        status: ApplicationStatus.REJECTED,
      });

      expect(mockPrisma.application.update).toHaveBeenCalledWith({
        where: { id: "app-1" },
        data: { status: ApplicationStatus.REJECTED },
      });
    });
  });

  // ── withdraw ─────────────────────────────────────────────────────────────

  describe("withdraw", () => {
    it("retire la candidature si le développeur en est propriétaire", async () => {
      mockPrisma.application.findUnique.mockResolvedValueOnce(baseApplication);
      const withdrawn = {
        ...baseApplication,
        status: ApplicationStatus.WITHDRAWN,
      };
      mockPrisma.$transaction.mockResolvedValueOnce([withdrawn]);

      const result = await service.withdraw("app-1", "dev-1");

      expect(result.status).toBe(ApplicationStatus.WITHDRAWN);
    });

    it("écrit un ApplicationEvent WITHDRAWN avec actorRole DEVELOPER", async () => {
      mockPrisma.application.findUnique.mockResolvedValueOnce(baseApplication);
      mockPrisma.$transaction.mockImplementationOnce((ops: unknown) =>
        Promise.all(ops as Promise<unknown>[]),
      );

      await service.withdraw("app-1", "dev-1");

      expect(mockPrisma.applicationEvent.create).toHaveBeenCalledWith({
        data: {
          applicationId: "app-1",
          status: ApplicationStatus.WITHDRAWN,
          actorRole: "DEVELOPER",
          actorId: "dev-1",
          note: null,
        },
      });
    });

    it("lance RpcException 403 si le développeur n'est pas propriétaire", async () => {
      mockPrisma.application.findUnique.mockResolvedValueOnce(baseApplication);
      await expect(service.withdraw("app-1", "autre-dev")).rejects.toThrow(
        RpcException,
      );
    });

    it("lance RpcException 400 si déjà dans un état terminal", async () => {
      mockPrisma.application.findUnique.mockResolvedValueOnce({
        ...baseApplication,
        status: ApplicationStatus.REJECTED,
      });
      await expect(service.withdraw("app-1", "dev-1")).rejects.toThrow(
        RpcException,
      );
    });

    it("lance RpcException 404 si la candidature est introuvable", async () => {
      mockPrisma.application.findUnique.mockResolvedValueOnce(null);
      await expect(service.withdraw("unknown", "dev-1")).rejects.toThrow(
        RpcException,
      );
    });
  });

  // ── reactivate ───────────────────────────────────────────────────────────

  describe("reactivate", () => {
    const withdrawnApplication = {
      ...baseApplication,
      status: ApplicationStatus.WITHDRAWN,
    };

    it("réactive (repasse en SENT) une candidature retirée si l'offre est toujours publiée", async () => {
      mockPrisma.application.findUnique.mockResolvedValueOnce(
        withdrawnApplication,
      );
      mockJobsClient.send.mockReturnValueOnce(of(baseOffer));
      const reactivated = {
        ...withdrawnApplication,
        status: ApplicationStatus.SENT,
      };
      mockPrisma.$transaction.mockResolvedValueOnce([reactivated]);

      const result = await service.reactivate("app-1", "dev-1");

      expect(result.status).toBe(ApplicationStatus.SENT);
    });

    it("écrit un ApplicationEvent SENT avec actorRole DEVELOPER", async () => {
      mockPrisma.application.findUnique.mockResolvedValueOnce(
        withdrawnApplication,
      );
      mockJobsClient.send.mockReturnValueOnce(of(baseOffer));
      mockPrisma.$transaction.mockImplementationOnce((ops: unknown) =>
        Promise.all(ops as Promise<unknown>[]),
      );

      await service.reactivate("app-1", "dev-1");

      expect(mockPrisma.applicationEvent.create).toHaveBeenCalledWith({
        data: {
          applicationId: "app-1",
          status: ApplicationStatus.SENT,
          actorRole: "DEVELOPER",
          actorId: "dev-1",
          note: null,
        },
      });
    });

    it("lance RpcException 403 si le développeur n'est pas propriétaire", async () => {
      mockPrisma.application.findUnique.mockResolvedValueOnce(
        withdrawnApplication,
      );
      await expect(service.reactivate("app-1", "autre-dev")).rejects.toThrow(
        RpcException,
      );
    });

    it("lance RpcException 404 si la candidature est introuvable", async () => {
      mockPrisma.application.findUnique.mockResolvedValueOnce(null);
      await expect(service.reactivate("unknown", "dev-1")).rejects.toThrow(
        RpcException,
      );
    });

    it.each(["SENT", "VIEWED", "INTERVIEW", "ACCEPTED", "REJECTED"])(
      "lance RpcException 400 si le statut n'est pas WITHDRAWN (%s)",
      async (status) => {
        mockPrisma.application.findUnique.mockResolvedValueOnce({
          ...baseApplication,
          status,
        });
        await expect(service.reactivate("app-1", "dev-1")).rejects.toThrow(
          RpcException,
        );
      },
    );

    it("lance RpcException 400 si l'offre n'est plus publiée", async () => {
      mockPrisma.application.findUnique.mockResolvedValueOnce(
        withdrawnApplication,
      );
      mockJobsClient.send.mockReturnValueOnce(
        of({ ...baseOffer, status: JobStatus.ARCHIVED }),
      );
      await expect(service.reactivate("app-1", "dev-1")).rejects.toThrow(
        RpcException,
      );
    });
  });

  // ── getHistory ───────────────────────────────────────────────────────────

  describe("getHistory", () => {
    const events = [
      {
        id: "evt-1",
        applicationId: "app-1",
        status: ApplicationStatus.SENT,
        actorRole: "DEVELOPER",
        actorId: "dev-1",
        note: null,
        createdAt: new Date(),
      },
    ];

    it("retourne l'historique pour le développeur propriétaire", async () => {
      mockPrisma.application.findUnique.mockResolvedValueOnce(baseApplication);
      mockPrisma.applicationEvent.findMany.mockResolvedValueOnce(events);
      const result = await service.getHistory(
        "app-1",
        "dev-1",
        "DEVELOPER",
        false,
      );
      expect(result).toEqual(events);
    });

    it("retourne l'historique pour le recruteur propriétaire de l'offre", async () => {
      mockPrisma.application.findUnique.mockResolvedValueOnce(baseApplication);
      mockJobsClient.send.mockReturnValueOnce(of(baseOffer));
      mockPrisma.applicationEvent.findMany.mockResolvedValueOnce(events);
      const result = await service.getHistory(
        "app-1",
        "recruiter-1",
        "RECRUITER",
        false,
      );
      expect(result).toEqual(events);
    });

    it("retourne l'historique pour un admin sans vérifier l'ownership", async () => {
      mockPrisma.application.findUnique.mockResolvedValueOnce(baseApplication);
      mockPrisma.applicationEvent.findMany.mockResolvedValueOnce(events);
      const result = await service.getHistory(
        "app-1",
        "admin-1",
        "ADMIN",
        true,
      );
      expect(result).toEqual(events);
    });

    it("lance RpcException 403 si le développeur n'est pas propriétaire", async () => {
      mockPrisma.application.findUnique.mockResolvedValueOnce(baseApplication);
      await expect(
        service.getHistory("app-1", "autre-dev", "DEVELOPER", false),
      ).rejects.toThrow(RpcException);
    });

    it("lance RpcException 403 si le recruteur n'est pas propriétaire de l'offre", async () => {
      mockPrisma.application.findUnique.mockResolvedValueOnce(baseApplication);
      mockJobsClient.send.mockReturnValueOnce(of(baseOffer));
      await expect(
        service.getHistory("app-1", "autre-recruteur", "RECRUITER", false),
      ).rejects.toThrow(RpcException);
    });

    it("lance RpcException 404 si la candidature est introuvable", async () => {
      mockPrisma.application.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.getHistory("unknown", "dev-1", "DEVELOPER", false),
      ).rejects.toThrow(RpcException);
    });
  });

  // ── hasActiveApplicationsForJobOffer (appelé par jobs-svc) ─────────────────

  describe("hasActiveApplicationsForJobOffer", () => {
    it("retourne hasActive=true s'il existe une candidature SENT/VIEWED/INTERVIEW", async () => {
      mockPrisma.application.count.mockResolvedValueOnce(1);
      const result = await service.hasActiveApplicationsForJobOffer("job-1");
      expect(result).toEqual({ hasActive: true });
      expect(mockPrisma.application.count).toHaveBeenCalledWith({
        where: {
          jobOfferId: "job-1",
          status: {
            notIn: [
              ApplicationStatus.ACCEPTED,
              ApplicationStatus.REJECTED,
              ApplicationStatus.WITHDRAWN,
            ],
          },
        },
      });
    });

    it("retourne hasActive=false si aucune candidature active (ou aucune candidature)", async () => {
      mockPrisma.application.count.mockResolvedValueOnce(0);
      const result = await service.hasActiveApplicationsForJobOffer("job-1");
      expect(result).toEqual({ hasActive: false });
    });
  });

  // ── Pièces justificatives ────────────────────────────────────────────────

  const baseDocumentRequest = {
    id: "req-1",
    applicationId: "app-1",
    label: "CV",
    note: null,
    status: "PENDING",
    fileKey: null,
    fileName: null,
    createdAt: new Date(),
    fulfilledAt: null,
  };

  describe("createDocumentRequest", () => {
    it("crée une demande RECRUITER si le recruteur est propriétaire de l'offre", async () => {
      mockPrisma.application.findUnique.mockResolvedValueOnce(baseApplication);
      mockJobsClient.send.mockReturnValueOnce(of(baseOffer));
      mockPrisma.documentRequest.create.mockResolvedValueOnce(
        baseDocumentRequest,
      );

      const result = await service.createDocumentRequest(
        "app-1",
        "recruiter-1",
        "RECRUITER",
        { label: "CV" },
      );

      expect(result.label).toBe("CV");
      expect(mockPrisma.documentRequest.create).toHaveBeenCalledWith({
        data: {
          applicationId: "app-1",
          label: "CV",
          note: null,
          source: "RECRUITER",
        },
      });
    });

    it("lance RpcException 403 si le recruteur n'est pas propriétaire de l'offre", async () => {
      mockPrisma.application.findUnique.mockResolvedValueOnce(baseApplication);
      mockJobsClient.send.mockReturnValueOnce(of(baseOffer));
      await expect(
        service.createDocumentRequest("app-1", "autre-recruteur", "RECRUITER", {
          label: "CV",
        }),
      ).rejects.toThrow(RpcException);
    });

    it("lance RpcException 404 si la candidature est introuvable", async () => {
      mockPrisma.application.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.createDocumentRequest("unknown", "recruiter-1", "RECRUITER", {
          label: "CV",
        }),
      ).rejects.toThrow(RpcException);
    });

    it("crée une demande DEVELOPER si le développeur joint son propre document", async () => {
      mockPrisma.application.findUnique.mockResolvedValueOnce(baseApplication);
      mockPrisma.documentRequest.create.mockResolvedValueOnce({
        ...baseDocumentRequest,
        source: "DEVELOPER",
      });

      const result = await service.createDocumentRequest(
        "app-1",
        "dev-1",
        "DEVELOPER",
        { label: "Portfolio" },
      );

      expect(result.source).toBe("DEVELOPER");
      expect(mockPrisma.documentRequest.create).toHaveBeenCalledWith({
        data: {
          applicationId: "app-1",
          label: "Portfolio",
          note: null,
          source: "DEVELOPER",
        },
      });
      expect(mockJobsClient.send).not.toHaveBeenCalled();
    });

    it("lance RpcException 403 si le développeur n'est pas propriétaire de la candidature", async () => {
      mockPrisma.application.findUnique.mockResolvedValueOnce(baseApplication);
      await expect(
        service.createDocumentRequest("app-1", "autre-dev", "DEVELOPER", {
          label: "Portfolio",
        }),
      ).rejects.toThrow(RpcException);
    });

    it.each(["WITHDRAWN", "REJECTED", "ACCEPTED"])(
      "lance RpcException 400 si la candidature est %s",
      async (status) => {
        mockPrisma.application.findUnique.mockResolvedValueOnce({
          ...baseApplication,
          status,
        });
        await expect(
          service.createDocumentRequest("app-1", "dev-1", "DEVELOPER", {
            label: "Portfolio",
          }),
        ).rejects.toThrow(RpcException);
      },
    );

    it("lance RpcException 409 si un document de ce type existe déjà pour la candidature", async () => {
      mockPrisma.application.findUnique.mockResolvedValueOnce(baseApplication);
      mockPrisma.documentRequest.findFirst.mockResolvedValueOnce(
        baseDocumentRequest,
      );
      await expect(
        service.createDocumentRequest("app-1", "dev-1", "DEVELOPER", {
          label: "CV",
        }),
      ).rejects.toThrow(RpcException);
    });

    it("la vérification de doublon est insensible à la casse/aux espaces", async () => {
      mockPrisma.application.findUnique.mockResolvedValueOnce(baseApplication);
      mockPrisma.documentRequest.findFirst.mockResolvedValueOnce(
        baseDocumentRequest,
      );
      await expect(
        service.createDocumentRequest("app-1", "dev-1", "DEVELOPER", {
          label: "  cv  ",
        }),
      ).rejects.toThrow(RpcException);
      expect(mockPrisma.documentRequest.findFirst).toHaveBeenCalledWith({
        where: {
          applicationId: "app-1",
          label: { equals: "cv", mode: "insensitive" },
        },
      });
    });
  });

  describe("listDocumentRequests", () => {
    it("retourne les demandes pour le développeur propriétaire", async () => {
      mockPrisma.application.findUnique.mockResolvedValueOnce(baseApplication);
      mockPrisma.documentRequest.findMany.mockResolvedValueOnce([
        baseDocumentRequest,
      ]);
      const result = await service.listDocumentRequests(
        "app-1",
        "dev-1",
        "DEVELOPER",
      );
      expect(result).toHaveLength(1);
    });

    it("retourne les demandes pour le recruteur propriétaire de l'offre", async () => {
      mockPrisma.application.findUnique.mockResolvedValueOnce(baseApplication);
      mockJobsClient.send.mockReturnValueOnce(of(baseOffer));
      mockPrisma.documentRequest.findMany.mockResolvedValueOnce([
        baseDocumentRequest,
      ]);
      const result = await service.listDocumentRequests(
        "app-1",
        "recruiter-1",
        "RECRUITER",
      );
      expect(result).toHaveLength(1);
    });

    it("lance RpcException 403 si le développeur n'est pas propriétaire", async () => {
      mockPrisma.application.findUnique.mockResolvedValueOnce(baseApplication);
      await expect(
        service.listDocumentRequests("app-1", "autre-dev", "DEVELOPER"),
      ).rejects.toThrow(RpcException);
    });
  });

  describe("createUploadUrl", () => {
    it("génère un POST presigné pour le développeur propriétaire", async () => {
      mockPrisma.documentRequest.findUnique.mockResolvedValueOnce(
        baseDocumentRequest,
      );
      mockPrisma.application.findUnique.mockResolvedValueOnce(baseApplication);
      mockS3Service.createUploadPost.mockResolvedValueOnce({
        url: "https://s3.example.com/upload",
        fields: { key: "applications/app-1/req-1/cv.pdf" },
      });

      const result = await service.createUploadUrl("req-1", "dev-1", {
        fileName: "cv.pdf",
        contentType: "application/pdf",
        fileSize: 1024,
      });

      expect(result.uploadUrl).toBe("https://s3.example.com/upload");
      expect(result.fields).toEqual({
        key: "applications/app-1/req-1/cv.pdf",
      });
      expect(result.fileKey).toContain("applications/app-1/req-1/");
      expect(result.fileKey).toContain("cv.pdf");
      expect(mockS3Service.createUploadPost).toHaveBeenCalledWith(
        expect.stringContaining("applications/app-1/req-1/"),
        "application/pdf",
        10 * 1024 * 1024,
      );
    });

    it("lance RpcException 403 si le développeur n'est pas propriétaire", async () => {
      mockPrisma.documentRequest.findUnique.mockResolvedValueOnce(
        baseDocumentRequest,
      );
      mockPrisma.application.findUnique.mockResolvedValueOnce(baseApplication);
      await expect(
        service.createUploadUrl("req-1", "autre-dev", {
          fileName: "cv.pdf",
          contentType: "application/pdf",
          fileSize: 1024,
        }),
      ).rejects.toThrow(RpcException);
    });

    it("lance RpcException 404 si la demande est introuvable", async () => {
      mockPrisma.documentRequest.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.createUploadUrl("unknown", "dev-1", {
          fileName: "cv.pdf",
          contentType: "application/pdf",
          fileSize: 1024,
        }),
      ).rejects.toThrow(RpcException);
    });

    it("nettoie les caractères spéciaux du nom de fichier", async () => {
      mockPrisma.documentRequest.findUnique.mockResolvedValueOnce(
        baseDocumentRequest,
      );
      mockPrisma.application.findUnique.mockResolvedValueOnce(baseApplication);
      mockS3Service.createUploadPost.mockResolvedValueOnce({
        url: "https://s3.example.com/upload",
        fields: {},
      });

      const result = await service.createUploadUrl("req-1", "dev-1", {
        fileName: "mon cv (final).pdf",
        contentType: "application/pdf",
        fileSize: 1024,
      });

      expect(result.fileKey).not.toMatch(/[() ]/);
    });

    it.each(["WITHDRAWN", "REJECTED", "ACCEPTED"])(
      "lance RpcException 400 si la candidature est %s",
      async (status) => {
        mockPrisma.documentRequest.findUnique.mockResolvedValueOnce(
          baseDocumentRequest,
        );
        mockPrisma.application.findUnique.mockResolvedValueOnce({
          ...baseApplication,
          status,
        });
        await expect(
          service.createUploadUrl("req-1", "dev-1", {
            fileName: "cv.pdf",
            contentType: "application/pdf",
            fileSize: 1024,
          }),
        ).rejects.toThrow(RpcException);
      },
    );
  });

  describe("confirmUpload", () => {
    it("marque la demande FULFILLED avec fileKey/fileName", async () => {
      mockPrisma.documentRequest.findUnique.mockResolvedValueOnce(
        baseDocumentRequest,
      );
      mockPrisma.application.findUnique.mockResolvedValueOnce(baseApplication);
      const fulfilled = {
        ...baseDocumentRequest,
        status: "FULFILLED",
        fileKey: "applications/app-1/req-1/123-cv.pdf",
        fileName: "cv.pdf",
      };
      mockPrisma.documentRequest.update.mockResolvedValueOnce(fulfilled);

      const result = await service.confirmUpload("req-1", "dev-1", {
        fileKey: "applications/app-1/req-1/123-cv.pdf",
        fileName: "cv.pdf",
      });

      expect(result.status).toBe("FULFILLED");
      expect(mockPrisma.documentRequest.update).toHaveBeenCalledWith({
        where: { id: "req-1" },
        data: expect.objectContaining({
          status: "FULFILLED",
          fileKey: "applications/app-1/req-1/123-cv.pdf",
          fileName: "cv.pdf",
        }),
      });
    });

    it("lance RpcException 403 si le développeur n'est pas propriétaire", async () => {
      mockPrisma.documentRequest.findUnique.mockResolvedValueOnce(
        baseDocumentRequest,
      );
      mockPrisma.application.findUnique.mockResolvedValueOnce(baseApplication);
      await expect(
        service.confirmUpload("req-1", "autre-dev", {
          fileKey: "x",
          fileName: "cv.pdf",
        }),
      ).rejects.toThrow(RpcException);
    });

    it.each(["WITHDRAWN", "REJECTED", "ACCEPTED"])(
      "lance RpcException 400 si la candidature est %s",
      async (status) => {
        mockPrisma.documentRequest.findUnique.mockResolvedValueOnce(
          baseDocumentRequest,
        );
        mockPrisma.application.findUnique.mockResolvedValueOnce({
          ...baseApplication,
          status,
        });
        await expect(
          service.confirmUpload("req-1", "dev-1", {
            fileKey: "x",
            fileName: "cv.pdf",
          }),
        ).rejects.toThrow(RpcException);
      },
    );
  });

  describe("getDownloadUrl", () => {
    const fulfilledRequest = {
      ...baseDocumentRequest,
      status: "FULFILLED",
      fileKey: "applications/app-1/req-1/123-cv.pdf",
      fileName: "cv.pdf",
    };

    it("génère une URL de téléchargement pour le développeur propriétaire", async () => {
      mockPrisma.documentRequest.findUnique.mockResolvedValueOnce(
        fulfilledRequest,
      );
      mockPrisma.application.findUnique.mockResolvedValueOnce(baseApplication);
      mockS3Service.createDownloadUrl.mockResolvedValueOnce(
        "https://s3.example.com/download",
      );

      const result = await service.getDownloadUrl(
        "req-1",
        "dev-1",
        "DEVELOPER",
      );

      expect(result.downloadUrl).toBe("https://s3.example.com/download");
      expect(result.fileName).toBe("cv.pdf");
      expect(mockS3Service.createDownloadUrl).toHaveBeenCalledWith(
        "applications/app-1/req-1/123-cv.pdf",
        "cv.pdf",
        "attachment",
      );
    });

    it("transmet la disposition 'inline' demandée pour l'aperçu", async () => {
      mockPrisma.documentRequest.findUnique.mockResolvedValueOnce(
        fulfilledRequest,
      );
      mockPrisma.application.findUnique.mockResolvedValueOnce(baseApplication);
      mockS3Service.createDownloadUrl.mockResolvedValueOnce(
        "https://s3.example.com/preview",
      );

      await service.getDownloadUrl("req-1", "dev-1", "DEVELOPER", "inline");

      expect(mockS3Service.createDownloadUrl).toHaveBeenCalledWith(
        "applications/app-1/req-1/123-cv.pdf",
        "cv.pdf",
        "inline",
      );
    });

    it("génère une URL de téléchargement pour le recruteur propriétaire de l'offre", async () => {
      mockPrisma.documentRequest.findUnique.mockResolvedValueOnce(
        fulfilledRequest,
      );
      mockPrisma.application.findUnique.mockResolvedValueOnce(baseApplication);
      mockJobsClient.send.mockReturnValueOnce(of(baseOffer));
      mockS3Service.createDownloadUrl.mockResolvedValueOnce(
        "https://s3.example.com/download",
      );

      const result = await service.getDownloadUrl(
        "req-1",
        "recruiter-1",
        "RECRUITER",
      );

      expect(result.downloadUrl).toBe("https://s3.example.com/download");
    });

    it("lance RpcException 400 si aucun fichier n'a été déposé", async () => {
      mockPrisma.documentRequest.findUnique.mockResolvedValueOnce(
        baseDocumentRequest,
      );
      mockPrisma.application.findUnique.mockResolvedValueOnce(baseApplication);

      await expect(
        service.getDownloadUrl("req-1", "dev-1", "DEVELOPER"),
      ).rejects.toThrow(RpcException);
    });

    it("lance RpcException 403 si le développeur n'est pas propriétaire", async () => {
      mockPrisma.documentRequest.findUnique.mockResolvedValueOnce(
        fulfilledRequest,
      );
      mockPrisma.application.findUnique.mockResolvedValueOnce(baseApplication);
      await expect(
        service.getDownloadUrl("req-1", "autre-dev", "DEVELOPER"),
      ).rejects.toThrow(RpcException);
    });
  });

  describe("deleteDocument", () => {
    const fulfilledDeveloperDoc = {
      ...baseDocumentRequest,
      status: "FULFILLED",
      fileKey: "applications/app-1/req-1/123-cv.pdf",
      fileName: "cv.pdf",
      source: "DEVELOPER",
    };
    const fulfilledRecruiterDoc = {
      ...fulfilledDeveloperDoc,
      source: "RECRUITER",
    };

    it("supprime entièrement la demande si elle a été ajoutée par le développeur (source DEVELOPER)", async () => {
      mockPrisma.documentRequest.findUnique.mockResolvedValueOnce(
        fulfilledDeveloperDoc,
      );
      mockPrisma.application.findUnique.mockResolvedValueOnce(baseApplication);
      mockS3Service.deleteObject.mockResolvedValueOnce(undefined);
      mockPrisma.documentRequest.delete.mockResolvedValueOnce(
        fulfilledDeveloperDoc,
      );

      const result = await service.deleteDocument("req-1", "dev-1");

      expect(mockS3Service.deleteObject).toHaveBeenCalledWith(
        "applications/app-1/req-1/123-cv.pdf",
      );
      expect(mockPrisma.documentRequest.delete).toHaveBeenCalledWith({
        where: { id: "req-1" },
      });
      expect(result).toEqual({ removed: true, requestId: "req-1" });
    });

    it("remet la demande en PENDING (sans la supprimer) si elle a été demandée par le recruteur (source RECRUITER)", async () => {
      mockPrisma.documentRequest.findUnique.mockResolvedValueOnce(
        fulfilledRecruiterDoc,
      );
      mockPrisma.application.findUnique.mockResolvedValueOnce(baseApplication);
      mockS3Service.deleteObject.mockResolvedValueOnce(undefined);
      mockPrisma.documentRequest.update.mockResolvedValueOnce({
        ...fulfilledRecruiterDoc,
        status: "PENDING",
        fileKey: null,
        fileName: null,
        fulfilledAt: null,
      });

      const result = await service.deleteDocument("req-1", "dev-1");

      expect(mockS3Service.deleteObject).toHaveBeenCalledWith(
        "applications/app-1/req-1/123-cv.pdf",
      );
      expect(mockPrisma.documentRequest.update).toHaveBeenCalledWith({
        where: { id: "req-1" },
        data: {
          status: "PENDING",
          fileKey: null,
          fileName: null,
          fulfilledAt: null,
        },
      });
      expect(mockPrisma.documentRequest.delete).not.toHaveBeenCalled();
      expect(result).toMatchObject({ status: "PENDING", fileKey: null });
    });

    it("lance RpcException 400 si aucun fichier n'a été déposé", async () => {
      mockPrisma.documentRequest.findUnique.mockResolvedValueOnce(
        baseDocumentRequest,
      );
      mockPrisma.application.findUnique.mockResolvedValueOnce(baseApplication);

      await expect(service.deleteDocument("req-1", "dev-1")).rejects.toThrow(
        RpcException,
      );
    });

    it("lance RpcException 403 si le développeur n'est pas propriétaire de la candidature", async () => {
      mockPrisma.documentRequest.findUnique.mockResolvedValueOnce(
        fulfilledDeveloperDoc,
      );
      mockPrisma.application.findUnique.mockResolvedValueOnce(baseApplication);

      await expect(
        service.deleteDocument("req-1", "autre-dev"),
      ).rejects.toThrow(RpcException);
    });
  });
});
